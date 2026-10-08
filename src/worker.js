import { createState } from './core.js';
import { generateLevel } from './generator.js';
import { solve } from './solver.js';

self.onmessage = ({ data }) => {
  const { requestId, kind, payload } = data;
  try {
    const result = kind === 'generate'
      ? generateLevel(payload.id)
      // 大型经典图的提示最多搜索六秒；超时仍报告尚未算完，不判断为无解。
      : solve(payload.level, { ...createState(payload.level), player: payload.state.player, boxes: payload.state.boxes }, 100000, 6000);
    self.postMessage({ requestId, result });
  } catch (error) {
    self.postMessage({ requestId, error: error.message });
  }
};
