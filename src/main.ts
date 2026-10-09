import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/press-start-2p/400.css';
import './style.css';
import { createGame, type GameController, type GameSnapshot } from './game';
import { FLOOR, type AttackId, type FighterId } from './types';
import { drawFighter } from './art';

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
const assetUrl = (file: string) => `${import.meta.env.BASE_URL}assets/${file}`;
app.innerHTML = `
<main class="arcade-app" data-route="title" id="arcade-app">
  <div class="world-backdrop" aria-hidden="true"><img id="title-art" src="${assetUrl('title.png')}" alt=""><div class="world-shade"></div></div>
  <div class="scanlines" aria-hidden="true"></div>
  <div class="utility-bar" id="utility-bar"><button id="sound-button" class="icon-button" aria-label="Mute sound" aria-pressed="false" title="Sound">${icon('sound')}</button><button id="fullscreen-button" class="icon-button" aria-label="Full screen" title="Full screen">${icon('expand')}</button><button id="pause-button" class="icon-button" aria-label="Pause game" title="Pause (P)" hidden>${icon('pause')}</button></div>

  <section class="view title-view" id="title-view" aria-labelledby="title-logo">
    <div class="title-top pixel-small"><span class="gold-diamond"></span> AN ORIGINAL ARCADE FIGHTER <span class="gold-diamond"></span></div>
    <div class="title-center"><div class="logo-crest" aria-hidden="true">✦</div><h1 class="game-logo" id="title-logo"><span>SHADOW</span><strong>ZOO</strong></h1><div class="logo-rule"><i></i><span>THE WILD HAS A NEW CHAMPION</span><i></i></div><button class="gold-button title-start" id="title-start">START GAME ${icon('arrow')}</button><span class="press-enter pixel-small">PRESS ENTER TO BEGIN</span></div>
    <div class="title-bottom"><span class="pixel-small">1 PLAYER <i>◆</i> 2 FIGHTERS <i>◆</i> BEST OF THREE</span><p lang="th">เลือกนักสู้ ปลดปล่อยสัญชาตญาณ ครองสังเวียน</p><span class="version-label">SHADOW ZOO · V.01</span></div>
  </section>

  <section class="view menu-view" id="menu-view" aria-labelledby="menu-title" hidden>
    <button class="back-button" id="menu-back" aria-label="Back to title">← <span>BACK</span></button>
    <div class="menu-content"><div class="mini-logo"><span>SHADOW</span><strong>ZOO</strong></div><div class="menu-heading"><i></i><h2 id="menu-title">MAIN MENU</h2><i></i></div><nav class="main-menu" aria-label="Game menu"><button class="menu-option primary-option" id="arcade-start"><span class="menu-pointer">▸</span><span>ARCADE<small lang="th">สู้กับ CPU · ชนะสองในสามยก</small></span><span class="menu-option-icon">01</span></button><button class="menu-option" id="menu-help"><span class="menu-pointer">▸</span><span>HOW TO PLAY<small lang="th">การควบคุม ท่าพิเศษ และคอมโบ</small></span>${icon('question')}</button><button class="menu-option" id="menu-settings"><span class="menu-pointer">▸</span><span>SETTINGS<small lang="th">เสียงและการแสดงผล</small></span><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 7h16M4 17h16M8 4v6m8 4v6"/></svg></button></nav><div class="menu-footnote pixel-small">YOUR ARENA. YOUR INSTINCT.</div></div>
    <div class="screen-caption"><span>LOCAL ARCADE</span><span>ENTER · SELECT &nbsp; ESC · BACK</span></div>
  </section>

  <section class="view select-view" id="select-view" aria-labelledby="select-title" hidden>
    <div class="select-header"><button class="back-button" id="select-back" aria-label="Back to main menu">← <span>BACK</span></button><span class="pixel-small">ARCADE MODE</span><span class="selection-player"><i></i> PLAYER 1</span></div>
    <div class="select-heading"><span class="pixel-small">TRUST YOUR INSTINCT</span><h2 id="select-title">CHOOSE YOUR FIGHTER</h2><p lang="th">สองนักสู้ สองสไตล์ ใครจะเป็นราชาแห่งสวนสัตว์?</p></div>
    <div class="fighter-roster"><button class="fighter-option selected" data-fighter="leo" aria-pressed="true"><span class="fighter-pick-marker">1P</span><span class="fighter-number">01 / LION</span><span class="fighter-art"><canvas class="fighter-preview" data-preview="leo" width="192" height="224" aria-hidden="true"></canvas><span class="fighter-art-glow"></span></span><span class="fighter-name">LEO</span><span class="fighter-subtitle">THE GOLDEN CLAW</span><span class="fighter-style">SPEED &amp; PRECISION</span><span class="fighter-mini-portrait">${lionPortrait}</span></button><span class="roster-versus" aria-hidden="true">VS</span><button class="fighter-option" data-fighter="koba" aria-pressed="false"><span class="fighter-pick-marker">1P</span><span class="fighter-number">02 / GORILLA</span><span class="fighter-art"><canvas class="fighter-preview" data-preview="koba" width="192" height="224" aria-hidden="true"></canvas><span class="fighter-art-glow"></span></span><span class="fighter-name">KOBA</span><span class="fighter-subtitle">THE IRON APE</span><span class="fighter-style">RAW POWER</span><span class="fighter-mini-portrait">${apePortrait}</span></button></div>
    <div class="selection-bottom"><div class="selection-moves"><span class="moves-heading pixel-small" id="fighter-detail-name">LEO'S SIGNATURE MOVES</span><div class="moves-row"><span><kbd>Q</kbd><strong id="special-one-name">Claw Rush</strong></span><span><kbd>E</kbd><strong id="special-two-name">Royal Roar</strong></span><span><kbd>R</kbd><strong id="super-name">Primal Fury</strong><i>SUPER</i></span></div></div><button class="gold-button" id="confirm-fighter">FIGHT ${icon('arrow')}</button></div>
    <div class="screen-caption"><span>← → · CHOOSE &nbsp; ENTER · FIGHT</span><span>VS CPU <i class="caption-pip"></i> NIGHTFALL SANCTUARY</span></div>
  </section>

  <section class="view fight-view" id="fight-view" aria-label="Shadow Zoo fighting arena" hidden>
    <div class="fight-topbar"><div class="fight-wordmark">SHADOW <span>ZOO</span></div><span class="stage-label">NIGHTFALL SANCTUARY <i>STAGE 01</i></span></div>
    <div class="arena-zone" id="arena-zone"><div class="game-frame" id="game-frame"><div id="game-screen" tabindex="0" role="application" aria-label="Fighting arena. Use WASD to move, U I O to punch, J K L to kick. Q and E special moves, R super, P pause."></div><div class="arena-scanlines" aria-hidden="true"></div></div></div>
    <div class="touch-controls" aria-label="Touch game controls"><div class="touch-movement"><span class="touch-label">MOVE / BLOCK</span><div class="dpad"><button class="dpad-up" data-direction="up" aria-label="Jump">↑</button><button class="dpad-left" data-direction="left" aria-label="Move left or block">←</button><button class="dpad-down" data-direction="down" aria-label="Crouch">↓</button><button class="dpad-right" data-direction="right" aria-label="Move right or block">→</button></div></div><div class="touch-attacks"><div class="touch-attack-row"><span>P</span><button data-attack="lp" aria-label="Light punch">L</button><button data-attack="mp" aria-label="Medium punch">M</button><button data-attack="hp" aria-label="Heavy punch">H</button></div><div class="touch-attack-row"><span>K</span><button data-attack="lk" aria-label="Light kick">L</button><button data-attack="mk" aria-label="Medium kick">M</button><button data-attack="hk" aria-label="Heavy kick">H</button></div></div><div class="touch-specials"><span class="touch-label">SPECIAL</span><div><button data-attack="special1" aria-label="Special move one">Q</button><button data-attack="special2" aria-label="Special move two">E</button></div><button class="touch-super" data-attack="super" aria-label="Super move. Requires full meter">SUPER</button></div></div>
    <div class="fight-bottom"><span class="keyboard-hint"><kbd>W A S D</kbd> MOVE <i>·</i> <kbd>U I O</kbd> PUNCH <i>·</i> <kbd>J K L</kbd> KICK <i>·</i> <kbd>Q E</kbd> SPECIAL <i>·</i> <kbd>R</kbd> SUPER</span><button id="fight-help">HOW TO PLAY ${icon('question')}</button></div><span id="game-status" class="sr-only" aria-live="polite">READY</span>
  </section>

  <div id="ui-toast" class="ui-toast" role="status" hidden></div>
</main>

<dialog class="arcade-dialog pause-dialog" id="pause-dialog" aria-labelledby="pause-title"><div class="dialog-kicker pixel-small">TAKE A BREATHER</div><h2 id="pause-title">PAUSED</h2><p lang="th">สังเวียนรอคุณอยู่</p><div class="dialog-menu"><button class="gold-button" id="resume-button">RESUME ${icon('play')}</button><button class="outline-button" id="pause-restart">RESTART MATCH ${icon('restart')}</button><button class="outline-button" id="pause-fighter">CHANGE FIGHTER ${icon('arrow')}</button><button class="outline-button" id="pause-menu">MAIN MENU</button></div><div class="dialog-footnote">PRESS P OR ESC TO RESUME</div></dialog>

<dialog class="arcade-dialog result-dialog" id="result-dialog" aria-labelledby="result-title"><span class="result-emblem" aria-hidden="true">✦</span><div class="dialog-kicker pixel-small" id="result-kicker">KING OF THE ZOO</div><h2 id="result-title">YOU WIN!</h2><p id="result-message">The arena belongs to you.</p><div class="result-score" id="result-score">2 : 0</div><div class="dialog-menu"><button class="gold-button" id="rematch-button">REMATCH ${icon('restart')}</button><button class="outline-button" id="result-fighter">CHANGE FIGHTER</button><button class="outline-button" id="result-menu">MAIN MENU</button></div></dialog>

<dialog class="arcade-dialog guide-dialog" id="guide-dialog" aria-labelledby="guide-title"><div class="dialog-top"><span class="pixel-small">THE FIGHTER'S PLAYBOOK</span><button class="close-button" id="guide-close" aria-label="Close guide">×</button></div><h2 id="guide-title">HOW TO PLAY</h2><p lang="th">ชนะสองยกเพื่อครองสังเวียน · ยกละ 60 วินาที</p><div class="guide-columns"><section><h3>01 / THE BASICS</h3><div class="guide-controls"><span><kbd>A</kbd><kbd>D</kbd></span><span>Move / hold back to block</span><span><kbd>W</kbd><kbd>S</kbd></span><span>Jump / crouch</span><span><kbd>U</kbd><kbd>I</kbd><kbd>O</kbd></span><span>Light / medium / heavy punch</span><span><kbd>J</kbd><kbd>K</kbd><kbd>L</kbd></span><span>Light / medium / heavy kick</span></div><p lang="th">ถอยหลังเพื่อป้องกัน ย่อและถอยเพื่อป้องกันท่าต่ำ ปุ่มลูกศรใช้แทน WASD ได้</p></section><section><h3>02 / GO PRIMAL</h3><div class="guide-controls"><span><kbd>Q</kbd><kbd>E</kbd></span><span>Special moves</span><span><kbd>R</kbd></span><span>Super · full meter required</span></div><p>↓ ↘ → + P = special 1<br>↓ ↙ ← + P = special 2<br>↓ ↘ → ↓ ↘ → + P = super</p><p lang="th">ทิศทางอ้างอิงการหันหน้า เกจสะสมระหว่างต่อสู้</p></section></div><section class="combo-guide"><h3>03 / CHAIN THE HITS</h3><div><kbd>U</kbd><span>→</span><kbd>I</kbd><span>→</span><kbd>Q</kbd><i>OR</i><kbd>J</kbd><span>→</span><kbd>K</kbd><span>→</span><kbd>E</kbd></div><p lang="th">เข้าระยะประชิด แล้วกดท่าถัดไปหลังท่าก่อนหน้าโจมตีโดน เพื่อยกเลิกเข้าสู่คอมโบ</p></section><div class="guide-footer"><span><kbd>P</kbd> / <kbd>ESC</kbd> PAUSE</span><button class="gold-button" id="guide-done">GOT IT ${icon('arrow')}</button></div></dialog>

<dialog class="arcade-dialog settings-dialog" id="settings-dialog" aria-labelledby="settings-title"><div class="dialog-top"><span class="pixel-small">MAKE IT YOURS</span><button class="close-button" id="settings-close" aria-label="Close settings">×</button></div><h2 id="settings-title">SETTINGS</h2><div class="setting-row"><div><strong>ARCADE AUDIO</strong><p lang="th">เพลงและเสียงเอฟเฟกต์</p></div><button id="settings-sound" class="setting-toggle" aria-pressed="true">ON</button></div><div class="setting-row"><div><strong>FULL SCREEN</strong><p lang="th">ใช้พื้นที่หน้าจอทั้งหมด</p></div><button id="settings-fullscreen" class="outline-button">EXPAND ${icon('expand')}</button></div><p class="settings-hint" lang="th">บนมือถือ หมุนจอแนวนอนเพื่อให้สนามใหญ่ขึ้น</p><button class="gold-button" id="settings-done">BACK ${icon('arrow')}</button></dialog>
`;

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const appRoot = byId<HTMLElement>('arcade-app');
const gameScreen = byId<HTMLDivElement>('game-screen');
const gameFrame = byId<HTMLDivElement>('game-frame');
const arenaZone = byId<HTMLDivElement>('arena-zone');
const titleArt = byId<HTMLImageElement>('title-art');
titleArt.addEventListener('error', () => { if (!titleArt.src.endsWith('/arena.png')) titleArt.src = assetUrl('arena.png'); });
const pauseDialog = byId<HTMLDialogElement>('pause-dialog');
const resultDialog = byId<HTMLDialogElement>('result-dialog');
const guideDialog = byId<HTMLDialogElement>('guide-dialog');
const settingsDialog = byId<HTMLDialogElement>('settings-dialog');
const soundButton = byId<HTMLButtonElement>('sound-button');
const pauseButton = byId<HTMLButtonElement>('pause-button');
const setText = (id: string, value: string) => { byId(id).textContent = value; };
type Route = 'title' | 'menu' | 'select' | 'fight';
let route: Route = 'title';
let selectedFighter: FighterId = 'leo';
let controller: GameController;
let latest: GameSnapshot | undefined;
let activeDialog: HTMLDialogElement | null = null;
let helperReturn: 'pause' | 'resume' | 'none' = 'none';
let helperOpener: HTMLElement | null = null;
let lastUiKey = '';
let toastTimeout = 0;
let previewFrame = 0;
let previewHandle = 0;
let alive = true;

