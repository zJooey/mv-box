import test from 'node:test';
import assert from 'node:assert/strict';
import { directionFromKey } from '../src/controls.js';

test('长按键盘产生的重复事件不会触发额外移动', () => {
  assert.equal(directionFromKey({ key: 'ArrowDown', repeat: false }), 'down');
  assert.equal(directionFromKey({ key: 'ArrowDown', repeat: true }), null);
});

test('WASD 和方向键映射到相同方向', () => {
  assert.equal(directionFromKey({ key: 'w', repeat: false }), 'up');
  assert.equal(directionFromKey({ key: 'ArrowUp', repeat: false }), 'up');
});
