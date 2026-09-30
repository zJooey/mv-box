import { writeFileSync } from 'node:fs';
import { generateLevel } from '../src/generator.js';

const levels = [];
for (let chapter = 0; chapter < 3; chapter++) {
  const section = Array.from({ length: 12 }, (_, index) => generateLevel(chapter * 12 + index + 1));
  section.sort((a, b) => a.minPushes - b.minPushes || a.seed - b.seed);
  section.forEach((level, index) => { level.id = chapter * 12 + index + 1; });
  levels.push(...section);
}

writeFileSync(new URL('../src/levels.json', import.meta.url), `${JSON.stringify(levels, null, 2)}\n`);
console.log(`已生成 ${levels.length} 个固定关卡`);
