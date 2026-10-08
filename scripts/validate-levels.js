import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createState, move, neighbor } from '../src/core.js';
import { generateLevel, validateLevel } from '../src/generator.js';
import { solve, solveRestricted } from '../src/solver.js';
import { endlessTemplate } from '../src/endless-templates.js';

const levels = JSON.parse(readFileSync(new URL('../src/levels.json', import.meta.url), 'utf8'));
const notes = JSON.parse(readFileSync(new URL('../src/level-notes.json', import.meta.url), 'utf8'));
const report = [], endlessLayouts = new Set();
assert.equal(levels.length, 36);

function verify(level, generationMs = 0) {
  const started = performance.now();
  assert.ok(validateLevel(level));
  assert.ok(level.width <= 10 && level.height <= 10);
  const answer = solve(level, createState(level));
  assert.ok(answer); assert.equal(answer.pushes, level.minPushes);
  if (level.id >= 3) assert.equal(solveRestricted(level, createState(level), 'serial'), null);
  if (level.id >= 9) assert.equal(solveRestricted(level, createState(level), 'monotone'), null);
  const identities = new Map(level.boxes.map((box, index) => [box, index]));
  const phases = level.boxes.map(() => 0), directions = level.boxes.map(() => new Set());
  let state = createState(level), active = -1;
  for (const direction of answer.directions) {
    const result = move(level, state, direction); assert.ok(result.moved);
    if (result.pushed) {
      const box = neighbor(state.player, direction, level.width, level.height), index = identities.get(box);
      if (active !== index) { phases[index]++; active = index; }
      directions[index].add(direction);
      identities.delete(box); identities.set(neighbor(box, direction, level.width, level.height), index);
    }
    state = result.state;
  }
  assert.ok(state.boxes.every(box => level.goals.includes(box)));
  assert.ok(phases.every(count => count > 0), '全部箱子必须参与');
  if (level.id > 36) {
    assert.equal(level.boxes.length, 6); assert.ok(answer.pushes >= 25);
    assert.ok(phases.every(count => count >= 2));
    assert.ok(phases.filter(count => count >= 3).length >= 3);
  }
  const trap = notes[level.id]?.prematureGoalRoute;
  if (level.id >= 19 && level.id <= 36) {
    assert.ok(trap?.length);
    state = createState(level);
    for (const direction of trap.slice(0, -1)) { const result = move(level, state, direction); assert.ok(result.moved); state = result.state; }
    assert.ok(solve(level, state));
    const result = move(level, state, trap.at(-1)); assert.ok(result.pushed);
    assert.ok(level.goals.includes(neighbor(result.state.player, trap.at(-1), level.width, level.height)));
    assert.equal(solve(level, result.state), null);
  }
  const row = { id: level.id, width: level.width, height: level.height, boxes: level.boxes.length,
    minPushes: answer.pushes, solutionSteps: answer.directions.length, boxPhases: phases, boxDirections: directions.map(set => [...set]),
    serialImpossible: level.id >= 3, monotoneImpossible: level.id >= 9, prematureGoalVerified: Boolean(trap),
    generationMs: Math.round(generationMs), verificationMs: Math.round(performance.now() - started),
    credit: level.id <= 36 ? notes[level.id].credit : endlessTemplate(level.id).note.credit, solution: answer.directions };
  report.push(row);
  console.log(`第 ${level.id} 关：${row.minPushes} 推，${row.solutionSteps} 步，生成 ${row.generationMs} 毫秒，验关 ${row.verificationMs} 毫秒`);
}

// 离线证明遇到预算异常直接失败；只有完整搜索返回 null 才记录策略成立。
for (const level of levels) verify(level);
for (let id = 37; id <= 100; id++) {
  const started = performance.now(), level = generateLevel(id), generationMs = performance.now() - started;
  assert.deepEqual(level, generateLevel(id), '同一编号必须确定性生成');
  const signature = JSON.stringify([level.width, level.height, level.walls, level.goals, level.boxes]);
  assert.ok(!endlessLayouts.has(signature), '连续无尽关不能重复同一起点'); endlessLayouts.add(signature);
  verify(level, generationMs);
  // 分批保存证据，耗时验关中断也能查看已经完成的真实结果。
  writeFileSync(new URL('../data/level-validation.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
}
console.log('36 个正式关与第 37～100 关均已完整验关，证据在 data/level-validation.json');
