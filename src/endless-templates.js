import templates from './endless-templates.json' with { type: 'json' };
export const endlessTemplateCount = templates.length;

// 界面署名和生成器使用同一编号选择，避免随机起点改编后署错来源。
export function endlessTemplate(id, variant = 0) {
  const seed = (id * 2654435761 + variant * 1013904223) >>> 0;
  // 先轮换不同机关，再切换朝向；随机种子专门构造起点，避免两个随机选择彼此碰撞。
  return { seed, ...templates[(id - 37 + variant) % templates.length] };
}
