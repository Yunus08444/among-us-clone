import Phaser from 'phaser';
import { EVENTS, NAME_MAX_LEN } from '../../../shared/events.js';
import { socket, session, listen } from '../net/socket.js';
import { createCrewTexture, createCrewAnims } from '../game/crewSprite.js';

// Главное меню: ник + «Создать лобби» / «Войти по коду»
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    createCrewTexture(this);
    createCrewAnims(this);
    this.#drawStars();

    const ui = document.getElementById('ui');
    ui.innerHTML = `
      <div class="menu">
        <h1>AMONG US CLONE</h1>
        <input id="name" placeholder="Твой ник" maxlength="${NAME_MAX_LEN}" autocomplete="off" />
        <button id="create">Создать лобби</button>
        <div class="divider">или войти по коду</div>
        <div class="row">
          <input id="code" placeholder="КОД" maxlength="4" autocomplete="off" />
          <button id="join" class="secondary" style="flex:1">Войти</button>
        </div>
        <div class="error" id="error"></div>
        <div class="status" id="status"></div>
      </div>`;

    const $ = (id) => document.getElementById(id);
    const nameInput = $('name');
    nameInput.value = localStorageGet('nickname');
    nameInput.focus();

    const showError = (msg) => ($('error').textContent = msg);
    const getName = () => {
      const name = nameInput.value.trim();
      if (!name) {
        showError('Введите ник');
        return null;
      }
      localStorageSet('nickname', name);
      return name;
    };

    $('create').onclick = () => {
      const name = getName();
      if (name) socket.emit(EVENTS.CREATE_ROOM, { name });
    };
    $('join').onclick = () => {
      const name = getName();
      const code = $('code').value.trim().toUpperCase();
      if (!name) return;
      if (code.length !== 4) return showError('Код комнаты — 4 символа');
      socket.emit(EVENTS.JOIN_ROOM, { code, name });
    };
    $('code').addEventListener('keydown', (e) => e.key === 'Enter' && $('join').click());
    nameInput.addEventListener('keydown', (e) => e.key === 'Enter' && $('create').click());

    // Статус соединения с сервером
    const updateStatus = () =>
      ($('status').textContent = socket.connected ? '● подключено к серверу' : '○ нет связи с сервером...');
    updateStatus();
    listen(this, 'connect', updateStatus);
    listen(this, 'disconnect', updateStatus);

    listen(this, EVENTS.ERROR_MSG, ({ message }) => showError(message));
    // Сервер прислал состояние комнаты — значит, мы внутри. Переходим в лобби.
    listen(this, EVENTS.ROOM_UPDATE, () => {
      if (session.myId) this.scene.start('Lobby');
    });
  }

  #drawStars() {
    const g = this.add.graphics();
    for (let i = 0; i < 120; i++) {
      g.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.2, 0.9));
      g.fillCircle(Phaser.Math.Between(0, 800), Phaser.Math.Between(0, 600), Phaser.Math.FloatBetween(0.5, 1.6));
    }
    // Плавающий персонаж для атмосферы
    const crew = this.add.sprite(130, 470, 'crew').setScale(3).setTint(0xe53935).play('crew-idle');
    this.tweens.add({ targets: crew, y: 450, angle: 15, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }
}

// localStorage может быть недоступен — не ломаем игру из-за этого
function localStorageGet(key) {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}
function localStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
