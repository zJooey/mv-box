import test from 'node:test';
import assert from 'node:assert/strict';
import * as solver from '../src/solver.js';
import { createState, move } from '../src/core.js';

// 两个箱子互相占住推动站位，必须先把右箱停进侧袋再处理左箱。
const borrow = {
  width: 7, height: 7,
  walls: [0,1,2,3,4,5,6,7,13,14,17,19,20,21,27,28,31,33,34,35,41,42,43,44,45,46,47,48],
  goals: [23,26], boxes: [24,25], player: 38
};
const direct = {
  width: 5, height: 5,
  walls: [0,1,2,3,4,5,9,10,14,15,19,20,21,22,23,24],
  goals: [13], boxes: [12], player: 11
};

test('受限求解能完成普通直推关卡，不会把简单关误认成策略关', () => {
  assert.equal(typeof solver.solveRestricted, 'function');
  for (const mode of ['serial', 'monotone', 'two-phases']) {
    assert.deepEqual(solver.solveRestricted(direct, createState(direct), mode), { directions: ['right'], pushes: 1 });
  }
});

test('两阶段验关允许暂存箱子，推动别箱后再回来归位', () => {
  const oneBorrow = { ...borrow, walls: borrow.walls.filter(position => position !== 17) };
  const answer = solver.solveRestricted(oneBorrow, createState(oneBorrow), 'two-phases');
  assert.ok(answer);
  assert.equal(answer.pushes, 4);
  assert.equal(solver.solveRestricted(oneBorrow, createState(oneBorrow), 'serial'), null);
});

test('必须借位的双箱关不能逐箱归位，也不能始终缩短目标推距', () => {
  assert.equal(typeof solver.solveRestricted, 'function');
  const answer = solver.solve(borrow, createState(borrow));
  // 左箱上目标后还要让出推动站位，再返回目标，因此至少需要六次推动。
  assert.equal(answer.pushes, 6);
  let state = createState(borrow);
  for (const direction of answer.directions) state = move(borrow, state, direction).state;
  assert.ok(state.boxes.every(box => borrow.goals.includes(box)));
  assert.equal(solver.solveRestricted(borrow, createState(borrow), 'serial'), null);
  assert.equal(solver.solveRestricted(borrow, createState(borrow), 'monotone'), null);
});

test('策略证明达到计算预算时明确失败，不能误报已经证明', () => {
  assert.equal(typeof solver.solveRestricted, 'function');
  assert.throws(() => solver.solveRestricted(borrow, createState(borrow), 'serial', 0), /求解超出计算上限/);
});

test('逐箱验关允许把当前箱子推过近目标再送到远目标', () => {
  // 窄仓有前后两个目标；首箱必须经过近目标，若强制封存就会漏掉合法直推解。
  const rows = ['######', '##.###', '##.###', '#  # #', '#  $ #', '#  $ #', '# @  #', '######'];
  const level = { width: 6, height: 8, walls: [], goals: [], boxes: [], player: 0 };
  rows.forEach((row, y) => [...row].forEach((tile, x) => {
    const position = y * level.width + x;
    if (tile === '#') level.walls.push(position);
    if (tile === '.') level.goals.push(position);
    if (tile === '$') level.boxes.push(position);
    if (tile === '@') level.player = position;
  }));
  const answer = solver.solveRestricted(level, createState(level), 'serial');
  // 两箱各向左一次、向上三次：首箱过近目标后继续进深处，共八次推动。
  assert.equal(answer.pushes, 8);
  let state = createState(level);
  for (const direction of answer.directions) state = move(level, state, direction).state;
  assert.ok(state.boxes.every(box => level.goals.includes(box)));
});
