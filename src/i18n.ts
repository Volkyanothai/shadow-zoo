import type { Locale } from './types';

const english = {
  original: 'AN ORIGINAL ARCADE FIGHTER', champion: 'THE WILD HAS A NEW CHAMPION', start: 'START GAME', pressEnter: 'PRESS ENTER TO BEGIN',
  titleFeatures: '1 PLAYER · 6 FIGHTERS · 4 ARENAS', titleTagline: 'Choose your fighter. Unleash your instinct. Own the arena.',
  back: 'BACK', backTitle: 'Back to title', backMenu: 'Back to main menu', backFighter: 'Back to fighter selection',
  mainMenu: 'MAIN MENU', gameMenu: 'Game menu', arcade: 'ARCADE', arcadeHint: 'Battle the CPU · win two rounds', howToPlay: 'HOW TO PLAY', howHint: 'Controls, special moves and combos',
  settings: 'SETTINGS', settingsHint: 'Language, sound and display', instinct: 'YOUR ARENA. YOUR INSTINCT.', localArcade: 'LOCAL ARCADE', menuKeys: 'ENTER · SELECT   ESC · BACK',
  arcadeMode: 'ARCADE MODE', playerOne: 'PLAYER 1', trustInstinct: 'TRUST YOUR INSTINCT', chooseFighter: 'CHOOSE YOUR FIGHTER', fighterIntro: 'Six fighters. Six instincts. Find your champion.',
  selectedFighter: 'SELECTED FIGHTER', power: 'POWER', speed: 'SPEED', range: 'REACH', statValue: '{stat}: {value} of 5', signatureMoves: '{name}’S SIGNATURE MOVES',
  super: 'SUPER', nextStage: 'CHOOSE ARENA', fighterKeys: 'ARROWS · CHOOSE   ENTER · NEXT', rosterSummary: '6 FIGHTERS · VS CPU',
  chooseStage: 'CHOOSE YOUR ARENA', stageIntro: 'Four worlds. One champion.', selectedStage: 'SELECTED ARENA', fight: 'FIGHT!', stageKeys: 'ARROWS · CHOOSE   ENTER · FIGHT', stageSummary: '{name} · VS CPU',
  arenaLabel: 'Shadow Zoo fighting arena', arenaControls: 'Fighting arena. WASD or arrow keys to move. U I O punch. J K L kick. Q and E special moves. R super. P pause.',
  stageNumber: 'ARENA {number}', touchControls: 'Touch game controls', moveBlock: 'MOVE / BLOCK', move: 'MOVE', punch: 'PUNCH', kick: 'KICK', special: 'SPECIAL',
  jump: 'Jump', crouch: 'Crouch', left: 'Move left or block', right: 'Move right or block', lp: 'Light punch', mp: 'Medium punch', hp: 'Heavy punch', lk: 'Light kick', mk: 'Medium kick', hk: 'Heavy kick',
  specialOne: 'Special move one', specialTwo: 'Special move two', superLabel: 'Super move. Requires full meter', lightShort: 'L', mediumShort: 'M', heavyShort: 'H', punchShort: 'P', kickShort: 'K',
  mute: 'Mute sound', enableSound: 'Enable sound', sound: 'Sound', fullscreen: 'Full screen', exitFullscreen: 'Exit full screen', pauseLabel: 'Pause game', pauseTip: 'Pause (P)',
  takeBreather: 'TAKE A BREATHER', paused: 'PAUSED', arenaWaits: 'The arena is waiting for you.', resume: 'RESUME', restartMatch: 'RESTART MATCH', changeFighter: 'CHANGE FIGHTER', pauseKeys: 'PRESS P OR ESC TO RESUME',
  king: 'KING OF THE ZOO', wildBites: 'THE WILD BITES BACK', evenlyMatched: 'EVENLY MATCHED', win: 'YOU WIN!', defeated: 'DEFEATED', draw: 'DRAW!',
  winMessage: 'The arena belongs to you.', loseMessage: 'Shake it off. Your next match awaits.', drawMessage: 'One more match will settle it.', rematch: 'REMATCH',
  playbook: 'THE FIGHTER’S PLAYBOOK', closeGuide: 'Close guide', guideIntro: 'Win two rounds to take the match · 60 seconds per round', basics: '01 / THE BASICS',
  moveGuide: 'Move / hold back to block', jumpGuide: 'Jump / crouch', punchGuide: 'Light / medium / heavy punch', kickGuide: 'Light / medium / heavy kick',
  blockGuide: 'Hold back to block. Crouch and hold back to block low attacks. Arrow keys also work.', primal: '02 / GO PRIMAL', specialGuide: 'Special moves', superGuide: 'Super · full meter required',
  motionOne: '↓ ↘ → + P = special 1', motionTwo: '↓ ↙ ← + P = special 2', motionSuper: '↓ ↘ → ↓ ↘ → + P = super', motionGuide: 'Directions follow the way your fighter faces. Build your meter during battle.',
  chain: '03 / CHAIN THE HITS', or: 'OR', comboGuide: 'Get close, land a light attack, then press the next move after the hit connects to cancel into a combo.', pause: 'PAUSE', gotIt: 'GOT IT',
  makeYours: 'MAKE IT YOURS', closeSettings: 'Close settings', language: 'LANGUAGE', languageHint: 'Change instantly. Your match continues.', languageChoice: 'Interface language',
  audio: 'ARCADE AUDIO', audioHint: 'Music and sound effects', on: 'ON', off: 'OFF', fullscreenHint: 'Use the whole screen', expand: 'EXPAND', portraitHint: 'On mobile, rotate to landscape for a larger arena.',
  unavailableFullscreen: 'Full screen is unavailable in this browser.', ready: 'READY', matchComplete: 'MATCH COMPLETE', roundStatus: 'ROUND {round} · {status}', inProgress: 'FIGHT IN PROGRESS', getReady: 'GET READY', roundComplete: 'ROUND COMPLETE',
} as const;

