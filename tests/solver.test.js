import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, move } from '../src/core.js';
import { solve } from '../src/solver.js';

const room = {
  width: 5,
  height: 5,
  walls: [0, 1, 2, 3, 4, 5, 9, 10, 14, 15, 19, 20, 21, 22, 23, 24],
  goals: [13],
  boxes: [12],
  player: 11
};

test('求解器从当前局面给出可执行的最少推动方案', () => {
  const result = solve(room, createState(room));
  assert.equal(result.pushes, 1);
  assert.deepEqual(result.directions, ['right']);
  const after = move(room, createState(room), result.directions[0]);
  assert.equal(after.won, true);
});

test('箱子困在非目标墙角时返回无解', () => {
  const trapped = { ...room, boxes: [6], goals: [13], player: 11 };
  assert.equal(solve(trapped, createState(trapped)), null);
});

test('走偏后提示从当前角色位置重新规划', () => {
  const detour = move(room, createState(room), 'down').state;
  const answer = solve(room, detour);
  assert.deepEqual(answer.directions.slice(0, 2), ['up', 'right']);
});
