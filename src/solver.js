import { neighbor } from './core.js';

const directions = ['right', 'down', 'left', 'up'];
const opposite = { right: 'left', down: 'up', left: 'right', up: 'down' };

function walking(level, player, occupied, walls) {
  const previous = new Map([[player, null]]);
  const queue = [player];
  for (let head = 0; head < queue.length; head++) {
    for (const direction of directions) {
      const next = neighbor(queue[head], direction, level.width, level.height);
      if (next === -1 || walls.has(next) || occupied.has(next) || previous.has(next)) continue;
      previous.set(next, [queue[head], direction]);
      queue.push(next);
    }
  }
  return { previous, region: Math.min(...queue) };
}

function goalDistances(level, walls) {
  // 反向计算单箱能到达目标的位置；到不了任何目标的格子就是静态死角。
  return level.goals.map(goal => {
    const distance = new Map([[goal, 0]]);
    const queue = [goal];
    for (let head = 0; head < queue.length; head++) {
      for (const direction of directions) {
        const before = neighbor(queue[head], opposite[direction], level.width, level.height);
        const stand = neighbor(before, opposite[direction], level.width, level.height);
        if (before === -1 || stand === -1 || walls.has(before) || walls.has(stand) || distance.has(before)) continue;
        distance.set(before, distance.get(queue[head]) + 1);
        queue.push(before);
      }
    }
    return distance;
  });
}

function lowerBound(boxes, distances) {
  // 最小目标匹配只计算单箱推距，因而不会高估真实推动次数。
  let costs = new Map([[0, 0]]);
  for (const box of boxes) {
    const next = new Map();
    for (const [mask, cost] of costs) {
      for (let goal = 0; goal < distances.length; goal++) {
        if (mask & (1 << goal)) continue;
        const distance = distances[goal].get(box);
        if (distance === undefined) continue;
        const key = mask | (1 << goal);
        next.set(key, Math.min(next.get(key) ?? Infinity, cost + distance));
      }
    }
    costs = next;
    if (!costs.size) return Infinity;
  }
  return costs.get((1 << boxes.length) - 1) ?? Infinity;
}

class Heap {
  values = [];
  push(node) {
    const values = this.values;
    let index = values.length;
    values.push(node);
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (values[parent].score <= node.score) break;
      values[index] = values[parent];
      index = parent;
    }
    values[index] = node;
  }
  pop() {
    const values = this.values;
    const first = values[0];
    const last = values.pop();
    if (values.length) {
      let index = 0;
      while (index * 2 + 1 < values.length) {
        let child = index * 2 + 1;
        if (child + 1 < values.length && values[child + 1].score < values[child].score) child++;
        if (values[child].score >= last.score) break;
        values[index] = values[child];
        index = child;
      }
      values[index] = last;
    }
    return first;
  }
  get size() { return this.values.length; }
}

function walkPath(previous, start, end) {
  const result = [];
  for (let current = end; current !== start; current = previous.get(current)[0]) result.push(previous.get(current)[1]);
  return result.reverse();
}

function solution(node) {
  const parts = [];
  for (let current = node; current.parent; current = current.parent) parts.push(current.path);
  return { directions: parts.reverse().flat(), pushes: node.pushes };
}

export function solve(level, state, maxStates = 100000, maxTimeMs = Infinity) {
  return search(level, state, maxStates, undefined, maxTimeMs);
}

// 离线验关专用：搜索结束返回 null 才能证明捷径不存在，预算耗尽仍抛错。
export function solveRestricted(level, state, mode, maxStates = 100000) {
  if (!['serial', 'monotone', 'two-phases'].includes(mode)) throw new Error('未知的策略验关模式');
  return search(level, state, maxStates, mode);
}

function search(level, state, maxStates, mode, maxTimeMs = Infinity) {
  const deadline = performance.now() + maxTimeMs;
  const walls = new Set(level.walls);
  const goals = new Set(level.goals);
  const won = boxes => boxes.every(box => goals.has(box));
  if (won(state.boxes)) return { directions: [], pushes: 0 };

  const distances = goalDistances(level, walls);
  const startBoxes = [...state.boxes].sort((a, b) => a - b);
  const bound = lowerBound(startBoxes, distances);
  if (!Number.isFinite(bound)) return null;
  const startWalk = walking(level, state.player, new Set(startBoxes), walls);
  const serial = mode === 'serial';
  const twoPhases = mode === 'two-phases';
  const stateKey = node => `${node.boxes.join(',')}|${node.region}${serial ? `|${node.active}|${node.frozen}` : twoPhases ? `|${node.active}|${node.touched}|${node.returned}` : ''}`;
  const start = { player: state.player, boxes: startBoxes, pushes: 0, score: bound, bound, region: startWalk.region, parent: null, active: -1, frozen: 0, touched: 0, returned: 0 };
  const heap = new Heap();
  heap.push(start);
  const best = new Map([[stateKey(start), 0]]);
  let expanded = 0;

  while (heap.size) {
    const current = heap.pop();
    const key = stateKey(current);
    if (current.pushes !== best.get(key)) continue;
    // 完整经典图最多有十六箱；同时限制耗时，避免只限局面数使手机提示长期占用线程。
    if (++expanded > maxStates || performance.now() >= deadline) throw new Error('求解超出计算上限');
    if (won(current.boxes)) return solution(current);
    const occupied = new Set(current.boxes);
    const { previous } = walking(level, current.player, occupied, walls);
    for (let index = 0; index < current.boxes.length; index++) {
      const box = current.boxes[index];
      // 逐箱模式只允许操作当前箱子；完成后可以封存，再选择下一个。
      if (serial && ((current.frozen & (1 << index)) || (current.active !== -1 && current.active !== index))) continue;
      // 每箱最多两个操作阶段；推动别箱后回来算新阶段，允许一次暂存回运但禁止第三次接手。
      if (twoPhases && current.active !== index && (current.returned & (1 << index))) continue;
      const returned = twoPhases && current.active !== index && (current.touched & (1 << index))
        ? current.returned | (1 << index) : current.returned;
      for (const direction of directions) {
        const behind = neighbor(box, opposite[direction], level.width, level.height);
        const ahead = neighbor(box, direction, level.width, level.height);
        if (!previous.has(behind) || ahead === -1 || walls.has(ahead) || occupied.has(ahead)) continue;
        if (!distances.some(distance => distance.has(ahead))) continue;
        const boxes = current.boxes.map(position => position === box ? ahead : position);
        if (!serial && !twoPhases) boxes.sort((a, b) => a - b);
        const nextBound = lowerBound(boxes, distances);
        if (!Number.isFinite(nextBound)) continue;
        if (mode === 'monotone' && nextBound > current.bound) continue;
        const nextWalk = walking(level, box, new Set(boxes), walls);
        const pushes = current.pushes + 1;
        const next = { player: box, boxes, pushes, score: pushes + nextBound, bound: nextBound,
          region: nextWalk.region, parent: current, path: [...walkPath(previous, current.player, behind), direction],
          active: serial || twoPhases ? index : -1, frozen: current.frozen,
          touched: twoPhases ? current.touched | (1 << index) : 0, returned };
        const choices = [next];
        // 经过目标不强制结束，避免把仍可继续推动的逐箱解法漏掉。
        if (serial && goals.has(ahead)) choices.push({ ...next, active: -1, frozen: current.frozen | (1 << index) });
        for (const choice of choices) {
          const nextKey = stateKey(choice);
          if (pushes >= (best.get(nextKey) ?? Infinity)) continue;
          best.set(nextKey, pushes);
          heap.push(choice);
        }
      }
    }
  }
  return null;
}
