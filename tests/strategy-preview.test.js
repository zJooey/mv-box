import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { createState, move, undo } from '../src/core.js';
import { previewLevels, designNotes } from '../src/strategy-levels.js';
import { directionFromKey } from '../src/controls.js';

// 使用真实 Phaser.Scene 的未启动状态，只替换浏览器边界，驱动入口实际注册的事件。
const require = createRequire(import.meta.url);
const Scene = require('../node_modules/phaser/src/scene/Scene');
function previewFixture() {
  const document = {
    body: { dataset: {} }, listeners: {}, nodes: new Map(),
    getElementById(id) {
      if (!this.nodes.has(id)) this.nodes.set(id, {
        textContent: '', innerHTML: '', disabled: false, hidden: false, open: false,
        showModal() { this.open = true; }, close() { this.open = false; },
        classList: { values: new Set(), add(name) { this.values.add(name); }, remove(name) { this.values.delete(name); } },
        addEventListener(type, callback) { this[type] = callback; }
      });
      return this.nodes.get(id);
    },
    querySelectorAll() { return []; },
    addEventListener(type, callback) { this.listeners[type] = callback; }
  };
  let worker;
  const context = vm.createContext({
    Phaser: { Scene, Game: class {}, AUTO: 0, Scale: { FIT: 0, CENTER_BOTH: 0 }, Scenes: { Events: { CREATE: 'create' } } },
    previewLevels, designNotes, createState, move, undo, directionFromKey, document, URL,
    setTimeout: () => 0, clearTimeout() {}, Worker: class { constructor() { worker = this; } postMessage(message) { this.message = message; } }
  });
  // 去除模块装载语法，保留完整入口逻辑；不从测试复制移动、提示或按钮状态实现。
  vm.runInContext(readFileSync(new URL('../src/game-scene.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace('export class GameScene', 'class GameScene'), context);
  vm.runInContext(readFileSync(new URL('../src/strategy-preview.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace("new URL('./worker.js', import.meta.url)", "new URL('http://localhost/worker.js')"), context);
  const startScene = () => vm.runInContext('scene.drawLevel = () => {}; scene.setState = () => {}; scene.animateMove = (previous, current, callback) => callback(); scene.showHint = () => {}; scene.create();', context);
  const key = direction => document.listeners.keydown({ key: direction, repeat: false, preventDefault() {} });
  return { document, worker, startScene, key };
}

test('引擎尚未启动时按键不会提前改变局面，提示保持禁用', () => {
  const app = previewFixture();
  assert.doesNotThrow(() => app.key('ArrowLeft'));
  assert.equal(app.document.getElementById('moves').textContent, 0);
  assert.equal(app.document.getElementById('hint').disabled, true);
  app.startScene();
  app.key('ArrowLeft');
  assert.equal(app.document.getElementById('moves').textContent, 1);
  assert.equal(app.document.getElementById('undo').disabled, false);
  app.document.getElementById('undo').click();
  assert.equal(app.document.getElementById('moves').textContent, 0);
  app.document.getElementById('restart').click();
  app.document.getElementById('confirm-restart').click();
  assert.equal(app.document.getElementById('restart').disabled, false);
});

test('重开清除上一局已显示的提示，过期后台结果也不能重新显示', () => {
  const app = previewFixture();
  app.startScene();
  const hint = app.document.getElementById('hint');
  hint.click();
  app.worker.onmessage({ data: { requestId: app.worker.message.requestId, result: { directions: ['left'] } } });
  assert.equal(app.document.getElementById('toast').classList.values.has('visible'), true);
  hint.click();
  const pendingId = app.worker.message.requestId;
  app.document.getElementById('restart').click();
  app.document.getElementById('confirm-restart').click();
  assert.equal(app.document.getElementById('toast').classList.values.has('visible'), false);
  app.worker.onmessage({ data: { requestId: pendingId, result: { directions: ['left'] } } });
  assert.equal(app.document.getElementById('toast').classList.values.has('visible'), false);
  assert.equal(hint.disabled, false);
});

test('试玩按钮显示三次撤销额度，用完后禁用，重开恢复', () => {
  const app = previewFixture();
  app.startScene();
  const button = app.document.getElementById('undo');
  assert.match(button.innerHTML, /撤销 3/);
  for (let count = 0; count < 3; count++) {
    app.key('ArrowLeft');
    button.click();
    assert.equal(app.document.getElementById('moves').textContent, 0);
    assert.match(button.innerHTML, new RegExp('撤销 ' + (2 - count)));
  }
  app.key('ArrowLeft');
  assert.equal(button.disabled, true);
  button.click();
  assert.equal(app.document.getElementById('moves').textContent, 1);
  app.document.getElementById('restart').click();
  app.document.getElementById('confirm-restart').click();
  assert.match(button.innerHTML, /撤销 3/);
  app.key('ArrowLeft');
  assert.equal(button.disabled, false);
});

test('试玩重开也先确认，取消不会改变局面，弹框不能穿透方向键', () => {
  const app = previewFixture(); app.startScene(); app.key('ArrowLeft');
  app.document.getElementById('restart').click();
  assert.equal(app.document.getElementById('restart-dialog').open, true);
  assert.equal(app.document.getElementById('moves').textContent, 1);
  app.key('ArrowLeft');
  assert.equal(app.document.getElementById('moves').textContent, 1);
  app.document.getElementById('cancel-restart').click();
  assert.equal(app.document.getElementById('moves').textContent, 1);
  app.document.getElementById('restart').click();
  app.document.getElementById('confirm-restart').click();
  assert.equal(app.document.getElementById('moves').textContent, 0);
});
