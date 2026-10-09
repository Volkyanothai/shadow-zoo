import {
  EMPTY_INPUT, FLOOR,
  type AttackId, type CombatEvent, type Fighter, type FighterId,
  type GameState, type PlayerInput, type Projectile,
} from './types';
import { FIGHTERS, FIGHTER_IDS } from './catalog';

export const FIGHTER_NAMES = Object.fromEntries(
  FIGHTER_IDS.map(id => [id, FIGHTERS[id].name.en]),
) as Record<FighterId, string>;

export interface AttackSpec {
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  reach: number;
  stun: number;
  push: number;
  rank: number;
  projectile?: 'roar' | 'ground';
  advance?: number;
}

const normals: Record<Exclude<AttackId, 'special1' | 'special2' | 'super'>, AttackSpec> = {
  lp: { startup: 4, active: 3, recovery: 10, damage: 42, reach: 34, stun: 18, push: 3, rank: 0 },
  mp: { startup: 6, active: 4, recovery: 14, damage: 70, reach: 44, stun: 23, push: 4, rank: 1 },
  hp: { startup: 10, active: 5, recovery: 20, damage: 110, reach: 52, stun: 29, push: 7, rank: 2 },
  lk: { startup: 5, active: 4, recovery: 11, damage: 38, reach: 36, stun: 18, push: 3, rank: 0 },
  mk: { startup: 8, active: 4, recovery: 15, damage: 64, reach: 50, stun: 23, push: 5, rank: 1 },
  hk: { startup: 12, active: 5, recovery: 22, damage: 100, reach: 62, stun: 28, push: 8, rank: 2 },
};

function tunedNormals(damage: number, startup: number, reach: number, recovery: number): typeof normals {
  return Object.fromEntries(Object.entries(normals).map(([id, spec]) => [id, {
    ...spec, damage: Math.round(spec.damage * damage), startup: spec.startup + startup,
    reach: spec.reach + reach, recovery: spec.recovery + recovery,
  }])) as typeof normals;
}

export const ATTACKS: Record<FighterId, Record<AttackId, AttackSpec>> = {
  leo: {
    ...normals,
    special1: { startup: 8, active: 8, recovery: 18, damage: 135, reach: 55, stun: 30, push: 11, rank: 3, advance: 3.1 },
    special2: { startup: 14, active: 3, recovery: 23, damage: 92, reach: 0, stun: 23, push: 6, rank: 3, projectile: 'roar' },
    super: { startup: 9, active: 26, recovery: 25, damage: 85, reach: 84, stun: 24, push: 3, rank: 4, advance: 2.4 },
  },
  koba: {
    ...tunedNormals(1.15, 2, 5, 2),
    special1: { startup: 12, active: 7, recovery: 22, damage: 165, reach: 58, stun: 34, push: 14, rank: 3, advance: 2.1 },
    special2: { startup: 19, active: 3, recovery: 26, damage: 110, reach: 0, stun: 25, push: 8, rank: 3, projectile: 'ground' },
    super: { startup: 15, active: 26, recovery: 27, damage: 110, reach: 76, stun: 26, push: 3, rank: 4, advance: 1.8 },
  },
  raya: {
    ...tunedNormals(0.92, -1, -2, -2),
    special1: { startup: 6, active: 10, recovery: 17, damage: 118, reach: 46, stun: 28, push: 9, rank: 3, advance: 3.7 },
    special2: { startup: 12, active: 3, recovery: 20, damage: 86, reach: 0, stun: 23, push: 6, rank: 3, projectile: 'roar' },
    super: { startup: 7, active: 26, recovery: 23, damage: 79, reach: 74, stun: 24, push: 3, rank: 4, advance: 3.1 },
  },
  bao: {
    ...tunedNormals(1.03, 1, 7, 1),
    special1: { startup: 10, active: 7, recovery: 20, damage: 141, reach: 64, stun: 32, push: 10, rank: 3, advance: 2.4 },
    special2: { startup: 16, active: 3, recovery: 23, damage: 98, reach: 0, stun: 25, push: 6, rank: 3, projectile: 'roar' },
    super: { startup: 11, active: 26, recovery: 25, damage: 94, reach: 90, stun: 25, push: 3, rank: 4, advance: 2 },
  },
  nilo: {
    ...tunedNormals(1.05, 2, 14, 2),
    special1: { startup: 11, active: 9, recovery: 23, damage: 149, reach: 80, stun: 33, push: 12, rank: 3, advance: 2.3 },
    special2: { startup: 18, active: 3, recovery: 25, damage: 116, reach: 0, stun: 27, push: 8, rank: 3, projectile: 'ground' },
    super: { startup: 13, active: 26, recovery: 27, damage: 102, reach: 100, stun: 26, push: 3, rank: 4, advance: 2 },
  },
  ruk: {
    ...tunedNormals(1.3, 4, 6, 4),
    special1: { startup: 15, active: 10, recovery: 27, damage: 188, reach: 62, stun: 36, push: 16, rank: 3, advance: 2.7 },
    special2: { startup: 23, active: 3, recovery: 28, damage: 134, reach: 0, stun: 29, push: 9, rank: 3, projectile: 'ground' },
    super: { startup: 18, active: 26, recovery: 31, damage: 124, reach: 84, stun: 28, push: 3, rank: 4, advance: 1.9 },
  },
};

