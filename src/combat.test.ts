import { describe, expect, it } from 'vitest';
import { ATTACKS, CombatEngine } from './combat';
import { EMPTY_INPUT, FLOOR, type AttackId, type PlayerInput } from './types';

const neutral = (): PlayerInput => ({ ...EMPTY_INPUT });
const attack = (id: AttackId): PlayerInput => ({ ...EMPTY_INPUT, attack: id });

function advance(engine: CombatEngine, frames: number, input = neutral(), opponent = neutral()): void {
  for (let i = 0; i < frames; i++) engine.step(input, opponent);
}

function ready(): CombatEngine {
  const engine = new CombatEngine('leo', false);
  engine.start();
  advance(engine, 180);
  engine.drainEvents();
  return engine;
}

function close(engine: CombatEngine, distance = 30): void {
  engine.state.fighters[0].x = 150;
  engine.state.fighters[1].x = 150 + distance;
}

describe('CombatEngine', () => {
  it('uses a countdown and a 60 second fixed-step round clock', () => {
    const engine = new CombatEngine();
    expect(engine.state.phase).toBe('select');
    engine.start();
    advance(engine, 179);
    expect(engine.state.phase).toBe('countdown');
    engine.step(neutral(), neutral());
    expect(engine.state.phase).toBe('fight');
    advance(engine, 60);
    expect(engine.state.timer).toBe(59);
  });

  it('does no startup damage and hits exactly once through the active frames', () => {
    const engine = ready();
    close(engine);
    engine.step(attack('lp'), neutral());
    advance(engine, ATTACKS.leo.lp.startup - 2);
    expect(engine.state.fighters[1].health).toBe(1000);
    advance(engine, 1);
    expect(engine.state.fighters[1].health).toBe(958);
    advance(engine, 50);
    expect(engine.state.fighters[1].health).toBe(958);
    expect(engine.drainEvents().filter(event => event.type === 'hit')).toHaveLength(1);
  });

  it('requires holding away from the attacker to block and gives specials chip damage', () => {
    const engine = ready();
    close(engine);
    const block = { ...EMPTY_INPUT, right: true };
    engine.step(attack('hp'), block);
    advance(engine, 30, neutral(), block);
    expect(engine.state.fighters[1].health).toBe(1000);
    expect(engine.drainEvents().some(event => event.type === 'block')).toBe(true);
    close(engine);
    engine.step(attack('special1'), block);
    advance(engine, 45, neutral(), block);
    expect(engine.state.fighters[1].health).toBeLessThan(1000);
    expect(engine.state.fighters[1].health).toBeGreaterThan(970);
  });

  it('lets simultaneously active attacks trade instead of favoring player one', () => {
    const engine = ready();
    close(engine);
    engine.step(neutral(), attack('lp'));
    engine.step(neutral(), neutral());
    engine.step(attack('lp'), neutral());
    advance(engine, 3);
    expect(engine.state.fighters[0].health).toBe(952);
    expect(engine.state.fighters[1].health).toBe(958);
    expect(engine.drainEvents().filter(event => event.type === 'hit')).toHaveLength(2);
  });

  it('cancels confirmed normals into stronger normals and specials as a genuine combo', () => {
    const engine = ready();
    close(engine);
    engine.step(attack('lp'), neutral());
    advance(engine, 3);
    expect(engine.state.fighters[0].hitConfirmed).toBe(true);
    engine.step(attack('mp'), neutral());
    advance(engine, 12);
    expect(engine.state.fighters[0].attack).toBe('mp');
    expect(engine.state.fighters[0].combo).toBe(2);
    engine.step(attack('special1'), neutral());
    advance(engine, 18);
    expect(engine.state.fighters[0].combo).toBe(3);
    expect(engine.drainEvents().filter(event => event.type === 'hit').map(event => event.combo)).toEqual([1, 2, 3]);
  });

  it('does not permit a normal cancel after a whiff or a blocked hit', () => {
    const engine = ready();
    engine.step(attack('hp'), neutral());
    advance(engine, 5);
    engine.step(attack('special1'), neutral());
    expect(engine.state.fighters[0].attack).toBe('hp');
    advance(engine, 50);
    expect(engine.drainEvents().filter(event => event.type === 'attack').map(event => event.attack)).toEqual(['hp']);
    close(engine);
    const block = { ...EMPTY_INPUT, right: true };
    engine.step(attack('lp'), block);
    advance(engine, 3, neutral(), block);
    engine.step(attack('special1'), block);
    expect(engine.state.fighters[0].attack).toBe('lp');
    expect(engine.state.fighters[0].hitConfirmed).toBe(false);
  });

  it('consumes full meter for a multi-hit super and refuses one without enough meter', () => {
    const engine = ready();
    close(engine);
    engine.step(attack('super'), neutral());
    expect(engine.state.fighters[0].attack).toBeNull();
    engine.state.fighters[0].meter = 100;
    engine.step(attack('super'), neutral());
    expect(engine.state.fighters[0].meter).toBe(0);
    advance(engine, 90);
    const hits = engine.drainEvents().filter(event => event.type === 'hit' && event.attack === 'super');
    expect(hits.length).toBeGreaterThanOrEqual(3);
    expect(engine.state.fighters[1].health).toBeLessThan(750);
  });

  it('projectiles travel, collide once, and are removed', () => {
    const engine = ready();
    engine.state.fighters[0].x = 80;
    engine.state.fighters[1].x = 275;
    engine.step(attack('special2'), neutral());
    advance(engine, 15);
    expect(engine.state.projectiles).toHaveLength(1);
    expect(engine.state.fighters[1].health).toBe(1000);
    advance(engine, 75);
    expect(engine.state.fighters[1].health).toBe(908);
    expect(engine.state.projectiles).toHaveLength(0);
    expect(engine.drainEvents().filter(event => event.type === 'hit')).toHaveLength(1);
  });

  it('can jump over a ground projectile, then land inside the stage bounds', () => {
    const engine = ready();
    engine.state.fighters[0].x = 100;
    engine.state.fighters[1].x = 200;
    engine.step(neutral(), attack('special2'));
    advance(engine, 23);
    engine.step({ ...EMPTY_INPUT, up: true }, neutral());
    advance(engine, 15);
    expect(engine.state.fighters[0].y).toBeLessThan(FLOOR - 35);
    expect(engine.state.fighters[0].health).toBe(1000);
    advance(engine, 50);
    expect(engine.state.fighters[0].y).toBe(FLOOR);
    advance(engine, 400, { ...EMPTY_INPUT, left: true });
    expect(engine.state.fighters[0].x).toBe(25);
    advance(engine, 400, { ...EMPTY_INPUT, right: true });
    expect(engine.state.fighters.every(f => f.x >= 25 && f.x <= 359)).toBe(true);
  });

  it('tracks best of three, resets the next round, and restarts the whole match', () => {
    const engine = ready();
    for (let round = 0; round < 2; round++) {
      engine.state.fighters[1].health = 0;
      engine.step(neutral(), neutral());
      expect(engine.state.phase).toBe('roundOver');
      expect(engine.state.wins[0]).toBe(round + 1);
      advance(engine, 160);
      if (round === 0) {
        expect(engine.state.phase).toBe('countdown');
        expect(engine.state.fighters[1].health).toBe(1000);
        expect(engine.state.round).toBe(2);
        advance(engine, 180);
      }
    }
    expect(engine.state.phase).toBe('matchOver');
    expect(engine.state.winner).toBe(0);
    engine.start('koba');
    expect(engine.state.fighters[0].id).toBe('koba');
    expect(engine.state.wins).toEqual([0, 0]);
    expect(engine.state.round).toBe(1);
    expect(engine.state.phase).toBe('countdown');
    expect(engine.state.fighters[0].meter).toBe(0);
  });

  it('resolves a time out according to remaining health', () => {
    const engine = ready();
    engine.state.fighters[0].health = 900;
    advance(engine, 3600);
    expect(engine.state.phase).toBe('roundOver');
    expect(engine.state.timer).toBe(0);
    expect(engine.state.winner).toBe(1);
    expect(engine.state.announcement).toBe('TIME UP');
  });

  it('has a deterministic CPU that can finish a full match against an idle player', () => {
    const a = new CombatEngine('leo', true);
    const b = new CombatEngine('leo', true);
    a.start(); b.start();
    let frames = 0;
    while (a.state.phase !== 'matchOver' && frames++ < 14000) {
      a.step(neutral());
      b.step(neutral());
    }
    expect(a.state.phase).toBe('matchOver');
    expect(a.state.wins[1]).toBe(2);
    expect(a.state).toEqual(b.state);
    expect(a.drainEvents().some(event => event.type === 'hit' && event.fighter === 1)).toBe(true);
  });
});
