import type { FighterId, Locale, StageId } from './types';

export type Localized = Record<Locale, string>;
export interface FighterDefinition {
  id: FighterId;
  name: Localized;
  species: Localized;
  title: Localized;
  style: Localized;
  description: Localized;
  moves: [Localized, Localized, Localized];
  color: string;
  speed: number;
  jump: number;
  stats: { power: number; speed: number; range: number };
}

export const FIGHTER_IDS: FighterId[] = ['leo', 'koba', 'raya', 'bao', 'nilo', 'ruk'];
export const FIGHTERS: Record<FighterId, FighterDefinition> = {
  leo: {
    id: 'leo', name: { th: 'ลีโอ', en: 'LEO' }, species: { th: 'สิงโต', en: 'Lion' },
    title: { th: 'กรงเล็บทอง', en: 'The Golden Claw' }, style: { th: 'สมดุลและแม่นยำ', en: 'Balanced & precise' },
    description: { th: 'นักสู้รอบด้าน ใช้กรงเล็บพุ่งเข้าประชิดและคำรามควบคุมระยะ', en: 'An all-round fighter with a rushing claw and a ranged roar.' },
    moves: [{ th: 'กรงเล็บพุ่ง', en: 'Claw Rush' }, { th: 'คำรามราชัน', en: 'Royal Roar' }, { th: 'พิโรธจ้าวป่า', en: 'Primal Fury' }],
    color: '#ffbd65', speed: 1.65, jump: -6.3, stats: { power: 3, speed: 4, range: 3 },
  },
  koba: {
    id: 'koba', name: { th: 'โคบา', en: 'KOBA' }, species: { th: 'กอริลลา', en: 'Gorilla' },
    title: { th: 'วานรเหล็ก', en: 'The Iron Ape' }, style: { th: 'หมัดหนักและกดดัน', en: 'Heavy pressure' },
    description: { th: 'หมัดหนัก ระยะโจมตีกว้าง ทุบพื้นส่งคลื่นเข้าหาคู่ต่อสู้', en: 'Heavy fists, long reach, and a ground-shattering wave.' },
    moves: [{ th: 'หมัดเหล็กพุ่ง', en: 'Iron Lunge' }, { th: 'ทุบแผ่นดิน', en: 'Ground Breaker' }, { th: 'ปฐพีสะเทือน', en: 'Earthquake' }],
    color: '#91b3e6', speed: 1.2, jump: -5.8, stats: { power: 5, speed: 2, range: 4 },
  },
  raya: {
    id: 'raya', name: { th: 'รายา', en: 'RAYA' }, species: { th: 'เสือ', en: 'Tiger' },
    title: { th: 'เงาพยัคฆ์', en: 'The Ember Fang' }, style: { th: 'รวดเร็วและต่อคอมโบ', en: 'Fast combo striker' },
    description: { th: 'พุ่งเร็ว ออกท่าไว เข้าประชิดด้วยเขี้ยวไฟแล้วต่อคอมโบ', en: 'Quick attacks and a fiery pounce make close-range combos her specialty.' },
    moves: [{ th: 'พยัคฆ์โผน', en: 'Tiger Pounce' }, { th: 'เขี้ยวเพลิง', en: 'Ember Fang' }, { th: 'ลายเสือคลั่ง', en: 'Blazing Stripes' }],
    color: '#ff985d', speed: 1.9, jump: -6.6, stats: { power: 3, speed: 5, range: 2 },
  },
  bao: {
    id: 'bao', name: { th: 'เป่า', en: 'BAO' }, species: { th: 'แพนด้า', en: 'Panda' },
    title: { th: 'ผู้พิทักษ์ไผ่', en: 'The Jade Guardian' }, style: { th: 'ฝ่ามือและคุมระยะ', en: 'Palm & wave specialist' },
    description: { th: 'ใช้ฝ่ามือหยกและคลื่นพลังไผ่ ควบคุมจังหวะการต่อสู้', en: 'Jade palms and bamboo energy waves control the pace of a match.' },
    moves: [{ th: 'ฝ่ามือหยก', en: 'Jade Palm' }, { th: 'คลื่นไผ่', en: 'Bamboo Wave' }, { th: 'พายุหยก', en: 'Jade Cyclone' }],
    color: '#82dfbd', speed: 1.4, jump: -6.0, stats: { power: 3, speed: 3, range: 4 },
  },
  nilo: {
    id: 'nilo', name: { th: 'ไนโล', en: 'NILO' }, species: { th: 'จระเข้', en: 'Crocodile' },
    title: { th: 'เขี้ยวเจ้าสายน้ำ', en: 'The River Reaper' }, style: { th: 'ระยะไกลและท่าต่ำ', en: 'Long reach & low waves' },
    description: { th: 'เขี้ยวและหางยาวโจมตีจากระยะไกล คลื่นน้ำบังคับให้คู่ต่อสู้กระโดด', en: 'Long-reaching strikes and low river waves keep opponents on their toes.' },
    moves: [{ th: 'เขี้ยวแม่น้ำ', en: 'River Snap' }, { th: 'คลื่นบึง', en: 'Marsh Wave' }, { th: 'พายุหางจระเข้', en: 'Death Roll' }],
    color: '#9eca73', speed: 1.3, jump: -5.9, stats: { power: 4, speed: 2, range: 5 },
  },
  ruk: {
    id: 'ruk', name: { th: 'รัค', en: 'RUK' }, species: { th: 'แรด', en: 'Rhino' },
    title: { th: 'นอสายฟ้า', en: 'The Thunder Horn' }, style: { th: 'พลังหนักและพุ่งชน', en: 'Powerful rushdown' },
    description: { th: 'เคลื่อนที่ช้าแต่โจมตีหนัก ใช้นอพุ่งชนและคลื่นกระแทกเปิดทาง', en: 'Slow, powerful strikes backed by a horn charge and seismic shockwaves.' },
    moves: [{ th: 'นอทะลวง', en: 'Horn Charge' }, { th: 'คลื่นกระแทก', en: 'Seismic Stomp' }, { th: 'สายฟ้าถล่ม', en: 'Thunder Stampede' }],
    color: '#c6a3ec', speed: 1.05, jump: -5.5, stats: { power: 5, speed: 1, range: 4 },
  },
};

