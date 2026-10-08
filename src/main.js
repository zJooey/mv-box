import * as Phaser from 'phaser';
import levels from './levels.json';
import classicLevels from './classic-levels.json';
import { loadClassicProgress, selectClassicLevel, completeClassicLevel, leaveClassics } from './classic-progress.js';
import { createState, move, undo } from './core.js';
import { directionFromKey } from './controls.js';
import { GameScene } from './game-scene.js';
import { completeLevel, loadProgress, selectLevel } from './progress.js';
import { levelNote } from './level-notes.js';
import './style.css';

const byId = id => document.getElementById(id);
// 引擎初始化完成后才开放输入，避免恢复后期存档时提前操作未绘制的棋盘。
class MainScene extends GameScene {
  create() { super.create(); refreshStats(); }
}
const scene = new MainScene();
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-board',
  width: 720,
  height: 720,
  backgroundColor: '#171b2b',
  pixelArt: true,
  // 画布允许触摸与滚轮原生滚动，角色由页面方向键控制，不拦截宽图拖动。
  input: { touch: { capture: false }, mouse: { preventDefaultWheel: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene
});

const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
const pending = new Map();
let nextRequestId = 1;
worker.onmessage = ({ data }) => {
  const request = pending.get(data.requestId);
  if (!request) return;
  pending.delete(data.requestId);
  data.error ? request.reject(new Error(data.error)) : request.resolve(data.result);
};
worker.onerror = () => {
  for (const request of pending.values()) request.reject(new Error('后台计算失败'));
  pending.clear();
};
function askWorker(kind, payload) {
  const requestId = nextRequestId++;
  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject });
    worker.postMessage({ requestId, kind, payload });
  });
}

let progress = loadProgress(localStorage);
// 经典合集全部开放，完成记录与冒险解锁编号分开保存。
let classicProgress = loadClassicProgress(localStorage);
let currentMode = 'adventure';
let currentLevel = null;
let state = null;
let animating = false;
let finished = false;
let toastTimer;
let loadSequence = 0;
let hintPending = false;
let loading = false;

const chapters = [
  { title: '森林起点', description: '把所有箱子推到青色目标格上。先看清路线，再决定每一步。', difficulty: '初级探险' },
  { title: '暖阳峡谷', description: '新的宝箱加入旅程，留意它们彼此的位置。', difficulty: '进阶挑战' },
  { title: '星光遗迹', description: '规划六个宝箱的推动顺序，破解交错的通道。', difficulty: '高手谜题' }
];

function chapterFor(id) {
  return Math.min(2, Math.floor((id - 1) / 12));
}

function toast(message) {
  const element = byId('toast');
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('visible'), 2800);
}

function refreshHeader() {
  byId('progress-pill').textContent = currentMode === 'classic'
    ? `经典完成 ${classicProgress.completed.length} / ${classicLevels.length}`
    : progress.unlocked <= 36
    ? `已解锁 ${progress.unlocked} / 36`
    : `已完成 ${progress.unlocked - 1} 关`;
}

function refreshStats() {
  byId('moves').textContent = state?.moves ?? 0;
  byId('pushes').textContent = state?.pushes ?? 0;
  byId('box-count').textContent = currentLevel?.boxes.length ?? 1;
  const undosLeft = state?.undosLeft ?? 3;
  byId('undo').innerHTML = `<span>↶</span> 撤销 ${undosLeft}`;
  byId('undo').title = `每局最多撤销 3 次，剩余 ${undosLeft} 次；重开恢复次数`;
  byId('undo').disabled = !state?.history.length || undosLeft === 0 || animating || finished;
  byId('restart').disabled = !scene.ready || !state || animating;
  byId('hint').disabled = !scene.ready || !state || finished || loading || hintPending;
}

function keepPlayerVisible() {
  if (currentMode !== 'classic') return;
  // 宽图起点可能在右端；载入与移动后仅在角色接近可视边缘时调整棋盘滚动。
  const board = byId('game-board'), frame = board.parentElement;
  const unit = board.clientWidth / (currentLevel.width * 70 + 40);
  const x = (20 + (state.player % currentLevel.width + 0.5) * 70) * unit;
  const margin = 70 * unit;
  if (x < frame.scrollLeft + margin) frame.scrollLeft = Math.max(0, x - margin);
  else if (x > frame.scrollLeft + frame.clientWidth - margin) frame.scrollLeft = x - frame.clientWidth + margin;
}

