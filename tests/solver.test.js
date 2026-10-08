import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createState, move, neighbor } from '../src/core.js';
import { solve } from '../src/solver.js';

const fixed = JSON.parse(readFileSync(new URL('../src/levels.json', import.meta.url), 'utf8'));

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

test('计算预算耗尽与真正无解分开报告', () => {
  assert.throws(() => solve(room, createState(room), 0), /求解超出计算上限/);
  const trapped = { ...room, boxes: [6], goals: [13], player: 11 };
  assert.equal(solve(trapped, createState(trapped), 0), null);
});

test('提示时间预算用尽时报告尚未算完，已完成的局面仍可直接返回', () => {
  assert.throws(() => solve(room, createState(room), 100000, 0), /求解超出计算上限/);
  const won = { ...room, boxes: [13] };
  assert.deepEqual(solve(won, createState(won), 100000, 0), { directions: [], pushes: 0 });
});

test('五箱和六箱关卡在推动后仍可从当前局面求解', () => {
  for (const level of [fixed[24], fixed[35]]) {
    let state = createState(level);
    const initial = solve(level, state);
    for (const direction of initial.directions) {
      const next = move(level, state, direction);
      state = next.state;
      if (next.pushed) break;
    }
    const hint = solve(level, state);
    assert.ok(hint?.directions.length);
    for (const direction of hint.directions) state = move(level, state, direction).state;
    assert.ok(state.boxes.every(box => level.goals.includes(box)));
  }
});

test('六箱关卡死角与预算耗尽分别返回无解和未算完', () => {
  const level = fixed[35];
  assert.throws(() => solve(level, createState(level), 0), /求解超出计算上限/);
  const walls = new Set(level.walls);
  const corner = Array.from({ length: level.width * level.height }, (_, index) => index).find(index => {
    if (walls.has(index) || level.goals.includes(index) || level.boxes.includes(index) || index === level.player) return false;
    const blocked = direction => walls.has(neighbor(index, direction, level.width, level.height));
    return (blocked('up') || blocked('down')) && (blocked('left') || blocked('right'));
  });
  assert.notEqual(corner, undefined);
  const trapped = createState(level);
  trapped.boxes[0] = corner;
  assert.equal(solve(level, trapped), null);
});
