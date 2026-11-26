// Точка входа сервера: Express + Socket.IO.
// Здесь только «провода»: принимаем события, вызываем RoomManager, рассылаем результат.

import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { EVENTS } from '../../shared/events.js';
import { RoomManager, RoomError } from './rooms.js';

const PORT = Number(process.env.PORT) || 3000;
const MIN_PLAYERS = process.env.MIN_PLAYERS ? Number(process.env.MIN_PLAYERS) : undefined;

const app = express();
app.get('/health', (_req, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });
const rooms = new RoomManager({ minPlayers: MIN_PLAYERS });

// Socket.IO-комнаты называем так же, как код лобби
const broadcastRoom = (room) => io.to(room.code).emit(EVENTS.ROOM_UPDATE, rooms.serialize(room));

io.on('connection', (socket) => {
  console.log(`+ connected ${socket.id}`);

  // Обёртка: любая RoomError уходит клиенту как error_msg, сервер не падает
  const on = (event, handler) =>
    socket.on(event, (payload = {}) => {
      try {
        handler(payload ?? {});
      } catch (err) {
        if (err instanceof RoomError) socket.emit(EVENTS.ERROR_MSG, { message: err.message });
        else console.error(err);
      }
    });

  on(EVENTS.CREATE_ROOM, ({ name }) => {
    const { room, player } = rooms.createRoom(socket.id, name);
    socket.join(room.code);
    socket.emit(EVENTS.ROOM_JOINED, { code: room.code, you: player.id });
    broadcastRoom(room);
    console.log(`  room ${room.code} created by ${player.name}`);
  });

  on(EVENTS.JOIN_ROOM, ({ code, name }) => {
    const { room, player } = rooms.joinRoom(socket.id, code, name);
    socket.join(room.code);
    socket.emit(EVENTS.ROOM_JOINED, { code: room.code, you: player.id });
    broadcastRoom(room);
    console.log(`  ${player.name} joined ${room.code}`);
  });

  on(EVENTS.START_GAME, () => {
    const room = rooms.startGame(socket.id);
    io.to(room.code).emit(EVENTS.GAME_STARTED, { code: room.code });
    broadcastRoom(room);
    console.log(`  room ${room.code} started`);
  });

  on(EVENTS.MOVE, ({ x, y }) => {
    const res = rooms.move(socket.id, Number(x), Number(y));
    if (!res) return;
    // Отправляем всем в комнате, кроме самого игрока
    socket.to(res.room.code).emit(EVENTS.PLAYER_MOVED, { id: res.player.id, x: res.player.x, y: res.player.y });
  });

  const leave = () => {
    const res = rooms.leave(socket.id);
    if (!res) return;
    socket.leave(res.code);
    if (res.room) broadcastRoom(res.room);
  };

  on(EVENTS.LEAVE_ROOM, leave);
  socket.on('disconnect', () => {
    leave();
    console.log(`- disconnected ${socket.id}`);
  });
});

httpServer.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
