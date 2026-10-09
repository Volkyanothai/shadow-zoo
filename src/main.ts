import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/press-start-2p/400.css';
import '@fontsource/noto-sans-thai/400.css';
import '@fontsource/noto-sans-thai/600.css';
import '@fontsource/noto-sans-thai/700.css';
import './style.css';
import { createGame, type GameController, type GameSnapshot } from './game';
import { FLOOR, type AttackId, type FighterId, type Locale, type StageId } from './types';
import { FIGHTERS, FIGHTER_IDS, STAGES, STAGE_IDS } from './catalog';
import { drawFighter } from './art';
import { getLocale, setLocale, onLocaleChange, t, type TranslationKey } from './i18n';

const icons = {
  sound: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 6 6m0-6-6 6"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  pause: '<path d="M8 5v14M16 5v14"/>', play: '<path d="m8 5 11 7-11 7V5Z"/>',
  restart: '<path d="M3 10a9 9 0 1 1 1 8M3 4v6h6"/>', arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1.5 1-1.5 1.5-1.5 2M12 16h.01"/>',
  settings: '<path d="M4 7h16M4 17h16M8 4v6m8 4v6"/>',
};
function icon(name: keyof typeof icons): string { return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`; }
const tr = (key: TranslationKey) => `<span data-i18n="${key}">${t(key)}</span>`;
const aria = (key: TranslationKey) => `data-i18n-aria="${key}" aria-label="${t(key)}"`;
function languageSwitch(): string { return `<div class="locale-switch" role="group" ${aria('languageChoice')}><button data-locale="th" aria-pressed="${getLocale() === 'th'}" lang="th">ไทย</button><button data-locale="en" aria-pressed="${getLocale() === 'en'}" lang="en">EN</button></div>`; }
const assetUrl = (file: string) => `${import.meta.env.BASE_URL}assets/${file}`;
const backButton = (id: string, label: TranslationKey) => `<button class="back-button" id="${id}" ${aria(label)}>← ${tr('back')}</button>`;
const fighterCards = FIGHTER_IDS.map((id, index) => `<button class="fighter-option${index === 0 ? ' selected' : ''}" data-fighter="${id}" aria-pressed="${index === 0}" style="--fighter-color:${FIGHTERS[id].color}"><span class="fighter-number">0${index + 1}</span><span class="fighter-pick-marker">1P</span><canvas class="fighter-preview roster-preview" data-preview="${id}" width="160" height="160" aria-hidden="true"></canvas><span class="fighter-card-name" data-fighter-name="${id}"></span><span class="fighter-card-species" data-fighter-species="${id}"></span></button>`).join('');
const stageCards = STAGE_IDS.map((id, index) => `<button class="stage-option${index === 0 ? ' selected' : ''}" data-stage="${id}" aria-pressed="${index === 0}" style="--stage-color:${STAGES[id].color}"><img src="${assetUrl(STAGES[id].asset)}" alt="" loading="lazy"><span class="stage-number">0${index + 1}</span><span class="stage-check" aria-hidden="true">✓</span><span class="stage-card-name" data-stage-name="${id}"></span></button>`).join('');

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
<main class="arcade-app" data-route="title" id="arcade-app">
  <div class="world-backdrop" aria-hidden="true"><img id="title-art" src="${assetUrl('title.png')}" alt=""><div class="world-shade"></div></div>
  <div class="scanlines" aria-hidden="true"></div><div class="ambient-glow" aria-hidden="true"></div>
  <div class="utility-bar" id="utility-bar">${languageSwitch()}<button id="sound-button" class="icon-button" ${aria('mute')} aria-pressed="false">${icon('sound')}</button><button id="fullscreen-button" class="icon-button" ${aria('fullscreen')}>${icon('expand')}</button><button id="pause-button" class="icon-button" ${aria('pauseLabel')} hidden>${icon('pause')}</button></div>
  <section class="view title-view" id="title-view" aria-labelledby="title-logo">
    <div class="title-top pixel-small"><span class="gold-diamond"></span>${tr('original')}<span class="gold-diamond"></span></div>
    <div class="title-center"><div class="logo-crest" aria-hidden="true">✦</div><h1 class="game-logo" id="title-logo"><span>SHADOW</span><strong>ZOO</strong></h1><div class="logo-rule"><i></i>${tr('champion')}<i></i></div><button class="gold-button title-start" id="title-start">${tr('start')}${icon('arrow')}</button><span class="press-enter pixel-small" data-i18n="pressEnter"></span></div>
    <div class="title-bottom"><span class="pixel-small" data-i18n="titleFeatures"></span><p data-i18n="titleTagline"></p><span class="version-label">SHADOW ZOO · V.02</span></div>
  </section>
  <section class="view menu-view" id="menu-view" aria-labelledby="menu-title" hidden>
    ${backButton('menu-back', 'backTitle')}
    <div class="menu-content"><div class="mini-logo"><span>SHADOW</span><strong>ZOO</strong></div><div class="menu-heading"><i></i><h2 id="menu-title" data-i18n="mainMenu"></h2><i></i></div><nav class="main-menu" ${aria('gameMenu')}>
      <button class="menu-option primary-option" id="arcade-start"><span class="menu-pointer">▸</span><span>${tr('arcade')}<small data-i18n="arcadeHint"></small></span><span class="menu-option-icon">01</span></button>
      <button class="menu-option" id="menu-help"><span class="menu-pointer">▸</span><span>${tr('howToPlay')}<small data-i18n="howHint"></small></span>${icon('question')}</button>
      <button class="menu-option" id="menu-settings"><span class="menu-pointer">▸</span><span>${tr('settings')}<small data-i18n="settingsHint"></small></span>${icon('settings')}</button>
    </nav><div class="menu-footnote pixel-small" data-i18n="instinct"></div></div>
    <div class="screen-caption"><span data-i18n="localArcade"></span><span data-i18n="menuKeys"></span></div>
  </section>
  <section class="view select-view" id="select-view" aria-labelledby="select-title" hidden>
    <div class="select-header">${backButton('select-back', 'backMenu')}<span class="pixel-small" data-i18n="arcadeMode"></span><span class="selection-player"><i></i>${tr('playerOne')}</span></div>
    <div class="select-heading"><span class="pixel-small" data-i18n="trustInstinct"></span><h2 id="select-title" data-i18n="chooseFighter"></h2><p data-i18n="fighterIntro"></p></div>
    <div class="selection-content"><div class="fighter-detail" id="fighter-detail"><div class="fighter-hero-art"><span class="hero-orbit" aria-hidden="true"></span><canvas class="fighter-preview hero-preview" id="selected-preview" data-preview="leo" width="260" height="260" aria-hidden="true"></canvas><span class="detail-kicker pixel-small" data-i18n="selectedFighter"></span></div><div class="fighter-biography"><div class="fighter-identity"><h3 id="selected-name"></h3><span id="selected-species"></span></div><span class="fighter-title" id="selected-title"></span><p id="selected-description"></p><div class="fighter-stats" id="fighter-stats"></div></div></div><div class="fighter-roster" role="group" aria-labelledby="select-title">${fighterCards}</div></div>
    <div class="selection-bottom"><div class="selection-moves"><span class="moves-heading pixel-small" id="fighter-detail-name"></span><div class="moves-row"><span><kbd>Q</kbd><strong id="special-one-name"></strong></span><span><kbd>E</kbd><strong id="special-two-name"></strong></span><span><kbd>R</kbd><strong id="super-name"></strong><i data-i18n="super"></i></span></div></div><button class="gold-button" id="confirm-fighter">${tr('nextStage')}${icon('arrow')}</button></div>
    <div class="screen-caption"><span data-i18n="fighterKeys"></span><span data-i18n="rosterSummary"></span></div>
  </section>
  <section class="view stage-view" id="stage-view" aria-labelledby="stage-title" hidden>
    <div class="select-header">${backButton('stage-back', 'backFighter')}<span class="pixel-small" data-i18n="arcadeMode"></span><span class="selection-player"><i></i>${tr('playerOne')}</span></div>
    <div class="select-heading"><span class="pixel-small" data-i18n="selectedStage"></span><h2 id="stage-title" data-i18n="chooseStage"></h2><p data-i18n="stageIntro"></p></div>
    <div class="stage-showcase"><img id="stage-preview" src="${assetUrl('arena.png')}" alt=""><div class="stage-showcase-shade"></div><div class="stage-showcase-copy"><span class="pixel-small" id="stage-preview-number"></span><h3 id="stage-preview-name"></h3><p id="stage-preview-description"></p></div></div>
    <div class="stage-roster" role="group" aria-labelledby="stage-title">${stageCards}</div>
    <div class="stage-confirm"><span id="stage-selected-fighter"></span><button class="gold-button" id="confirm-stage">${tr('fight')}${icon('arrow')}</button></div>
    <div class="screen-caption"><span data-i18n="stageKeys"></span><span id="stage-caption"></span></div>
  </section>
  <section class="view fight-view" id="fight-view" ${aria('arenaLabel')} hidden>
    <div class="fight-topbar"><div class="fight-wordmark">SHADOW <span>ZOO</span></div><span class="stage-label"><span id="fight-stage-name"></span><i id="fight-stage-number"></i></span></div>
    <div class="arena-zone" id="arena-zone"><div class="game-frame" id="game-frame"><div id="game-screen" tabindex="0" role="application" ${aria('arenaControls')}></div><div class="arena-scanlines" aria-hidden="true"></div></div></div>
    <div class="touch-controls" ${aria('touchControls')}><div class="touch-movement"><span class="touch-label" data-i18n="moveBlock"></span><div class="dpad"><button class="dpad-up" data-direction="up" ${aria('jump')}>↑</button><button class="dpad-left" data-direction="left" ${aria('left')}>←</button><button class="dpad-down" data-direction="down" ${aria('crouch')}>↓</button><button class="dpad-right" data-direction="right" ${aria('right')}>→</button></div></div><div class="touch-attacks"><div class="touch-attack-row"><span data-i18n="punchShort"></span><button data-attack="lp" ${aria('lp')}>${tr('lightShort')}</button><button data-attack="mp" ${aria('mp')}>${tr('mediumShort')}</button><button data-attack="hp" ${aria('hp')}>${tr('heavyShort')}</button></div><div class="touch-attack-row"><span data-i18n="kickShort"></span><button data-attack="lk" ${aria('lk')}>${tr('lightShort')}</button><button data-attack="mk" ${aria('mk')}>${tr('mediumShort')}</button><button data-attack="hk" ${aria('hk')}>${tr('heavyShort')}</button></div></div><div class="touch-specials"><span class="touch-label" data-i18n="special"></span><div><button data-attack="special1" ${aria('specialOne')}>Q</button><button data-attack="special2" ${aria('specialTwo')}>E</button></div><button class="touch-super" data-attack="super" ${aria('superLabel')}>${tr('super')}</button></div></div>
    <div class="fight-bottom"><span class="keyboard-hint"><kbd>W A S D</kbd>${tr('move')}<i>·</i><kbd>U I O</kbd>${tr('punch')}<i>·</i><kbd>J K L</kbd>${tr('kick')}<i>·</i><kbd>Q E</kbd>${tr('special')}<i>·</i><kbd>R</kbd>${tr('super')}</span><button id="fight-help">${tr('howToPlay')}${icon('question')}</button></div><span id="game-status" class="sr-only" aria-live="polite"></span>
  </section>
  <div id="ui-toast" class="ui-toast" role="status" hidden></div>
</main>
<dialog class="arcade-dialog pause-dialog" id="pause-dialog" aria-labelledby="pause-title"><div class="dialog-top"><span class="dialog-kicker pixel-small" data-i18n="takeBreather"></span>${languageSwitch()}</div><h2 id="pause-title" data-i18n="paused"></h2><p data-i18n="arenaWaits"></p><div class="dialog-menu"><button class="gold-button" id="resume-button">${tr('resume')}${icon('play')}</button><button class="outline-button" id="pause-restart">${tr('restartMatch')}${icon('restart')}</button><button class="outline-button" id="pause-fighter">${tr('changeFighter')}${icon('arrow')}</button><button class="outline-button" id="pause-settings">${tr('settings')}${icon('settings')}</button><button class="outline-button" id="pause-menu">${tr('mainMenu')}</button></div><div class="dialog-footnote" data-i18n="pauseKeys"></div></dialog>
<dialog class="arcade-dialog result-dialog" id="result-dialog" aria-labelledby="result-title"><div class="dialog-top"><span class="result-emblem" aria-hidden="true">✦</span>${languageSwitch()}</div><div class="dialog-kicker pixel-small" id="result-kicker"></div><h2 id="result-title"></h2><p id="result-message"></p><div class="result-score" id="result-score"></div><div class="dialog-menu"><button class="gold-button" id="rematch-button">${tr('rematch')}${icon('restart')}</button><button class="outline-button" id="result-fighter">${tr('changeFighter')}</button><button class="outline-button" id="result-menu">${tr('mainMenu')}</button></div></dialog>
<dialog class="arcade-dialog guide-dialog" id="guide-dialog" aria-labelledby="guide-title"><div class="dialog-top"><span class="pixel-small" data-i18n="playbook"></span><div class="dialog-tools">${languageSwitch()}<button class="close-button" id="guide-close" ${aria('closeGuide')}>×</button></div></div><h2 id="guide-title" data-i18n="howToPlay"></h2><p data-i18n="guideIntro"></p><div class="guide-columns"><section><h3 data-i18n="basics"></h3><div class="guide-controls"><span><kbd>A</kbd><kbd>D</kbd></span>${tr('moveGuide')}<span><kbd>W</kbd><kbd>S</kbd></span>${tr('jumpGuide')}<span><kbd>U</kbd><kbd>I</kbd><kbd>O</kbd></span>${tr('punchGuide')}<span><kbd>J</kbd><kbd>K</kbd><kbd>L</kbd></span>${tr('kickGuide')}</div><p data-i18n="blockGuide"></p></section><section><h3 data-i18n="primal"></h3><div class="guide-controls"><span><kbd>Q</kbd><kbd>E</kbd></span>${tr('specialGuide')}<span><kbd>R</kbd></span>${tr('superGuide')}</div><div class="motion-guide"><span data-i18n="motionOne"></span><span data-i18n="motionTwo"></span><span data-i18n="motionSuper"></span></div><p data-i18n="motionGuide"></p></section></div><section class="combo-guide"><h3 data-i18n="chain"></h3><div><kbd>U</kbd><span>→</span><kbd>I</kbd><span>→</span><kbd>Q</kbd><i data-i18n="or"></i><kbd>J</kbd><span>→</span><kbd>K</kbd><span>→</span><kbd>E</kbd></div><p data-i18n="comboGuide"></p></section><div class="guide-footer"><span><kbd>P</kbd> / <kbd>ESC</kbd>${tr('pause')}</span><button class="gold-button" id="guide-done">${tr('gotIt')}${icon('arrow')}</button></div></dialog>
<dialog class="arcade-dialog settings-dialog" id="settings-dialog" aria-labelledby="settings-title"><div class="dialog-top"><span class="pixel-small" data-i18n="makeYours"></span><button class="close-button" id="settings-close" ${aria('closeSettings')}>×</button></div><h2 id="settings-title" data-i18n="settings"></h2><div class="setting-row"><div><strong data-i18n="language"></strong><p data-i18n="languageHint"></p></div>${languageSwitch()}</div><div class="setting-row"><div><strong data-i18n="audio"></strong><p data-i18n="audioHint"></p></div><button id="settings-sound" class="setting-toggle" aria-pressed="true"></button></div><div class="setting-row"><div><strong data-i18n="fullscreen"></strong><p data-i18n="fullscreenHint"></p></div><button id="settings-fullscreen" class="outline-button">${tr('expand')}${icon('expand')}</button></div><p class="settings-hint" data-i18n="portraitHint"></p><button class="gold-button" id="settings-done">${tr('back')}${icon('arrow')}</button></dialog>
`;

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const appRoot = byId<HTMLElement>('arcade-app');
const gameScreen = byId<HTMLDivElement>('game-screen');
const gameFrame = byId<HTMLDivElement>('game-frame');
const arenaZone = byId<HTMLDivElement>('arena-zone');
const titleArt = byId<HTMLImageElement>('title-art');
const pauseDialog = byId<HTMLDialogElement>('pause-dialog');
const resultDialog = byId<HTMLDialogElement>('result-dialog');
const guideDialog = byId<HTMLDialogElement>('guide-dialog');
const settingsDialog = byId<HTMLDialogElement>('settings-dialog');
const soundButton = byId<HTMLButtonElement>('sound-button');
const pauseButton = byId<HTMLButtonElement>('pause-button');
const setText = (id: string, value: string) => { byId(id).textContent = value; };
type Route = 'title' | 'menu' | 'select' | 'stage' | 'fight';
let route: Route = 'title';
let selectedFighter: FighterId = 'leo';
let selectedStage: StageId = 'temple';
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
const allDialogs = [pauseDialog, resultDialog, guideDialog, settingsDialog];

function fallbackImage(image: HTMLImageElement): void { image.addEventListener('error', () => { if (!image.src.endsWith('/arena.png')) image.src = assetUrl('arena.png'); }); }
document.querySelectorAll<HTMLImageElement>('img').forEach(fallbackImage);
function resizeArena(): void {
  if (route !== 'fight' || !controller) return;
  const width = Math.floor(Math.min(arenaZone.clientWidth, arenaZone.clientHeight * 384 / 224));
  if (width <= 0) return;
  gameFrame.style.width = `${width}px`; gameFrame.style.height = `${Math.round(width * 224 / 384)}px`;
  controller.resize();
}
const resizeObserver = new ResizeObserver(resizeArena);
resizeObserver.observe(arenaZone);
function closeAllDialogs(): void { activeDialog = null; allDialogs.forEach(dialog => { if (dialog.open) dialog.close(); }); }
function updateBackdrop(): void { titleArt.src = assetUrl(route === 'stage' || route === 'fight' ? STAGES[selectedStage].asset : 'title.png'); }
function showRoute(next: Route): void {
  closeAllDialogs(); helperReturn = 'none'; route = next; appRoot.dataset.route = next;
  ['title', 'menu', 'select', 'stage', 'fight'].forEach(name => { byId(`${name}-view`).hidden = name !== next; });
  pauseButton.hidden = next !== 'fight';
  if (next !== 'fight') controller.returnToMenu();
  controller.setInputEnabled(next === 'fight'); updateBackdrop();
  requestAnimationFrame(() => {
    if (route !== next) return;
    if (next === 'fight') resizeArena();
    const focus = next === 'title' ? byId('title-start') : next === 'menu' ? byId('arcade-start') : next === 'select' ? document.querySelector<HTMLElement>(`[data-fighter="${selectedFighter}"]`) : next === 'stage' ? document.querySelector<HTMLElement>(`[data-stage="${selectedStage}"]`) : gameScreen;
    focus?.focus({ preventScroll: true });
  });
}
function beginFight(): void { showRoute('fight'); controller.start(selectedFighter, selectedStage); requestAnimationFrame(resizeArena); }
function restartMatch(): void { showRoute('fight'); controller.restart(); requestAnimationFrame(resizeArena); }
function fighterDetails(): void {
  const locale = getLocale(), fighter = FIGHTERS[selectedFighter];
  byId('fighter-detail').style.setProperty('--fighter-color', fighter.color);
  byId<HTMLCanvasElement>('selected-preview').dataset.preview = selectedFighter;
  setText('selected-name', fighter.name[locale]); setText('selected-species', fighter.species[locale]); setText('selected-title', fighter.title[locale]); setText('selected-description', fighter.description[locale]);
  setText('fighter-detail-name', t('signatureMoves', { name: fighter.name[locale] }));
  ['special-one-name', 'special-two-name', 'super-name'].forEach((id, index) => setText(id, fighter.moves[index][locale]));
  byId('fighter-stats').innerHTML = (['power', 'speed', 'range'] as const).map(stat => `<div class="fighter-stat" role="img" aria-label="${t('statValue', { stat: t(stat), value: fighter.stats[stat] })}"><span>${t(stat)}</span><div aria-hidden="true">${Array.from({ length: 5 }, (_, index) => `<i${index < fighter.stats[stat] ? ' class="filled"' : ''}></i>`).join('')}</div></div>`).join('');
}
function selectFighter(id: FighterId): void {
  selectedFighter = id;
  document.querySelectorAll<HTMLButtonElement>('[data-fighter]').forEach(button => { const selected = button.dataset.fighter === id; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected)); });
  fighterDetails(); stageDetails();
}
function stageDetails(): void {
  const locale = getLocale(), stage = STAGES[selectedStage], number = String(STAGE_IDS.indexOf(selectedStage) + 1).padStart(2, '0');
  setText('stage-preview-name', stage.name[locale]); setText('stage-preview-description', stage.description[locale]);
  setText('stage-preview-number', t('stageNumber', { number })); setText('fight-stage-number', t('stageNumber', { number }));
  setText('fight-stage-name', stage.name[locale]); setText('stage-caption', t('stageSummary', { name: stage.name[locale] }));
  setText('stage-selected-fighter', `${FIGHTERS[selectedFighter].name[locale]} · ${FIGHTERS[selectedFighter].species[locale]}`);
}
function selectStage(id: StageId): void {
  selectedStage = id; controller?.setStage(id);
  document.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach(button => { const selected = button.dataset.stage === id; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected)); });
  byId<HTMLImageElement>('stage-preview').src = assetUrl(STAGES[id].asset); stageDetails(); if (route === 'stage') updateBackdrop();
}
function showDialog(dialog: HTMLDialogElement): void {
  if (dialog.open) return;
  activeDialog = dialog; controller.setInputEnabled(false);
  if (route === 'fight' && latest && !latest.paused && ['fight', 'countdown', 'roundOver'].includes(latest.state.phase)) controller.pause();
  dialog.showModal();
}
function resumeFight(): void { closeAllDialogs(); if (latest?.paused) controller.pause(); controller.setInputEnabled(true); gameScreen.focus({ preventScroll: true }); }
function openHelper(dialog: HTMLDialogElement): void {
  helperOpener = document.activeElement as HTMLElement | null;
  helperReturn = route !== 'fight' ? 'none' : latest?.paused ? 'pause' : 'resume';
  closeAllDialogs(); showDialog(dialog);
}
function closeHelper(): void {
  const destination = helperReturn; closeAllDialogs();
  if (route === 'fight') { if (destination === 'pause') showDialog(pauseDialog); else resumeFight(); }
  else (helperOpener?.isConnected ? helperOpener : byId('arcade-start')).focus({ preventScroll: true });
}
function toggleSound(): void { controller.setMuted(!latest?.muted); controller.unlockAudio(); }
function toast(message: string): void { const element = byId<HTMLDivElement>('ui-toast'); element.textContent = message; element.hidden = false; window.clearTimeout(toastTimeout); toastTimeout = window.setTimeout(() => { element.hidden = true; }, 3300); }
async function fullscreen(): Promise<void> {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else toast(t('unavailableFullscreen')); }
  catch { toast(t('unavailableFullscreen')); }
}
function statusText(snapshot: GameSnapshot): string {
  const state = snapshot.state;
  return state.phase === 'select' ? t('ready') : snapshot.paused ? t('paused') : state.phase === 'matchOver' ? t('matchComplete') : t('roundStatus', { round: state.round, status: t(state.phase === 'fight' ? 'inProgress' : state.phase === 'countdown' ? 'getReady' : 'roundComplete') });
}
function updateUi(snapshot: GameSnapshot): void {
  latest = snapshot;
  const state = snapshot.state, key = `${getLocale()}:${state.phase}:${snapshot.paused}:${snapshot.muted}:${state.round}:${state.winner}:${state.wins.join('-')}`;
  if (lastUiKey !== key) {
    lastUiKey = key; setText('game-status', statusText(snapshot));
    soundButton.innerHTML = icon(snapshot.muted ? 'mute' : 'sound'); soundButton.dataset.i18nAria = snapshot.muted ? 'enableSound' : 'mute'; soundButton.setAttribute('aria-label', t(snapshot.muted ? 'enableSound' : 'mute')); soundButton.setAttribute('aria-pressed', String(snapshot.muted));
    setText('settings-sound', t(snapshot.muted ? 'off' : 'on')); byId('settings-sound').setAttribute('aria-pressed', String(!snapshot.muted));
    if (state.phase === 'matchOver') {
      const won = state.winner === 0, draw = state.winner === null;
      setText('result-kicker', t(draw ? 'evenlyMatched' : won ? 'king' : 'wildBites')); setText('result-title', t(draw ? 'draw' : won ? 'win' : 'defeated')); setText('result-message', t(draw ? 'drawMessage' : won ? 'winMessage' : 'loseMessage')); setText('result-score', `${state.wins[0]} : ${state.wins[1]}`); resultDialog.classList.toggle('player-lost', !won && !draw);
    }
  }
  if (route !== 'fight' || !controller) return;
  if (state.phase === 'matchOver' && !activeDialog) showDialog(resultDialog);
  else if (snapshot.paused && !activeDialog) showDialog(pauseDialog);
}
function translateUi(): void {
  const locale = getLocale();
  document.title = locale === 'th' ? 'Shadow Zoo — สังเวียนแห่งโลกสัตว์' : 'Shadow Zoo — Enter the wild.';
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n as TranslationKey); });
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach(element => { element.setAttribute('aria-label', t(element.dataset.i18nAria as TranslationKey)); });
  document.querySelectorAll<HTMLButtonElement>('[data-locale]').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.locale === locale)); });
  document.querySelectorAll<HTMLElement>('[data-fighter-name]').forEach(element => { element.textContent = FIGHTERS[element.dataset.fighterName as FighterId].name[locale]; });
  document.querySelectorAll<HTMLElement>('[data-fighter-species]').forEach(element => { element.textContent = FIGHTERS[element.dataset.fighterSpecies as FighterId].species[locale]; });
  document.querySelectorAll<HTMLElement>('[data-stage-name]').forEach(element => { element.textContent = STAGES[element.dataset.stageName as StageId].name[locale]; });
  fighterDetails(); stageDetails(); lastUiKey = '';
  if (controller) controller.setLocale(locale);
  if (latest) updateUi(latest);
}
translateUi();
controller = createGame(gameScreen, updateUi); controller.setInputEnabled(false); controller.setLocale(getLocale());
const unsubscribeLocale = onLocaleChange(translateUi);
document.querySelectorAll<HTMLButtonElement>('[data-locale]').forEach(button => { button.addEventListener('click', () => setLocale(button.dataset.locale as Locale)); });

