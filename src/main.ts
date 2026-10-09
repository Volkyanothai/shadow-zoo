import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/press-start-2p/400.css';
import './style.css';
import { createGame, type GameController, type GameSnapshot } from './game';
import type { AttackId, FighterId } from './types';

const icons = {
  sound: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 6 6m0-6-6 6"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="m8 5 11 7-11 7V5Z"/>',
  restart: '<path d="M3 10a9 9 0 1 1 1 8M3 4v6h6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1.5 1-1.5 1.5-1.5 2M12 16h.01"/>',
};
function icon(name: keyof typeof icons, cls = ''): string {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}
const lionPortrait = `<svg viewBox="0 0 88 88" fill="none" aria-hidden="true"><path d="M28 8h32v8h12v12h8v32h-8v12H60v8H28v-8H16V60H8V28h8V16h12V8Z" fill="#703c24"/><path d="M28 16h32v8h12v36H60v12H28V60H16V24h12v-8Z" fill="#b36530"/><path d="M24 24h12v12H24zM52 24h12v12H52z" fill="#ffbf6b"/><path d="M28 32h32v28H52v8H36v-8h-8V32Z" fill="#e9a64e"/><path d="M28 40h12v6H28zm20 0h12v6H48z" fill="#2a241c"/><path d="M30 41h6v3h-6zm20 0h6v3h-6z" fill="#fff2cc"/><path d="M36 48h16v12H36z" fill="#ffdfa2"/><path d="M40 48h8v5h-8zm-4 11h16v4H36z" fill="#493026"/><path d="M16 16h8v8h-8zm48 0h8v8h-8z" fill="#e9a64e"/></svg>`;
const apePortrait = `<svg viewBox="0 0 88 88" fill="none" aria-hidden="true"><path d="M28 8h32v8h12v12h8v32h-8v12H60v8H28v-8H16V60H8V28h8V16h12V8Z" fill="#314b46"/><path d="M28 16h32v8h8v12h8v24H64v12H24V60H12V36h8V24h8v-8Z" fill="#54766c"/><path d="M28 24h32v8h8v32H56v8H32v-8H20V32h8v-8Z" fill="#82978a"/><path d="M24 32h16v8H24zm24 0h16v8H48z" fill="#263e36"/><path d="M28 39h12v5H28zm20 0h12v5H48z" fill="#ffe1a3"/><path d="M32 48h24v16H32z" fill="#b2b29c"/><path d="M36 45h16v9H36zM32 61h24v5H32z" fill="#3c4d41"/><path d="M40 48h3v3h-3zm5 0h3v3h-3z" fill="#202c28"/><path d="M30 65h28v3H30z" fill="#e0d8b9"/></svg>`;

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div class="site-shell">
    <header class="site-header">
      <a class="brand" href="./" aria-label="Shadow Zoo home">
        <span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M4 4h24v6L14 22h14v6H4v-6l14-12H4z" fill="currentColor"/></svg></span>
        <span class="brand-name">SHADOW<span>ZOO</span></span>
      </a>
      <span class="header-caption">THE ARCADE COLLECTION <span class="caption-slash">/</span> VOL. 01</span>
      <button class="sound-button" id="sound-button" aria-label="Mute sound" aria-pressed="false">${icon('sound')}<span id="sound-label">SOUND ON</span></button>
    </header>

    <main>
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-copy"><div class="eyebrow"><span class="little-line"></span> UNLEASH YOUR INNER ANIMAL</div><h1 id="hero-title">WELCOME TO THE <span>WILD SIDE.</span><span class="title-star" aria-hidden="true">✳</span></h1></div>
        <div class="hero-aside"><p>The gates are open.<br>The gloves are off.</p><div class="mode-tag"><span class="live-dot"></span> 1 PLAYER <span class="mode-divider">/</span> VS CPU</div></div>
      </section>

      <section class="arena-layout" aria-label="Shadow Zoo arcade">
        <div class="arcade-machine">
          <div class="arena-topbar"><span class="arena-stage"><span class="live-dot"></span> NIGHTFALL SANCTUARY</span><span class="stage-number">STAGE 01 <span>↗</span></span></div>
          <div class="screen-bezel" id="screen-bezel">
            <div id="game-screen" role="application" aria-label="Shadow Zoo fighting game. Choose a fighter and press Enter the arena to play." tabindex="0"></div>
            <div class="screen-grain" aria-hidden="true"></div>
            <div class="screen-intro" id="screen-intro"><div class="intro-chip"><span></span> READY WHEN YOU ARE</div><div class="intro-title">THE ZOO<br>IS YOURS.</div><p>Choose your fighter. Make your mark.</p><button class="screen-start" id="screen-start">ENTER THE ARENA ${icon('arrow')}</button><div class="intro-hint">OR PRESS <kbd>ENTER</kbd></div></div>
            <div class="pause-overlay" id="pause-overlay" hidden><span class="pixel-label">TAKE A BREATHER</span><strong>PAUSED</strong><button id="resume-button">BACK TO THE FIGHT ${icon('play')}</button></div>
            <div class="result-overlay" id="result-overlay" hidden><span class="pixel-label" id="result-kicker">KING OF THE ZOO</span><strong id="result-title">YOU WIN!</strong><p id="result-message">The arena belongs to you.</p><button id="rematch-button">RUN IT BACK ${icon('restart')}</button></div>
          </div>
          <div class="arena-bottom-bar"><div class="arena-live"><span class="status-light"></span><span id="game-status">READY TO RUMBLE</span></div><div class="arena-actions"><button id="pause-button" title="Pause (P)" aria-label="Pause game">${icon('pause')}</button><button id="restart-button" title="Restart match" aria-label="Restart match">${icon('restart')}</button><span class="action-divider"></span><button id="fullscreen-button" title="Full screen" aria-label="Open full screen">${icon('expand')}</button></div></div>
        </div>

      <div class="touch-controls" aria-label="Touch game controls"><div class="dpad"><button class="dpad-up" data-direction="up" aria-label="Jump">↑</button><button class="dpad-left" data-direction="left" aria-label="Move left">←</button><button class="dpad-down" data-direction="down" aria-label="Crouch">↓</button><button class="dpad-right" data-direction="right" aria-label="Move right">→</button></div><div class="touch-attacks"><button data-attack="lp">LP</button><button data-attack="mp">MP</button><button data-attack="hp">HP</button><button data-attack="lk">LK</button><button data-attack="mk">MK</button><button data-attack="hk">HK</button></div><div class="touch-specials"><button data-attack="special1">Q</button><button data-attack="special2">E</button><button data-attack="super">SUPER</button></div></div>

        <aside class="fighter-panel" aria-labelledby="fighter-title">
          <div class="section-heading"><h2 id="fighter-title">CHOOSE YOUR FIGHTER</h2><span>01 / 02</span></div>
          <button class="fighter-card selected" data-fighter="leo" aria-pressed="true"><span class="portrait leo-portrait">${lionPortrait}</span><span class="fighter-info"><span class="fighter-number">01 <span class="fighter-selected">SELECTED</span></span><strong>LEO</strong><span class="fighter-nickname">THE GOLDEN CLAW</span><span class="fighter-class"><i></i> SPEED &amp; PRECISION</span></span><span class="selection-check" aria-hidden="true">✓</span></button>
          <button class="fighter-card" data-fighter="koba" aria-pressed="false"><span class="portrait koba-portrait">${apePortrait}</span><span class="fighter-info"><span class="fighter-number">02 <span class="fighter-selected">SELECTED</span></span><strong>KOBA</strong><span class="fighter-nickname">THE IRON APE</span><span class="fighter-class"><i></i> RAW POWER</span></span><span class="selection-check" aria-hidden="true">✓</span></button>
          <div class="fighter-details"><div class="detail-label"><span id="fighter-detail-name">LEO'S</span> SIGNATURE MOVES</div><div class="signature-move"><span class="move-key">Q</span><span id="special-one-name">Claw Rush</span><span class="move-direction">↓ ↘ → + P</span></div><div class="signature-move"><span class="move-key">E</span><span id="special-two-name">Royal Roar</span><span class="move-direction">↓ ↙ ← + P</span></div><div class="signature-move super-move"><span class="move-key">R</span><span id="super-name">Primal Fury</span><span class="super-label">FULL METER</span></div></div>
          <button class="play-button" id="play-button"><span id="play-label">LET'S FIGHT</span>${icon('arrow')}</button>
          <div class="fighter-note"><span class="tiny-star">✦</span> Two fighters. One king of the zoo.</div>
        </aside>
      </section>



      <section class="playbook" aria-labelledby="playbook-title"><div class="playbook-heading"><div><span class="eyebrow">A LITTLE INSTINCT. A LOT OF PRACTICE.</span><h2 id="playbook-title">MAKE YOUR MOVE.</h2></div><button class="help-button" id="help-button">FIGHTER'S GUIDE ${icon('question')}</button></div><div class="control-grid"><div class="control-group"><div class="control-group-label"><span class="control-dot teal-dot"></span> MOVEMENT</div><div class="key-row"><div class="movement-keys"><kbd>W</kbd><div><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div></div><p>Move, jump &amp; crouch.<br><span>Hold back to block.</span></p></div></div><div class="control-group"><div class="control-group-label"><span class="control-dot orange-dot"></span> THROW HANDS</div><div class="attack-key-rows"><div><span>PUNCH</span><kbd>U</kbd><kbd>I</kbd><kbd>O</kbd></div><div><span>KICK</span><kbd>J</kbd><kbd>K</kbd><kbd>L</kbd></div></div><div class="key-weight-label">LIGHT <span>MEDIUM</span> HEAVY</div></div><div class="control-group combos-group"><div class="control-group-label"><span class="control-dot pink-dot"></span> KEEP IT GOING</div><div class="combo-sequence"><kbd>U</kbd><span>→</span><kbd>I</kbd><span>→</span><kbd>Q</kbd></div><p>Land a hit. Chain the next move.<br><span>Fill your meter. Unleash <kbd>R</kbd>.</span></p></div></div></section>
    </main>
    <footer class="site-footer"><span>BUILT FOR THE FIGHT.</span><span>LOCAL PLAY <i></i> NO ACCOUNT NEEDED <span class="footer-version">V.01</span></span></footer>
  </div>
  <dialog id="guide-dialog" class="guide-dialog"><div class="guide-top"><span class="eyebrow">THE FIGHTER'S PLAYBOOK</span><button id="close-guide" aria-label="Close fighter guide">×</button></div><h2>Instinct meets technique.</h2><p>Win two rounds to take the match. When the timer runs out, the fighter with more health wins.</p><div class="guide-rule"><strong>01 <span>Know your range.</span></strong><p>Light attacks are fast. Heavy attacks reach farther and hit harder, but leave you open. Hold the direction away from your opponent to block; crouch and hold back to block low attacks.</p></div><div class="guide-rule"><strong>02 <span>Make it a combo.</span></strong><p>After a normal attack connects, press a stronger normal or a special to cancel into it. Try <kbd>U</kbd> → <kbd>I</kbd> → <kbd>Q</kbd> or <kbd>J</kbd> → <kbd>K</kbd> → <kbd>E</kbd> while close to your opponent.</p></div><div class="guide-rule"><strong>03 <span>Go primal.</span></strong><p>Attacking and taking hits build your super meter. With a full meter, press <kbd>R</kbd> to unleash your super. Press <kbd>Q</kbd> or <kbd>E</kbd> for specials, or use quarter-circle forward + punch / quarter-circle back + punch.</p></div><div class="guide-bottom"><span><kbd>P</kbd> Pause <span>·</span> <kbd>ENTER</kbd> Start / rematch</span><button id="guide-done">GOT IT ${icon('arrow')}</button></div></dialog>
