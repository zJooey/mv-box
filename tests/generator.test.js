import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../src/core.js';
import { generateLevel, validateLevel } from '../src/generator.js';
import { solve } from '../src/solver.js';
import { readFileSync } from 'node:fs';

test('相同关卡编号生成相同的可解地图', () => {
  const level = generateLevel(1);
  assert.deepEqual(level, generateLevel(1));
  assert.equal(validateLevel(level), true);
  assert.equal(solve(level, createState(level)).pushes, level.minPushes);
});

test('前期关卡逐步过渡到三箱与复杂墙体', () => {
  for (const [id, boxes, pushes, moves] of [[1, 1, 2, 4], [3, 2, 6, 15], [9, 3, 10, 22]]) {
    const level = generateLevel(id);
    assert.ok(level.width <= 10 && level.height <= 10);
    assert.equal(level.boxes.length, boxes);
    const answer = solve(level, createState(level));
    assert.equal(answer.pushes, level.minPushes);
    assert.ok(answer.pushes >= pushes);
    assert.ok(answer.directions.length >= moves);
  }
});

test('中后期关卡增加箱子与内部障碍', () => {
  for (const [id, boxes, pushes] of [[13, 3, 15], [19, 4, 23], [25, 5, 22], [36, 6, 48]]) {
    const level = generateLevel(id);
    assert.equal(level.boxes.length, boxes);
    assert.ok(level.width <= 10 && level.height <= 10);
    assert.ok(level.minPushes >= pushes);
    assert.equal(validateLevel(level), true);
  }
});

test('无限关卡继续按编号确定生成', () => {
  const level = generateLevel(37);
  assert.equal(level.id, 37);
  assert.ok(level.width <= 10 && level.height <= 10);
  assert.equal(level.boxes.length, 6);
  assert.deepEqual(level, generateLevel(37));
  assert.ok(solve(level, createState(level)));
});

test('无尽模板调度不能把相邻编号映射成重复起点', () => {
  const signatures = [38, 39, 50, 51, 52].map(id => {
    const level = generateLevel(id);
    return JSON.stringify([level.width, level.height, level.walls, level.goals, level.boxes]);
  });
  assert.equal(new Set(signatures).size, signatures.length);
});

test('无尽首轮生成实际的新起点，不能只复印已发布机关', () => {
  const fixed = JSON.parse(readFileSync(new URL('../src/levels.json', import.meta.url), 'utf8'));
  const signature = level => JSON.stringify([level.width, level.height, level.walls, level.goals, level.boxes]);
  const known = new Set(fixed.map(signature));
  assert.equal(known.has(signature(generateLevel(37))), false);
});

test('同一机关和朝向下一轮采用不同起点组', () => {
  const first = generateLevel(37), next = generateLevel(77);
  assert.deepEqual(first.walls, next.walls);
  assert.deepEqual(first.goals, next.goals);
  assert.notDeepEqual(first.boxes, next.boxes);
});
