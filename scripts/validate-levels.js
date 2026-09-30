import { readFileSync } from 'node:fs';
import { createState } from '../src/core.js';
import { validateLevel } from '../src/generator.js';
import { solve } from '../src/solver.js';

const levels = JSON.parse(readFileSync(new URL('../src/levels.json', import.meta.url), 'utf8'));
if (levels.length !== 36) throw new Error('固定关卡数量必须为 36');
for (const level of levels) {
  if (!validateLevel(level)) throw new Error(`第 ${level.id} 关地图无效`);
  const answer = solve(level, createState(level));
  if (!answer || answer.pushes !== level.minPushes) throw new Error(`第 ${level.id} 关解法无效`);
}
console.log('36 个固定关卡均可通关');