function resizeArena(): void {
  if (route !== 'fight' || !controller) return;
  const width = Math.floor(Math.min(arenaZone.clientWidth, arenaZone.clientHeight * 384 / 224));
  if (width <= 0) return;
  gameFrame.style.width = `${width}px`;
  gameFrame.style.height = `${Math.round(width * 224 / 384)}px`;
  controller.resize();
}
const resizeObserver = new ResizeObserver(resizeArena);
resizeObserver.observe(arenaZone);

function closeAllDialogs(): void {
  activeDialog = null;
  [pauseDialog, resultDialog, guideDialog, settingsDialog].forEach(dialog => { if (dialog.open) dialog.close(); });
}
function showRoute(next: Route): void {
  closeAllDialogs();
  helperReturn = 'none';
  route = next;
  appRoot.dataset.route = next;
  ['title', 'menu', 'select', 'fight'].forEach(name => { byId(`${name}-view`).hidden = name !== next; });
  pauseButton.hidden = next !== 'fight';
  if (next !== 'fight') controller.returnToMenu();
  controller.setInputEnabled(next === 'fight');
  const focusId = next === 'title' ? 'title-start' : next === 'menu' ? 'arcade-start' : next === 'select' ? '' : 'game-screen';
  requestAnimationFrame(() => {
    if (route !== next) return;
    if (next === 'fight') resizeArena();
    if (focusId) byId(focusId).focus({ preventScroll: true });
    else document.querySelector<HTMLButtonElement>(`[data-fighter="${selectedFighter}"]`)?.focus({ preventScroll: true });
  });
}
function beginFight(): void {
  closeAllDialogs();
  showRoute('fight');
  controller.start(selectedFighter);
  requestAnimationFrame(resizeArena);
}
function selectFighter(id: FighterId): void {
  selectedFighter = id;
  document.querySelectorAll<HTMLButtonElement>('[data-fighter]').forEach(button => {
    const selected = button.dataset.fighter === id;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  const leo = id === 'leo';
  setText('fighter-detail-name', `${leo ? 'LEO' : 'KOBA'}'S SIGNATURE MOVES`);
  setText('special-one-name', leo ? 'Claw Rush' : 'Iron Lunge');
  setText('special-two-name', leo ? 'Royal Roar' : 'Ground Breaker');
  setText('super-name', leo ? 'Primal Fury' : 'Earthquake');
}
function showDialog(dialog: HTMLDialogElement): void {
  if (dialog.open) return;
  activeDialog = dialog;
  controller.setInputEnabled(false);
  if (route === 'fight' && latest && !latest.paused && ['fight', 'countdown', 'roundOver'].includes(latest.state.phase)) controller.pause();
  dialog.showModal();
}
function resumeFight(): void {
  closeAllDialogs();
  if (latest?.paused) controller.pause();
  controller.setInputEnabled(true);
  gameScreen.focus({ preventScroll: true });
}
function openHelper(dialog: HTMLDialogElement): void {
  helperOpener = document.activeElement as HTMLElement | null;
  helperReturn = route !== 'fight' ? 'none' : latest?.paused ? 'pause' : 'resume';
  closeAllDialogs();
  showDialog(dialog);
}
function closeHelper(): void {
  const destination = helperReturn;
  closeAllDialogs();
  if (route === 'fight') {
    if (destination === 'pause') showDialog(pauseDialog);
    else resumeFight();
  } else (helperOpener?.isConnected ? helperOpener : byId('arcade-start')).focus({ preventScroll: true });
}
function toggleSound(): void { controller.setMuted(!latest?.muted); controller.unlockAudio(); }
function toast(message: string): void {
  const element = byId<HTMLDivElement>('ui-toast');
  element.textContent = message; element.hidden = false;
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => { element.hidden = true; }, 3300);
}
async function fullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else toast('Full screen is unavailable in this browser.');
  } catch { toast('Full screen is unavailable in this browser.'); }
}
function updateUi(snapshot: GameSnapshot): void {
  latest = snapshot;
  const state = snapshot.state;
  const key = `${state.phase}:${snapshot.paused}:${snapshot.muted}:${state.round}:${state.winner}:${state.wins.join('-')}`;
  if (lastUiKey !== key) {
    lastUiKey = key;
    setText('game-status', state.phase === 'select' ? 'READY' : snapshot.paused ? 'PAUSED' : state.phase === 'matchOver' ? 'MATCH COMPLETE' : `ROUND ${state.round} · ${state.phase === 'fight' ? 'FIGHT IN PROGRESS' : state.phase === 'countdown' ? 'GET READY' : 'ROUND COMPLETE'}`);
    soundButton.innerHTML = icon(snapshot.muted ? 'mute' : 'sound');
    soundButton.setAttribute('aria-label', snapshot.muted ? 'Enable sound' : 'Mute sound');
    soundButton.setAttribute('aria-pressed', String(snapshot.muted));
    setText('settings-sound', snapshot.muted ? 'OFF' : 'ON');
    byId('settings-sound').setAttribute('aria-pressed', String(!snapshot.muted));
    if (state.phase === 'matchOver') {
      const won = state.winner === 0;
      const draw = state.winner === null;
      setText('result-kicker', draw ? 'EVENLY MATCHED' : won ? 'KING OF THE ZOO' : 'THE WILD BITES BACK');
      setText('result-title', draw ? 'DRAW!' : won ? 'YOU WIN!' : 'DEFEATED');
      setText('result-message', draw ? 'One more match will settle it.' : won ? 'The arena belongs to you.' : 'Shake it off. Your next round awaits.');
      setText('result-score', `${state.wins[0]} : ${state.wins[1]}`);
      resultDialog.classList.toggle('player-lost', !won && !draw);
    }
  }
  if (route !== 'fight' || !controller) return;
  if (state.phase === 'matchOver' && !activeDialog) showDialog(resultDialog);
  else if (snapshot.paused && !activeDialog) showDialog(pauseDialog);
}