export interface StageDefinition {
  id: StageId;
  name: Localized;
  description: Localized;
  asset: string;
  color: string;
}
export const STAGE_IDS: StageId[] = ['temple', 'bamboo', 'savanna', 'mangrove'];
export const STAGES: Record<StageId, StageDefinition> = {
  temple: { id: 'temple', name: { th: 'วิหารยามสนธยา', en: 'Nightfall Sanctuary' }, description: { th: 'ลานหิน โคมไฟ และวิหารกลางสวนสัตว์', en: 'Lanterns glow over the stone courtyard of an ancient sanctuary.' }, asset: 'arena.png', color: '#ffc56c' },
  bamboo: { id: 'bamboo', name: { th: 'ป่าไผ่ใต้แสงจันทร์', en: 'Moonlit Bamboo' }, description: { th: 'ป่าไผ่สีหยกใต้แสงจันทร์และหิ่งห้อย', en: 'A jade bamboo grove under moonlight and drifting fireflies.' }, asset: 'stage-bamboo.png', color: '#87dfce' },
  savanna: { id: 'savanna', name: { th: 'ทุ่งสะวันนาสีทอง', en: 'Savanna Sunset' }, description: { th: 'ลานหินกลางทุ่งกว้างยามพระอาทิตย์ตก', en: 'A sunlit fighting terrace overlooking the golden savanna.' }, asset: 'stage-savanna.png', color: '#ffad70' },
  mangrove: { id: 'mangrove', name: { th: 'ซากวิหารป่าชายเลน', en: 'Mangrove Ruins' }, description: { th: 'สะพานหินเหนือสายน้ำ ล้อมด้วยรากไม้และซากวิหาร', en: 'Ancient stone ruins rise over a misty mangrove river.' }, asset: 'stage-mangrove.png', color: '#8bc6df' },
};
