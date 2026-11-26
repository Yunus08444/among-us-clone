// Единый контракт между клиентом и сервером.
// Меняешь событие здесь — оно меняется у всех. Не пиши строки событий руками в коде!

export const EVENTS = {
  // клиент → сервер
  CREATE_ROOM: 'create_room', // { name }
  JOIN_ROOM: 'join_room', // { code, name }
  LEAVE_ROOM: 'leave_room', // —
  START_GAME: 'start_game', // — (только хост)
  MOVE: 'move', // { x, y }

  // сервер → клиент
  ROOM_JOINED: 'room_joined', // { code, you: playerId }
  ROOM_UPDATE: 'room_update', // { code, hostId, state, players: [{ id, name, color, x, y }] }
  ERROR_MSG: 'error_msg', // { message }
  GAME_STARTED: 'game_started', // { code }
  PLAYER_MOVED: 'player_moved', // { id, x, y }
};

// Общие настройки игры
export const MAX_PLAYERS = 5;
export const MIN_PLAYERS = 2; // для теста в одиночку поставь 1
export const NAME_MAX_LEN = 12;
export const CODE_LEN = 4;

// Цвета игроков (hex для Phaser tint)
export const COLORS = [
  { id: 'red', hex: 0xe53935 },
  { id: 'blue', hex: 0x1e88e5 },
  { id: 'green', hex: 0x43a047 },
  { id: 'yellow', hex: 0xfdd835 },
  { id: 'purple', hex: 0x8e24aa },
];

// Размер комнаты ожидания (мира) в пикселях
export const ROOM_W = 800;
export const ROOM_H = 600;
export const PLAYER_SIZE = 32;
