import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import classics from '../src/classic-levels.json' with { type: 'json' };
import levels from '../src/levels.json' with { type: 'json' };

const require = createRequire(import.meta.url), base = '../node_modules/phaser/src/';
const constants = require(base + 'scale/const'), Size = require(base + 'structs/Size');

// 执行本地真实 Phaser 缩放方法；仅替换浏览器矩形与实际绘图边界，复现切关尺寸缓存。
function draw(level, oldWidth, oldHeight, width, height) {
  const sandbox = { module: { exports: {} }, window: { pageXOffset: 0, pageYOffset: 0 }, document: { documentElement: { clientLeft: 0, clientTop: 0 } },
    require(name) {
      if (name === '../utils/Class') return class { constructor(definition) { return definition; } };
      if (name === './const') return constants;
      if (name === '../structs/Size') return Size;
      if (name === '../math/Clamp') return require(base + 'math/Clamp');
      return class {};
    }
  };
  vm.runInNewContext(readFileSync(new URL(base + 'scale/ScaleManager.js', import.meta.url), 'utf8'), sandbox);
  const scale = { ...sandbox.module.exports, autoRound: false, scaleMode: constants.SCALE_MODE.FIT, autoCenter: constants.CENTER.CENTER_BOTH,
    zoom: 1, parentIsWindow: false, dirty: false, resizeInterval: 500, _lastCheck: 0, game: { domContainer: null },
    parentSize: new Size(oldWidth, oldHeight), gameSize: new Size(720, 720), baseSize: new Size(720, 720), canvasBounds: {},
    displayScale: { set() {} }, updateOrientation() {}, emit() {}
  };
  scale.displaySize = new Size(720, 720, constants.SCALE_MODE.FIT, scale.parentSize);
  scale.parent = { getBoundingClientRect: () => ({ width, height }) };
  scale.canvas = { style: {}, getBoundingClientRect() {
    const style = this.style, x = parseFloat(style.marginLeft) || 0, y = parseFloat(style.marginTop) || 0;
    return { width: parseFloat(style.width), height: parseFloat(style.height), left: x, top: y, x, y };
  } };
  const context = vm.createContext({ Phaser: { Scene: class {} } });
  vm.runInContext(readFileSync(new URL('../src/game-scene.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export class GameScene', 'class GameScene'), context);
  const Scene = vm.runInContext('GameScene', context), scene = new Scene();
  scene.scale = scale; scene.level = level; scene.tweens = { killAll() {} }; scene.children = { removeAll() {} };
  scene.add = { graphics: () => ({ fillStyle() {}, fillRect() {}, setPosition() {}, setScale() {}, destroy() {} }) };
  scene.drawLevel(); scale.step(1000, 1000);
  return scale.canvas.style;
}

test('切入大型经典图使用新的父容器尺寸，格子不能仍缩在旧小画布内', () => {
  const style = draw(classics.find(level => level.id === 154), 348, 348, 770, 770 * 1230 / 2070);
  assert.equal(parseFloat(style.width), 770);
  assert.ok(Math.abs(parseFloat(style.height) - 457.536) < 0.01);
});

test('大图切小图与经典切冒险都恢复正确比例和尺寸', () => {
  const classic = draw(classics[0], 770, 457.536, 348, 348 * 530 / 460);
  assert.equal(parseFloat(classic.width), 348);
  assert.ok(Math.abs(parseFloat(classic.height) - 400.9565) < 0.01);
  const adventure = draw(levels[0], 348, 400.9565, 348, 348);
  assert.equal(parseFloat(adventure.width), 348); assert.equal(parseFloat(adventure.height), 348);
});
