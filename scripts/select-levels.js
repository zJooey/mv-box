import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { validateLevel } from '../src/generator.js';
import { createState } from '../src/core.js';
import { solve } from '../src/solver.js';

// 人工精选记录是发布来源；随机候选与朝向样本不能自动覆盖已认可的正式地图。
const curated = JSON.parse(readFileSync(new URL('../data/curated-levels.json', import.meta.url), 'utf8'));
assert.equal(curated.length, 36);
for (const [index, { level, note }] of curated.entries()) {
  assert.equal(level.id, index + 1); assert.ok(validateLevel(level));
  assert.ok(note.title && note.credit);
  assert.equal(solve(level, createState(level)).pushes, level.minPushes);
}
writeFileSync(new URL('../src/levels.json', import.meta.url), JSON.stringify(curated.map(row => row.level), null, 2) + '\n');
writeFileSync(new URL('../src/level-notes.json', import.meta.url), JSON.stringify(Object.fromEntries(curated.map(row => [row.level.id, row.note])), null, 2) + '\n');
const endless = JSON.parse(readFileSync(new URL('../data/curated-endless.json', import.meta.url), 'utf8'));
writeFileSync(new URL('../src/endless-templates.json', import.meta.url), JSON.stringify(endless, null, 2) + '\n');
console.log('已从人工精选记录发布 36 关、署名与五种六箱模板；请继续运行 validate:levels。');