`;

let selectedFighter: FighterId = 'leo';
let controller: GameController;
let latest: GameSnapshot | undefined;
let lastUiKey = '';
const screen = document.querySelector<HTMLDivElement>('#game-screen')!;
const intro = document.querySelector<HTMLDivElement>('#screen-intro')!;
const pauseOverlay = document.querySelector<HTMLDivElement>('#pause-overlay')!;
const resultOverlay = document.querySelector<HTMLDivElement>('#result-overlay')!;
const playLabel = document.querySelector<HTMLSpanElement>('#play-label')!;
const soundButton = document.querySelector<HTMLButtonElement>('#sound-button')!;
const pauseButton = document.querySelector<HTMLButtonElement>('#pause-button')!;
const setText = (id: string, value: string) => { document.getElementById(id)!.textContent = value; };

function selectFighter(id: FighterId): void {
  selectedFighter = id;
  document.querySelectorAll<HTMLButtonElement>('[data-fighter]').forEach(button => {
    const selected = button.dataset.fighter === id;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  const leo = id === 'leo';
  setText('fighter-detail-name', leo ? "LEO'S" : "KOBA'S");
  setText('special-one-name', leo ? 'Claw Rush' : 'Iron Lunge');
  setText('special-two-name', leo ? 'Royal Roar' : 'Ground Breaker');
  setText('super-name', leo ? 'Primal Fury' : 'Earthquake');
}

function updateUi(snapshot: GameSnapshot): void {
  latest = snapshot;
  const state = snapshot.state;
  const uiKey = `${state.phase}:${snapshot.paused}:${snapshot.muted}:${state.round}:${state.winner}:${state.fighters[0].id}`;
  if (uiKey === lastUiKey) return;
  lastUiKey = uiKey;
  const selecting = state.phase === 'select';
  const ended = state.phase === 'matchOver';
  intro.hidden = !selecting;
  pauseOverlay.hidden = !snapshot.paused || selecting || ended;
  resultOverlay.hidden = !ended;
  setText('game-status', selecting ? 'READY TO RUMBLE' : ended ? 'MATCH COMPLETE' : snapshot.paused ? 'TAKING A BREATHER' : `ROUND ${String(state.round).padStart(2, '0')} · ${state.phase === 'countdown' ? 'GET READY' : 'FIGHT IN PROGRESS'}`);
  document.querySelector('.arena-live')?.classList.toggle('is-paused', snapshot.paused);
  playLabel.textContent = selecting ? "LET'S FIGHT" : ended ? 'RUN IT BACK' : 'NEW MATCH';
  pauseButton.disabled = selecting || ended;
  pauseButton.innerHTML = icon(snapshot.paused ? 'play' : 'pause');
  pauseButton.setAttribute('aria-label', snapshot.paused ? 'Resume game' : 'Pause game');
  soundButton.setAttribute('aria-pressed', String(snapshot.muted));
  soundButton.setAttribute('aria-label', snapshot.muted ? 'Enable sound' : 'Mute sound');
  soundButton.innerHTML = `${icon(snapshot.muted ? 'mute' : 'sound')}<span>${snapshot.muted ? 'SOUND OFF' : 'SOUND ON'}</span>`;
  if (ended) {
    const playerWon = state.winner === 0;
    const draw = state.winner === null;
    setText('result-kicker', draw ? 'EVENLY MATCHED' : playerWon ? 'KING OF THE ZOO' : 'THE WILD BITES BACK');
    setText('result-title', draw ? 'DRAW!' : playerWon ? 'YOU WIN!' : 'DEFEATED.');
    setText('result-message', draw ? 'One more match will settle it.' : playerWon ? 'The arena belongs to you.' : 'Shake it off. Your next round awaits.');
  }
}

controller = createGame(screen, updateUi);
function start(): void {
  controller.start(selectedFighter);
  screen.focus({ preventScroll: true });
}
document.querySelectorAll<HTMLButtonElement>('[data-fighter]').forEach(button => button.addEventListener('click', () => selectFighter(button.dataset.fighter as FighterId)));
['play-button', 'screen-start', 'rematch-button'].forEach(id => document.getElementById(id)!.addEventListener('click', start));
document.getElementById('restart-button')!.addEventListener('click', () => { if (!latest || latest.state.phase === 'select') start(); else { controller.restart(); screen.focus({ preventScroll: true }); } });
['pause-button', 'resume-button'].forEach(id => document.getElementById(id)!.addEventListener('click', () => { controller.pause(); screen.focus({ preventScroll: true }); }));
soundButton.addEventListener('click', () => controller.setMuted(!latest?.muted));
const bezel = document.querySelector<HTMLDivElement>('#screen-bezel')!;
document.getElementById('fullscreen-button')!.addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await bezel.requestFullscreen(); } catch { setText('game-status', 'FULL SCREEN UNAVAILABLE'); }
});
const guide = document.querySelector<HTMLDialogElement>('#guide-dialog')!;
document.getElementById('help-button')!.addEventListener('click', () => { if (latest && ['fight', 'countdown', 'roundOver'].includes(latest.state.phase) && !latest.paused) controller.pause(); guide.showModal(); });
['close-guide', 'guide-done'].forEach(id => document.getElementById(id)!.addEventListener('click', () => guide.close()));
guide.addEventListener('click', event => { if (event.target === guide) { const rect = guide.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) guide.close(); } });
window.addEventListener('keydown', event => {
  if (guide.open) { event.stopImmediatePropagation(); return; }
  if ((event.target as HTMLElement | null)?.closest('button, a')) return;
  if (event.key === 'Enter' && !guide.open && (!latest || latest.state.phase === 'select' || latest.state.phase === 'matchOver')) { event.preventDefault(); event.stopImmediatePropagation(); start(); }
}, { capture: true });
document.querySelectorAll<HTMLButtonElement>('[data-direction]').forEach(button => {
  const direction = button.dataset.direction as 'left' | 'right' | 'up' | 'down';
  const release = () => { controller.setDirection(direction, false); button.classList.remove('held'); };
  button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); controller.setDirection(direction, true); button.classList.add('held'); });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
});
document.querySelectorAll<HTMLButtonElement>('[data-attack]').forEach(button => {
  button.addEventListener('pointerdown', event => { event.preventDefault(); controller.press(button.dataset.attack as AttackId); button.classList.add('held'); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(name => button.addEventListener(name, () => button.classList.remove('held')));
});
window.addEventListener('pagehide', () => controller.destroy());
