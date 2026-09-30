import { neighbor } from './core.js';

const directions = ['right', 'down', 'left', 'up'];
const opposite = { right: 'left', down: 'up', left: 'right', up: 'down' };

function reachable(level, player, boxes, walls) {
  const occupied = new Set(boxes);
  const paths = new Map([[player, []]]);
  const queue = [player];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    for (const direction of directions) {
      const next = neighbor(current, direction, level.width, level.height);
      if (next === -1 || walls.has(next) || occupied.has(next) || paths.has(next)) continue;
      paths.set(next, [...paths.get(current), direction]);
      queue.push(next);
    }
  }
  return paths;
}

export function solve(level, state, maxStates = 100000) {
  const walls = new Set(level.walls);
  const goals = new Set(level.goals);
  const won = boxes => boxes.every(box => goals.has(box));
  if (won(state.boxes)) return { directions: [], pushes: 0 };

  const start = { player: state.player, boxes: [...state.boxes].sort((a, b) => a - b), path: [], pushes: 0 };
  const queue = [start];
  const visited = new Set();

  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    const paths = reachable(level, current.player, current.boxes, walls);
    const key = `${current.boxes.join(',')}|${Math.min(...paths.keys())}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (visited.size > maxStates) throw new Error('求解超出计算上限');

    for (const box of current.boxes) {
      for (const direction of directions) {
        const behind = neighbor(box, opposite[direction], level.width, level.height);
        const ahead = neighbor(box, direction, level.width, level.height);
        if (!paths.has(behind) || ahead === -1 || walls.has(ahead) || current.boxes.includes(ahead)) continue;
        const boxes = current.boxes.map(position => position === box ? ahead : position).sort((a, b) => a - b);
        const path = [...current.path, ...paths.get(behind), direction];
        const pushes = current.pushes + 1;
        if (won(boxes)) return { directions: path, pushes };
        queue.push({ player: box, boxes, path, pushes });
      }
    }
  }
  return null;
}