function renderLevelGrid(mode = currentMode) {
  const grid = byId('level-grid');
  grid.replaceChildren();
  for (const name of ['adventure', 'classic']) {
    byId(`${name}-tab`).className = `collection-tab ${name === mode ? 'selected' : ''}`;
    byId(`${name}-tab`).setAttribute('aria-pressed', String(name === mode));
  }
  byId('dialog-eyebrow').textContent = mode === 'classic' ? '经典仓库 / MICROBAN' : '冒险地图 / 01—36';
  byId('dialog-subtitle').textContent = mode === 'classic' ? `Microban 全集 ${classicLevels.length} 关全部开放，按作者原顺序排列。向下滚动选择更多关卡。` : '完成当前关卡，解锁下一段旅程。';
  if (mode === 'classic') {
    byId('endless-button').hidden = true;
    for (const level of classicLevels) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `level-tile classic-tile ${classicProgress.completed.includes(level.id) ? 'completed' : ''} ${currentMode === 'classic' && currentLevel?.id === level.id ? 'current' : ''}`;
      button.innerHTML = `${level.sourceNumber}<small>${level.width}×${level.height}</small>`;
      button.title = `Microban ${level.sourceNumber} · ${level.boxes.length} 箱${classicProgress.completed.includes(level.id) ? ' · 已完成' : ''}`;
      button.disabled = false;
      button.addEventListener('click', () => { byId('level-dialog').close(); return loadLevel(level.id, true); });
      grid.append(button);
    }
    return;
  }
  for (let index = 1; index <= 36; index++) {
    if ([1, 13, 25].includes(index)) {
      const chapter = document.createElement('div');
      chapter.className = 'level-chapter';
      chapter.textContent = `${['第一章', '第二章', '第三章'][Math.floor((index - 1) / 12)]} · ${chapters[chapterFor(index)].title}`;
      grid.append(chapter);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `level-tile ${index < progress.unlocked ? 'completed' : ''} ${index === progress.selected ? 'current' : ''}`;
    button.textContent = index <= progress.unlocked ? String(index) : '🔒';
    button.title = index <= progress.unlocked ? `第 ${index} 关` : `第 ${index} 关尚未解锁`;
    button.disabled = index > progress.unlocked;
    button.addEventListener('click', () => { byId('level-dialog').close(); loadLevel(index); });
    grid.append(button);
  }
  byId('endless-button').hidden = progress.unlocked < 37;
}

async function loadLevel(id, classic = false) {
  if (!classic && id > progress.unlocked) return;
  const sequence = ++loadSequence;
  byId('restart-dialog').close();
  byId('win-overlay').hidden = true;
  byId('board-loading').hidden = false;
  animating = true;
  loading = true;
  finished = false;
  clearTimeout(toastTimer);
  byId('toast').classList.remove('visible');
  refreshStats();
  try {
    const level = classic ? classicLevels.find(item => item.id === id) : id <= 36 ? levels[id - 1] : await askWorker('generate', { id });
    if (sequence !== loadSequence) return;
    currentLevel = level;
    currentMode = classic ? 'classic' : 'adventure';
    state = createState(level);
    if (classic) classicProgress = selectClassicLevel(localStorage, id);
    else { progress = selectLevel(localStorage, id); classicProgress = leaveClassics(localStorage); }
    const chapter = classic ? 2 : chapterFor(id);
    byId('chapter-badge').textContent = classic ? '经典合集 · 原图挑战' : id > 36 ? '无尽探险 · 新的旅程' : `${['第一章', '第二章', '第三章'][chapter]} · ${chapters[chapter].title}`;
    const note = classic ? { title: `Microban ${level.sourceNumber}`, mission: '经典仓库原图：留意窄口、借位和箱子的归位顺序。', credit: `David W. Skinner · Microban 第 ${level.sourceNumber} 关 · 原图` } : levelNote(id);
    byId('level-title').textContent = classic ? note.title : `第 ${id} 关 · ${note.title}`;
    byId('level-description').textContent = note.mission;
    byId('level-credit').textContent = note.credit;
    byId('board-label').textContent = classic ? `Microban ${level.sourceNumber} · ${level.width}×${level.height}` : `${id > 36 ? '无尽探险' : chapters[chapter].title} · 第 ${id} 关`;
    byId('difficulty').textContent = classic ? `${level.boxes.length} 箱 · 经典` : id > 36 ? '无尽挑战' : chapters[chapter].difficulty;
    document.body.dataset.chapter = String(chapter);
    // 经典原图按实际宽高排版，宽图保留可辨认的格子尺寸，由棋盘容器滚动。
    byId('game-board').style.aspectRatio = classic ? `${level.width * 70 + 40} / ${level.height * 70 + 40}` : '1';
    byId('game-board').style.minWidth = classic ? `${level.width * 26 + 16}px` : '0';
    scene.setLevel(level);
    keepPlayerVisible();
    animating = false;
    loading = false;
    refreshHeader();
    refreshStats();
  } catch (error) {
    // 旧生成请求的失败不能解除当前关卡的加载锁或覆盖提示。
    if (sequence !== loadSequence) return;
    toast(`地图生成失败：${error.message}`);
    animating = false;
    loading = false;
    refreshStats();
  } finally {
    if (sequence === loadSequence) byId('board-loading').hidden = true;
  }
}

