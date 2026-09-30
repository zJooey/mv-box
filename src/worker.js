import { createState } from './core.js';
import { generateLevel } from './generator.js';
import { solve } from './solver.js';

self.onmessage = ({ data }) => {
  const { requestId, kind, payload } = data;
  try {
    const result = kind === 'generate'
      ? generateLevel(payload.id)
      : solve(payload.level, { ...createState(payload.level), player: payload.state.player, boxes: payload.state.boxes });
    self.postMessage({ requestId, result });
  } catch (error) {
    self.postMessage({ requestId, error: error.message });
  }
};
