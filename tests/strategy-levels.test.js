import test from 'node:test';
import assert from 'node:assert/strict';
import { previewLevels, designNotes } from '../src/strategy-levels.js';
import { createState, move, neighbor } from '../src/core.js';
import { validateLevel } from '../src/generator.js';
import { solve, solveRestricted } from '../src/solver.js';

function replay(level, directions) {
  let state = createState(level);
  const touched = new Set();
  const phases = level.boxes.map(() => 0);
  const traces = level.boxes.map(() => []);
  let active = -1;
  const identities = new Map(level.boxes.map((position, index) => [position, index]));
  for (const direction of directions) {
    const result = move(level, state, direction);
    assert.ok(result.moved, '验关路线中的每一步都必须有效');
    if (result.pushed) {
      const box = neighbor(state.player, direction, level.width, level.height);
      const identity = identities.get(box);
      touched.add(identity);
      if (active !== identity) { phases[identity]++; active = identity; }
      traces[identity].push(direction);
      identities.delete(box);
      identities.set(neighbor(box, direction, level.width, level.height), identity);
    }
    state = result.state;
  }
  return { state, touched, phases, traces };
}

for (const id of [24, 36]) {
  test('第 ' + id + ' 关的最优路线要求全部箱子转向、回运和多阶段操作', () => {
    const level = previewLevels.find(item => item.id === id);
    const answer = solve(level, createState(level));
    assert.ok(answer.pushes >= (id === 24 ? 35 : 45));
    const { phases, traces } = replay(level, answer.directions);
    assert.ok(phases.every(count => count >= 3));
    for (const trace of traces) {
      assert.ok(trace.some(direction => ['left', 'right'].includes(direction)));
      assert.ok(trace.some(direction => ['up', 'down'].includes(direction)));
      assert.ok((trace.includes('left') && trace.includes('right')) || (trace.includes('up') && trace.includes('down')));
    }
    // 四箱关完整排除每箱只暂存一次的解法；六箱的阶段数记录这条最优路线，不冒充全局证明。
    if (id === 24) assert.equal(solveRestricted(level, createState(level), 'two-phases'), null);
  });
}

test('四个手绘样例保留指定编号和箱数，地图不超过十格', () => {
  assert.deepEqual(previewLevels.map(level => [level.id, level.boxes.length]), [[3, 2], [12, 3], [24, 4], [36, 6]]);
  for (const level of previewLevels) {
    assert.ok(validateLevel(level));
    assert.ok(level.width <= 10 && level.height <= 10);
    assert.ok(level.boxes.every(box => !level.goals.includes(box)));
  }
});

for (const id of [3, 12, 24, 36]) {
  test('第 ' + id + ' 关可解且每个箱子都必须参与，逐箱直推不能过关', () => {
    const level = previewLevels.find(item => item.id === id);
    const answer = solve(level, createState(level));
    assert.ok(answer);
    assert.equal(answer.pushes, level.minPushes);
    const { state, touched } = replay(level, answer.directions);
    assert.ok(state.boxes.every(box => level.goals.includes(box)));
    assert.equal(touched.size, level.boxes.length);
    assert.equal(solveRestricted(level, createState(level), 'serial'), null);
    if (id >= 9) assert.equal(solveRestricted(level, createState(level), 'monotone'), null);
    // 推动之后继续从当前局面求解，覆盖试玩页的提示入口。
    const firstPush = answer.directions.findIndex((direction, index) => {
      const prefix = replay(level, answer.directions.slice(0, index)).state;
      return move(level, prefix, direction).pushed;
    });
    const current = replay(level, answer.directions.slice(0, firstPush + 1)).state;
    assert.ok(solve(level, current));
  });
}

for (const id of [24, 36]) {
  test('第 ' + id + ' 关过早填近目标会堵路，最后一步归位前仍可挽回', () => {
    const level = previewLevels.find(item => item.id === id);
    const route = designNotes[id].prematureGoalRoute;
    const before = replay(level, route.slice(0, -1)).state;
    assert.ok(solve(level, before));
    const last = move(level, before, route.at(-1));
    assert.ok(last.pushed);
    assert.ok(level.goals.includes(neighbor(last.state.player, route.at(-1), level.width, level.height)));
    assert.equal(solve(level, last.state), null);
    assert.equal(solveRestricted(level, last.state, 'monotone'), null);
  });
}
