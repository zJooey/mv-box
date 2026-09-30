import * as Phaser from 'phaser';
import levels from './levels.json';
import { createState, move, undo } from './core.js';
import { directionFromKey } from './controls.js';
import { GameScene } from './game-scene.js';
import { completeLevel, loadProgress, selectLevel } from './progress.js';
import './style.css';

const byId = id => document.getElementById(id);
const scene = new GameScene();
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-board',
  width: 720,
  height: 720,
  backgroundColor: '#171b2b',
  pixelArt: true,
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
let currentLevel = null;
let state = null;
let animating = false;
let finished = false;
let toastTimer;
let loadSequence = 0;

const chapters = [
  { title: '森林起点', description: '把所有箱子推到青色目标格上。先看清路线，再决定每一步。', difficulty: '初级探险' },
  { title: '暖阳峡谷', description: '新的宝箱加入旅程，留意它们彼此的位置。', difficulty: '进阶挑战' },
  { title: '星光遗迹', description: '让四个宝箱各归其位，完成真正的探险考验。', difficulty: '高手谜题' }
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
  byId('progress-pill').textContent = progress.unlocked <= 36
    ? `已解锁 ${progress.unlocked} / 36`
    : `已完成 ${progress.unlocked - 1} 关`;
}

function refreshStats() {
  byId('moves').textContent = state?.moves ?? 0;
  byId('pushes').textContent = state?.pushes ?? 0;
  byId('box-count').textContent = currentLevel?.boxes.length ?? 1;
  byId('undo').disabled = !state?.history.length || animating || finished;
}

function renderLevelGrid() {
  const grid = byId('level-grid');
  grid.replaceChildren();
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

async function loadLevel(id) {
  if (id > progress.unlocked) return;
  const sequence = ++loadSequence;
  byId('win-overlay').hidden = true;
  byId('board-loading').hidden = false;
  animating = true;
  finished = false;
  try {
    const level = id <= 36 ? levels[id - 1] : await askWorker('generate', { id });
    if (sequence !== loadSequence) return;
    currentLevel = level;
    state = createState(level);
    progress = selectLevel(localStorage, id);
    const chapter = chapterFor(id);
    byId('chapter-badge').textContent = id > 36 ? '无尽探险 · 新的旅程' : `${['第一章', '第二章', '第三章'][chapter]} · ${chapters[chapter].title}`;
    byId('level-title').textContent = `第 ${id} 关`;
    byId('level-description').textContent = id > 36 ? '前方还有新的谜题，看看这一次你会如何安排路线。' : chapters[chapter].description;
    byId('board-label').textContent = `${id > 36 ? '无尽探险' : chapters[chapter].title} · 第 ${id} 关`;
    byId('difficulty').textContent = id > 36 ? '无尽挑战' : chapters[chapter].difficulty;
    document.body.dataset.chapter = String(chapter);
    scene.setLevel(level);
    animating = false;
    refreshHeader();
    refreshStats();
  } catch (error) {
    toast(`地图生成失败：${error.message}`);
    animating = false;
  } finally {
    if (sequence === loadSequence) byId('board-loading').hidden = true;
  }
}

function finishLevel() {
  finished = true;
  progress = completeLevel(localStorage, currentLevel.id);
  refreshHeader();
  refreshStats();
  byId('win-copy').textContent = `用了 ${state.moves} 步、推动 ${state.pushes} 次，下一关已解锁。`;
  byId('win-overlay').hidden = false;
}

function movePlayer(direction) {
  if (!state || animating || finished) return;
  const previous = state;
  const result = move(currentLevel, state, direction);
  if (!result.moved) return;
  state = result.state;
  animating = true;
  refreshStats();
  scene.animateMove(previous, state, () => {
    animating = false;
    if (result.won) finishLevel();
    else refreshStats();
  });
}

function undoMove() {
  if (!state || animating || finished || !state.history.length) return;
  state = undo(state);
  scene.setState(state);
  refreshStats();
}

function restartLevel() {
  if (!currentLevel || animating) return;
  state = createState(currentLevel);
  finished = false;
  byId('win-overlay').hidden = true;
  scene.setState(state);
  refreshStats();
}

async function showHint() {
  if (!state || finished) return;
  const snapshot = state;
  byId('hint').disabled = true;
  byId('hint').textContent = '正在思考…';
  try {
    const answer = await askWorker('hint', { level: currentLevel, state: { player: snapshot.player, boxes: snapshot.boxes } });
    if (snapshot !== state) return;
    if (!answer) toast('这个局面已经无解，试试撤销或重开。');
    else if (answer.directions.length) {
      const direction = answer.directions[0];
      scene.showHint(direction, state.player);
      toast(`下一步：向${{ up: '上', down: '下', left: '左', right: '右' }[direction]}移动`);
    }
  } catch {
    toast('提示暂时不可用，请稍后再试。');
  } finally {
    byId('hint').disabled = false;
    byId('hint').innerHTML = '<span>✧</span> 提示下一步';
  }
}

document.addEventListener('keydown', event => {
  const direction = directionFromKey(event);
  if (!direction || byId('level-dialog').open) return;
  event.preventDefault();
  movePlayer(direction);
});
document.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => movePlayer(button.dataset.direction)));
byId('undo').addEventListener('click', undoMove);
byId('restart').addEventListener('click', restartLevel);
byId('hint').addEventListener('click', showHint);
for (const id of ['open-levels', 'open-levels-side']) byId(id).addEventListener('click', () => { renderLevelGrid(); byId('level-dialog').showModal(); });
byId('close-levels').addEventListener('click', () => byId('level-dialog').close());
byId('endless-button').addEventListener('click', () => { byId('level-dialog').close(); loadLevel(Math.max(37, progress.unlocked)); });
byId('replay-level').addEventListener('click', () => { byId('win-overlay').hidden = true; restartLevel(); });
byId('next-level').addEventListener('click', () => loadLevel(currentLevel.id + 1));

refreshHeader();
loadLevel(progress.selected);
