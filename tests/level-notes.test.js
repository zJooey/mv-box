import test from 'node:test';
import assert from 'node:assert/strict';
import { levelNote } from '../src/level-notes.js';

// 原创样例没有经典来源字段，正式推广后也必须显示中文署名，不能出现 undefined。
test('所有正式关都有名称、任务和实际的中文署名', () => {
  for (let id = 1; id <= 36; id++) {
    const note = levelNote(id);
    assert.ok(note.title && note.mission);
    assert.equal(typeof note.credit, 'string', '第 ' + id + ' 关缺少署名');
    assert.ok(note.credit.length > 0 && !note.credit.includes('undefined'));
  }
});
