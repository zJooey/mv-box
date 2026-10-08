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

test('每局最多撤销三次，后续移动不能返还次数，重开恢复额度', () => {
  let state = createState(level);
  assert.equal(state.undosLeft, 3);
  assert.equal(undo(state), state, '没有历史时不消耗额度');
  for (let count = 0; count < 3; count++) {
    state = move(level, state, 'down').state;
    state = undo(state);
    assert.equal(state.player, level.player);
    assert.equal(state.moves, 0);
    assert.equal(state.undosLeft, 2 - count);
  }
  state = move(level, state, 'down').state;
  assert.equal(state.undosLeft, 0);
  assert.equal(undo(state), state, '额度耗尽后保留当前局面和历史');
  assert.equal(createState(level).undosLeft, 3);
});

test('连续撤销只恢复局面，不恢复上一局面的撤销额度', () => {
  let state = createState(level);
  state = move(level, state, 'down').state;
  state = move(level, state, 'right').state;
  state = undo(state);
  assert.equal(state.player, 16);
  assert.equal(state.undosLeft, 2);
  state = undo(state);
  assert.equal(state.player, 11);
  assert.equal(state.undosLeft, 1);
});
