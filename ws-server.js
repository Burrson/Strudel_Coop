import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';

const PORT = 1234;
const ROOMS_DIR = path.resolve('./rooms');

if (!fs.existsSync(ROOMS_DIR)) {
  fs.mkdirSync(ROOMS_DIR);
}

const wss = new WebSocketServer({ 
  port: PORT,
  //host: '::',
});

// roomId → { clients: Set<ws>, code: string }
const rooms = new Map();

function roomFile(roomId) {
  return path.join(ROOMS_DIR, `${roomId}.json`);
}

function loadRoom(roomId) {
  const file = roomFile(roomId);
  if (!fs.existsSync(file)) return null;

  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error('Failed to load room', roomId, e);
    return null;
  }
}

function saveRoom(roomId, code) {
  const file = roomFile(roomId);
  const data = {
    code,
    updatedAt: Date.now(),
  };
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

wss.on('connection', (ws) => {
  let roomId = null;

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());

    // JOIN ROOM
    if (msg.type === 'join') {
      roomId = msg.room;

      if (!rooms.has(roomId)) {
        const persisted = loadRoom(roomId);
        rooms.set(roomId, {
          clients: new Set(),
          code: persisted?.code ?? null,
        });
      }

      const room = rooms.get(roomId);
      room.clients.add(ws);

      console.log(`Client joined room "${roomId}"`);

      // Send persisted state to new client
      if (room.code) {
        ws.send(
          JSON.stringify({
            type: 'code',
            code: room.code,
          })
        );
      }

      return;
    }

    // CODE UPDATE
    if (msg.type === 'code' && roomId) {
      const room = rooms.get(roomId);
      room.code = msg.code;

      // Persist immediately
      saveRoom(roomId, msg.code);

      // Broadcast to others
      for (const client of room.clients) {
        if (client !== ws && client.readyState === 1) {
          client.send(
            JSON.stringify({
              type: 'code',
              code: msg.code,
            })
          );
        }
      }
    }
  });

  ws.on('close', () => {
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    room.clients.delete(ws);
    console.log(`Client left room "${roomId}"`);

    // Optional cleanup: keep room in memory, file already saved
    if (room.clients.size === 0) {
      console.log(`Room "${roomId}" is empty`);
    }
  });
});

console.log(`WebSocket server running on ws://localhost:${PORT}`);
