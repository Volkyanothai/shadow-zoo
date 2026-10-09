import Phaser from 'phaser';
import { CombatEngine } from './combat';
import { ArcadeAudio } from './audio';
import { ArcadeInput } from './input';
import { drawArena, drawFighter, drawEffects, setArenaImage } from './art';
import { WIDTH, HEIGHT, type AttackId, type FighterId, type GameState } from './types';

export interface GameSnapshot { state: GameState; paused: boolean; muted: boolean }
export interface GameController {
  start(fighterId: FighterId): void;
  pause(): void;
  restart(): void;
  setMuted(muted: boolean): void;
  press(attack: AttackId): void;
  setDirection(direction: 'left' | 'right' | 'up' | 'down', pressed: boolean): void;
  getState(): GameState;
  destroy(): void;
}

const NAMES = { leo: 'LEO', koba: 'KOBA' };
const SMALL_FONT = '"Press Start 2P", monospace';

function pixelText(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size = 7, color = '#fff3d6', align: CanvasTextAlign = 'left') {
  ctx.font = `${size}px ${SMALL_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#101521';
  ctx.fillText(value, Math.round(x) + 1, Math.round(y) + 1);
  ctx.fillStyle = color;
  ctx.fillText(value, Math.round(x), Math.round(y));
}

function drawHud(ctx: CanvasRenderingContext2D, state: GameState, trails: number[]) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 48);
  gradient.addColorStop(0, 'rgba(9,15,23,.88)');
  gradient.addColorStop(1, 'rgba(9,15,23,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, 48);
  pixelText(ctx, NAMES[state.fighters[0].id], 14, 8, 7, '#ffdf94');
  pixelText(ctx, NAMES[state.fighters[1].id], 370, 8, 7, '#8ee7d2', 'right');
  pixelText(ctx, '1P', 66, 9, 5, '#e4d8c3');
  pixelText(ctx, 'CPU', 313, 9, 5, '#e4d8c3', 'right');
  const barWidth = 146;
  state.fighters.forEach((fighter, i) => {
    const x = i === 0 ? 14 : 224;
    ctx.fillStyle = '#101725'; ctx.fillRect(x - 1, 19, barWidth + 2, 10);
    ctx.fillStyle = '#e9dcb8'; ctx.fillRect(x, 20, barWidth, 8);
    ctx.fillStyle = '#352731'; ctx.fillRect(x + 1, 21, barWidth - 2, 6);
    const trailWidth = Math.max(0, Math.floor((barWidth - 2) * trails[i] / 1000));
    const healthWidth = Math.max(0, Math.floor((barWidth - 2) * fighter.health / 1000));
    const origin = i === 0 ? x + 1 : x + barWidth - 1;
    ctx.fillStyle = '#b54848'; ctx.fillRect(i === 0 ? origin : origin - trailWidth, 21, trailWidth, 6);
    ctx.fillStyle = fighter.health < 250 ? '#f36c52' : i === 0 ? '#ffc960' : '#63d5b8';
    ctx.fillRect(i === 0 ? origin : origin - healthWidth, 21, healthWidth, 6);
    ctx.fillStyle = fighter.health < 250 ? '#ffaf72' : i === 0 ? '#ffe79f' : '#b3f3ce';
    ctx.fillRect(i === 0 ? origin : origin - healthWidth, 21, healthWidth, 2);
    for (let r = 0; r < 2; r++) {
      const pipX = i === 0 ? 15 + r * 10 : 364 - r * 10;
      ctx.fillStyle = r < state.wins[i] ? '#ffcb68' : '#354647';
      ctx.fillRect(pipX, 32, 6, 3);
      if (r < state.wins[i]) { ctx.fillStyle = '#fff1ba'; ctx.fillRect(pipX + 2, 31, 2, 5); }
    }
    const meterX = i === 0 ? 14 : 260;
    ctx.fillStyle = '#0b1924'; ctx.fillRect(meterX - 1, 209, 112, 9);
    ctx.fillStyle = '#506560'; ctx.fillRect(meterX, 210, 110, 7);
    ctx.fillStyle = '#101b27'; ctx.fillRect(meterX + 1, 211, 108, 5);
    ctx.fillStyle = fighter.meter >= 100 ? (state.frame % 20 < 10 ? '#ffe8aa' : '#ffbd55') : i === 0 ? '#f0af45' : '#5eb5b7';
    ctx.fillRect(meterX + 1, 211, Math.floor(108 * fighter.meter / 100), 5);
    for (let m = 1; m < 4; m++) { ctx.fillStyle = '#0b1924'; ctx.fillRect(meterX + m * 27, 211, 1, 5); }
    pixelText(ctx, fighter.meter >= 100 ? 'SUPER READY' : 'SUPER', i === 0 ? 14 : 370, 201, 5, fighter.meter >= 100 ? '#ffdf8f' : '#ddd5b4', i === 0 ? 'left' : 'right');
    if (fighter.combo >= 2 && fighter.comboTimer > 0) {
      pixelText(ctx, `${fighter.combo} HIT`, i === 0 ? 30 : 354, 51, 10, '#fff0bc', i === 0 ? 'left' : 'right');
      pixelText(ctx, 'COMBO', i === 0 ? 31 : 353, 64, 5, '#ffad67', i === 0 ? 'left' : 'right');
    }
  });
  ctx.fillStyle = '#111e27'; ctx.fillRect(170, 8, 44, 29);
  ctx.fillStyle = '#58645c'; ctx.fillRect(172, 9, 40, 1);
  pixelText(ctx, String(Math.ceil(state.timer)).padStart(2, '0'), WIDTH / 2, 13, 14, state.timer < 10 ? '#ff8565' : '#fff4ca', 'center');
  pixelText(ctx, `ROUND ${String(state.round).padStart(2, '0')}`, WIDTH / 2, 35, 5, '#ece0c0', 'center');
}

export function createGame(parent: HTMLElement, onUpdate: (snapshot: GameSnapshot) => void): GameController {
  const engine = new CombatEngine('leo', true);
  const sound = new ArcadeAudio();
  let paused = false;
  let muted = false;
  let selected: FighterId = 'leo';
  let accumulator = 0;
  let flash = 0;
  let shake = 0;
  let fightText = 0;
  let meterHint = 0;
  let hudTrails = [1000, 1000];
  let lastNotification = 0;
  let sceneReady = false;
  let dead = false;

  const notify = () => { if (!dead) onUpdate({ state: engine.state, paused, muted }); };
  const pause = () => {
    if (!['fight', 'countdown', 'roundOver'].includes(engine.state.phase)) return;
    paused = !paused;
    accumulator = 0;
    input.clear();
    sound.setMuted(muted || paused);
    notify();
  };
  const input = new ArcadeInput((action) => {
    if (action === 'unlock') sound.unlock();
    if (action === 'pause') pause();
    if (action === 'resume' && paused) pause();
  });
  const background = new Image();
  background.onload = () => setArenaImage(background);
  background.src = `${import.meta.env.BASE_URL}assets/arena.png`;

  class ArenaScene extends Phaser.Scene {
    private screen!: Phaser.Textures.CanvasTexture;
    constructor() { super('arena'); }
    create() {
      const texture = this.textures.createCanvas('stage', WIDTH, HEIGHT);
      if (!texture) throw new Error('Unable to create arena canvas');
      this.screen = texture;
      this.add.image(0, 0, 'stage').setOrigin(0);
      this.screen.context.imageSmoothingEnabled = false;
      const canvas = this.game.canvas;
      canvas.setAttribute('aria-label', 'Shadow Zoo fighting arena. Use WASD to move, U I O to punch, J K L to kick.');
      canvas.setAttribute('role', 'img');
      canvas.tabIndex = 0;
      canvas.addEventListener('pointerdown', () => { sound.unlock(); canvas.focus({ preventScroll: true }); });
      sceneReady = true;
      notify();
    }
    update(time: number, delta: number) {
      if (!sceneReady || dead) return;
      if (!paused) {
        accumulator += Math.min(delta, 100);
        while (accumulator >= 1000 / 60) {
          const previousPhase = engine.state.phase;
          input.facing = engine.state.fighters[0].facing;
          const command = input.sample();
          if (command.attack === 'super' && engine.state.phase === 'fight' && engine.state.fighters[0].meter < 100) meterHint = 70;
          engine.step(command);
          for (const event of engine.drainEvents()) {
            sound.play(event);
            if (event.type === 'hit') shake = Math.min(5, (event.amount ?? 40) / 24);
            if (event.type === 'super') { flash = 18; shake = 4; }
            if (event.type === 'ko') { shake = 5; flash = 6; }
          }
          if (previousPhase === 'countdown' && engine.state.phase === 'fight') fightText = 45;
          if (previousPhase === 'roundOver' && engine.state.phase === 'countdown') hudTrails = [1000, 1000];
          sound.tick(engine.state.frame, engine.state.phase === 'fight');
          fightText = Math.max(0, fightText - 1);
          flash = Math.max(0, flash - 1);
          shake = Math.max(0, shake - .35);
          meterHint = Math.max(0, meterHint - 1);
          engine.state.fighters.forEach((fighter, i) => {
            hudTrails[i] = Math.max(fighter.health, hudTrails[i] - 4);
          });
          accumulator -= 1000 / 60;
        }
      }
      const ctx = this.screen.context;
      const visualFrame = Math.floor(time / (1000 / 60));
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.save();
      if (shake > 0 && !paused) ctx.translate(Math.round(Math.sin(visualFrame * 2.7) * shake), Math.round(Math.cos(visualFrame * 3.4) * shake / 2));
      drawArena(ctx, visualFrame);
      for (const fighter of engine.state.fighters) drawFighter(ctx, fighter, paused ? engine.state.frame : visualFrame);
      drawEffects(ctx, engine.state, visualFrame);
      if (flash > 0) { ctx.fillStyle = `rgba(255,234,176,${flash / 60})`; ctx.fillRect(0, 0, WIDTH, HEIGHT); }
      ctx.restore();
      drawHud(ctx, engine.state, hudTrails);
      const state = engine.state;
      if (state.phase === 'countdown') {
        pixelText(ctx, `ROUND ${state.round}`, WIDTH / 2, 76, 13, '#ffdd84', 'center');
        const number = Math.ceil(state.phaseTimer / 60);
        pixelText(ctx, String(Math.max(1, number)), WIDTH / 2, 102, 27, '#fff5d6', 'center');
      }
      if (fightText > 0 && state.phase === 'fight') pixelText(ctx, 'FIGHT!', WIDTH / 2, 85, 22, '#ffe297', 'center');
      if (state.phase === 'roundOver') {
        const knockedOut = state.fighters.some((fighter) => fighter.health <= 0);
        pixelText(ctx, knockedOut ? 'K.O.' : 'TIME UP', WIDTH / 2, 76, 24, '#ffde8e', 'center');
        pixelText(ctx, state.winner === null ? 'DRAW' : `${NAMES[state.fighters[state.winner].id]} WINS`, WIDTH / 2, 109, 9, '#fff5df', 'center');
      }
      if (meterHint > 0 && !paused) pixelText(ctx, 'SUPER NEEDS FULL METER', WIDTH / 2, 183, 6, '#ffe69e', 'center');
      if (paused) {
        ctx.fillStyle = 'rgba(9,16,24,.72)'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
        pixelText(ctx, 'PAUSED', WIDTH / 2, 86, 20, '#ffdf93', 'center');
        pixelText(ctx, 'PRESS P TO RESUME', WIDTH / 2, 116, 7, '#fff1d1', 'center');
      }
      this.screen.refresh();
      if (time - lastNotification > 120) { lastNotification = time; notify(); }
    }
  }

  const phaser = new Phaser.Game({
    type: Phaser.CANVAS,
    width: WIDTH,
    height: HEIGHT,
    parent,
    backgroundColor: '#101a23',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    audio: { noAudio: true },
    input: { keyboard: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: ArenaScene,
    banner: false,
    fps: { target: 60, forceSetTimeOut: false },
  });

  const onVisibility = () => {
    if (document.hidden && !paused && ['fight', 'countdown', 'roundOver'].includes(engine.state.phase)) pause();
  };
  document.addEventListener('visibilitychange', onVisibility);

  const controller: GameController = {
    start(fighterId) {
      sound.unlock(); selected = fighterId; paused = false; input.clear(); accumulator = 0;
      sound.setMuted(muted); engine.start(fighterId); hudTrails = [1000, 1000]; flash = 0; shake = 0; fightText = 0; notify();
    },
    pause,
    restart() { controller.start(selected); },
    setMuted(value) { muted = value; sound.setMuted(muted || paused); if (!muted) sound.unlock(); notify(); },
    press(attack) { input.press(attack); },
    setDirection(direction, pressed) { input.setDirection(direction, pressed); },
    getState() { return engine.state; },
    destroy() {
      dead = true; input.destroy(); sound.destroy(); document.removeEventListener('visibilitychange', onVisibility); phaser.destroy(true);
    },
  };

  // Development-only inspection lets browser checks verify actual combat behavior.
  if (import.meta.env.DEV) {
    (window as unknown as { shadowZoo: GameController }).shadowZoo = controller;
  }
  return controller;
}
