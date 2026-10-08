import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createState, move, neighbor } from '../src/core.js';
import { validateLevel } from '../src/generator.js';
import { solve, solveRestricted } from '../src/solver.js';

const levels = JSON.parse(readFileSync(new URL('../src/levels.json', import.meta.url), 'utf8'));
const notes = JSON.parse(readFileSync(new URL('../src/level-notes.json', import.meta.url), 'utf8'));
const tiers = [[2, 1, 2], [8, 2, 6], [12, 3, 10], [18, 3, 15], [24, 4, 23], [30, 5, 22], [36, 6, 25]];

test('固定 36 关完整可解，箱数递进，机关地图各有变化', () => {
  assert.equal(levels.length, 36);
  const layouts = new Set(), walls = new Set();
  for (const [index, level] of levels.entries()) {
    assert.equal(level.id, index + 1);
    assert.equal(validateLevel(level), true);
    const [, count, pushes] = tiers.find(([last]) => level.id <= last);
    assert.equal(level.boxes.length, count);
    assert.ok(level.width <= 10 && level.height <= 10);
    const answer = solve(level, createState(level));
    assert.equal(answer.pushes, level.minPushes);
    assert.ok(answer.pushes >= pushes);
    let state = createState(level);
    const moved = new Set(), identities = new Map(level.boxes.map((box, i) => [box, i]));
    for (const direction of answer.directions) {
      const box = neighbor(state.player, direction, level.width, level.height), result = move(level, state, direction);
      assert.ok(result.moved);
      if (result.pushed) {
        moved.add(identities.get(box));
        identities.set(neighbor(box, direction, level.width, level.height), identities.get(box));
        identities.delete(box);
      }
      state = result.state;
    }
    assert.equal(moved.size, count, '初始已在目标上的箱子也必须参与解题');
    assert.ok(state.boxes.every(box => level.goals.includes(box)));
    layouts.add(JSON.stringify([level.width, level.height, level.walls, level.goals, level.boxes]));
    walls.add(JSON.stringify([level.width, level.height, level.walls]));
  }
  assert.equal(layouts.size, 36);
  // 五箱回程机关在六箱阶段再加入新目标，允许一次有实质变化的复访。
  assert.ok(walls.size >= 35);
});

test('第 3 关起不能逐箱归位，第 9 关起不能始终缩短目标匹配推距', () => {
  for (const level of levels.filter(level => level.id >= 3)) {
    assert.equal(solveRestricted(level, createState(level), 'serial'), null, '第 ' + level.id + ' 关');
    if (level.id >= 9) assert.equal(solveRestricted(level, createState(level), 'monotone'), null, '第 ' + level.id + ' 关');
  }
});

test('第 19 关起均保留合法的错误目标归位证据', () => {
  for (const level of levels.filter(level => level.id >= 19)) {
    const route = notes[level.id].prematureGoalRoute;
    assert.ok(route?.length, '第 ' + level.id + ' 关缺少归位证据');
    let state = createState(level);
    for (const direction of route.slice(0, -1)) {
      const result = move(level, state, direction); assert.ok(result.moved); state = result.state;
    }
    assert.ok(solve(level, state));
    const final = move(level, state, route.at(-1));
    assert.ok(final.pushed);
    const box = neighbor(final.state.player, route.at(-1), level.width, level.height);
    assert.ok(level.goals.includes(box));
    assert.equal(solve(level, final.state), null);
    assert.match(notes[level.id].credit, /David W\. Skinner/);
  }
});
