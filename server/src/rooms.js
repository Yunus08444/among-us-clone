// Логика комнат (лобби). Здесь НЕТ сокетов — только данные и правила.
// Так её легко тестировать и менять, не трогая сеть.

import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  NAME_MAX_LEN,
  CODE_LEN,
  COLORS,
  ROOM_W,
  ROOM_H,
  PLAYER_SIZE,
} from '../../shared/events.js';

// Без похожих символов O/0, I/1 — чтобы код было легко продиктовать
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class RoomError extends Error {}

export class RoomManager {
  constructor({ minPlayers = MIN_PLAYERS } = {}) {
    this.rooms = new Map(); // code -> room
    this.playerRoom = new Map(); // playerId (socket.id) -> code
    this.minPlayers = minPlayers;
  }

  // ---------- публичные методы ----------

  createRoom(playerId, rawName) {
    this.#ensureNotInRoom(playerId);
    const name = this.#validateName(rawName);
    const code = this.#generateCode();
    const room = { code, hostId: playerId, state: 'lobby', players: new Map() };
    this.rooms.set(code, room);
    const player = this.#addPlayer(room, playerId, name);
    return { room, player };
  }

  joinRoom(playerId, rawCode, rawName) {
    this.#ensureNotInRoom(playerId);
    const code = String(rawCode ?? '')
      .trim()
      .toUpperCase();
    const room = this.rooms.get(code);
    if (!room) throw new RoomError('Комната с таким кодом не найдена');
    if (room.state !== 'lobby') throw new RoomError('Игра в этой комнате уже началась');
    if (room.players.size >= MAX_PLAYERS) throw new RoomError(`Комната заполнена (максимум ${MAX_PLAYERS})`);
    const name = this.#validateName(rawName);
    const taken = [...room.players.values()].some((p) => p.name.toLowerCase() === name.toLowerCase());
    if (taken) throw new RoomError('Этот ник уже занят в комнате');
    const player = this.#addPlayer(room, playerId, name);
    return { room, player };
  }

  // Возвращает { code, room } — room = null, если комната удалена (стала пустой)
  leave(playerId) {
    const code = this.playerRoom.get(playerId);
    if (!code) return null;
    const room = this.rooms.get(code);
    this.playerRoom.delete(playerId);
    room.players.delete(playerId);

    if (room.players.size === 0) {
      this.rooms.delete(code);
      return { code, room: null };
    }
    // Хост ушёл — хостом становится следующий (самый ранний из оставшихся)
    if (room.hostId === playerId) {
      room.hostId = room.players.keys().next().value;
    }
    return { code, room };
  }

  startGame(playerId) {
    const room = this.getRoomOf(playerId);
    if (!room) throw new RoomError('Вы не в комнате');
    if (room.hostId !== playerId) throw new RoomError('Начать игру может только хост');
    if (room.state !== 'lobby') throw new RoomError('Игра уже идёт');
    if (room.players.size < this.minPlayers) {
      throw new RoomError(`Нужно минимум ${this.minPlayers} игрока`);
    }
    room.state = 'playing';
    return room;
  }

  // Сервер не доверяет клиенту: проверяем числа и не даём выйти за границы
  move(playerId, x, y) {
    const room = this.getRoomOf(playerId);
    if (!room) return null;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const half = PLAYER_SIZE / 2;
    const player = room.players.get(playerId);
    player.x = clamp(x, half, ROOM_W - half);
    player.y = clamp(y, half, ROOM_H - half);
    return { room, player };
  }

  getRoomOf(playerId) {
    const code = this.playerRoom.get(playerId);
    return code ? this.rooms.get(code) : null;
  }

  // То, что уходит клиентам в room_update
  serialize(room) {
    return {
      code: room.code,
      hostId: room.hostId,
      state: room.state,
      minPlayers: this.minPlayers,
      players: [...room.players.values()].map(({ id, name, color, x, y }) => ({ id, name, color, x, y })),
    };
  }

  // ---------- внутреннее ----------

  #addPlayer(room, playerId, name) {
    const used = new Set([...room.players.values()].map((p) => p.color));
    const color = COLORS.find((c) => !used.has(c.id)).id;
    // Ставим игроков по кругу вокруг центра комнаты
    const angle = (room.players.size / MAX_PLAYERS) * Math.PI * 2;
    const player = {
      id: playerId,
      name,
      color,
      x: Math.round(ROOM_W / 2 + Math.cos(angle) * 120),
      y: Math.round(ROOM_H / 2 + Math.sin(angle) * 120),
    };
    room.players.set(playerId, player);
    this.playerRoom.set(playerId, room.code);
    return player;
  }

  #validateName(rawName) {
    const name = String(rawName ?? '').trim();
    if (!name) throw new RoomError('Введите ник');
    if (name.length > NAME_MAX_LEN) throw new RoomError(`Ник не длиннее ${NAME_MAX_LEN} символов`);
    return name;
  }

  #ensureNotInRoom(playerId) {
    if (this.playerRoom.has(playerId)) throw new RoomError('Вы уже в комнате');
  }

  #generateCode() {
    let code;
    do {
      code = '';
      for (let i = 0; i < CODE_LEN; i++) {
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      }
    } while (this.rooms.has(code));
    return code;
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