controller = createGame(gameScreen, updateUi);
controller.setInputEnabled(false);

byId('title-start').addEventListener('click', () => { controller.unlockAudio(); showRoute('menu'); });
byId('menu-back').addEventListener('click', () => showRoute('title'));
byId('select-back').addEventListener('click', () => showRoute('menu'));
byId('arcade-start').addEventListener('click', () => showRoute('select'));
byId('confirm-fighter').addEventListener('click', beginFight);
document.querySelectorAll<HTMLButtonElement>('[data-fighter]').forEach(button => button.addEventListener('click', () => selectFighter(button.dataset.fighter as FighterId)));
byId('menu-help').addEventListener('click', () => openHelper(guideDialog));
byId('fight-help').addEventListener('click', () => openHelper(guideDialog));
byId('menu-settings').addEventListener('click', () => openHelper(settingsDialog));
['guide-close', 'guide-done', 'settings-close', 'settings-done'].forEach(id => byId(id).addEventListener('click', closeHelper));
byId('sound-button').addEventListener('click', toggleSound);
byId('settings-sound').addEventListener('click', toggleSound);
['fullscreen-button', 'settings-fullscreen'].forEach(id => byId(id).addEventListener('click', fullscreen));
byId('pause-button').addEventListener('click', () => { if (latest?.state.phase === 'matchOver') showDialog(resultDialog); else showDialog(pauseDialog); });
byId('resume-button').addEventListener('click', resumeFight);
['pause-restart', 'rematch-button'].forEach(id => byId(id).addEventListener('click', beginFight));
['pause-fighter', 'result-fighter'].forEach(id => byId(id).addEventListener('click', () => showRoute('select')));
['pause-menu', 'result-menu'].forEach(id => byId(id).addEventListener('click', () => showRoute('menu')));
[pauseDialog, resultDialog, guideDialog, settingsDialog].forEach(dialog => dialog.addEventListener('cancel', event => {
  event.preventDefault();
  if (dialog === pauseDialog) resumeFight();
  else if (dialog === resultDialog) showRoute('menu');
  else closeHelper();
}));

