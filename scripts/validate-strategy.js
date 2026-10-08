import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { previewLevels, designNotes } from '../src/strategy-levels.js';
import { createState, move, neighbor } from '../src/core.js';
import { validateLevel } from '../src/generator.js';
import { solve, solveRestricted } from '../src/solver.js';

// 离线验关必须完整搜完受限局面；任何预算异常直接使脚本失败，不能算作通过。
const report = [];
for (const level of previewLevels) {
  const started = performance.now();
  assert.ok(validateLevel(level));
  const answer = solve(level, createState(level));
  assert.ok(answer);
  assert.equal(answer.pushes, level.minPushes);
  assert.equal(solveRestricted(level, createState(level), 'serial'), null);
  const monotoneImpossible = solveRestricted(level, createState(level), 'monotone') === null;
  if (level.id >= 9) assert.ok(monotoneImpossible);
  const twoPhasesImpossible = level.id === 24 ? solveRestricted(level, createState(level), 'two-phases') === null : null;
  if (level.id === 24) assert.ok(twoPhasesImpossible);
  let state = createState(level);
  const identities = new Map(level.boxes.map((position, index) => [position, index]));
  const boxPhases = level.boxes.map(() => 0);
  const boxDirections = level.boxes.map(() => new Set());
  let active = -1;
  for (const direction of answer.directions) {
    const result = move(level, state, direction);
    assert.ok(result.moved);
    if (result.pushed) {
      const position = neighbor(state.player, direction, level.width, level.height);
      const identity = identities.get(position);
      if (active !== identity) { boxPhases[identity]++; active = identity; }
      boxDirections[identity].add(direction);
      identities.delete(position);
      identities.set(neighbor(position, direction, level.width, level.height), identity);
    }
    state = result.state;
  }
  assert.ok(state.boxes.every(box => level.goals.includes(box)));
  if (level.id >= 24) {
    assert.ok(answer.pushes >= (level.id === 24 ? 35 : 45));
    assert.ok(boxPhases.every(count => count >= 3));
    for (const directions of boxDirections) {
      assert.ok(directions.has('left') || directions.has('right'));
      assert.ok(directions.has('up') || directions.has('down'));
      assert.ok((directions.has('left') && directions.has('right')) || (directions.has('up') && directions.has('down')));
    }
  }
  const trap = designNotes[level.id].prematureGoalRoute;
  if (trap) {
    state = createState(level);
    for (const direction of trap.slice(0, -1)) {
      const result = move(level, state, direction);
      assert.ok(result.moved);
      state = result.state;
    }
    assert.ok(solve(level, state), '错误归位前必须仍有解');
    const result = move(level, state, trap.at(-1));
    assert.ok(result.pushed);
    assert.equal(solve(level, result.state), null, '错误归位后必须完整证明无解');
  }
  const row = { id: level.id, title: designNotes[level.id].title, width: level.width, height: level.height, boxes: level.boxes.length,
    minPushes: answer.pushes, solutionSteps: answer.directions.length, serialImpossible: true, monotoneImpossible, twoPhasesImpossible,
    boxPhases, boxDirections: boxDirections.map(directions => [...directions]), credit: designNotes[level.id].credit,
    prematureGoalVerified: Boolean(trap), elapsedMs: Math.round(performance.now() - started), solution: answer.directions };
  report.push(row);
  console.log('第 ' + level.id + ' 关通过：' + answer.pushes + ' 次最少推动，解题路线 ' + answer.directions.length + ' 步，验关 ' + row.elapsedMs + ' 毫秒');
}
writeFileSync(new URL('../data/strategy-validation.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log('四个样例的策略证据已保存到 data/strategy-validation.json；本脚本不改写正式关卡。');
