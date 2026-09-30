import { createState, neighbor } from './core.js';
import { solve } from './solver.js';

const directions = ['up', 'right', 'down', 'left'];
const opposite = { up: 'down', right: 'left', down: 'up', left: 'right' };

function randomSource(seed) {
  let value = seed >>> 0 || 1;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
}

function choose(list, random) {
  return list[Math.floor(random() * list.length)];
}

function connected(rows) {
  const size = rows.length;
  const floor = [];
  rows.forEach((row, y) => row.forEach((tile, x) => {
    if (tile !== '#') floor.push(y * size + x);
  }));
  const seen = new Set([floor[0]]);
  const queue = [floor[0]];
  for (let head = 0; head < queue.length; head++) {
    for (const direction of directions) {
      const next = neighbor(queue[head], direction, size, size);
      if (next === -1 || rows[Math.floor(next / size)][next % size] === '#' || seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen.size === floor.length;
}

function makeRoom(id, random) {
  const size = id <= 12 ? 7 : 9;
  const rows = Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) =>
    x === 0 || y === 0 || x === size - 1 || y === size - 1 ? '#' : '.'));
  const wallCount = id <= 2 ? 3 : id <= 12 ? 4 + Math.floor(random() * 3) : id <= 24 ? 7 + Math.floor(random() * 4) : 8 + Math.floor(random() * 4);
  let placed = 0;
  // 每放一块墙都检查通道连通性，避免生成无法进入的区域。
  for (let attempt = 0; placed < wallCount && attempt < 150; attempt++) {
    const x = 1 + Math.floor(random() * (size - 2));
    const y = 1 + Math.floor(random() * (size - 2));
    if (rows[y][x] === '#') continue;
    rows[y][x] = '#';
    if (connected(rows)) placed++;
    else rows[y][x] = '.';
  }
  return rows;
}

function reachable(level, player, boxes) {
  const walls = new Set(level.walls);
  const occupied = new Set(boxes);
  const seen = new Set([player]);
  const queue = [player];
  for (let head = 0; head < queue.length; head++) {
    for (const direction of directions) {
      const next = neighbor(queue[head], direction, level.width, level.height);
      if (next === -1 || walls.has(next) || occupied.has(next) || seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

function makeCandidate(id, seed, count, random) {
  const rows = makeRoom(id, random);
  const width = rows[0].length;
  const height = rows.length;
  const walls = [];
  const floor = [];
  const inner = [];
  rows.forEach((row, y) => [...row].forEach((tile, x) => {
    const position = y * width + x;
    if (tile === '#') walls.push(position);
    else {
      floor.push(position);
      if (x >= 2 && x <= width - 3 && y >= 2 && y <= height - 3) inner.push(position);
    }
  }));
  const wallSet = new Set(walls);
  // 目标格至少留有一条可反向拉箱的直线，避免箱子一开始就无法离开目标。
  const goalCandidates = inner.filter(position => directions.some(direction => {
    const previous = neighbor(position, opposite[direction], width, height);
    const standing = neighbor(previous, opposite[direction], width, height);
    return previous !== -1 && standing !== -1 && !wallSet.has(previous) && !wallSet.has(standing);
  }));
  if (goalCandidates.length < count) return null;
  const goals = [];
  while (goals.length < count) {
    const position = choose(goalCandidates, random);
    if (!goals.includes(position)) goals.push(position);
  }
  const boxes = [...goals];
  let player = choose(floor.filter(position => !boxes.includes(position)), random);
  const level = { id, width, height, walls, goals: goals.sort((a, b) => a - b), boxes, player, seed, minPushes: 0 };

  // 从箱子已经归位的局面反向拉动，保证每一步都能逆向推回终点。
  const pulls = 4 + count * 8 + Math.floor(random() * 10);
  const pullCounts = Array(count).fill(0);
  const seenLayouts = new Set([[...boxes].sort((a, b) => a - b).join(',')]);
  for (let step = 0; step < pulls; step++) {
    const access = reachable(level, player, boxes);
    const options = [];
    for (let index = 0; index < boxes.length; index++) {
      for (const direction of directions) {
        const previous = neighbor(boxes[index], opposite[direction], width, height);
        if (previous === -1) continue;
        const standing = neighbor(previous, opposite[direction], width, height);
        const layout = boxes.map((box, boxIndex) => boxIndex === index ? previous : box).sort((a, b) => a - b).join(',');
        if (access.has(previous) && standing !== -1 && !walls.includes(standing) && !boxes.includes(standing) && !seenLayouts.has(layout)) {
          options.push({ index, previous, standing, layout });
        }
      }
    }
    if (!options.length) break;
    const leastPulled = Math.min(...options.map(option => pullCounts[option.index]));
    const selection = choose(options.filter(option => pullCounts[option.index] === leastPulled), random);
    boxes[selection.index] = selection.previous;
    player = selection.standing;
    pullCounts[selection.index]++;
    seenLayouts.add(selection.layout);
  }
  level.boxes = boxes.sort((a, b) => a - b);
  level.player = player;
  return level;
}

export function validateLevel(level) {
  const area = level.width * level.height;
  const unique = values => new Set(values).size === values.length;
  const inside = position => Number.isInteger(position) && position >= 0 && position < area;
  if (!Number.isInteger(level.width) || !Number.isInteger(level.height) || level.width < 4 || level.height < 4) return false;
  if (!unique(level.walls) || !unique(level.goals) || !unique(level.boxes)) return false;
  if (level.goals.length === 0 || level.goals.length !== level.boxes.length) return false;
  if (![...level.walls, ...level.goals, ...level.boxes, level.player].every(inside)) return false;
  const walls = new Set(level.walls);
  if ([...level.goals, ...level.boxes, level.player].some(position => walls.has(position))) return false;
  if (level.boxes.includes(level.player)) return false;
  for (let x = 0; x < level.width; x++) {
    if (!walls.has(x) || !walls.has((level.height - 1) * level.width + x)) return false;
  }
  for (let y = 0; y < level.height; y++) {
    if (!walls.has(y * level.width) || !walls.has(y * level.width + level.width - 1)) return false;
  }
  return true;
}

export function generateLevel(id) {
  const count = id <= 2 ? 1 : id <= 12 ? 2 : id <= 24 ? 3 : 4;
  const target = id <= 2 ? id + 1 : id <= 12 ? 4 + Math.floor((id - 3) / 4) : id <= 24 ? 8 + Math.floor((id - 13) / 4) : 12;
  const minMoves = id <= 2 ? 4 : id <= 12 ? 12 : id <= 24 ? 20 : 28;
  const seed = (id * 2654435761) >>> 0;
  const random = randomSource(seed);
  for (let attempt = 0; attempt < 120; attempt++) {
    const level = makeCandidate(id, seed, count, random);
    if (!level || !validateLevel(level)) continue;
    const answer = solve(level, createState(level));
    if (!answer || answer.pushes < target || answer.directions.length < minMoves || level.boxes.some(box => level.goals.includes(box))) continue;
    level.minPushes = answer.pushes;
    return level;
  }
  throw new Error(`第 ${id} 关生成失败`);
}
