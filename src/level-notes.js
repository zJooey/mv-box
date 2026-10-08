import notes from './level-notes.json' with { type: 'json' };
import { endlessTemplate } from './endless-templates.js';

// 关卡署名独立于既有地图字段和进度存档，机关证据不展示给正在解题的玩家。
export function levelNote(id) {
  if (id <= 36) return notes[id];
  const template = endlessTemplate(id);
  return {
    title: '新的中转任务',
    mission: '观察共用窄口，安排六个箱子的暂存与回运。',
    credit: template.note.credit.replace(/^基于 /, '').replace(/，.*$/, '') + '，无尽起点改编'
  };
}
