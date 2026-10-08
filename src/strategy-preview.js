import * as Phaser from 'phaser';
import { previewLevels, designNotes } from './strategy-levels.js';
import { createState, move, undo } from './core.js';
import { directionFromKey } from './controls.js';
import { GameScene } from './game-scene.js';
import './style.css';
import './strategy-preview.css';

// 独立试玩入口没有存档模块：选关、过关、刷新均不写正式游戏进度。
const byId = id => document.getElementById(id);
// 引擎首次创建完成后再开启操作，手机加载较慢时不能先改变局面再调用动画。
class PreviewScene extends GameScene {
  create() {
    super.create();
    refreshStats();
  }
}
const scene = new PreviewScene();
new Phaser.Game({
  type: Phaser.AUTO, parent: 'game-board', width: 720, height: 720,
  backgroundColor: '#171b2b', pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene
});
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
let level;
let state;
let animating = false;
let finished = false;
let sequence = 0;
let hintRequest = null;
let requestId = 0;
let toastTimer;

function toast(message) {
  byId('toast').textContent = message;
  byId('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => byId('toast').classList.remove('visible'), 3000);
}

function refreshStats() {
  byId('moves').textContent = state.moves;
  byId('pushes').textContent = state.pushes;
  byId('box-count').textContent = level.boxes.length;
  byId('undo').innerHTML = '<span>↶</span> 撤销 ' + state.undosLeft;
  byId('undo').title = '每局最多撤销 3 次，剩余 ' + state.undosLeft + ' 次；重开恢复次数';
  byId('undo').disabled = !scene.ready || animating || finished || !state.history.length || state.undosLeft === 0;
  byId('restart').disabled = !scene.ready || animating;
  byId('hint').disabled = !scene.ready || Boolean(hintRequest);
  document.querySelectorAll('[data-direction]').forEach(button => { button.disabled = !scene.ready || finished; });
}

function loadLevel(id) {
  sequence++;
  byId('restart-dialog').close();
  clearTimeout(toastTimer);
  byId('toast').classList.remove('visible');
  level = previewLevels.find(item => item.id === id);
  state = createState(level);
  animating = false;
  finished = false;
  byId('win-overlay').hidden = true;
  const note = designNotes[id];
  byId('level-title').textContent = note.title;
  byId('level-description').textContent = note.mission;
  byId('level-credit').textContent = note.credit || '本游戏原创入门机关';
  byId('board-label').textContent = '第 ' + id + ' 关 · ' + note.title;
  byId('difficulty').textContent = level.boxes.length + ' 箱挑战';
  document.body.dataset.chapter = String(Math.min(2, Math.floor((id - 1) / 12)));
  document.querySelectorAll('[data-level]').forEach(button => {
    const selected = Number(button.dataset.level) === id;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  scene.setLevel(level);
  refreshStats();
}

function movePlayer(direction) {
  if (!scene.ready || animating || finished || byId('restart-dialog').open) return;
  const previous = state;
  const result = move(level, state, direction);
  if (!result.moved) return;
  const moveSequence = sequence;
  state = result.state;
  animating = true;
  refreshStats();
  scene.animateMove(previous, state, () => {
    // 快速切关会使旧动画的回调晚到，不能让它完成新关或修改新关的按钮。
    if (moveSequence !== sequence) return;
    animating = false;
    finished = result.won;
    refreshStats();
    if (finished) {
      byId('win-copy').textContent = '用了 ' + state.moves + ' 步、推动 ' + state.pushes + ' 次。试试下一个机关！';
      byId('win-overlay').hidden = false;
    }
  });
}

function resetHintButton() {
  byId('hint').disabled = !scene.ready;
  byId('hint').innerHTML = '<span>✧</span> 提示下一步';
}

function showHint() {
  if (!scene.ready || finished || hintRequest) return;
  hintRequest = { requestId: ++requestId, snapshot: state, sequence };
  byId('hint').disabled = true;
  byId('hint').textContent = '正在思考…';
  worker.postMessage({ requestId, kind: 'hint', payload: { level, state: { player: state.player, boxes: state.boxes } } });
}

worker.onmessage = ({ data }) => {
  if (!hintRequest || data.requestId !== hintRequest.requestId) return;
  const request = hintRequest;
  hintRequest = null;
  resetHintButton();
  // 后台思考时仍可移动和切关；过期结果不能指示另一局面的下一步。
  if (request.snapshot !== state || request.sequence !== sequence) return;
  if (data.error) {
    toast(data.error === '求解超出计算上限' ? '计算还未完成，请先移动、撤销或重开后再试。' : '提示计算失败，请再试一次。');
  } else if (!data.result) {
    toast(state.undosLeft ? '这个局面已经无解，试试撤销或重开。' : '这个局面已经无解，撤销次数已用完，请重开本关。');
  } else if (data.result.directions.length) {
    const direction = data.result.directions[0];
    scene.showHint(direction, state.player);
    toast('下一步：向' + { up: '上', down: '下', left: '左', right: '右' }[direction] + '移动');
  }
};
worker.onerror = () => {
  hintRequest = null;
  resetHintButton();
  toast('后台计算失败，请刷新试玩页后再试。');
};

document.addEventListener('keydown', event => {
  const direction = directionFromKey(event);
  if (!direction || byId('restart-dialog').open) return;
  event.preventDefault();
  movePlayer(direction);
});
document.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => movePlayer(button.dataset.direction)));
document.querySelectorAll('[data-level]').forEach(button => button.addEventListener('click', () => loadLevel(Number(button.dataset.level))));
byId('undo').addEventListener('click', () => {
  if (!scene.ready || animating || finished || !state.history.length || state.undosLeft === 0) return;
  state = undo(state);
  scene.setState(state);
  refreshStats();
});
// 试玩与正式入口保持同样的防误触确认，过关后的再玩一次仍直接开始。
byId('restart').addEventListener('click', () => { if (scene.ready && !animating) byId('restart-dialog').showModal(); });
byId('cancel-restart').addEventListener('click', () => byId('restart-dialog').close());
byId('confirm-restart').addEventListener('click', () => { byId('restart-dialog').close(); loadLevel(level.id); });
byId('hint').addEventListener('click', showHint);
byId('replay-level').addEventListener('click', () => loadLevel(level.id));
byId('next-level').addEventListener('click', () => loadLevel(previewLevels[(previewLevels.indexOf(level) + 1) % previewLevels.length].id));
loadLevel(3);