byId('title-start').addEventListener('click', () => { controller.unlockAudio(); showRoute('menu'); });
byId('menu-back').addEventListener('click', () => showRoute('title')); byId('select-back').addEventListener('click', () => showRoute('menu')); byId('stage-back').addEventListener('click', () => showRoute('select'));
byId('arcade-start').addEventListener('click', () => showRoute('select')); byId('confirm-fighter').addEventListener('click', () => showRoute('stage')); byId('confirm-stage').addEventListener('click', beginFight);
document.querySelectorAll<HTMLButtonElement>('[data-fighter]').forEach(button => { button.addEventListener('click', () => selectFighter(button.dataset.fighter as FighterId)); });
document.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach(button => { button.addEventListener('click', () => selectStage(button.dataset.stage as StageId)); });
['menu-help', 'fight-help'].forEach(id => byId(id).addEventListener('click', () => openHelper(guideDialog)));
['menu-settings', 'pause-settings'].forEach(id => byId(id).addEventListener('click', () => openHelper(settingsDialog)));
['guide-close', 'guide-done', 'settings-close', 'settings-done'].forEach(id => byId(id).addEventListener('click', closeHelper));
['sound-button', 'settings-sound'].forEach(id => byId(id).addEventListener('click', toggleSound));
['fullscreen-button', 'settings-fullscreen'].forEach(id => byId(id).addEventListener('click', fullscreen));
byId('pause-button').addEventListener('click', () => showDialog(latest?.state.phase === 'matchOver' ? resultDialog : pauseDialog));
byId('resume-button').addEventListener('click', resumeFight);
['pause-restart', 'rematch-button'].forEach(id => byId(id).addEventListener('click', restartMatch));
['pause-fighter', 'result-fighter'].forEach(id => byId(id).addEventListener('click', () => showRoute('select')));
['pause-menu', 'result-menu'].forEach(id => byId(id).addEventListener('click', () => showRoute('menu')));
allDialogs.forEach(dialog => dialog.addEventListener('cancel', event => { event.preventDefault(); if (dialog === pauseDialog) resumeFight(); else if (dialog === resultDialog) showRoute('menu'); else closeHelper(); }));

