// Сквозная проверка сервера с несколькими «ботами».
// Запуск: сначала `npm run dev -w server` (или `npm start -w server`), потом `npm run test:e2e`
import { io } from 'socket.io-client';
import { EVENTS } from '../shared/events.js';

const URL = process.env.SERVER_URL || 'http://localhost:3000';
const connect = () => io(URL, { forceNew: true, transports: ['websocket'] });
const once = (s, ev) =>
  new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`timeout waiting ${ev}`)), 3000);
    s.once(ev, (d) => {
      clearTimeout(t);
      res(d);
    });
  });
// Ждём событие, удовлетворяющее условию (старые обновления пропускаем)
const waitFor = (s, ev, pred) =>
  new Promise((res, rej) => {
    const t = setTimeout(() => {
      s.off(ev, h);
      rej(new Error(`timeout waiting ${ev}`));
    }, 3000);
    const h = (d) => {
      if (pred(d)) {
        clearTimeout(t);
        s.off(ev, h);
        res(d);
      }
    };
    s.on(ev, h);
  });
const check = (cond, msg) => {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('  ✔', msg);
};

const [a, b, c] = [connect(), connect(), connect()];
try {
  await Promise.all([a, b, c].map((s) => once(s, 'connect')));

  a.emit(EVENTS.CREATE_ROOM, { name: 'Alice' });
  const { code } = await once(a, EVENTS.ROOM_JOINED);
  check(/^[A-Z2-9]{4}$/.test(code), `комната создана: ${code}`);

  const bUpdate = once(b, EVENTS.ROOM_UPDATE);
  b.emit(EVENTS.JOIN_ROOM, { code, name: 'Bob' });
  check((await bUpdate).players.length === 2, 'Bob вошёл, в комнате 2 игрока');

  const aUpdate = waitFor(a, EVENTS.ROOM_UPDATE, (r) => r.players.length === 3);
  c.emit(EVENTS.JOIN_ROOM, { code, name: 'Carl' });
  check(
    (await aUpdate).players.some((p) => p.name === 'Carl'),
    'Alice видит, что зашёл Carl',
  );

  c.emit(EVENTS.JOIN_ROOM, { code: 'ZZZZ', name: 'X' });
  check(!!(await once(c, EVENTS.ERROR_MSG)).message, 'повторный/неверный вход → ошибка');

  const moved = once(b, EVENTS.PLAYER_MOVED);
  a.emit(EVENTS.MOVE, { x: 100, y: 120 });
  const m = await moved;
  check(m.x === 100 && m.y === 120, 'Bob получил движение Alice');

  b.emit(EVENTS.START_GAME);
  check(/хост/.test((await once(b, EVENTS.ERROR_MSG)).message), 'не-хост не может начать игру');

  const afterLeave = waitFor(b, EVENTS.ROOM_UPDATE, (r) => r.players.length === 2);
  a.disconnect();
  const room = await afterLeave;
  check(room.players.length === 2 && room.hostId === b.id, 'Alice ушла → хост перешёл к Bob');

  const started = once(c, EVENTS.GAME_STARTED);
  b.emit(EVENTS.START_GAME);
  await started;
  check(true, 'новый хост начал игру, все получили game_started');

  console.log('\nВсе проверки пройдены ✅');
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  [a, b, c].forEach((s) => s.disconnect());
}