function defaultOpponent(playerId: FighterId): FighterId {
  if (playerId === 'leo') return 'koba';
  if (playerId === 'koba') return 'leo';
  return FIGHTER_IDS[(FIGHTER_IDS.indexOf(playerId) + 1) % FIGHTER_IDS.length];
}

interface FighterRuntime {
  buffer: AttackId | null;
  bufferTime: number;
  lastHit: number;
  spawned: boolean;
  upHeld: boolean;
  jumpPressed: boolean;
  crouchingAttack: boolean;
}

const runtime = (): FighterRuntime => ({
  buffer: null, bufferTime: 0, lastHit: -100, spawned: false,
  upHeld: false, jumpPressed: false, crouchingAttack: false,
});

function fighter(id: FighterId, index: 0 | 1): Fighter {
  return {
    id, x: index === 0 ? 115 : 269, y: FLOOR, vx: 0, vy: 0,
    facing: index === 0 ? 1 : -1, health: 1000, meter: 0,
    action: 'idle', attack: null, attackFrame: 0, animationFrame: 0,
    stun: 0, combo: 0, comboTimer: 0, grounded: true, hitConfirmed: false,
  };
}

/** Fixed 60 Hz simulation. Rendering and keyboard sampling live outside the engine. */
export class CombatEngine {
  state: GameState;
  private runtimes: [FighterRuntime, FighterRuntime] = [runtime(), runtime()];
  private events: CombatEvent[] = [];
  private roundClock = 3600;
  private rng = 0x5a00cafe;
  private aiWait = 0;
  private aiInput: PlayerInput = { ...EMPTY_INPUT };

  constructor(playerId: FighterId = 'leo', cpu = true, opponentId: FighterId = defaultOpponent(playerId)) {
    this.state = {
      fighters: [fighter(playerId, 0), fighter(opponentId, 1)],
      phase: 'select', timer: 60, round: 1, wins: [0, 0], phaseTimer: 0,
      frame: 0, hitstop: 0, projectiles: [], effects: [], winner: null,
      announcement: 'CHOOSE YOUR FIGHTER', cpu,
    };
  }

  start(playerId: FighterId = this.state.fighters[0].id, opponentId?: FighterId): void {
    const cpu = this.state.cpu;
    // A rematch keeps its selected rival; a different player gets a new default matchup.
    const rival = opponentId ?? (playerId === this.state.fighters[0].id
      ? this.state.fighters[1].id : defaultOpponent(playerId));
    this.state = {
      fighters: [fighter(playerId, 0), fighter(rival, 1)],
      phase: 'countdown', timer: 60, round: 1, wins: [0, 0], phaseTimer: 180,
      frame: 0, hitstop: 0, projectiles: [], effects: [], winner: null,
      announcement: '3', cpu,
    };
    this.runtimes = [runtime(), runtime()];
    this.events = [{ type: 'start', fighter: 0 }];
    this.roundClock = 3600;
    this.rng = 0x5a00cafe;
    this.aiWait = 0;
    this.aiInput = { ...EMPTY_INPUT };
  }