window.addEventListener('keydown', event => {
  if (event.repeat) return;
  if (activeDialog) {
    event.stopImmediatePropagation();
    if (event.code === 'KeyP' && activeDialog === pauseDialog) { event.preventDefault(); resumeFight(); }
    return;
  }
  if (route === 'fight') return;
  event.stopImmediatePropagation();
  const buttonTarget = (event.target as HTMLElement | null)?.closest('button');
  if (event.key === 'Escape') { event.preventDefault(); showRoute(route === 'select' ? 'menu' : 'title'); }
  if (route === 'select' && ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(event.code)) {
    event.preventDefault(); selectFighter(selectedFighter === 'leo' ? 'koba' : 'leo');
    document.querySelector<HTMLButtonElement>(`[data-fighter="${selectedFighter}"]`)?.focus({ preventScroll: true });
  }
  if (route === 'menu' && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault();
    const options = Array.from(document.querySelectorAll<HTMLButtonElement>('.main-menu button'));
    const current = options.indexOf(document.activeElement as HTMLButtonElement);
    const next = current < 0 ? (event.key === 'ArrowDown' ? 0 : options.length - 1)
      : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
    options[next].focus({ preventScroll: true });
  }
  if (event.key === 'Enter') {
    if (route === 'select' && (!buttonTarget || buttonTarget.hasAttribute('data-fighter'))) {
      event.preventDefault();
      if (buttonTarget?.dataset.fighter) selectFighter(buttonTarget.dataset.fighter as FighterId);
      beginFight();
    }
    else if (!buttonTarget) { event.preventDefault(); if (route === 'title') { controller.unlockAudio(); showRoute('menu'); } else if (route === 'menu') showRoute('select'); }
  }
}, { capture: true });

