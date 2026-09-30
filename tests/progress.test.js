import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProgress, completeLevel, selectLevel } from '../src/progress.js';

const storage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};

test('完成关卡后解锁下一关，并可刷新恢复', () => {
  const store = storage();
  const initial = loadProgress(store);
  assert.deepEqual(initial, { unlocked: 1, selected: 1 });
  completeLevel(store, 1);
  assert.deepEqual(loadProgress(store), { unlocked: 2, selected: 1 });
  selectLevel(store, 2);
  assert.deepEqual(loadProgress(store), { unlocked: 2, selected: 2 });
});

test('损坏的本地存档回到第一关', () => {
  const store = storage();
  store.setItem('sokoban-progress', '{broken');
  assert.deepEqual(loadProgress(store), { unlocked: 1, selected: 1 });
});
