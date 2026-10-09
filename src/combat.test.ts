import { describe, expect, it } from 'vitest';
import { ATTACKS, CombatEngine } from './combat';
import { FIGHTERS, FIGHTER_IDS } from './catalog';
import { EMPTY_INPUT, FLOOR, type AttackId, type FighterId, type PlayerInput } from './types';

const neutral = (): PlayerInput => ({ ...EMPTY_INPUT });
const attack = (id: AttackId): PlayerInput => ({ ...EMPTY_INPUT, attack: id });

function advance(engine: CombatEngine, frames: number, input = neutral(), opponent = neutral()): void {
  for (let i = 0; i < frames; i++) engine.step(input, opponent);
}

function ready(fighterId: FighterId = 'leo', opponentId?: FighterId): CombatEngine {
  const engine = new CombatEngine(fighterId, false, opponentId);
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

describe('expanded animal roster', () => {
  const newcomers: FighterId[] = ['raya', 'bao', 'nilo', 'ruk'];
  const normalIds: AttackId[] = ['lp', 'mp', 'hp', 'lk', 'mk', 'hk'];

  it('preserves the original matchup and chooses a different default rival for every new animal', () => {
    expect(new CombatEngine('leo').state.fighters[1].id).toBe('koba');
    expect(new CombatEngine('koba').state.fighters[1].id).toBe('leo');
    for (const id of newcomers) {
      const engine = new CombatEngine(id);
      expect(engine.state.fighters[1].id).not.toBe(id);
      expect(FIGHTER_IDS).toContain(engine.state.fighters[1].id);
      const originalRival = engine.state.fighters[1].id;
      engine.start();
      expect(engine.state.fighters.map(f => f.id)).toEqual([id, originalRival]);
    }
  });

  it('retains an explicitly selected CPU opponent across rounds and rematches', () => {
    const engine = new CombatEngine('bao', true, 'ruk');
    engine.start();
    advance(engine, 180);
    expect(engine.state.cpu).toBe(true);
    expect(engine.state.fighters.map(f => f.id)).toEqual(['bao', 'ruk']);
    engine.state.fighters[1].health = 0;
    engine.step(neutral(), neutral());
    advance(engine, 160);
    expect(engine.state.round).toBe(2);
    expect(engine.state.fighters.map(f => f.id)).toEqual(['bao', 'ruk']);
    engine.start();
    expect(engine.state.round).toBe(1);
    expect(engine.state.fighters.map(f => f.id)).toEqual(['bao', 'ruk']);
    engine.start('raya', 'nilo');
    expect(engine.state.fighters.map(f => f.id)).toEqual(['raya', 'nilo']);
    engine.start('raya');
    expect(engine.state.fighters.map(f => f.id)).toEqual(['raya', 'nilo']);
    engine.start('koba');
    expect(engine.state.fighters.map(f => f.id)).toEqual(['koba', 'leo']);
  });

  it.each(FIGHTER_IDS)('%s walks and jumps at its own movement speed', id => {
    const engine = ready(id);
    const f = engine.state.fighters[0];
    const initialX = f.x;
    advance(engine, 10, { ...EMPTY_INPUT, right: true });
    expect(f.x - initialX).toBeCloseTo(FIGHTERS[id].speed * 10);
    engine.step({ ...EMPTY_INPUT, up: true }, neutral());
    expect(f.grounded).toBe(false);
    expect(f.vy).toBeCloseTo(FIGHTERS[id].jump + 0.3);
    advance(engine, 60);
    expect(f.grounded).toBe(true);
    expect(f.y).toBe(FLOOR);
  });

  it.each(newcomers)('%s has six working normals with startup, one hit, and recovery', id => {
    for (const normalId of normalIds) {
      const engine = ready(id);
      close(engine);
      const spec = ATTACKS[id][normalId];
      engine.step(attack(normalId), neutral());
      advance(engine, spec.startup - 2);
      expect(engine.state.fighters[1].health).toBe(1000);
      advance(engine, 1);
      expect(engine.state.fighters[1].health).toBe(1000 - spec.damage);
      advance(engine, spec.active + spec.recovery + 20);
      expect(engine.state.fighters[0].attack).toBeNull();
      expect(engine.state.fighters[1].health).toBe(1000 - spec.damage);
      expect(engine.drainEvents().filter(event => event.type === 'hit')).toHaveLength(1);
    }
  });

  it.each(newcomers)('%s closes a gap with its advancing special and hits once', id => {
    const engine = ready(id);
    close(engine, 80);
    const initialX = engine.state.fighters[0].x;
    engine.step(attack('special1'), neutral());
    advance(engine, 80);
    expect(engine.state.fighters[0].x).toBeGreaterThan(initialX);
    expect(engine.state.fighters[1].health).toBe(1000 - ATTACKS[id].special1.damage);
    expect(engine.drainEvents().filter(event => event.type === 'hit' && event.attack === 'special1')).toHaveLength(1);
  });

  it.each(newcomers)('%s launches a traveling wave that damages its opponent once', id => {
    const engine = ready(id);
    engine.state.fighters[0].x = 80;
    engine.state.fighters[1].x = 280;
    engine.step(attack('special2'), neutral());
    advance(engine, ATTACKS[id].special2.startup);
    expect(engine.state.projectiles).toHaveLength(1);
    expect(engine.state.projectiles[0].kind).toBe(ATTACKS[id].special2.projectile);
    const launchedX = engine.state.projectiles[0].x;
    advance(engine, 5);
    expect(engine.state.projectiles[0].x).toBeGreaterThan(launchedX);
    expect(engine.state.fighters[1].health).toBe(1000);
    advance(engine, 110);
    expect(engine.state.fighters[1].health).toBe(1000 - ATTACKS[id].special2.damage);
    expect(engine.state.projectiles).toHaveLength(0);
    expect(engine.drainEvents().filter(event => event.type === 'hit' && event.attack === 'special2')).toHaveLength(1);
  });

  it.each(newcomers)('%s spends a full meter on a multi-hit super', id => {
    const engine = ready(id);
    close(engine);
    engine.step(attack('super'), neutral());
    expect(engine.state.fighters[0].attack).toBeNull();
    engine.state.fighters[0].meter = 100;
    engine.step(attack('super'), neutral());
    expect(engine.state.fighters[0].meter).toBe(0);
    advance(engine, 110);
    const hits = engine.drainEvents().filter(event => event.type === 'hit' && event.attack === 'super');
    expect(hits.length).toBeGreaterThanOrEqual(3);
    expect(engine.state.fighters[0].meter).toBe(0);
    expect(engine.state.fighters[1].health).toBeLessThan(800);
  });

  it.each(newcomers)('%s can fight as the CPU and finish a match', id => {
    const engine = new CombatEngine('leo', true, id);
    engine.start();
    let frames = 0;
    while (engine.state.phase !== 'matchOver' && frames++ < 14000) engine.step(neutral());
    expect(engine.state.phase).toBe('matchOver');
    expect(engine.state.fighters[1].id).toBe(id);
    expect(engine.state.wins[1]).toBe(2);
    expect(engine.drainEvents().some(event => event.type === 'hit' && event.fighter === 1)).toBe(true);
  });

  it.each(['nilo', 'ruk'] as FighterId[])('%s ground wave requires a crouching block', id => {
    const cast = (down: boolean): CombatEngine => {
      const engine = ready(id, 'leo');
      close(engine, 60);
      const block = { ...EMPTY_INPUT, right: true, down };
      engine.step(attack('special2'), block);
      advance(engine, 140, neutral(), block);
      return engine;
    };
    const standing = cast(false);
    const crouching = cast(true);
    expect(standing.state.fighters[1].health).toBe(1000 - ATTACKS[id].special2.damage);
    expect(crouching.state.fighters[1].health).toBeGreaterThan(standing.state.fighters[1].health);
    expect(crouching.drainEvents().some(event => event.type === 'block' && event.attack === 'special2')).toBe(true);
  });
});
