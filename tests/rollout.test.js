import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { previewLevels } from '../src/strategy-levels.js';
import { createState } from '../src/core.js';
import { generateLevel } from '../src/generator.js';
import { solveRestricted } from '../src/solver.js';

const levels = JSON.parse(readFileSync(new URL('../src/levels.json', import.meta.url), 'utf8'));

// 发布数据必须真正接入认可的试玩，不能只改变名称和难度文案。
test('正式关原样纳入四个已认可的策略样例', () => {
  for (const sample of previewLevels) assert.deepEqual(levels[sample.id - 1], sample);
});

test('无尽六箱不能逐箱直推归位，也不能始终向目标靠近', () => {
  const level = generateLevel(37);
  assert.equal(solveRestricted(level, createState(level), 'serial'), null);
  assert.equal(solveRestricted(level, createState(level), 'monotone'), null);
});
