import Phaser from 'phaser';
import { EVENTS, COLORS, ROOM_W, ROOM_H, PLAYER_SIZE } from '../../../shared/events.js';
import { socket, session, listen, resetSession } from '../net/socket.js';

const SPEED = 180; // пикселей в секунду
const SEND_INTERVAL = 66; // мс между отправками позиции (~15 раз в секунду)
const LERP = 0.2; // плавность движения чужих персонажей (0..1)
const colorHex = (id) => COLORS.find((c) => c.id === id)?.hex ?? 0xffffff;
const colorCss = (id) => '#' + colorHex(id).toString(16).padStart(6, '0');

// Комната ожидания: все игроки бегают по комнате, хост нажимает «Старт»
export class LobbyScene extends Phaser.Scene {
  constructor() {
    super('Lobby');
  }

  create() {
    this.players = new Map(); // id -> { sprite, label, target }
    this.lastSent = 0;
    this.lastPos = { x: 0, y: 0 };

    this.#drawRoom();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT');
    this.#buildPanel();

    // Комната уже пришла в room_update до старта сцены — рисуем её сразу
    if (session.room) this.#syncRoom(session.room);

    listen(this, EVENTS.ROOM_UPDATE, (room) => this.#syncRoom(room));
    listen(this, EVENTS.PLAYER_MOVED, ({ id, x, y }) => {
      const p = this.players.get(id);
      if (p) p.target = { x, y };
    });
    listen(this, EVENTS.GAME_STARTED, () => this.#showBanner('Игра началась!<br><small>Тут будет этап 2 🚀</small>'));
    listen(this, EVENTS.ERROR_MSG, ({ message }) => this.#showBanner(message, 2000));
    listen(this, 'disconnect', () => this.scene.start('Menu'));
  }

  update(time, delta) {
    this.#moveMe(time, delta);
    this.#moveOthers();
  }

  // ---------- движение ----------

  #moveMe(time, delta) {
    const me = this.players.get(session.myId);
    if (!me) return;
    const k = this.keys;
    let dx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let dy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    const moving = dx !== 0 || dy !== 0;

    if (moving) {
      const len = Math.hypot(dx, dy); // чтобы по диагонали не бегать быстрее
      const step = (SPEED * delta) / 1000;
      const half = PLAYER_SIZE / 2;
      me.sprite.x = Phaser.Math.Clamp(me.sprite.x + (dx / len) * step, half, ROOM_W - half);
      me.sprite.y = Phaser.Math.Clamp(me.sprite.y + (dy / len) * step, half, ROOM_H - half);
      if (dx !== 0) me.sprite.setFlipX(dx < 0);
    }
    this.#setAnim(me.sprite, moving);
    this.#placeLabel(me);

    // Отправляем позицию не чаще SEND_INTERVAL и только если она изменилась
    const { x, y } = me.sprite;
    if (time - this.lastSent > SEND_INTERVAL && (x !== this.lastPos.x || y !== this.lastPos.y)) {
      socket.emit(EVENTS.MOVE, { x: Math.round(x), y: Math.round(y) });
      this.lastSent = time;
      this.lastPos = { x, y };
    }
  }

  #moveOthers() {
    for (const [id, p] of this.players) {
      if (id === session.myId) continue;
      const dx = p.target.x - p.sprite.x;
      const dy = p.target.y - p.sprite.y;
      const moving = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5;
      p.sprite.x += dx * LERP;
      p.sprite.y += dy * LERP;
      if (Math.abs(dx) > 0.5) p.sprite.setFlipX(dx < 0);
      this.#setAnim(p.sprite, moving);
      this.#placeLabel(p);
    }
  }

  #setAnim(sprite, moving) {
    const key = moving ? 'crew-walk' : 'crew-idle';
    if (sprite.anims.currentAnim?.key !== key) sprite.play(key);
  }

