// Временный персонаж-заглушка, нарисованный кодом (пока арт-участник не сделал спрайтшит).
// Персонаж БЕЛЫЙ — цвет игрока задаётся через sprite.setTint(hex).
//
// Когда будет готов настоящий PNG-спрайтшит (32x32 на кадр, кадры в ряд):
//   в preload(): this.load.spritesheet('crew', 'assets/crew.png', { frameWidth: 32, frameHeight: 32 });
//   и удали вызов createCrewTexture(). Анимации ниже останутся рабочими.

export const FRAME = 32;
// Кадры: 0-1 idle, 2-5 walk
const FRAMES = [
  { bob: 0, legs: [0, 0] },
  { bob: 1, legs: [0, 0] },
  { bob: 0, legs: [-3, 3] },
  { bob: -1, legs: [0, 0] },
  { bob: 0, legs: [3, -3] },
  { bob: -1, legs: [0, 0] },
];

export function createCrewTexture(scene) {
  if (scene.textures.exists('crew')) return;
  const tex = scene.textures.createCanvas('crew', FRAME * FRAMES.length, FRAME);
  const ctx = tex.getContext();

  FRAMES.forEach((f, i) => {
    const ox = i * FRAME;
    const y = f.bob;
    // рюкзак
    ctx.fillStyle = '#d9d9d9';
    roundRect(ctx, ox + 4, 11 + y, 6, 12, 2);
    // тело
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, ox + 8, 5 + y, 16, 20, 7);
    // ноги
    roundRect(ctx, ox + 9 + f.legs[0], 22 + y, 6, 7, 2);
    roundRect(ctx, ox + 17 + f.legs[1], 22 + y, 6, 7, 2);
    // визор (светлый, при tint станет оттенком цвета игрока)
    ctx.fillStyle = '#cfe8ff';
    roundRect(ctx, ox + 14, 9 + y, 11, 7, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + 20, 10 + y, 3, 2);
    tex.add(i, 0, ox, 0, FRAME, FRAME);
  });
  tex.refresh();
}

export function createCrewAnims(scene) {
  if (scene.anims.exists('crew-idle')) return;
  scene.anims.create({
    key: 'crew-idle',
    frames: scene.anims.generateFrameNumbers('crew', { start: 0, end: 1 }),
    frameRate: 2,
    repeat: -1,
  });
  scene.anims.create({
    key: 'crew-walk',
    frames: scene.anims.generateFrameNumbers('crew', { start: 2, end: 5 }),
    frameRate: 10,
    repeat: -1,
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}
