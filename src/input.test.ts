import { describe, expect, it } from 'vitest';
import { recognizeMotion } from './input';

describe('arcade command recognition', () => {
  const motion = (directions: number[]) => directions.map((direction, i) => ({ direction, time: i * 40 }));
  it('recognizes forward and backward quarter circles', () => {
    expect(recognizeMotion(motion([2, 3, 6]), 130)).toBe('special1');
    expect(recognizeMotion(motion([2, 1, 4]), 130)).toBe('special2');
  });
  it('gives a double quarter circle priority over the single command', () => {
    expect(recognizeMotion(motion([2, 3, 6, 5, 2, 3, 6]), 300)).toBe('super');
  });
  it('rejects stale or incomplete commands', () => {
    expect(recognizeMotion(motion([2, 3, 6]), 650)).toBeNull();
    expect(recognizeMotion(motion([2, 3]), 100)).toBeNull();
    expect(recognizeMotion(motion([6, 3, 2]), 100)).toBeNull();
  });
});
