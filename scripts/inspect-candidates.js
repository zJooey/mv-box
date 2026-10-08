import { readFileSync } from 'node:fs';
import { createState } from '../src/core.js';
import { solve } from '../src/solver.js';

const groups = JSON.parse(readFileSync(new URL('../data/level-candidates.json', import.meta.url), 'utf8'));
// 汇总每个候选的最少推数与完整路线，辅助人工比较关卡节奏。
for (const group of groups) {
  const items = group.map((level, variant) => {
    const answer = solve(level, createState(level));
    const innerWalls = level.walls.length - (2 * level.width + 2 * level.height - 4);
    const score = answer.pushes * 4 + answer.directions.length + innerWalls;
    return { variant, pushes: answer.pushes, moves: answer.directions.length, innerWalls, score };
  });
  console.log(`${String(group[0].id).padStart(2)}: ${items.map(item => `${item.variant}=${item.pushes}/${item.moves}`).join('  ')}`);
}
