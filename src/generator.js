import levels from './levels.json' with { type: 'json' };
import { endlessTemplate, endlessTemplateCount } from './endless-templates.js';
import { createState, move, neighbor } from './core.js';
import { solve, solveRestricted } from './solver.js';

const directions = ['up', 'right', 'down', 'left'];
function randomSource(seed) {
  let value = seed || 1;
  return () => { value ^= value << 13; value ^= value >>> 17; value ^= value << 5; return (value >>> 0) / 4294967296; };
}

function reachable(level, player, boxes) {
  const walls = new Set(level.walls), occupied = new Set(boxes), seen = new Set([player]), queue = [player];
  for (let head = 0; head < queue.length; head++) for (const direction of directions) {
    const next = neighbor(queue[head], direction, level.width, level.height);
    if (next === -1 || walls.has(next) || occupied.has(next) || seen.has(next)) continue;
    seen.add(next); queue.push(next);
  }
  return seen;
}

function orient(level, orientation) {
  const turns = orientation % 4;
  const transform = position => {
    let x = position % level.width, y = Math.floor(position / level.width), width = level.width, height = level.height;
    if (orientation >= 4) x = width - 1 - x;
    for (let turn = 0; turn < turns; turn++) { [x, y] = [height - 1 - y, x]; [width, height] = [height, width]; }
    return y * width + x;
  };
  const list = values => values.map(transform).sort((a, b) => a - b);
  return { ...level, width: turns % 2 ? level.height : level.width, height: turns % 2 ? level.width : level.height,
    walls: list(level.walls), goals: list(level.goals), boxes: list(level.boxes), player: transform(level.player) };
}

function reverseStart(level, random) {
  const boxes = [...level.boxes], walls = new Set(level.walls), seen = new Set(), counts = boxes.map(() => 0);
  let player = level.player;
  // 从已经验关的机关起点反向拉动，保留窄口与回环；每个起点都有逆向推回的可解路线。
  for (let step = 0, limit = 4 + Math.floor(random() * 9); step < limit; step++) {
    const access = reachable(level, player, boxes), choices = [];
    for (let index = 0; index < boxes.length; index++) for (const direction of directions) {
      const previous = neighbor(boxes[index], direction, level.width, level.height);
      const standing = neighbor(previous, direction, level.width, level.height);
      const key = boxes.map((box, i) => i === index ? previous : box).sort((a, b) => a - b).join(',');
      if (access.has(previous) && standing >= 0 && !walls.has(standing) && !boxes.includes(standing) && !seen.has(key)) {
        choices.push({ index, previous, standing, key });
      }
    }
    if (!choices.length) break;
    const least = Math.min(...choices.map(choice => counts[choice.index]));
    const options = choices.filter(choice => counts[choice.index] === least);
    const choice = options[Math.floor(random() * options.length)];
    boxes[choice.index] = choice.previous; player = choice.standing; counts[choice.index]++; seen.add(choice.key);
  }
  return { ...level, boxes: boxes.sort((a, b) => a - b), player };
}

function involved(level, answer) {
  const identities = new Map(level.boxes.map((box, index) => [box, index])), phases = level.boxes.map(() => 0), pushDirections = new Set();
  let state = createState(level), active = -1;
  for (const direction of answer.directions) {
    const box = neighbor(state.player, direction, level.width, level.height), result = move(level, state, direction);
    if (result.pushed) {
      const index = identities.get(box);
      if (active !== index) { phases[index]++; active = index; }
      identities.delete(box); identities.set(neighbor(box, direction, level.width, level.height), index);
      pushDirections.add(direction);
    }
    state = result.state;
  }
  return phases.every(count => count >= 2) && phases.filter(count => count >= 3).length >= 3 && pushDirections.size >= 3;
}

export function validateLevel(level) {
  const area = level.width * level.height;
  const unique = values => new Set(values).size === values.length;
  const inside = position => Number.isInteger(position) && position >= 0 && position < area;
  // 经典集合包含三行窄廊；三格已能容纳两侧边墙和内部通道。
  if (!Number.isInteger(level.width) || !Number.isInteger(level.height) || level.width < 3 || level.height < 3) return false;
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

export function generateLevel(id, variant = 0) {
  // 正式手工关与候选输出分离，重新生成候选不会覆盖精选的发布数据。
  if (id <= 36) {
    const level = levels[id - 1];
    return variant === 0 ? structuredClone(level) : orient({ ...level, seed: (id * 2654435761 + variant * 1013904223) >>> 0 }, variant % 8);
  }
  const template = endlessTemplate(id, variant), random = randomSource(template.seed);
  // 同一机关和朝向再次出现时，交替使用坐标和为奇／偶数的起点组，避免第一轮与下一轮撞关。
  const group = (Math.floor((id - 37) / (endlessTemplateCount * 8)) + variant) % 2;
  const base = { ...template.level, ...template.starts[group], id, seed: template.seed };
  const orientation = (Math.floor((id - 37) / endlessTemplateCount) + variant) % 8;
  // 性能筛选限制随机候选计算，困难起点使用已离线证明的备用布局；提示仍保留完整预算。
  for (let attempt = 0; attempt < 4; attempt++) {
    const raw = reverseStart(base, random);
    if (raw.boxes.reduce((sum, box) => sum + box, 0) % 2 !== group) continue;
    if (raw.boxes.join(',') === template.level.boxes.join(',')) continue;
    const candidate = orient(raw, orientation);
    let answer;
    try {
      answer = solve(candidate, createState(candidate), 12000);
      if (!answer || answer.pushes < 25 || !involved(candidate, answer)) continue;
      if (solveRestricted(candidate, createState(candidate), 'serial', 12000)) continue;
      if (solveRestricted(candidate, createState(candidate), 'monotone', 12000)) continue;
    } catch (error) {
      // 随机起点可能超出筛选预算，只放弃该候选，绝不视为无解或策略验证通过。
      if (error.message === '求解超出计算上限') continue;
      throw error;
    }
    return { ...candidate, minPushes: answer.pushes };
  }
  // 预算内未选出起点时使用同机关已完整验关的起点，保证手机计算能结束；不会换掉署名来源。
  return orient(base, orientation);
}
