import test from 'node:test';
import assert from 'node:assert/strict';
import { parseClassicMaps } from '../scripts/classic-format.js';
import { createState, move } from '../src/core.js';
import { validateLevel } from '../src/generator.js';

// 手写非方形凹边地图：外侧空白是虚空，室内空白仍可行走。
const text = '; 7\n\n  #####\n###   #\n# @$. #\n#######\n';
test('导入经典图保留宽高、原编号与凹边，外侧空白不可行走', () => {
  const [level] = parseClassicMaps(text);
  assert.equal(level.sourceNumber, 7);
  assert.equal(level.width, 7); assert.equal(level.height, 4);
  assert.deepEqual(level.voids, [0, 1]);
  assert.ok(level.walls.includes(0)); assert.ok(!level.walls.includes(10));
  assert.equal(level.player, 16); assert.deepEqual(level.boxes, [17]);
  assert.deepEqual(level.goals, [18]); assert.equal(validateLevel(level), true);
  assert.equal(move(level, createState(level), 'right').won, true);
});

test('导入边界拒绝角色缺失、箱目标不匹配及未知图符', () => {
  for (const invalid of [text.replace('@', ' '), text.replace('.', ' '), text.replace('$', '?')]) {
    assert.throws(() => parseClassicMaps(invalid));
  }
});

test('作者文本中的单引号关卡标题不会被当作地图行', () => {
  const [level] = parseClassicMaps(text.replace('; 7', "; 7\n'转角仓库'"));
  assert.equal(level.width, 7); assert.equal(level.height, 4);
});

test('经典三行窄廊不需要为了校验补成方形', () => {
  const [level] = parseClassicMaps('; 44\n#####\n#@$.#\n#####\n');
  assert.equal(level.width, 5); assert.equal(level.height, 3);
  assert.equal(validateLevel(level), true);
});