  drainEvents(): CombatEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  step(input1: PlayerInput, input2?: PlayerInput): void {
    const state = this.state;
    state.frame++;
    for (const effect of state.effects) effect.life--;
    state.effects = state.effects.filter(effect => effect.life > 0);
    if (state.phase === 'select' || state.phase === 'matchOver') return;
    if (state.phase === 'countdown') {
      state.phaseTimer--;
      state.announcement = state.phaseTimer > 120 ? '3' : state.phaseTimer > 60 ? '2' : state.phaseTimer > 12 ? '1' : 'FIGHT!';
      if (state.phaseTimer <= 0) {
        state.phase = 'fight';
        state.phaseTimer = 45;
        state.announcement = 'FIGHT!';
      }
      return;
    }
    if (state.phase === 'roundOver') {
      if (--state.phaseTimer <= 0) {
        if (state.wins.some(wins => wins >= 2)) {
          state.phase = 'matchOver';
          state.announcement = `${FIGHTER_NAMES[state.fighters[state.winner ?? 0].id]} WINS`;
        } else this.nextRound();
      }
      return;
    }

    const secondInput = input2 ?? (state.cpu ? this.cpuInput() : EMPTY_INPUT);
    const inputs: [PlayerInput, PlayerInput] = [input1, secondInput];
    for (const index of [0, 1] as const) {
      const rt = this.runtimes[index];
      const input = inputs[index];
      rt.jumpPressed = input.up && !rt.upHeld;
      rt.upHeld = input.up;
      if (input.attack) {
        rt.buffer = input.attack;
        rt.bufferTime = 10;
      }
    }
    if (state.hitstop > 0) {
      state.hitstop--;
      return;
    }
    if (state.phaseTimer > 0 && --state.phaseTimer === 0) state.announcement = '';
    this.roundClock--;
    state.timer = Math.max(0, Math.ceil(this.roundClock / 60));

    for (const index of [0, 1] as const) this.updateFighter(index, inputs[index]);
    this.separateFighters();

    // Gather both active attacks before applying either, allowing fair simultaneous trades.
    const attacks = ([0, 1] as const).filter(index => this.canMeleeHit(index)).map(index => ({
      index, attack: state.fighters[index].attack!, frame: state.fighters[index].attackFrame,
    }));
    for (const pending of attacks) this.meleeHit(pending.index, pending.attack, pending.frame, inputs[(1 - pending.index) as 0 | 1]);
    this.updateProjectiles(inputs);
    for (const index of [0, 1] as const) {
      const rt = this.runtimes[index];
      if (rt.bufferTime > 0 && --rt.bufferTime === 0) rt.buffer = null;
    }
    if (state.fighters.some(f => f.health <= 0) || this.roundClock <= 0) this.finishRound();
  }

  private updateFighter(index: 0 | 1, input: PlayerInput): void {
    const f = this.state.fighters[index];
    const other = this.state.fighters[(1 - index) as 0 | 1];
    const rt = this.runtimes[index];
    f.animationFrame++;
    if (f.comboTimer > 0 && --f.comboTimer === 0) f.combo = 0;
    if (!f.attack && f.stun === 0) f.facing = other.x >= f.x ? 1 : -1;
    const wasStunned = f.stun > 0;
    if (wasStunned) {
      f.stun--;
      f.x += f.vx;
      f.vx *= 0.78;
      if (f.stun === 0) f.action = f.grounded ? 'idle' : 'jump';
    } else {
      if (rt.buffer && this.canStartAttack(index, rt.buffer)) this.beginAttack(index, rt.buffer, input.down);
      if (f.attack) {
        const spec = ATTACKS[f.id][f.attack];
        f.attackFrame++;
        f.action = 'attack';
        if (f.attackFrame >= spec.startup && f.attackFrame < spec.startup + spec.active) {
          if (spec.advance) f.x += spec.advance * f.facing;
          if (spec.projectile && !rt.spawned) this.spawnProjectile(index, spec);
        }
        if (f.attackFrame >= spec.startup + spec.active + spec.recovery) {
          f.attack = null;
          f.attackFrame = 0;
          f.hitConfirmed = false;
          f.action = f.grounded ? 'idle' : 'jump';
        }
      } else {
        const direction = Number(input.right) - Number(input.left);
        if (f.grounded) {
          f.vx = input.down ? 0 : direction * FIGHTERS[f.id].speed;
          f.action = input.down ? 'crouch' : direction ? 'walk' : 'idle';
          if (rt.jumpPressed && !input.down) {
            f.grounded = false;
            f.vy = FIGHTERS[f.id].jump;
            f.vx = direction * 1.7;
            f.action = 'jump';
            this.effect(f.x, FLOOR, 'dust', f.facing, 12);
          }
        }
        f.x += f.vx;
      }
    }
    if (!f.grounded) {
      f.vy += 0.3;
      f.y += f.vy;
      if (f.attack && !wasStunned) f.x += f.vx;
      if (f.y >= FLOOR) {
        f.y = FLOOR;
        f.vy = 0;
        f.grounded = true;
        if (!f.attack && f.stun === 0) f.action = 'idle';
        this.effect(f.x, FLOOR, 'dust', f.facing, 10);
      }
    }
    f.x = Math.max(25, Math.min(359, f.x));
  }

