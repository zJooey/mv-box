export function directionFromKey(event) {
  if (event.repeat) return null;
  return { ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left', w: 'up', d: 'right', s: 'down', a: 'left' }[event.key] ?? null;
}
