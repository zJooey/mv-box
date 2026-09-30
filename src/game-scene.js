import * as Phaser from 'phaser';

const themes = [
  { floor: 0x606b7c, floorAlt: 0x5c6677, wall: 0x171923, wallTop: 0x3e4655, wallEdge: 0xa8aeb7, goal: 0x2fc9ad, background: 0x171b2b },
  { floor: 0x6c6476, floorAlt: 0x696173, wall: 0x1a1520, wallTop: 0x494054, wallEdge: 0xb2a4b8, goal: 0x39c7ab, background: 0x241b2b },
  { floor: 0x657379, floorAlt: 0x627076, wall: 0x151e25, wallTop: 0x3e535b, wallEdge: 0xa8bcc0, goal: 0x3bd0a9, background: 0x141d31 }
];

export class GameScene extends Phaser.Scene {
  constructor() {
    super('game');
    this.level = null;
    this.ready = false;
    this.boxSprites = new Map();
  }

  create() {
    this.ready = true;
    if (this.level) this.drawLevel();
  }

  setLevel(level) {
    this.level = level;
    if (this.ready) this.drawLevel();
  }

  cellPosition(index) {
    const x = index % this.level.width;
    const y = Math.floor(index / this.level.width);
    return { x: this.originX + x * this.cell + this.cell / 2, y: this.originY + y * this.cell + this.cell / 2 };
  }

  drawLevel() {
    this.tweens.killAll();
    this.children.removeAll(true);
    this.boxSprites.clear();
    const chapter = Math.min(2, Math.floor((this.level.id - 1) / 12));
    const theme = themes[chapter];
    this.cell = Math.floor(630 / Math.max(this.level.width, this.level.height));
    this.originX = (720 - this.level.width * this.cell) / 2;
    this.originY = (720 - this.level.height * this.cell) / 2;

    const backdrop = this.add.graphics();
    backdrop.fillStyle(theme.background, 1);
    backdrop.fillRect(0, 0, 720, 720);
    backdrop.fillStyle(0x71809a, 0.15);
    for (let i = 0; i < 32; i++) {
      const x = (i * 137 + 43) % 720;
      const y = (i * 193 + 61) % 720;
      backdrop.fillRect(x, y, 3, 3);
    }
    backdrop.fillStyle(0x090c17, 1);
    backdrop.fillRect(this.originX - 14, this.originY - 14, this.cell * this.level.width + 28, this.cell * this.level.height + 28);
    backdrop.fillStyle(theme.wallEdge, 1);
    backdrop.fillRect(this.originX - 9, this.originY - 9, this.cell * this.level.width + 18, this.cell * this.level.height + 18);

    const board = this.add.graphics();
    const wallSet = new Set(this.level.walls);
    const goalSet = new Set(this.level.goals);
    for (let index = 0; index < this.level.width * this.level.height; index++) {
      const { x, y } = this.cellPosition(index);
      const left = x - this.cell / 2;
      const top = y - this.cell / 2;
      if (wallSet.has(index)) {
        // 墙体比暗色地板更深，并用顶部高光与砖缝强化轮廓。
        board.fillStyle(0x171522, 1);
        board.fillRect(left, top, this.cell, this.cell);
        board.fillStyle(theme.wall, 1);
        board.fillRect(left + 3, top + 3, this.cell - 6, this.cell - 6);
        board.fillStyle(theme.wallTop, 1);
        board.fillRect(left + 4, top + 4, this.cell - 8, 8);
        board.fillStyle(theme.wallEdge, 1);
        board.fillRect(left + 4, top + 4, 6, this.cell - 8);
        board.fillStyle(theme.wallTop, 1);
        board.fillRect(left + 13, top + Math.floor(this.cell * 0.52), this.cell - 17, 4);
        board.fillRect(left + Math.floor(this.cell * 0.55), top + 12, 4, Math.floor(this.cell * 0.45) - 11);
      } else {
        board.fillStyle((index + Math.floor(index / this.level.width)) % 2 ? theme.floor : theme.floorAlt, 1);
        board.fillRect(left + 1, top + 1, this.cell - 2, this.cell - 2);
        board.fillStyle(0x202735, 0.35);
        board.fillRect(left + 1, top + this.cell - 3, this.cell - 2, 2);
        if (goalSet.has(index)) {
          board.fillStyle(0x0b605d, 1);
          board.fillRect(left + 12, top + 12, this.cell - 24, this.cell - 24);
          board.fillStyle(theme.goal, 1);
          board.fillRect(left + 17, top + 17, this.cell - 34, this.cell - 34);
          board.fillStyle(0x0e655f, 1);
          board.fillRect(x - 5, y - 5, 10, 10);
          board.fillStyle(0xe9ffe6, 1);
          board.fillRect(x - 2, y - 2, 4, 4);
        } else if ((index * 17) % 11 === 0) {
          board.fillStyle(0xb0bbc4, 0.4);
          board.fillRect(x - 14, y + 11, 4, 3);
          board.fillRect(x - 5, y + 11, 3, 3);
        }
      }
    }
    this.setState({ player: this.level.player, boxes: this.level.boxes });
  }

