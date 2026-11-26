import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager, RoomError } from '../src/rooms.js';
import { MAX_PLAYERS, ROOM_W } from '../../shared/events.js';

test('создание комнаты: код из 4 символов, создатель — хост', () => {
  const rm = new RoomManager();
  const { room, player } = rm.createRoom('a', 'Yunus');
  assert.match(room.code, /^[A-Z2-9]{4}$/);
  assert.equal(room.hostId, 'a');
  assert.equal(player.color, 'red');
});

test('вход по коду (регистр не важен), цвета не повторяются', () => {
  const rm = new RoomManager();
  const { room } = rm.createRoom('a', 'A');
  const { player } = rm.joinRoom('b', room.code.toLowerCase(), 'B');
  assert.equal(player.color, 'blue');
  assert.equal(room.players.size, 2);
});

test('неверный код → ошибка', () => {
  const rm = new RoomManager();
  assert.throws(() => rm.joinRoom('b', 'ZZZZ', 'B'), RoomError);
});

test(`лимит ${MAX_PLAYERS} игроков`, () => {
  const rm = new RoomManager();
  const { room } = rm.createRoom('p0', 'P0');
  for (let i = 1; i < MAX_PLAYERS; i++) rm.joinRoom(`p${i}`, room.code, `P${i}`);
  assert.throws(() => rm.joinRoom('extra', room.code, 'Extra'), /заполнена/);
});

test('пустой, длинный и повторяющийся ник', () => {
  const rm = new RoomManager();
  assert.throws(() => rm.createRoom('a', '   '), /ник/i);
  assert.throws(() => rm.createRoom('a', 'x'.repeat(13)), /длиннее/);
  const { room } = rm.createRoom('a', 'Same');
  assert.throws(() => rm.joinRoom('b', room.code, 'same'), /занят/);
});

test('нельзя быть в двух комнатах сразу', () => {
  const rm = new RoomManager();
  rm.createRoom('a', 'A');
  assert.throws(() => rm.createRoom('a', 'A'), /уже в комнате/);
});

test('хост ушёл → хостом становится следующий', () => {
  const rm = new RoomManager();
  const { room } = rm.createRoom('a', 'A');
  rm.joinRoom('b', room.code, 'B');
  rm.joinRoom('c', room.code, 'C');
  const res = rm.leave('a');
  assert.equal(res.room.hostId, 'b');
});

test('последний вышел → комната удаляется', () => {
  const rm = new RoomManager();
  const { room } = rm.createRoom('a', 'A');
  const res = rm.leave('a');
  assert.equal(res.room, null);
  assert.equal(rm.rooms.has(room.code), false);
});

test('старт: только хост и минимум игроков, после старта войти нельзя', () => {
  const rm = new RoomManager({ minPlayers: 2 });
  const { room } = rm.createRoom('a', 'A');
  assert.throws(() => rm.startGame('a'), /минимум/);
  rm.joinRoom('b', room.code, 'B');
  assert.throws(() => rm.startGame('b'), /только хост/);
  rm.startGame('a');
  assert.equal(room.state, 'playing');
  assert.throws(() => rm.joinRoom('c', room.code, 'C'), /началась/);
});

test('движение: мусор игнорируется, координаты ограничены комнатой', () => {
  const rm = new RoomManager();
  rm.createRoom('a', 'A');
  assert.equal(rm.move('a', NaN, 5), null);
  const { player } = rm.move('a', 99999, -50);
  assert.equal(player.x, ROOM_W - 16);
  assert.equal(player.y, 16);
});
