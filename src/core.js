const offsets = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0]
};

export function neighbor(index, direction, width, height) {
  const [dx, dy] = offsets[direction];
  const x = index % width + dx;
  const y = Math.floor(index / width) + dy;
  return x < 0 || y < 0 || x >= width || y >= height ? -1 : y * width + x;
}

export function createState(level) {
  return { player: level.player, boxes: [...level.boxes].sort((a, b) => a - b), history: [], moves: 0, pushes: 0 };
}

export function move(level, state, direction) {
  const next = neighbor(state.player, direction, level.width, level.height);
  const blocked = { state, moved: false, pushed: false, won: false };
  if (next === -1 || level.walls.includes(next)) return blocked;

  const boxes = [...state.boxes];
  const boxPosition = boxes.indexOf(next);
  const pushed = boxPosition !== -1;
  if (pushed) {
    const beyond = neighbor(next, direction, level.width, level.height);
    if (beyond === -1 || level.walls.includes(beyond) || boxes.includes(beyond)) return blocked;
    boxes[boxPosition] = beyond;
    boxes.sort((a, b) => a - b);
  }

  // 仅记录有效移动，撤销时恢复角色、箱子和计数。
  const previous = { player: state.player, boxes: state.boxes, moves: state.moves, pushes: state.pushes };
  const updated = {
    player: next,
    boxes,
    history: [...state.history, previous],
    moves: state.moves + 1,
    pushes: state.pushes + Number(pushed)
  };
  return { state: updated, moved: true, pushed, won: boxes.every(box => level.goals.includes(box)) };
}

export function undo(state) {
  if (state.history.length === 0) return state;
  const previous = state.history.at(-1);
  return { ...previous, history: state.history.slice(0, -1) };
}
