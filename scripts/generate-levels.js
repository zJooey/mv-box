import { mkdirSync, writeFileSync } from 'node:fs';
import { generateLevel } from '../src/generator.js';

// 候选池与正式关卡分开保存；再次生成不会覆盖已经精选的地图。
// 正式关已经改为人工精选，此脚本输出八种朝向样本，方便比对手机布局，不新增随机正式谜题。
const candidates = [];
for (let id = 1; id <= 36; id++) {
  const group = [];
  for (let variant = 0; variant < 8; variant++) group.push(generateLevel(id, variant));
  candidates.push(group);
  console.log(`第 ${id} 关：已生成 8 个朝向样本`);
}
mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
writeFileSync(new URL('../data/level-candidates.json', import.meta.url), `${JSON.stringify(candidates, null, 2)}\n`);
console.log('候选池已保存到 data/level-candidates.json；正式关卡未改动');