  makeBox(index) {
    const { x, y } = this.cellPosition(index);
    const g = this.add.graphics();
    const size = this.cell;
    const side = Math.round(size * 0.68);
    const edge = -Math.floor(side / 2);
    g.fillStyle(0x151524, 1);
    g.fillRect(edge - 5, edge - 3, side + 10, side + 10);
    g.fillStyle(0xd8753e, 1);
    g.fillRect(edge, edge, side, side);
    g.fillStyle(0xffbd65, 1);
    g.fillRect(edge + 5, edge + 5, side - 10, 9);
    g.fillStyle(0x8f443b, 1);
    g.fillRect(edge + 9, edge + 18, 7, side - 28);
    g.fillRect(edge + side - 16, edge + 18, 7, side - 28);
    g.fillStyle(0xffe1a0, 1);
    g.fillRect(-6, -6, 12, 12);
    g.setPosition(x, y);
    return g;
  }

  makeHero(index) {
    const { x, y } = this.cellPosition(index);
    const g = this.add.graphics();
    const size = this.cell;
    g.fillStyle(0x161522, 1);
    g.fillRect(-18, 19, 36, 10);
    g.fillRect(-22, -17, 44, 39);
    g.fillStyle(0x4989a4, 1);
    g.fillRect(-18, 7, 36, 17);
    g.fillStyle(0xf2c797, 1);
    g.fillRect(-18, -17, 36, 25);
    g.fillStyle(0x4a3650, 1);
    g.fillRect(-22, -27, 44, 13);
    g.fillStyle(0xea7554, 1);
    g.fillRect(-16, -29, 32, 6);
    g.fillStyle(0x262239, 1);
    g.fillRect(-11, -8, 5, 5);
    g.fillRect(7, -8, 5, 5);
    g.fillRect(-3, 2, 8, 3);
    g.setPosition(x, y);
    // 保持角色在 7×7 与 9×9 地图中占据相近的格子比例。
    g.setScale(size / 70);
    return g;
  }

  setState(state) {
    this.playerSprite?.destroy();
    for (const sprite of this.boxSprites.values()) sprite.destroy();
    this.boxSprites.clear();
    for (const box of state.boxes) this.boxSprites.set(box, this.makeBox(box));
    this.playerSprite = this.makeHero(state.player);
  }

  animateMove(previous, current, onComplete) {
    const playerPosition = this.cellPosition(current.player);
    this.tweens.add({ targets: this.playerSprite, ...playerPosition, duration: 140, ease: 'Sine.Out' });
    const from = previous.boxes.find(box => !current.boxes.includes(box));
    const to = current.boxes.find(box => !previous.boxes.includes(box));
    if (from !== undefined && to !== undefined) {
      const sprite = this.boxSprites.get(from);
      this.boxSprites.delete(from);
      this.boxSprites.set(to, sprite);
      this.tweens.add({ targets: sprite, ...this.cellPosition(to), duration: 150, ease: 'Sine.Out' });
    }
    this.time.delayedCall(155, onComplete);
  }

  showHint(direction, player) {
    const labels = { up: '↑', right: '→', down: '↓', left: '←' };
    const { x, y } = this.cellPosition(player);
    const marker = this.add.text(x, y - this.cell * 0.66, labels[direction], {
      fontFamily: 'monospace', fontSize: '48px', fontStyle: 'bold', color: '#ffda75', stroke: '#171b2b', strokeThickness: 7
    }).setOrigin(0.5);
    this.tweens.add({ targets: marker, y: marker.y - 18, alpha: 0, duration: 1000, onComplete: () => marker.destroy() });
  }
}