function finishLevel() {
  finished = true;
  if (currentMode === 'classic') classicProgress = completeClassicLevel(localStorage, currentLevel.id);
  else progress = completeLevel(localStorage, currentLevel.id);
  refreshHeader();
  refreshStats();
  byId('win-copy').textContent = `用了 ${state.moves} 步、推动 ${state.pushes} 次，${currentMode === 'classic' ? '已记入经典完成记录。' : '下一关已解锁。'}`;
  byId('next-level').textContent = currentMode === 'classic' && currentLevel === classicLevels.at(-1) ? '返回经典合集' : '下一关 →';
  byId('win-overlay').hidden = false;
}

function movePlayer(direction) {
  if (!scene.ready || !state || animating || finished || byId('restart-dialog').open) return;
  const sequence = loadSequence;
  const previous = state;
  const result = move(currentLevel, state, direction);
  if (!result.moved) return;
  state = result.state;
  animating = true;
  refreshStats();
  scene.animateMove(previous, state, () => {
    if (sequence !== loadSequence) return;
    animating = false;
    if (result.won) finishLevel();
    else refreshStats();
  });
  keepPlayerVisible();
}

function undoMove() {
  if (!state || animating || finished || !state.history.length || state.undosLeft === 0) return;
  state = undo(state);
  scene.setState(state);
  keepPlayerVisible();
  refreshStats();
}

function restartLevel() {
  if (!scene.ready || !currentLevel || animating) return;
  state = createState(currentLevel);
  finished = false;
  byId('win-overlay').hidden = true;
  scene.setState(state);
  keepPlayerVisible();
  clearTimeout(toastTimer);
  byId('toast').classList.remove('visible');
  refreshStats();
}

async function showHint() {
  if (!scene.ready || !state || finished || loading || hintPending) return;
  const snapshot = state;
  const sequence = loadSequence;
  hintPending = true;
  refreshStats();
  byId('hint').textContent = '正在思考…';
  try {
    const answer = await askWorker('hint', { level: currentLevel, state: { player: snapshot.player, boxes: snapshot.boxes } });
    if (sequence !== loadSequence || snapshot !== state) return;
    if (!answer) toast(state.undosLeft ? '这个局面已经无解，试试撤销或重开。' : '这个局面已经无解，撤销次数已用完，请重开本关。');
    else if (answer.directions.length) {
      const direction = answer.directions[0];
      scene.showHint(direction, state.player);
      toast(`下一步：向${{ up: '上', down: '下', left: '左', right: '右' }[direction]}移动`);
    }
  } catch (error) {
    if (sequence !== loadSequence || snapshot !== state) return;
    toast(error.message === '求解超出计算上限'
      ? '这一步还没算完，请先移动、撤销或重开后再试。'
      : '提示暂时不可用，请稍后再试。');
  } finally {
    hintPending = false;
    refreshStats();
    byId('hint').innerHTML = '<span>✧</span> 提示下一步';
  }
}

document.addEventListener('keydown', event => {
  const direction = directionFromKey(event);
  if (!direction || byId('level-dialog').open || byId('restart-dialog').open) return;
  event.preventDefault();
  movePlayer(direction);
});
document.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => movePlayer(button.dataset.direction)));
byId('undo').addEventListener('click', undoMove);
// 防止触屏误点清空局面；默认焦点放在取消，方向键不会穿透确认框。
byId('restart').addEventListener('click', () => {
  if (scene.ready && currentLevel && !animating) byId('restart-dialog').showModal();
});
byId('cancel-restart').addEventListener('click', () => byId('restart-dialog').close());
byId('confirm-restart').addEventListener('click', () => { byId('restart-dialog').close(); restartLevel(); });
byId('hint').addEventListener('click', showHint);
for (const id of ['open-levels', 'open-levels-side']) byId(id).addEventListener('click', () => { renderLevelGrid(); byId('level-dialog').showModal(); });
byId('close-levels').addEventListener('click', () => byId('level-dialog').close());
byId('adventure-tab').addEventListener('click', () => renderLevelGrid('adventure'));
byId('classic-tab').addEventListener('click', () => renderLevelGrid('classic'));
byId('endless-button').addEventListener('click', () => { byId('level-dialog').close(); loadLevel(Math.max(37, progress.unlocked)); });
byId('replay-level').addEventListener('click', () => { byId('win-overlay').hidden = true; restartLevel(); });
byId('next-level').addEventListener('click', () => {
  if (currentMode !== 'classic') return loadLevel(currentLevel.id + 1);
  const next = classicLevels[classicLevels.indexOf(currentLevel) + 1];
  if (next) return loadLevel(next.id, true);
  renderLevelGrid('classic'); byId('level-dialog').showModal();
});

// 手机旋转或窗口缩窄会改变可视宽度，已有角色仍应留在可视范围内。
window.addEventListener('resize', keepPlayerVisible);

refreshHeader();
loadLevel(classicProgress.active ? classicProgress.selected : progress.selected, classicProgress.active);
