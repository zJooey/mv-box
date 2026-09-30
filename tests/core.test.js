import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, move, undo } from '../src/core.js';

const level = {
  width: 5,
  height: 5,
  walls: [0, 1, 2, 3, 4, 5, 9, 10, 14, 15, 19, 20, 21, 22, 23, 24],
  goals: [13],
  boxes: [12],
  player: 11
};

test('推箱到目标后获胜，撤销可恢复原位置', () => {
  const start = createState(level);
  const result = move(level, start, 'right');
  assert.equal(result.moved, true);
  assert.equal(result.pushed, true);
  assert.equal(result.won, true);
  assert.deepEqual(result.state.boxes, [13]);
  assert.deepEqual(undo(result.state).boxes, [12]);
});

test('墙壁和箱子后方墙壁会阻止移动且不记录历史', () => {
  const start = createState(level);
  const blocked = move(level, start, 'left');
  assert.equal(blocked.moved, false);
  assert.equal(blocked.state.history.length, 0);
  const pinned = { ...level, walls: [...level.walls, 13] };
  assert.equal(move(pinned, start, 'right').moved, false);
});

test('普通移动不会推箱或获胜', () => {
  const start = createState(level);
  const result = move(level, start, 'down');
  assert.equal(result.moved, true);
  assert.equal(result.pushed, false);
  assert.equal(result.won, false);
  assert.equal(result.state.player, 16);
});
