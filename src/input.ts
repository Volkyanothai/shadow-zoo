import type { AttackId, PlayerInput } from './types';

const ATTACK_KEYS: Record<string, AttackId> = {
  KeyU: 'lp', KeyI: 'mp', KeyO: 'hp', KeyJ: 'lk', KeyK: 'mk', KeyL: 'hk',
  KeyQ: 'special1', KeyE: 'special2', KeyR: 'super',
};
const DIRECTION_KEYS: Record<string, 'left' | 'right' | 'up' | 'down'> = {
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
};

/** Direction history uses facing-relative numpad notation: 2 down, 6 forward. */
export function recognizeMotion(history: { direction: number; time: number }[], now: number): AttackId | null {
  const recent = history.filter((entry) => entry.direction !== 5 && now - entry.time <= 750);
  const matches = (pattern: number[], window: number) => {
    const tail = recent.slice(-pattern.length);
    return tail.length === pattern.length && now - tail[0].time <= window
      && tail.every((entry, i) => entry.direction === pattern[i]);
  };
  if (matches([2, 3, 6, 2, 3, 6], 750)) return 'super';
  if (matches([2, 3, 6], 400)) return 'special1';
  if (matches([2, 1, 4], 400)) return 'special2';
  return null;
}

export class ArcadeInput {
  private keys = new Set<string>();
  private touch = new Set<'left' | 'right' | 'up' | 'down'>();
  private taps: { attack: AttackId; time: number }[] = [];
  private history: { direction: number; time: number }[] = [];
  private lastDirection = 5;
  facing: 1 | -1 = 1;

  constructor(private readonly onAction: (action: 'pause' | 'resume' | 'unlock') => void) {
    document.addEventListener('keydown', this.keyDown);
    document.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.clear);
  }

  private isEditing(event: KeyboardEvent) {
    const element = event.target as HTMLElement | null;
    return element?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element?.tagName ?? '');
  }

  private keyDown = (event: KeyboardEvent) => {
    if (this.isEditing(event)) return;
    if (ATTACK_KEYS[event.code] || DIRECTION_KEYS[event.code] || ['KeyP', 'Escape'].includes(event.code)) {
      event.preventDefault();
      this.onAction('unlock');
    }
    if (event.repeat) return;
    this.keys.add(event.code);
    this.recordDirection();
    const attack = ATTACK_KEYS[event.code];
    if (attack) this.press(attack);
    if (event.code === 'KeyP' || event.code === 'Escape') this.onAction('pause');
    if (event.code === 'Enter') this.onAction('resume');
  };

  private keyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
    this.recordDirection();
  };

  private directionPressed(direction: 'left' | 'right' | 'up' | 'down') {
    return this.touch.has(direction) || [...this.keys].some((key) => DIRECTION_KEYS[key] === direction);
  }

  private recordDirection() {
    const forward = this.directionPressed(this.facing === 1 ? 'right' : 'left');
    const back = this.directionPressed(this.facing === 1 ? 'left' : 'right');
    const down = this.directionPressed('down');
    const up = this.directionPressed('up');
    const direction = down ? forward ? 3 : back ? 1 : 2 : up ? forward ? 9 : back ? 7 : 8 : forward ? 6 : back ? 4 : 5;
    if (direction !== this.lastDirection) {
      const now = performance.now();
      this.history.push({ direction, time: now });
      this.history = this.history.filter((entry) => now - entry.time < 900).slice(-24);
      this.lastDirection = direction;
    }
  }

  press(attack: AttackId) {
    this.onAction('unlock');
    this.recordDirection();
    const motion = ['lp', 'mp', 'hp'].includes(attack) ? recognizeMotion(this.history, performance.now()) : null;
    this.taps.push({ attack: motion ?? attack, time: performance.now() });
    this.taps = this.taps.slice(-4);
    if (motion) this.history = [];
  }

  setDirection(direction: 'left' | 'right' | 'up' | 'down', pressed: boolean) {
    this.onAction('unlock');
    if (pressed) this.touch.add(direction);
    else this.touch.delete(direction);
    this.recordDirection();
  }

  sample(): PlayerInput {
    this.recordDirection();
    this.taps = this.taps.filter((tap) => performance.now() - tap.time < 160);
    return {
      left: this.directionPressed('left'), right: this.directionPressed('right'),
      up: this.directionPressed('up'), down: this.directionPressed('down'),
      attack: this.taps.shift()?.attack ?? null,
    };
  }

  clear = () => {
    this.keys.clear(); this.touch.clear(); this.taps = []; this.history = []; this.lastDirection = 5;
  };

  destroy() {
    document.removeEventListener('keydown', this.keyDown);
    document.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.clear);
  }
}
