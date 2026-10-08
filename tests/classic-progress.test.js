import test from 'node:test';
import assert from 'node:assert/strict';
import { loadClassicProgress, selectClassicLevel, completeClassicLevel, leaveClassics } from '../src/classic-progress.js';
import { loadProgress } from '../src/progress.js';

// 两种模式使用不同键，经典关不会因编号相同而误解锁冒险关。
function storage() {
  const values = new Map([['sokoban-progress', JSON.stringify({ unlocked: 24, selected: 12 })]]);
  return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
}
test('经典选关、完成与刷新恢复不会改动冒险存档，退出后仍保留完成记录', () => {
  const saved = storage();
  selectClassicLevel(saved, 154); completeClassicLevel(saved, 154); completeClassicLevel(saved, 154);
  assert.deepEqual(loadClassicProgress(saved), { selected: 154, active: true, completed: [154] });
  assert.deepEqual(loadProgress(saved), { unlocked: 24, selected: 12 });
  leaveClassics(saved);
  assert.deepEqual(loadClassicProgress(saved), { selected: 154, active: false, completed: [154] });
});
test('损坏或不存在的经典存档编号从第一张发布地图开始', () => {
  const saved = storage();
  for (const data of ['{', JSON.stringify({ selected: 999, active: true, completed: [] }), JSON.stringify({ selected: 1, active: true, completed: ['坏数据'] })]) {
    saved.setItem('sokoban-classic-progress', data);
    assert.deepEqual(loadClassicProgress(saved), { selected: 1, active: false, completed: [] });
  }
});