  private canStartAttack(index: 0 | 1, attack: AttackId): boolean {
    const f = this.state.fighters[index];
    if (attack === 'super' && f.meter < 100) return false;
    if (!f.grounded && (attack === 'special1' || attack === 'special2' || attack === 'super')) return false;
    if (!f.attack) return true;
    const old = ATTACKS[f.id][f.attack];
    const next = ATTACKS[f.id][attack];
    return f.hitConfirmed && old.rank < 3 && next.rank > old.rank;
  }

  private beginAttack(index: 0 | 1, attack: AttackId, crouching: boolean): void {
    const f = this.state.fighters[index];
    const rt = this.runtimes[index];
    f.attack = attack;
    f.attackFrame = 0;
    f.action = 'attack';
    f.hitConfirmed = false;
    f.vx = f.grounded ? 0 : f.vx;
    rt.buffer = null;
    rt.bufferTime = 0;
    rt.lastHit = -100;
    rt.spawned = false;
    rt.crouchingAttack = crouching && f.grounded;
    this.events.push({ type: 'attack', fighter: index, attack });
    if (attack === 'super') {
      f.meter -= 100;
      this.state.hitstop = 10;
      this.effect(f.x, f.y - 30, 'super', f.facing, 32);
      this.events.push({ type: 'super', fighter: index, attack });
    } else if (attack === 'special1' || attack === 'special2') {
      this.effect(f.x, f.y - 25, 'special', f.facing, 16);
      this.events.push({ type: 'special', fighter: index, attack });
    }
  }

  private canMeleeHit(index: 0 | 1): boolean {
    const attacker = this.state.fighters[index];
    const defender = this.state.fighters[(1 - index) as 0 | 1];
    if (!attacker.attack) return false;
    const spec = ATTACKS[attacker.id][attacker.attack];
    const rt = this.runtimes[index];
    if (spec.projectile || attacker.attackFrame < spec.startup || attacker.attackFrame >= spec.startup + spec.active) return false;
    if (rt.lastHit >= 0 && (attacker.attack !== 'super' || attacker.attackFrame - rt.lastHit < 8)) return false;
    const forwardDistance = (defender.x - attacker.x) * attacker.facing;
    if (forwardDistance < -8 || forwardDistance > spec.reach + 11) return false;
    const hitY = attacker.y - (rt.crouchingAttack ? 18 : 31);
    const height = defender.action === 'crouch' ? 34 : 54;
    return hitY + 13 >= defender.y - height && hitY - 13 <= defender.y;
  }

  private meleeHit(index: 0 | 1, attack: AttackId, attackFrame: number, input: PlayerInput): void {
    const f = this.state.fighters[index];
    const spec = ATTACKS[f.id][attack];
    this.runtimes[index].lastHit = attackFrame;
    const low = this.runtimes[index].crouchingAttack;
    this.applyHit(index, spec.damage, spec.stun, spec.push, input, attack, low, !f.grounded);
  }

