import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import levels from '../src/classic-levels.json' with { type: 'json' };
import { createState, move } from '../src/core.js';
import { validateLevel } from '../src/generator.js';
import { parseClassicMaps } from '../scripts/classic-format.js';

test('完整收录 155 张经典原图，编号连续且原始机关没有改动', () => {
  const originals = parseClassicMaps(readFileSync(new URL('../data/microban.txt', import.meta.url), 'utf8'));
  assert.equal(levels.length, 155);
  assert.deepEqual(levels.map(level => level.id), Array.from({ length: 155 }, (_, index) => index + 1));
  for (const level of levels) {
    assert.equal(validateLevel(level), true);
    const { minPushes, ...map } = level;
    assert.deepEqual(map, originals.find(item => item.sourceNumber === level.sourceNumber));
    assert.ok(level.voids.every(p => level.walls.includes(p) && !level.goals.includes(p)));
  }
  assert.equal(levels.find(level => level.id === 144).boxes.length, 16);
  assert.equal(levels.at(-1).width, 30);
  assert.ok(levels.some(level => level.width > level.height * 2));
  assert.ok(levels.some(level => level.height > level.width));
});

test('经典验关覆盖全合集，已验证路线合法回放，预算用尽不冒充无解或最少推数', () => {
  const proofs = JSON.parse(readFileSync(new URL('../data/classic-validation.json', import.meta.url), 'utf8'));
  assert.equal(proofs.length, 155);
  assert.ok(proofs.filter(proof => proof.route).length >= 100);
  for (const level of levels) {
    const proof = proofs.find(item => item.sourceNumber === level.sourceNumber);
    if (!proof.route) {
      assert.equal(proof.status, '已收录：求解预算内未完成');
      assert.equal(level.minPushes, null);
      continue;
    }
    let state = createState(level);
    for (const direction of proof.route) {
      const result = move(level, state, direction); assert.ok(result.moved); state = result.state;
    }
    assert.ok(state.boxes.every(box => level.goals.includes(box)));
    assert.equal(state.pushes, level.minPushes);
  }
});
