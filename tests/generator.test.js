import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../src/core.js';
import { generateLevel, validateLevel } from '../src/generator.js';
import { solve } from '../src/solver.js';

test('相同关卡编号生成相同的可解地图', () => {
  const level = generateLevel(1);
  assert.deepEqual(level, generateLevel(1));
  assert.equal(validateLevel(level), true);
  assert.equal(solve(level, createState(level)).pushes, level.minPushes);
});

test('前十二关从入门逐步过渡到双箱与复杂墙体', () => {
  for (let id = 1; id <= 12; id++) {
    const level = generateLevel(id);
    assert.equal(level.width, 7);
    assert.equal(level.height, 7);
    assert.equal(level.boxes.length, id <= 2 ? 1 : 2);
    assert.ok(49 - level.walls.length <= 25);
    assert.ok(level.walls.length - 24 >= 3);
    const answer = solve(level, createState(level));
    assert.equal(answer.pushes, level.minPushes);
    assert.ok(answer.directions.length >= (id <= 2 ? 4 : 12));
  }
});

test('中后期关卡增加箱子与内部障碍', () => {
  for (const [id, boxes, pushes] of [[13, 3, 8], [24, 3, 8], [25, 4, 12], [36, 4, 12]]) {
    const level = generateLevel(id);
    assert.equal(level.boxes.length, boxes);
    assert.ok(level.walls.length - 32 >= 7);
    assert.ok(level.minPushes >= pushes);
    assert.equal(validateLevel(level), true);
  }
});

test('无限关卡继续按编号确定生成', () => {
  const level = generateLevel(37);
  assert.equal(level.id, 37);
  assert.deepEqual(level, generateLevel(37));
  assert.ok(solve(level, createState(level)));
});