  private applyHit(
    owner: 0 | 1, damage: number, stun: number, push: number,
    input: PlayerInput, attack: AttackId, low = false, air = false,
  ): void {
    const source = this.state.fighters[owner];
    const targetIndex = (1 - owner) as 0 | 1;
    const target = this.state.fighters[targetIndex];
    const away = target.x >= source.x ? 1 : -1;
    const holdingBack = away === 1 ? input.right && !input.left : input.left && !input.right;
    const blocked = target.grounded && !target.attack && target.action !== 'hurt'
      && holdingBack && (!low || input.down) && (!air || !input.down);
    if (blocked) {
      const chip = attack.startsWith('special') || attack === 'super' ? Math.max(1, Math.round(damage * 0.12)) : 0;
      target.health = Math.max(0, target.health - chip);
      target.stun = Math.max(target.stun, Math.round(stun * 0.55));
      target.action = 'block';
      target.vx = away * push * 0.3;
      source.meter = Math.min(100, source.meter + 3);
      target.meter = Math.min(100, target.meter + 2);
      this.state.hitstop = Math.max(this.state.hitstop, 3);
      this.effect(target.x - away * 12, target.y - 31, 'block', away as 1 | -1, 10);
      this.events.push({ type: 'block', fighter: owner, attack, amount: chip });
      return;
    }
    const continuing = target.stun > 0 && target.action === 'hurt';
    source.combo = continuing ? source.combo + 1 : 1;
    source.comboTimer = 85;
    const scaling = Math.max(0.6, 1 - (source.combo - 1) * 0.08);
    const amount = Math.round(damage * scaling);
    target.health = Math.max(0, target.health - amount);
    target.stun = stun;
    target.action = 'hurt';
    target.attack = null;
    target.attackFrame = 0;
    target.hitConfirmed = false;
    target.vx = away * push * 0.42;
    source.hitConfirmed = true;
    source.meter = Math.min(100, source.meter + (attack === 'super' ? 0 : 9));
    target.meter = Math.min(100, target.meter + 6);
    this.state.hitstop = Math.max(this.state.hitstop, attack === 'super' ? 7 : 5);
    this.effect(target.x - away * 9, target.y - 29, attack === 'super' ? 'super' : 'hit', away as 1 | -1, 13);
    this.events.push({ type: 'hit', fighter: owner, attack, amount, combo: source.combo });
  }

  private spawnProjectile(index: 0 | 1, spec: AttackSpec): void {
    const f = this.state.fighters[index];
    this.runtimes[index].spawned = true;
    this.state.projectiles.push({
      x: f.x + 22 * f.facing, y: spec.projectile === 'ground' ? FLOOR - 10 : f.y - 29,
      vx: (spec.projectile === 'ground' ? 2.45 : 3.25) * f.facing,
      owner: index, damage: spec.damage, life: 135, kind: spec.projectile!,
    });
  }

  private updateProjectiles(inputs: [PlayerInput, PlayerInput]): void {
    const removed = new Set<Projectile>();
    for (const projectile of this.state.projectiles) {
      projectile.x += projectile.vx;
      projectile.life--;
      if (projectile.life <= 0 || projectile.x < -20 || projectile.x > 404) {
        removed.add(projectile);
        continue;
      }
      const targetIndex = (1 - projectile.owner) as 0 | 1;
      const target = this.state.fighters[targetIndex];
      const height = target.action === 'crouch' ? 34 : 54;
      if (Math.abs(projectile.x - target.x) < 21 && projectile.y + 9 >= target.y - height && projectile.y - 9 <= target.y) {
        this.applyHit(projectile.owner, projectile.damage, 25, 6, inputs[targetIndex], 'special2', projectile.kind === 'ground');
        removed.add(projectile);
      }
    }
    this.state.projectiles = this.state.projectiles.filter(p => !removed.has(p));
  }

