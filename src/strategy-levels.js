// 首批手绘策略关，与正式关卡和自动候选分开保存，试玩通过后才替换正式数据。
// 用户认可后四个样例已原样推广；这里继续保留独立试玩与回归验关数据。
// 后两关引入 David W. Skinner 的署名经典布局：第 24 关保留谜题，第 36 关保留墙体并重编起点。
const sketches = [
  { id: 3, minPushes: 6, rows: [
    '#######',
    '#     #',
    '#  # ##',
    '# .$$.#',
    '#  # ##',
    '#  @  #',
    '#######'
  ] },
  { id: 12, minPushes: 10, rows: [
    '#######',
    '# .   #',
    '#  # ##',
    '# .$$.#',
    '#  # ##',
    '#   $ #',
    '#   @ #',
    '#######'
  ] },
  { id: 24, minPushes: 39, rows: [
    '#########',
    '####   ##',
    '#### # ##',
    '# . .# ##',
    '#  .   ##',
    '# .## $##',
    '##  #$$ #',
    '###   $@#',
    '####  ###',
    '#########'
  ] },
  { id: 36, minPushes: 48, rows: [
    '##########',
    '#  ### @##',
    '#  # $$$##',
    '# $$ #  ##',
    '#    #  ##',
    '### $.#  #',
    '###.... .#',
    '####   ###',
    '##########'
  ] }
];

export const previewLevels = sketches.map(({ id, minPushes, rows }) => {
  // 手绘地图入口检查漏格或误写符号，避免把排版错误当成地板发布。
  if (rows.some(row => row.length !== rows[0].length || /[^# .$@]/.test(row))) throw new Error('手绘地图存在漏格或未知符号');
  const level = { id, width: rows[0].length, height: rows.length, walls: [], goals: [], boxes: [], player: -1, seed: 2026100800 + id, minPushes };
  rows.forEach((row, y) => [...row].forEach((tile, x) => {
    const position = y * level.width + x;
    if (tile === '#') level.walls.push(position);
    if (tile === '.') level.goals.push(position);
    if (tile === '$') level.boxes.push(position);
    if (tile === '@') level.player = position;
  }));
  return level;
});

// 设计证据供离线验关使用；试玩界面只展示名称与简短任务，不直接展示解法。
export const designNotes = {
  3: { title: '借位初试', mission: '两个箱子共用推动站位，找一处临时停靠点。', mechanism: '右箱必须先借侧袋；左箱到目标后还要离开目标，为右箱让出推动站位。' },
  12: { title: '回程借道', mission: '三个箱子需要通过同一条回程通道。', mechanism: '下方箱子要转向并穿过左侧窄口；双箱占住中间推动站位，必须交替操作并向远离目标的方向借位。' },
  24: {
    title: '回环换位', mission: '四箱挤在转弯处，观察两个回环和中间的窄口。',
    mechanism: '底部叠箱互相占住转向站位，上部目标占据回环连接处。箱子要穿过窄口，又要返回为后续箱子腾路；每箱只操作两个阶段仍无解。',
    credit: 'David W. Skinner · Sasquatch V 第 3 关',
    prematureGoalRoute: 'left,left,up,up,down,down,right,right,up,left,down,left,up,right,up,up,left,left,left,up,left,down'.split(',')
  },
  36: {
    title: '交错中转', mission: '六箱分占两侧房间，中转口与目标共用空间。',
    mechanism: '右侧三个叠箱需要交换运送位置，左侧双箱又占住换位站位；侧目标是两室共用的中转口，提前占用会阻断整批运输。最优路线中六箱均出现转向与反向回运。',
    credit: '基于 David W. Skinner · Sasquatch V 第 4 关，起点重编',
    prematureGoalRoute: 'down,down,down,down,right,down,left,left,down,left,up'.split(',')
  }
};