window.addEventListener('keydown', event => {
  if (event.repeat) return;
  if (activeDialog) { event.stopImmediatePropagation(); if (event.code === 'KeyP' && activeDialog === pauseDialog) { event.preventDefault(); resumeFight(); } return; }
  if (route === 'fight') return;
  event.stopImmediatePropagation();
  const buttonTarget = (event.target as HTMLElement | null)?.closest('button');
  if (event.key === 'Escape') { event.preventDefault(); showRoute(route === 'stage' ? 'select' : route === 'select' ? 'menu' : 'title'); return; }
  if ((route === 'select' || route === 'stage') && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(event.code)) {
    event.preventDefault();
    const ids = route === 'select' ? FIGHTER_IDS : STAGE_IDS, current = route === 'select' ? selectedFighter : selectedStage;
    const columns = route === 'select' ? 3 : matchMedia('(max-width: 600px) and (orientation: portrait)').matches ? 2 : 4;
    const step = ['ArrowLeft', 'KeyA'].includes(event.code) ? -1 : ['ArrowRight', 'KeyD'].includes(event.code) ? 1 : ['ArrowUp', 'KeyW'].includes(event.code) ? -columns : columns;
    const index = ids.indexOf(current as never), next = ids[(index + step + ids.length) % ids.length];
    if (route === 'select') selectFighter(next as FighterId); else selectStage(next as StageId);
    document.querySelector<HTMLButtonElement>(`[data-${route === 'select' ? 'fighter' : 'stage'}="${next}"]`)?.focus({ preventScroll: true }); return;
  }
  if (route === 'menu' && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault(); const options = Array.from(document.querySelectorAll<HTMLButtonElement>('.main-menu button')), current = options.indexOf(document.activeElement as HTMLButtonElement);
    const next = current < 0 ? (event.key === 'ArrowDown' ? 0 : options.length - 1) : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
    options[next].focus({ preventScroll: true }); return;
  }
  if (event.key === 'Enter') {
    if (route === 'select' && (!buttonTarget || buttonTarget.hasAttribute('data-fighter'))) { event.preventDefault(); if (buttonTarget?.dataset.fighter) selectFighter(buttonTarget.dataset.fighter as FighterId); showRoute('stage'); }
    else if (route === 'stage' && (!buttonTarget || buttonTarget.hasAttribute('data-stage'))) { event.preventDefault(); if (buttonTarget?.dataset.stage) selectStage(buttonTarget.dataset.stage as StageId); beginFight(); }
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
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.imageSmoothingEnabled = false;
      const scale = canvas.classList.contains('hero-preview') ? 2.65 : 1.7;
      const fighter = { ...controller.getState().fighters[0], id: canvas.dataset.preview as FighterId, x: canvas.width / 2 / scale, y: FLOOR, action: 'idle' as const, facing: 1 as const, attack: null, animationFrame: previewFrame };
      ctx.save(); ctx.translate(0, canvas.height - FLOOR * scale - 12); ctx.scale(scale, scale); drawFighter(ctx, fighter, previewFrame); ctx.restore();
    });
  }
  previewHandle = requestAnimationFrame(animatePreviews);
}
previewHandle = requestAnimationFrame(animatePreviews);
document.addEventListener('fullscreenchange', () => { const key = document.fullscreenElement ? 'exitFullscreen' : 'fullscreen'; byId('fullscreen-button').dataset.i18nAria = key; byId('fullscreen-button').setAttribute('aria-label', t(key)); requestAnimationFrame(resizeArena); });
window.addEventListener('pagehide', event => {
  if (event.persisted) { if (route === 'fight' && latest && !latest.paused && ['fight', 'countdown', 'roundOver'].includes(latest.state.phase)) controller.pause(); return; }
  alive = false; cancelAnimationFrame(previewHandle); resizeObserver.disconnect(); unsubscribeLocale(); controller.destroy();
});
byId('title-start').focus({ preventScroll: true });