export type TranslationKey = keyof typeof english;
const thai: Record<TranslationKey, string> = {
  original: 'เกมต่อสู้สัตว์สไตล์อาร์เคด', champion: 'ราชันคนใหม่แห่งโลกสัตว์', start: 'เข้าเกม', pressEnter: 'กด ENTER เพื่อเริ่ม',
  titleFeatures: 'ผู้เล่น 1 คน · นักสู้ 6 ตัว · 4 สังเวียน', titleTagline: 'เลือกนักสู้ ปลดปล่อยสัญชาตญาณ ครองสังเวียน',
  back: 'กลับ', backTitle: 'กลับหน้าเข้าเกม', backMenu: 'กลับเมนูหลัก', backFighter: 'กลับไปเลือกนักสู้',
  mainMenu: 'เมนูหลัก', gameMenu: 'เมนูเกม', arcade: 'อาร์เคด', arcadeHint: 'สู้กับ CPU · ชนะให้ได้สองยก', howToPlay: 'วิธีเล่น', howHint: 'การควบคุม ท่าพิเศษ และคอมโบ',
  settings: 'ตั้งค่า', settingsHint: 'ภาษา เสียง และการแสดงผล', instinct: 'สังเวียนของคุณ สัญชาตญาณของคุณ', localArcade: 'อาร์เคดผู้เล่นคนเดียว', menuKeys: 'ENTER · เลือก   ESC · กลับ',
  arcadeMode: 'โหมดอาร์เคด', playerOne: 'ผู้เล่น 1', trustInstinct: 'เชื่อในสัญชาตญาณ', chooseFighter: 'เลือกนักสู้ของคุณ', fighterIntro: 'หกนักสู้ หกสไตล์ ใครจะเป็นราชาแห่งสวนสัตว์?',
  selectedFighter: 'นักสู้ที่เลือก', power: 'พลัง', speed: 'ความเร็ว', range: 'ระยะโจมตี', statValue: '{stat}: {value} จาก 5', signatureMoves: 'ท่าประจำตัวของ{name}',
  super: 'ไม้ตาย', nextStage: 'เลือกสังเวียน', fighterKeys: 'ลูกศร · เลือก   ENTER · ต่อไป', rosterSummary: 'นักสู้ 6 ตัว · สู้กับ CPU',
  chooseStage: 'เลือกสังเวียนของคุณ', stageIntro: 'สี่ดินแดน ราชันเพียงหนึ่งเดียว', selectedStage: 'สังเวียนที่เลือก', fight: 'เริ่มต่อสู้!', stageKeys: 'ลูกศร · เลือก   ENTER · ต่อสู้', stageSummary: '{name} · สู้กับ CPU',
  arenaLabel: 'สังเวียนต่อสู้ Shadow Zoo', arenaControls: 'สังเวียนต่อสู้ ใช้ WASD หรือปุ่มลูกศรเคลื่อนที่ U I O ต่อย J K L เตะ Q และ E ท่าพิเศษ R ไม้ตาย P พักเกม',
  stageNumber: 'สังเวียน {number}', touchControls: 'ปุ่มควบคุมเกมด้วยการสัมผัส', moveBlock: 'เคลื่อนที่ / ป้องกัน', move: 'เคลื่อนที่', punch: 'ต่อย', kick: 'เตะ', special: 'ท่าพิเศษ',
  jump: 'กระโดด', crouch: 'ย่อ', left: 'เดินซ้ายหรือป้องกัน', right: 'เดินขวาหรือป้องกัน', lp: 'ต่อยเบา', mp: 'ต่อยกลาง', hp: 'ต่อยหนัก', lk: 'เตะเบา', mk: 'เตะกลาง', hk: 'เตะหนัก',
  specialOne: 'ท่าพิเศษหนึ่ง', specialTwo: 'ท่าพิเศษสอง', superLabel: 'ท่าไม้ตาย ต้องมีเกจเต็ม', lightShort: 'เบา', mediumShort: 'กลาง', heavyShort: 'หนัก', punchShort: 'ต่อย', kickShort: 'เตะ',
  mute: 'ปิดเสียง', enableSound: 'เปิดเสียง', sound: 'เสียง', fullscreen: 'เต็มหน้าจอ', exitFullscreen: 'ออกจากเต็มหน้าจอ', pauseLabel: 'พักเกม', pauseTip: 'พักเกม (P)',
  takeBreather: 'พักหายใจสักครู่', paused: 'พักเกม', arenaWaits: 'สังเวียนรอคุณอยู่', resume: 'เล่นต่อ', restartMatch: 'เริ่มแมตช์ใหม่', changeFighter: 'เปลี่ยนนักสู้', pauseKeys: 'กด P หรือ ESC เพื่อเล่นต่อ',
  king: 'ราชาแห่งสวนสัตว์', wildBites: 'ศึกนี้ยังไม่จบ', evenlyMatched: 'สูสีไม่มีใครยอมใคร', win: 'คุณชนะ!', defeated: 'พ่ายแพ้', draw: 'เสมอ!',
  winMessage: 'สังเวียนนี้เป็นของคุณ', loseMessage: 'ตั้งหลักใหม่ แล้วกลับมาสู้กันอีกครั้ง', drawMessage: 'อีกแมตช์จะตัดสินผู้ชนะ', rematch: 'สู้ใหม่อีกครั้ง',
  playbook: 'คู่มือนักสู้', closeGuide: 'ปิดคู่มือ', guideIntro: 'ชนะสองยกเพื่อชนะทั้งแมตช์ · ยกละ 60 วินาที', basics: '01 / พื้นฐาน',
  moveGuide: 'เคลื่อนที่ / ถอยหลังเพื่อป้องกัน', jumpGuide: 'กระโดด / ย่อ', punchGuide: 'ต่อยเบา / กลาง / หนัก', kickGuide: 'เตะเบา / กลาง / หนัก',
  blockGuide: 'ถอยหลังเพื่อป้องกัน ย่อและถอยเพื่อป้องกันท่าต่ำ ปุ่มลูกศรใช้แทน WASD ได้', primal: '02 / ปลดปล่อยพลัง', specialGuide: 'ท่าพิเศษ', superGuide: 'ท่าไม้ตาย · ต้องมีเกจเต็ม',
  motionOne: '↓ ↘ → + ต่อย = ท่าพิเศษ 1', motionTwo: '↓ ↙ ← + ต่อย = ท่าพิเศษ 2', motionSuper: '↓ ↘ → ↓ ↘ → + ต่อย = ไม้ตาย', motionGuide: 'ทิศทางอ้างอิงการหันหน้าของนักสู้ เกจสะสมระหว่างต่อสู้',
  chain: '03 / ต่อคอมโบ', or: 'หรือ', comboGuide: 'เข้าระยะประชิด เริ่มด้วยท่าเบา แล้วกดท่าถัดไปหลังท่าก่อนหน้าโจมตีโดน เพื่อยกเลิกเข้าสู่คอมโบ', pause: 'พักเกม', gotIt: 'เข้าใจแล้ว',
  makeYours: 'ปรับให้เข้ากับคุณ', closeSettings: 'ปิดการตั้งค่า', language: 'ภาษา', languageHint: 'เปลี่ยนได้ทันทีโดยไม่เริ่มแมตช์ใหม่', languageChoice: 'ภาษาของเกม',
  audio: 'เสียงอาร์เคด', audioHint: 'เพลงและเสียงเอฟเฟกต์', on: 'เปิด', off: 'ปิด', fullscreenHint: 'ใช้พื้นที่หน้าจอทั้งหมด', expand: 'ขยาย', portraitHint: 'บนมือถือ หมุนจอแนวนอนเพื่อให้สนามใหญ่ขึ้น',
  unavailableFullscreen: 'เบราว์เซอร์นี้ไม่รองรับการแสดงผลเต็มหน้าจอ', ready: 'พร้อม', matchComplete: 'จบแมตช์', roundStatus: 'ยกที่ {round} · {status}', inProgress: 'กำลังต่อสู้', getReady: 'เตรียมพร้อม', roundComplete: 'จบยก',
};

const storageKey = 'shadow-zoo-locale';
let locale: Locale = 'th';
try { const saved = globalThis.localStorage?.getItem(storageKey); if (saved === 'th' || saved === 'en') locale = saved; } catch { /* Storage can be unavailable in private browser contexts. */ }
const listeners = new Set<(locale: Locale) => void>();
function applyDocumentLocale(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.documentElement.dataset.locale = locale;
}
applyDocumentLocale();
export function getLocale(): Locale { return locale; }
export function setLocale(next: Locale): void {
  if (next !== 'th' && next !== 'en') return;
  try { globalThis.localStorage?.setItem(storageKey, next); } catch { /* Keep switching languages even without persistence. */ }
  if (next === locale) { applyDocumentLocale(); return; }
  locale = next;
  applyDocumentLocale();
  listeners.forEach(listener => listener(locale));
}
export function onLocaleChange(listener: (locale: Locale) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function t(key: TranslationKey, params: Record<string, string | number> = {}): string {
  const template: string = (locale === 'th' ? thai : english)[key];
  return template.replace(/\{(\w+)\}/g, (token, name: string) => Object.hasOwn(params, name) ? String(params[name]) : token);
}