  private separateFighters(): void {
    const [a, b] = this.state.fighters;
    if (Math.abs(a.y - b.y) > 46) return;
    const distance = b.x - a.x;
    if (Math.abs(distance) >= 24) return;
    const direction = distance >= 0 ? 1 : -1;
    const shift = (24 - Math.abs(distance)) / 2;
    a.x = Math.max(25, Math.min(359, a.x - shift * direction));
    b.x = Math.max(25, Math.min(359, b.x + shift * direction));
    if (Math.abs(b.x - a.x) < 24) {
      if (a.x === 25 || a.x === 359) b.x = a.x + direction * 24;
      else if (b.x === 25 || b.x === 359) a.x = b.x - direction * 24;
    }
  }

  private finishRound(): void {
    const [a, b] = this.state.fighters;
    const winner: 0 | 1 | null = a.health === b.health ? null : a.health > b.health ? 0 : 1;
    this.state.winner = winner;
    if (winner !== null) {
      this.state.wins[winner]++;
      this.state.fighters[winner].action = 'win';
      this.state.fighters[(1 - winner) as 0 | 1].action = 'ko';
    }
    for (const f of this.state.fighters) {
      f.attack = null;
      f.stun = 0;
      f.y = FLOOR;
      f.grounded = true;
    }
    this.state.phase = 'roundOver';
    this.state.phaseTimer = 160;
    this.state.announcement = winner === null ? 'DRAW' : this.roundClock <= 0 ? 'TIME UP' : 'K.O.';
    this.state.projectiles = [];
    this.state.hitstop = 0;
    this.events.push({ type: 'ko', fighter: winner ?? 0 });
    this.events.push({ type: 'round', fighter: winner ?? 0 });
  }

  private nextRound(): void {
    const meters = this.state.fighters.map(f => f.meter);
    const ids = this.state.fighters.map(f => f.id);
    this.state.fighters = [fighter(ids[0], 0), fighter(ids[1], 1)];
    this.state.fighters[0].meter = meters[0];
    this.state.fighters[1].meter = meters[1];
    this.runtimes = [runtime(), runtime()];
    this.roundClock = 3600;
    this.state.round++;
    this.state.timer = 60;
    this.state.phase = 'countdown';
    this.state.phaseTimer = 180;
    this.state.announcement = '3';
    this.state.effects = [];
    this.state.winner = null;
    this.aiWait = 0;
  }

  private effect(x: number, y: number, kind: GameState['effects'][number]['kind'], facing: 1 | -1, life: number): void {
    this.state.effects.push({ x, y, kind, facing, life, maxLife: life });
  }

  private random(): number {
    this.rng = (Math.imul(this.rng, 1664525) + 1013904223) >>> 0;
    return this.rng / 4294967296;
  }

  private cpuInput(): PlayerInput {
    const f = this.state.fighters[1];
    const opponent = this.state.fighters[0];
    // Decisions persist for 9–19 frames. The CPU observes world state, never player inputs.
    if (this.aiWait-- > 0) return { ...this.aiInput, attack: null };
    this.aiWait = 9 + Math.floor(this.random() * 11);
    const input = { ...EMPTY_INPUT };
    const direction = opponent.x > f.x ? 1 : -1;
    const distance = Math.abs(opponent.x - f.x);
    if (opponent.attack && distance < 90 && this.random() < 0.43) {
      input.left = direction > 0;
      input.right = direction < 0;
      input.down = this.random() < 0.3;
    } else if (distance > 54) {
      input.left = direction < 0;
      input.right = direction > 0;
      if (distance > 105 && this.random() < 0.19) input.attack = 'special2';
      else if (distance < 110 && this.random() < 0.3) input.attack = 'special1';
      if (this.state.projectiles.some(p => p.owner === 0 && Math.abs(p.x - f.x) < 75) && this.random() < 0.65) input.up = true;
    } else {
      const options: AttackId[] = ['lp', 'mp', 'hp', 'lk', 'mk', 'hk', 'special1'];
      input.attack = f.meter >= 100 && this.random() < 0.5 ? 'super' : options[Math.floor(this.random() * options.length)];
      input.down = this.random() < 0.1;
    }
    if (f.hitConfirmed && f.attack && ATTACKS[f.id][f.attack].rank < 3 && this.random() < 0.6) input.attack = 'special1';
    this.aiInput = { ...input, attack: null };
    return input;
  }
}
