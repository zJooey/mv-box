import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createState } from '../src/core.js';
import { validateLevel } from '../src/generator.js';
import { solve } from '../src/solver.js';

const levels = JSON.parse(readFileSync(new URL('../src/levels.json', import.meta.url), 'utf8'));

test('固定 36 关完整、各关可解且难度分段递进', () => {
  assert.equal(levels.length, 36);
  const signatures = new Set();
  const wallSignatures = new Set();
  levels.forEach((level, index) => {
    assert.equal(level.id, index + 1);
    assert.equal(validateLevel(level), true);
    assert.equal(level.boxes.length, index < 2 ? 1 : index < 12 ? 2 : index < 24 ? 3 : 4);
    assert.equal(level.width, index < 12 ? 7 : 9);
    assert.equal(level.height, index < 12 ? 7 : 9);
    const answer = solve(level, createState(level));
    assert.equal(answer.pushes, level.minPushes);
    assert.ok(level.walls.length - (4 * level.width - 4) >= (index < 12 ? 3 : 7));
    assert.ok(answer.directions.length >= (index < 2 ? 4 : index < 12 ? 12 : index < 24 ? 20 : 28));
    signatures.add(JSON.stringify([level.walls, level.goals, level.boxes, level.player]));
    wallSignatures.add(JSON.stringify(level.walls));
  });
  assert.equal(signatures.size, 36);
  assert.equal(wallSignatures.size, 36);
  for (const start of [0, 12, 24]) {
    const section = levels.slice(start, start + 12);
    assert.ok(section.every((level, index) => index === 0 || level.minPushes >= section[index - 1].minPushes));
  }
});
