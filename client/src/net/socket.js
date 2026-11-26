// Вся работа с сервером — через этот файл. Сцены не создают свои сокеты.
import { io } from 'socket.io-client';
import { EVENTS } from '../../../shared/events.js';

// Адрес сервера: из client/.env (VITE_SERVER_URL) или тот же компьютер, порт 3000.
// Благодаря location.hostname друзья в одной Wi-Fi сети подключаются к твоему серверу автоматически.
const SERVER_URL = import.meta.env.VITE_SERVER_URL || `${location.protocol}//${location.hostname}:3000`;

export const socket = io(SERVER_URL);

// Общее состояние клиента: кто я и в какой комнате
export const session = {
  myId: null,
  code: null,
  room: null, // последний room_update
};

export function resetSession() {
  session.myId = null;
  session.code = null;
  session.room = null;
}

// Глобальные подписки: держат session актуальной, какая бы сцена ни была открыта.
// Регистрируются раньше подписок сцен, поэтому сцены всегда видят свежие данные.
socket.on(EVENTS.ROOM_JOINED, ({ code, you }) => {
  session.code = code;
  session.myId = you;
});
socket.on(EVENTS.ROOM_UPDATE, (room) => {
  session.room = room;
});
// Связь пропала (например, сервер перезапустился) — комнаты больше нет
socket.on('disconnect', resetSession);

// Хелпер для сцен: подписка, которая сама снимается при выходе из сцены
export function listen(scene, event, handler) {
  socket.on(event, handler);
  scene.events.once('shutdown', () => socket.off(event, handler));
}
