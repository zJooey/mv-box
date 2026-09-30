const key = 'sokoban-progress';

export function loadProgress(storage) {
  try {
    const data = JSON.parse(storage.getItem(key));
    if (Number.isInteger(data?.unlocked) && data.unlocked >= 1 && Number.isInteger(data?.selected) && data.selected >= 1 && data.selected <= data.unlocked) {
      return { unlocked: data.unlocked, selected: data.selected };
    }
  } catch {
    // 浏览器存储内容损坏时，从第一关重新开始。
  }
  return { unlocked: 1, selected: 1 };
}

export function completeLevel(storage, levelId) {
  const progress = loadProgress(storage);
  progress.unlocked = Math.max(progress.unlocked, levelId + 1);
  storage.setItem(key, JSON.stringify(progress));
  return progress;
}

export function selectLevel(storage, levelId) {
  const progress = loadProgress(storage);
  if (levelId > progress.unlocked || levelId < 1) return progress;
  progress.selected = levelId;
  storage.setItem(key, JSON.stringify(progress));
  return progress;
}
