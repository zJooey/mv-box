import { readFile, writeFile } from 'node:fs/promises';
import { parseClassicMaps } from './classic-format.js';
import { createState, move } from '../src/core.js';
import { solve } from '../src/solver.js';

// 离线完整导入并保存合法解法；运行游戏只读取发布数据，不联网下载或导入文本。
const maps = parseClassicMaps(await readFile(new URL('../data/microban.txt', import.meta.url), 'utf8'));
const previous = JSON.parse(await readFile(new URL('../data/classic-validation.json', import.meta.url), 'utf8'));
const selected = [], report = [];
for (const level of maps) {
  const started = performance.now();
  // 已有解法仍逐步回放；新增高箱数图即使验关超预算也完整收录。
  const proof = previous.find(item => item.sourceNumber === level.sourceNumber && item.route);
  let answer = proof ? { directions: proof.route, pushes: proof.pushes } : null;
  try { answer ??= solve(level, createState(level), 100000, 6000); }
  catch (error) {
    if (error.message !== '求解超出计算上限') throw error;
    selected.push({ ...level, minPushes: null });
    report.push({ sourceNumber: level.sourceNumber, status: '已收录：求解预算内未完成', ms: Math.round(performance.now() - started) });
    console.log(`已收录 ${level.sourceNumber}/${maps.length}：Microban ${level.sourceNumber}，求解预算内未完成`);
    continue;
  }
  if (!answer) throw new Error(`经典第 ${level.sourceNumber} 关初始局面无解`);
  let state = createState(level);
  for (const direction of answer.directions) {
    const result = move(level, state, direction);
    if (!result.moved) throw new Error(`经典第 ${level.sourceNumber} 关解法包含无效移动`);
    state = result.state;
  }
  if (!state.boxes.every(box => level.goals.includes(box))) throw new Error('经典验关未抵达全部目标');
  selected.push({ ...level, minPushes: answer.pushes });
  report.push({ sourceNumber: level.sourceNumber, status: '已收录', pushes: answer.pushes, route: answer.directions, ms: Math.round(performance.now() - started) });
  console.log(`已验 ${selected.length}/${maps.length}：Microban ${level.sourceNumber}，${level.width}×${level.height}，${answer.pushes} 推`);
}
selected.sort((a, b) => a.sourceNumber - b.sourceNumber);
await writeFile(new URL('../src/classic-levels.json', import.meta.url), JSON.stringify(selected));
await writeFile(new URL('../data/classic-validation.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(`${selected.length} 个经典关卡原图已完整发布，其中 ${report.filter(item => item.route).length} 关已回放解法`);
