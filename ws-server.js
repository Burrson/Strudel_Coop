console.log("WS SERVER FILE EXECUTED");
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 1234 });

// roomId → Set<ws>
const rooms = new Map();

wss.on('connection', (ws) => {
  let roomId = null;

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());

    if (msg.type === 'join') {
      roomId = msg.room;

      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
      }

      rooms.get(roomId).add(ws);
      return;
    }

    if (msg.type === 'code' && roomId) {
      for (const client of rooms.get(roomId)) {
        if (client !== ws && client.readyState === 1) {
          client.send(JSON.stringify(msg));
        }
      }
    }
  });

  ws.on('close', () => {
    if (roomId && rooms.has(roomId)) {
      rooms.get(roomId).delete(ws);
    }
  });
});

console.log('WebSocket server running on ws://localhost:1234');
