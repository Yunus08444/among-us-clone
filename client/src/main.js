import Phaser from 'phaser';
import { ROOM_W, ROOM_H } from '../../shared/events.js';
import { MenuScene } from './scenes/MenuScene.js';
import { LobbyScene } from './scenes/LobbyScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: ROOM_W,
  height: ROOM_H,
  backgroundColor: '#141a2e',
  pixelArt: true,
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [MenuScene, LobbyScene],
});