  #placeLabel(p) {
    p.label.setPosition(p.sprite.x, p.sprite.y - PLAYER_SIZE * 1.2);
    p.sprite.setDepth(p.sprite.y); // кто ниже — тот рисуется поверх
    p.label.setDepth(10000);
  }

  // ---------- синхронизация с сервером ----------

  #syncRoom(room) {
    const ids = new Set(room.players.map((p) => p.id));

    // Удаляем ушедших
    for (const [id, p] of this.players) {
      if (!ids.has(id)) {
        p.sprite.destroy();
        p.label.destroy();
        this.players.delete(id);
      }
    }
    // Добавляем новых
    for (const data of room.players) {
      if (this.players.has(data.id)) continue;
      const sprite = this.add
        .sprite(data.x, data.y, 'crew')
        .setScale(2)
        .setTint(colorHex(data.color))
        .play('crew-idle');
      const label = this.add
        .text(data.x, data.y, data.name, { fontSize: '14px', fontFamily: 'system-ui', color: '#ffffff' })
        .setOrigin(0.5)
        .setStroke('#000000', 3);
      const p = { sprite, label, target: { x: data.x, y: data.y } };
      this.players.set(data.id, p);
      this.#placeLabel(p);
    }
    this.#renderPanel(room);
  }

  // ---------- интерфейс ----------

  #buildPanel() {
    const ui = document.getElementById('ui');
    ui.innerHTML = `
      <div class="lobby-panel">
        <div class="label">Код комнаты (нажми, чтобы скопировать)</div>
        <div class="code" id="room-code" title="Скопировать"></div>
        <div class="label" id="count"></div>
        <ul id="players"></ul>
        <button id="start">Старт</button>
        <div class="hint" id="hint"></div>
        <button id="leave" class="danger">Выйти</button>
      </div>`;
    document.getElementById('room-code').onclick = () => navigator.clipboard?.writeText(session.code).catch(() => {});
    document.getElementById('start').onclick = () => socket.emit(EVENTS.START_GAME);
    document.getElementById('leave').onclick = () => {
      socket.emit(EVENTS.LEAVE_ROOM);
      resetSession();
      this.scene.start('Menu');
    };
  }

  #renderPanel(room) {
    document.getElementById('room-code').textContent = room.code;
    document.getElementById('count').textContent = `Игроки: ${room.players.length} / 5`;

    const list = document.getElementById('players');
    list.innerHTML = '';
    for (const p of room.players) {
      const li = document.createElement('li');
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = colorCss(p.color);
      const name = document.createElement('span');
      name.textContent = p.name + (p.id === room.hostId ? ' 👑' : ''); // textContent — защита от HTML в нике
      li.append(dot, name);
      if (p.id === session.myId) {
        const me = document.createElement('span');
        me.className = 'me';
        me.textContent = '(ты)';
        li.append(me);
      }
      list.append(li);
    }

    const isHost = room.hostId === session.myId;
    const enough = room.players.length >= room.minPlayers;
    const startBtn = document.getElementById('start');
    startBtn.style.display = isHost ? '' : 'none';
    startBtn.disabled = !enough || room.state !== 'lobby';
    document.getElementById('hint').textContent =
      room.state !== 'lobby'
        ? 'Игра идёт'
        : isHost
          ? enough
            ? 'Можно начинать!'
            : `Ждём игроков (минимум ${room.minPlayers})`
          : 'Ждём, пока хост начнёт игру';
  }

  #showBanner(html, hideAfter) {
    document.querySelector('.banner')?.remove();
    const div = document.createElement('div');
    div.className = 'banner';
    div.innerHTML = html;
    document.getElementById('ui').append(div);
    if (hideAfter) setTimeout(() => div.remove(), hideAfter);
  }

  #drawRoom() {
    const g = this.add.graphics();
    // Пол плиткой
    for (let x = 0; x < ROOM_W; x += 40) {
      for (let y = 0; y < ROOM_H; y += 40) {
        g.fillStyle((x / 40 + y / 40) % 2 === 0 ? 0x2a3150 : 0x262c49, 1);
        g.fillRect(x, y, 40, 40);
      }
    }
    // Стены
    g.lineStyle(8, 0x4a5584, 1);
    g.strokeRoundedRect(4, 4, ROOM_W - 8, ROOM_H - 8, 16);
    // Стол в центре (декор)
    g.fillStyle(0x3b4470, 1);
    g.fillCircle(ROOM_W / 2, ROOM_H / 2, 46);
    g.lineStyle(3, 0x5b6699, 1);
    g.strokeCircle(ROOM_W / 2, ROOM_H / 2, 46);
    g.setDepth(-1);
    this.add
      .text(ROOM_W / 2, ROOM_H - 24, 'WASD / стрелки — ходить', { fontSize: '13px', color: '#7f8bb3' })
      .setOrigin(0.5);
  }
}
