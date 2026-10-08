import classicLevels from './classic-levels.json' with { type: 'json' };

const key = 'sokoban-classic-progress';
const ids = new Set(classicLevels.map(level => level.id));

export function loadClassicProgress(storage) {
  try {
    const data = JSON.parse(storage.getItem(key));
    // 浏览器数据可能损坏，或未来精选列表变化使旧编号不存在；只在存档读取边界校验。
    if (ids.has(data?.selected) && typeof data.active === 'boolean' && Array.isArray(data.completed) && data.completed.every(id => ids.has(id))) {
      return { selected: data.selected, active: data.active, completed: [...new Set(data.completed)] };
    }
  } catch {
    // 损坏的经典存档从首张发布地图恢复，不影响冒险存档。
  }
  return { selected: classicLevels[0].id, active: false, completed: [] };
}

export function selectClassicLevel(storage, id) {
  const progress = { ...loadClassicProgress(storage), selected: id, active: true };
  storage.setItem(key, JSON.stringify(progress));
  return progress;
}

export function completeClassicLevel(storage, id) {
  const progress = loadClassicProgress(storage);
  if (!progress.completed.includes(id)) progress.completed.push(id);
  storage.setItem(key, JSON.stringify(progress));
  return progress;
}

export function leaveClassics(storage) {
  const progress = { ...loadClassicProgress(storage), active: false };
  storage.setItem(key, JSON.stringify(progress));
  return progress;
}
