import { neighbor } from '../src/core.js';
import { validateLevel } from '../src/generator.js';

// 文本导入是外部数据边界：检查图符和封闭性，避免把地图外空白误当可走地板。
export function parseClassicMaps(text) {
  return text.replace(/\r/g, '').split(/;\s*(\d+)\s*\n/).slice(1).reduce((maps, block, index, blocks) => {
    if (index % 2) return maps;
    const sourceNumber = Number(block);
    // 作者原文本夹有单引号标题／来源附注；保留附注，地图仍逐字符检查。
    const lines = blocks[index + 1].split('\n');
    const sourceNote = lines.find(row => /^'[^']*'$/.test(row));
    const rows = lines.filter(row => row.trim().length && !/^'[^']*'$/.test(row));
    if (!rows.length || rows.some(row => /[^ #.$@*+]/.test(row))) throw new Error(`经典第 ${sourceNumber} 关图符不合法`);
    const width = Math.max(...rows.map(row => row.length)), height = rows.length;
    const tiles = rows.map(row => row.padEnd(width, ' ')).join('');
    const outside = new Set(), queue = [];
    for (let p = 0; p < tiles.length; p++) {
      if (tiles[p] === ' ' && (p % width === 0 || p % width === width - 1 || p < width || p >= width * (height - 1))) {
        outside.add(p); queue.push(p);
      }
    }
    for (let head = 0; head < queue.length; head++) for (const direction of ['up', 'down', 'left', 'right']) {
      const next = neighbor(queue[head], direction, width, height);
      if (next !== -1 && tiles[next] === ' ' && !outside.has(next)) { outside.add(next); queue.push(next); }
    }
    const level = { id: sourceNumber, sourceNumber, sourceNote: sourceNote?.slice(1, -1) || '', width, height, walls: [], voids: [...outside].sort((a, b) => a - b), goals: [], boxes: [], player: -1, seed: 0 };
    let players = 0;
    [...tiles].forEach((tile, p) => {
      if (tile === '#' || outside.has(p)) level.walls.push(p);
      if ('.*+'.includes(tile)) level.goals.push(p);
      if ('$*'.includes(tile)) level.boxes.push(p);
      if ('@+'.includes(tile)) { level.player = p; players++; }
    });
    if (players !== 1 || !validateLevel(level)) throw new Error(`经典第 ${sourceNumber} 关数据不完整或地图未封闭`);
    maps.push(level); return maps;
  }, []);
}
