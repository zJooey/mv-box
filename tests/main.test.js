import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { createState, move, undo } from '../src/core.js';
import { directionFromKey } from '../src/controls.js';
import { completeLevel, loadProgress, selectLevel } from '../src/progress.js';
import { previewLevels } from '../src/strategy-levels.js';
import { generateLevel } from '../src/generator.js';
import { solve } from '../src/solver.js';
import classicLevels from '../src/classic-levels.json' with { type: 'json' };
import { loadClassicProgress, selectClassicLevel, completeClassicLevel, leaveClassics } from '../src/classic-progress.js';

const Scene = createRequire(import.meta.url)('../node_modules/phaser/src/scene/Scene');
function fixture(unlocked = 40, classicData = null) {
  const document = { body: { dataset: {} }, listeners: {}, nodes: new Map(),
    getElementById(id) {
      if (!this.nodes.has(id)) this.nodes.set(id, { textContent: '', innerHTML: '', disabled: false, hidden: false, open: false,
        classList: { values: new Set(), add(n) { this.values.add(n); }, remove(n) { this.values.delete(n); } },
        style: {}, clientWidth: 1000, parentElement: { clientWidth: 300, scrollLeft: 0 },
        children: [], replaceChildren() { this.children = []; }, append(child) { this.children.push(child); },
        setAttribute(name, value) { this[name] = value; }, showModal() { this.open = true; }, close() { this.open = false; },
        addEventListener(type, callback) { this[type] = callback; } });
      return this.nodes.get(id);
    }, createElement() { return { children: [], append(child) { this.children.push(child); }, addEventListener(type, cb) { this[type] = cb; } }; },
    querySelectorAll() { return []; }, addEventListener(type, callback) { this.listeners[type] = callback; }
  };
  const values = new Map([['sokoban-progress', JSON.stringify({ unlocked, selected: 36 })]]);
  if (classicData) values.set('sokoban-classic-progress', JSON.stringify(classicData));
  const localStorage = { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) };
  const window = { listeners: {}, addEventListener(type, callback) { this.listeners[type] = callback; } };
  let worker, gameConfig;
  const levels = JSON.parse(readFileSync(new URL('../src/levels.json', import.meta.url)));
  levels[35] = previewLevels.find(level => level.id === 36);
  const context = vm.createContext({ Phaser: { Scene, Game: class { constructor(options) { gameConfig = options; } }, AUTO: 0, Scale: { FIT: 0, CENTER_BOTH: 0 } },
    levels, classicLevels, loadClassicProgress, selectClassicLevel, completeClassicLevel, leaveClassics,
    levelNote: () => ({ title: '交错中转', mission: '六箱交错运送', credit: 'David W. Skinner' }),
    createState, move, undo, directionFromKey, completeLevel, loadProgress, selectLevel,
    localStorage, document, window, URL, setTimeout: () => 0, clearTimeout() {},
    Worker: class { constructor() { worker = this; } postMessage(message) { this.message = message; } }
  });
  // 执行真实入口事件，只替换 DOM、存储和后台线程这些浏览器边界。
  vm.runInContext(readFileSync(new URL('../src/game-scene.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace('export class GameScene', 'class GameScene'), context);
  vm.runInContext(readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace("new URL('./worker.js', import.meta.url)", "new URL('http://localhost/worker.js')"), context);
  const start = () => vm.runInContext('scene.drawLevel = () => {}; scene.setState = () => {}; scene.animateMove = (a, b, cb) => cb(); scene.showHint = () => {}; scene.create();', context);
  const key = value => document.listeners.keydown({ key: value, repeat: false, preventDefault() {} });
  return { document, worker, context, start, key, localStorage, window, gameConfig };
}

test('正式游戏启动前保持操作禁用，启动后保留已有解锁编号', () => {
  const app = fixture();
  assert.equal(app.document.getElementById('hint').disabled, true);
  assert.equal(app.document.getElementById('restart').disabled, true);
  assert.doesNotThrow(() => app.key('ArrowDown'));
  assert.equal(app.document.getElementById('moves').textContent, 0);
  app.start();
  assert.equal(app.document.getElementById('hint').disabled, false);
  assert.deepEqual(loadProgress(app.localStorage), { unlocked: 40, selected: 36 });
});

test('提示计算期间可以移动，重开后过期的预算错误不弹出', async () => {
  const app = fixture(); app.start();
  const pending = app.document.getElementById('hint').click();
  app.key('ArrowDown');
  assert.equal(app.document.getElementById('moves').textContent, 1);
  app.document.getElementById('restart').click();
  app.document.getElementById('confirm-restart').click();
  app.worker.onmessage({ data: { requestId: app.worker.message.requestId, error: '求解超出计算上限' } });
  await pending;
  assert.equal(app.document.getElementById('toast').classList.values.has('visible'), false);
  assert.equal(app.document.getElementById('moves').textContent, 0);
});

test('正式游戏的撤销额度用尽后禁用，重开恢复三次', () => {
  const app = fixture(); app.start(); const undoButton = app.document.getElementById('undo');
  for (let n = 0; n < 3; n++) { app.key('ArrowDown'); undoButton.click(); }
  app.key('ArrowDown');
  assert.equal(undoButton.disabled, true);
  assert.match(undoButton.innerHTML, /撤销 0/);
  app.document.getElementById('restart').click();
  app.document.getElementById('confirm-restart').click();
  assert.match(undoButton.innerHTML, /撤销 3/);
});

test('第 36 关完整通关解锁 37，后台生成后保持原存档格式', async () => {
  const app = fixture(36); app.start();
  const level = previewLevels.find(level => level.id === 36);
  for (const direction of solve(level, createState(level)).directions) {
    app.key({ up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[direction]);
  }
  assert.equal(app.document.getElementById('win-overlay').hidden, false);
  assert.deepEqual(loadProgress(app.localStorage), { unlocked: 37, selected: 36 });
  const pending = app.document.getElementById('next-level').click();
  assert.equal(app.worker.message.kind, 'generate');
  assert.equal(app.worker.message.payload.id, 37);
  const generated = generateLevel(37);
  app.worker.onmessage({ data: { requestId: app.worker.message.requestId, result: generated } });
  await pending;
  assert.deepEqual(loadProgress(app.localStorage), { unlocked: 37, selected: 37 });
  assert.match(app.document.getElementById('level-title').textContent, /第 37 关/);
  assert.equal(app.document.getElementById('moves').textContent, 0);
  assert.match(app.document.getElementById('undo').innerHTML, /撤销 3/);
});

test('过期的生成失败不能解除新关加载锁或让旧棋盘恢复操作', async () => {
  const app = fixture(); app.start();
  const old = vm.runInContext('loadLevel(37)', app.context), oldId = app.worker.message.requestId;
  const current = vm.runInContext('loadLevel(38)', app.context), currentId = app.worker.message.requestId;
  app.worker.onmessage({ data: { requestId: oldId, error: '第 37 关生成失败' } }); await old;
  app.key('ArrowDown');
  assert.equal(app.document.getElementById('moves').textContent, 0);
  assert.equal(app.document.getElementById('hint').disabled, true);
  assert.equal(app.document.getElementById('board-loading').hidden, false);
  assert.equal(app.document.getElementById('toast').classList.values.has('visible'), false);
  app.worker.onmessage({ data: { requestId: currentId, result: { ...previewLevels[3], id: 38 } } }); await current;
  assert.match(app.document.getElementById('level-title').textContent, /第 38 关/);
  assert.equal(app.document.getElementById('hint').disabled, false);
});

test('换关等待时旧提示失效，不会显示在旧棋盘或新关上', async () => {
  const app = fixture(); app.start();
  const hint = app.document.getElementById('hint').click(), hintId = app.worker.message.requestId;
  const load = vm.runInContext('loadLevel(37)', app.context), loadId = app.worker.message.requestId;
  app.worker.onmessage({ data: { requestId: hintId, result: { directions: ['down'] } } }); await hint;
  assert.equal(app.document.getElementById('toast').classList.values.has('visible'), false);
  assert.equal(app.document.getElementById('hint').disabled, true);
  app.worker.onmessage({ data: { requestId: loadId, result: { ...previewLevels[3], id: 37 } } }); await load;
});

test('重开先确认，取消与关闭保留局面和撤销次数，弹框期间不能移动', () => {
  const app = fixture(); app.start(); app.key('ArrowDown');
  app.document.getElementById('undo').click(); app.key('ArrowDown');
  app.document.getElementById('restart').click();
  assert.equal(app.document.getElementById('restart-dialog').open, true);
  assert.equal(app.document.getElementById('moves').textContent, 1);
  app.key('ArrowDown');
  assert.equal(app.document.getElementById('moves').textContent, 1);
  app.document.getElementById('cancel-restart').click();
  assert.equal(app.document.getElementById('restart-dialog').open, false);
  assert.equal(app.document.getElementById('moves').textContent, 1);
  assert.match(app.document.getElementById('undo').innerHTML, /撤销 2/);
  app.document.getElementById('restart').click();
  app.document.getElementById('restart-dialog').close();
  assert.equal(app.document.getElementById('moves').textContent, 1);
  app.document.getElementById('restart').click();
  app.document.getElementById('confirm-restart').click();
  assert.equal(app.document.getElementById('restart-dialog').open, false);
  assert.equal(app.document.getElementById('moves').textContent, 0);
  assert.match(app.document.getElementById('undo').innerHTML, /撤销 3/);
});

test('经典合集全部开放，选择长地图不改冒险编号，刷新恢复独立完成情况', async () => {
  const app = fixture(36); app.start();
  app.document.getElementById('open-levels').click();
  app.document.getElementById('classic-tab').click();
  const tiles = app.document.getElementById('level-grid').children.filter(node => node.className?.includes('level-tile'));
  assert.equal(tiles.length, 155);
  assert.deepEqual(tiles.map(tile => Number(tile.innerHTML.split('<')[0])), Array.from({ length: 155 }, (_, index) => index + 1));
  assert.ok(tiles.every(tile => !tile.disabled));
  await tiles.find(tile => tile.title?.includes('Microban 154')).click();
  assert.match(app.document.getElementById('level-title').textContent, /Microban 154/);
  assert.deepEqual(loadProgress(app.localStorage), { unlocked: 36, selected: 36 });
  assert.equal(loadClassicProgress(app.localStorage).active, true);
  const restored = fixture(36, { selected: 154, active: true, completed: [1] }); restored.start();
  assert.match(restored.document.getElementById('level-title').textContent, /Microban 154/);
  assert.match(restored.document.getElementById('progress-pill').textContent, /1.*155/);
});

test('经典关通关只记经典完成，下一关取合集下一张，返回冒险保留原进度', async () => {
  const app = fixture(36, { selected: 1, active: true, completed: [] }); app.start();
  const level = classicLevels.find(level => level.id === 1);
  for (const direction of solve(level, createState(level)).directions) app.key({ up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[direction]);
  assert.equal(app.document.getElementById('win-overlay').hidden, false);
  assert.deepEqual(loadClassicProgress(app.localStorage).completed, [1]);
  assert.deepEqual(loadProgress(app.localStorage), { unlocked: 36, selected: 36 });
  await app.document.getElementById('next-level').click();
  assert.match(app.document.getElementById('level-title').textContent, /Microban 2/);
  await vm.runInContext('loadLevel(36)', app.context);
  assert.match(app.document.getElementById('level-title').textContent, /第 36 关/);
  assert.equal(loadClassicProgress(app.localStorage).active, false);
});

test('宽经典地图初始角色在右侧时，棋盘滚动到角色而非把他留在屏外', () => {
  const app = fixture(36, { selected: 63, active: true, completed: [] }); app.start();
  assert.ok(app.document.getElementById('game-board').parentElement.scrollLeft > 400);
});

test('宽地图从桌面缩到手机时，重新滚动保持右侧角色可见', () => {
  const app = fixture(36, { selected: 63, active: true, completed: [] }); app.start();
  const board = app.document.getElementById('game-board');
  board.clientWidth = 510; board.parentElement.clientWidth = 271; board.parentElement.scrollLeft = 0;
  app.window.listeners.resize?.();
  // 原图角色中心约为 437 像素，窄屏必须向右滚动至少 167 像素才可看到。
  assert.ok(board.parentElement.scrollLeft >= 167);
});

test('补齐经典关后按连续编号进入下一关，最后一张完成后返回合集', async () => {
  for (const [id, next] of [[33, 34], [154, 155]]) {
    const app = fixture(36, { selected: id, active: true, completed: [] }); app.start();
    const level = classicLevels.find(level => level.id === id);
    for (const direction of solve(level, createState(level)).directions) app.key({ up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[direction]);
    assert.equal(app.document.getElementById('win-overlay').hidden, false);
    assert.deepEqual(loadClassicProgress(app.localStorage).completed, [id]);
    await app.document.getElementById('next-level').click();
    assert.equal(app.document.getElementById('level-title').textContent, `Microban ${next}`);
    assert.deepEqual(loadProgress(app.localStorage), { unlocked: 36, selected: 36 });
  }
  // 这里只检查最后一关的过关入口，解法由经典数据验关负责回放。
  const app = fixture(36, { selected: 155, active: true, completed: [] }); app.start();
  vm.runInContext('finishLevel()', app.context);
  assert.equal(app.document.getElementById('next-level').textContent, '返回经典合集');
  await app.document.getElementById('next-level').click();
  assert.equal(app.document.getElementById('level-dialog').open, true);
  assert.deepEqual(loadClassicProgress(app.localStorage).completed, [155]);
});

test('棋盘触摸滑动不被 Phaser 阻止，允许浏览器原生滚动宽图', () => {
  const app = fixture(), canvas = new EventTarget();
  const sandbox = { module: { exports: {} }, window: {}, require(name) {
    if (name === '../../utils/Class') return class { constructor(definition) { return definition; } };
    return () => {};
  } };
  // 执行真实触摸管理器与原生可取消事件，捕捉 preventDefault 对拖动滚动的影响。
  vm.runInNewContext(readFileSync(new URL('../node_modules/phaser/src/input/touch/TouchManager.js', import.meta.url), 'utf8'), sandbox);
  const manager = { enabled: true, canvas, config: { inputTouch: true, inputTouchCapture: app.gameConfig.input?.touch?.capture ?? true },
    game: { canvas, config: {} }, onTouchMove() {} };
  const touch = { ...sandbox.module.exports, manager }; touch.boot();
  const event = new Event('touchmove', { cancelable: true }); canvas.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
});
