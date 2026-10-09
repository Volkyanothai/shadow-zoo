export type FighterId = 'leo' | 'koba';
export type AttackId = 'lp' | 'mp' | 'hp' | 'lk' | 'mk' | 'hk' | 'special1' | 'special2' | 'super';
export type FighterAction = 'idle' | 'walk' | 'crouch' | 'jump' | 'attack' | 'hurt' | 'block' | 'ko' | 'win';

export interface Fighter {
  id: FighterId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  health: number;
  meter: number;
  action: FighterAction;
  attack: AttackId | null;
  attackFrame: number;
  animationFrame: number;
  stun: number;
  combo: number;
  comboTimer: number;
  grounded: boolean;
  hitConfirmed: boolean;
}

export interface PlayerInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  attack: AttackId | null;
}

export interface CombatEffect {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  kind: 'hit' | 'block' | 'special' | 'super' | 'dust';
  facing: 1 | -1;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  owner: 0 | 1;
  damage: number;
  life: number;
  kind: 'roar' | 'ground';
}

export type Phase = 'select' | 'countdown' | 'fight' | 'roundOver' | 'matchOver';
export interface GameState {
  fighters: [Fighter, Fighter];
  phase: Phase;
  timer: number;
  round: number;
  wins: [number, number];
  phaseTimer: number;
  frame: number;
  hitstop: number;
  projectiles: Projectile[];
  effects: CombatEffect[];
  winner: 0 | 1 | null;
  announcement: string;
  cpu: boolean;
}

export interface CombatEvent {
  type: 'hit' | 'block' | 'attack' | 'round' | 'ko' | 'super' | 'start' | 'special';
  fighter: 0 | 1;
  attack?: AttackId;
  amount?: number;
  combo?: number;
}

export const WIDTH = 384;
export const HEIGHT = 224;
export const FLOOR = 190;
export const EMPTY_INPUT: PlayerInput = { left: false, right: false, up: false, down: false, attack: null };