document.querySelectorAll<HTMLButtonElement>('[data-direction]').forEach(button => {
  const direction = button.dataset.direction as 'left' | 'right' | 'up' | 'down';
  const release = () => { controller.setDirection(direction, false); button.classList.remove('held'); };
  button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); controller.setDirection(direction, true); button.classList.add('held'); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(name => button.addEventListener(name, release));
});
document.querySelectorAll<HTMLButtonElement>('[data-attack]').forEach(button => {
  button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); controller.press(button.dataset.attack as AttackId); button.classList.add('held'); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(name => button.addEventListener(name, () => button.classList.remove('held')));
});
function animatePreviews(): void {
  if (!alive) return;
  previewFrame++;
  if (route === 'select' && controller) {
    document.querySelectorAll<HTMLCanvasElement>('.fighter-preview').forEach(canvas => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, 192, 224);
      ctx.imageSmoothingEnabled = false;
      const fighter = { ...controller.getState().fighters[0], id: canvas.dataset.preview as FighterId, x: 96, y: FLOOR, action: 'idle' as const, facing: canvas.dataset.preview === 'leo' ? 1 as const : -1 as const, attack: null, animationFrame: previewFrame };
      ctx.save();
      ctx.translate(-96, -180);
      ctx.scale(2, 2);
      drawFighter(ctx, fighter, previewFrame);
      ctx.restore();
    });
  }
  previewHandle = requestAnimationFrame(animatePreviews);
}
previewHandle = requestAnimationFrame(animatePreviews);
document.addEventListener('fullscreenchange', () => requestAnimationFrame(resizeArena));
window.addEventListener('pagehide', event => {
  if (event.persisted) {
    if (route === 'fight' && latest && !latest.paused && ['fight', 'countdown', 'roundOver'].includes(latest.state.phase)) controller.pause();
    return;
  }
  alive = false; cancelAnimationFrame(previewHandle); resizeObserver.disconnect(); controller.destroy();
});
byId('title-start').focus({ preventScroll: true });
