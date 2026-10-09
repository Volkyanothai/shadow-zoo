import { FLOOR, type Fighter, type FighterId, type GameState, type StageId } from './types';
import { ATTACKS } from './combat';
import { FIGHTERS } from './catalog';

// Everything is painted on the game's native 384 × 224 pixel grid.
// Scanline primitives keep edges crisp even for articulated sprite pieces.
type Point = [number, number];
const ink = '#141425';
const round = Math.round;
let arenaImage: HTMLImageElement | null = null;
export function setArenaImage(image: HTMLImageElement | null): void { arenaImage = image; }
function rect(c: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number): void {
  c.fillStyle = color; c.fillRect(round(x), round(y), round(w), round(h));
}
function poly(c: CanvasRenderingContext2D, color: string, points: Point[]): void {
  c.fillStyle = color;
  const min = Math.ceil(Math.min(...points.map(p => p[1]))), max = Math.floor(Math.max(...points.map(p => p[1])));
  for (let y = min; y <= max; y++) {
    const hits: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) hits.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
    }
    hits.sort((a, b) => a - b);
    for (let i = 0; i + 1 < hits.length; i += 2) c.fillRect(round(hits[i]), y, Math.max(1, round(hits[i + 1]) - round(hits[i])), 1);
  }
}
function oval(c: CanvasRenderingContext2D, color: string, x: number, y: number, rx: number, ry: number): void {
  c.fillStyle = color;
  for (let yy = -round(ry); yy <= round(ry); yy++) {
    const xx = Math.floor(rx * Math.sqrt(Math.max(0, 1 - yy * yy / (ry * ry))));
    c.fillRect(round(x - xx), round(y + yy), xx * 2 + 1, 1);
  }
}
function hash(x: number, y: number): number { return ((Math.imul(x + 23, 17389) ^ Math.imul(y + 87, 9311)) >>> 0) % 997; }
function beam(c: CanvasRenderingContext2D, color: string, a: Point, b: Point, width: number): void {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy) || 1;
  const px = -dy / len * width / 2, py = dx / len * width / 2;
  poly(c, color, [[a[0] + px, a[1] + py], [b[0] + px, b[1] + py], [b[0] - px, b[1] - py], [a[0] - px, a[1] - py]]);
  oval(c, color, a[0], a[1], width / 2, width / 2); oval(c, color, b[0], b[1], width / 2, width / 2);
}

function roof(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  // A stepped sweep of glazed tiles and raised, gold-capped eaves.
  poly(c, '#111f31', [[x-8,y+h],[x+1,y+h-6],[x+16,y+h-13],[x+29,y+8],[x+w/2,y-1],[x+w-29,y+8],[x+w-16,y+h-13],[x+w-1,y+h-6],[x+w+8,y+h]]);
  for (let row = 0; row < 8; row++) {
    const yy = y + 7 + row * 4, inset = Math.max(0, 26 - row * 4);
    rect(c, row % 2 ? '#214d53' : '#285c5d', x+inset, yy, w-inset*2, 4);
    for (let tx = x+inset; tx < x+w-inset; tx += 6) {
      rect(c, '#438575', tx, yy, 2, 2); rect(c, '#102b3c', tx+3, yy+2, 2, 2);
      rect(c, '#72a080', tx+1, yy, 1, 1);
    }
  }
  poly(c, '#367a6c', [[x-8,y+h-3],[x+12,y+h-6],[x+w-12,y+h-6],[x+w+8,y+h-3],[x+w+4,y+h],[x-4,y+h]]);
  rect(c,'#a4b885',x-3,y+h-2,w+6,1); rect(c,'#172632',x-4,y+h+1,w+8,3);
  rect(c,'#baa269',x+26,y+5,w-52,2); rect(c,'#ddc584',x+30,y+3,w-60,1);
  for (const edge of [x-8,x+w+6]) { rect(c,'#9ca46c',edge,y+h-6,2,6); rect(c,'#debd70',edge,y+h-9,2,3); }
}
function lantern(c: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
  const glow = Math.sin(frame / 37 + x) > 0 ? '#ffd279' : '#f2b963';
  rect(c,'#15222f',x-1,y-11,2,10); rect(c,'#251e28',x-5,y-2,10,2);
  rect(c,'#8d4242',x-5,y,10,12); rect(c,'#d27748',x-4,y+1,8,10);
  rect(c,glow,x-2,y+1,4,10); rect(c,'#ffde9e',x,y+2,1,8);
  rect(c,'#301f2d',x-5,y+12,10,2); rect(c,'#d89b53',x-1,y+14,2,4);
}
function bamboo(c: CanvasRenderingContext2D, x: number, y: number, h: number, frame: number, dark: boolean): void {
  const sway = round(Math.sin(frame / 70 + x) * 1.2), stem = dark ? '#142f3d' : '#2e6550';
  rect(c,stem,x,y-h,3,h); rect(c,dark?'#285345':'#70a265',x,y-h,1,h);
  for (let yy=y-h+7; yy<y; yy+=12) {
    rect(c,'#141f2c',x-1,yy,5,1);
    for (const d of [-1,1]) {
      const xx=x+d*7+sway;
      poly(c,dark?'#204339':'#38785b',[[x+1,yy-2],[xx,yy-9],[xx+d*10,yy-11],[xx+d*4,yy-5]]);
      poly(c,dark?'#285347':'#5b9566',[[x+1,yy-2],[xx,yy-4],[xx+d*13,yy-3],[xx+d*3,yy+1]]);
    }
  }
}

export function drawArena(c: CanvasRenderingContext2D, frame: number, stageId: StageId = 'temple'): void {
  c.imageSmoothingEnabled = false;
  if (arenaImage) {
    c.drawImage(arenaImage,0,0,384,224);
    drawAtmosphere(c, frame, stageId);
    return;
  }
  rect(c,'#24283f',0,0,384,224);
  const sky = ['#25273e','#34334a','#4c4258','#675065','#8a6470','#b17c76'];
  sky.forEach((v,i)=>rect(c,v,0,i*13,384,14));
  oval(c,'#e9c394',307,42,14,14); oval(c,'#f8d6a4',305,40,10,10);
  for(let i=0;i<31;i++) { const x=hash(i,4)%384,y=hash(i,9)%46; rect(c,i%3?'#978591':'#d5b59d',x,y,1,1); }
  for (let i=0;i<5;i++) {
    const x=i*92-30,y=39+(i%2)*8;
    poly(c,'#786073',[[x,y],[x+23,y-2],[x+37,y-7],[x+52,y-6],[x+61,y-2],[x+91,y],[x+89,y+3],[x+7,y+3]]);
    rect(c,'#93717d',x+19,y+3,61,1);
  }
  poly(c,'#604d64',[[0,72],[19,57],[31,58],[65,36],[91,48],[117,71],[156,54],[184,62],[221,45],[242,58],[278,68],[308,52],[344,58],[384,43],[384,107],[0,107]]);
  poly(c,'#3a4055',[[0,84],[22,76],[42,83],[78,65],[100,78],[115,71],[153,88],[184,69],[217,83],[242,77],[284,86],[319,74],[347,80],[384,68],[384,116],[0,116]]);
  // Distant zoo enclosures and treetops.
  for(let x=-9;x<392;x+=13) {
    const top=79+hash(x,11)%18;
    oval(c,'#293c49',x,top,11,15); oval(c,'#334b4c',x-3,top-3,7,9);
    rect(c,'#203340',x,top+4,3,37);
  }
  rect(c,'#192c3a',0,113,384,66); rect(c,'#687f70',0,120,384,58);
  rect(c,'#789783',0,122,384,3); rect(c,'#304b4b',0,127,384,2);
  for(let x=0;x<384;x+=12) {
    rect(c,'#587765',x,133,11,36); rect(c,'#8fa084',x+1,133,1,31);
    rect(c,'#315553',x+3,137,6,27); rect(c,'#1e3d43',x+4,138,4,24);
    rect(c,'#bbad79',x+3,132,6,2); rect(c,'#718872',x+3,167,6,1);
  }
  // A central pavilion, with its own original zoo crest.
  rect(c,'#142634',104,103,177,76); rect(c,'#59453d',108,111,169,66);
  rect(c,'#ba8559',113,118,158,62); rect(c,'#805239',119,124,146,53);
  for (const x of [111,132,253,273]) { rect(c,'#312c32',x-2,113,7,68); rect(c,'#a87b55',x,113,4,68); rect(c,'#d0a073',x,114,1,64); }
  rect(c,'#ddac72',112,117,165,4); rect(c,'#312a30',115,121,159,3);
  rect(c,'#263e40',137,125,112,54); rect(c,'#c28c55',142,127,102,52);
  rect(c,'#e1ae6e',143,128,1,49); rect(c,'#925b3d',190,126,4,53);
  for(let y=133;y<176;y+=11) for(let x=149;x<242;x+=13) {
    rect(c,'#5c5144',x,y,3,3); rect(c,'#f0ca85',x,y,2,1); rect(c,'#b9a87a',x,y+1,1,1);
  }
  rect(c,'#694534',188,146,8,12); rect(c,'#e0c78a',189,147,2,5); rect(c,'#e0c78a',193,147,2,5);
  roof(c,95,72,194,35);
  rect(c,'#6d4039',149,111,86,11); rect(c,'#d3a267',150,112,84,1);
  c.fillStyle='#f2cc84'; c.font='bold 7px monospace'; c.textAlign='center'; c.fillText('SHADOW ZOO',192,119);
  // Smaller side roofs add a second architectural layer.
  roof(c,-25,89,133,25); roof(c,282,90,131,25);
  for(const x of [19,57,330,368]) { rect(c,'#243536',x,119,5,58); rect(c,'#66816a',x+1,119,2,56); }
  // Golden aviary in the far right, tucked behind the main wall.
  poly(c,'#172d3c',[[350,87],[358,65],[370,50],[377,34],[384,25],[384,112],[349,112]]);
  for(let y=49;y<99;y+=15) {
    poly(c,'#a36f42',[[351,y+11],[368,y+4],[378,y-6],[384,y-14],[384,y+4],[364,y+15]]);
    poly(c,'#efbb62',[[352,y+10],[369,y+3],[379,y-7],[384,y-14],[383,y-8],[372,y+7]]);
    rect(c,'#334b40',376,y+7,3,7);
  }
  lantern(c,77,129,frame); lantern(c,308,129,frame);
  // Stone animal guardian pedestals.
  for(const x of [87,298]) {
    rect(c,'#233b43',x-11,166,23,12); rect(c,'#7f9683',x-12,164,25,3); rect(c,'#bdd0a3',x-10,164,21,1);
    rect(c,'#405d5a',x-7,146,14,18); rect(c,'#759084',x-5,145,11,16);
    oval(c,'#55766d',x+1,143,8,7); rect(c,'#9bb29a',x-4,139,7,4);
    rect(c,'#263f44',x+4,141,2,2); rect(c,'#b4c8a1',x-7,145,4,3);
    rect(c,'#45675e',x-7,158,16,5); rect(c,'#8aa88c',x-8,159,14,2);
  }
  rect(c,'#222f36',0,176,384,4); rect(c,'#b2aa85',0,178,384,3);
  drawFloor(c);
  bamboo(c,3,185,91,frame,true); bamboo(c,15,183,72,frame,false);
  bamboo(c,375,185,90,frame,true); bamboo(c,385,185,70,frame,false);
  for(const x of [34,347]) {
    poly(c,'#1c4141',[[x-14,183],[x-11,173],[x-3,177],[x-4,165],[x+3,175],[x+8,169],[x+10,181],[x+18,177],[x+18,187],[x-14,187]]);
    rect(c,'#52815b',x-5,176,2,5); rect(c,'#749464',x+5,177,2,4);
  }
}
function drawAtmosphere(c: CanvasRenderingContext2D, frame: number, stage: StageId): void {
  c.save();
  if (stage === 'savanna') {
    // Warm motes hang well above the fighting plane.
    c.globalAlpha = .35;
    for (let i = 0; i < 9; i++) {
      const x = (i * 47 + frame * .13) % 384, y = 90 + (i * 17) % 57 + Math.sin(frame / 70 + i) * 3;
      rect(c, i % 2 ? '#ffd999' : '#eebc6b', x, y, 1, 1);
    }
  } else if (stage === 'mangrove') {
    // Broken silver reflections shimmer on the distant water, not beneath the feet.
    c.globalAlpha = .22;
    for (let i = 0; i < 7; i++) {
      const x = 29 + i * 49 + Math.sin(frame / 97 + i) * 5;
      rect(c, '#bfe9ee', x, 137 + (i % 3) * 6, 4 + (i % 2) * 3, 1);
    }
    for (let i = 0; i < 4; i++) {
      const x = (i * 109 + frame * .21) % 394 - 5, y = 73 + (frame * .16 + i * 37) % 77;
      poly(c, '#88b5a1', [[x,y],[x+3,y+1],[x+1,y+3],[x-1,y+2]]);
    }
  } else {
    for (let i = 0; i < 7; i++) {
      const x = round(24 + i * 53 + Math.sin(frame / 95 + i * 2) * 7), y = round(119 + Math.sin(frame / 76 + i) * 20);
      c.globalAlpha = (Math.sin(frame / 31 + i * 3) + 1) * .2;
      rect(c, stage === 'bamboo' ? '#b8ffe0' : '#ffdb82', x, y, 1, 1);
    }
    if (stage === 'bamboo') {
      c.globalAlpha = .3;
      for (let i = 0; i < 3; i++) {
        const x = (frame * .3 + i * 151) % 395 - 5, y = 53 + (frame * .16 + i * 23) % 78;
        poly(c, '#99c6a8', [[x,y],[x+4,y-1],[x+2,y+2],[x-1,y+2]]);
      }
    }
  }
  c.restore();
}
function drawFloor(c: CanvasRenderingContext2D): void {
  rect(c,'#95836c',0,181,384,43); rect(c,'#b4a081',0,182,384,3);
  const rows=[185,193,204,219];
  rows.forEach((y,index)=>{
    rect(c,'#645c56',0,y,384,1); rect(c,'#c3b194',0,y+1,384,1);
    const width=37+index*15,shift=index%2?width/2:0;
    for(let x=-width+shift;x<384;x+=width) {
      rect(c,'#6f6357',x,y+1,1,index===3?5:rows[index+1]-y-1);
      rect(c,'#b9a58b',x+1,y+2,1,index===3?3:rows[index+1]-y-3);
      for(let i=0;i<5;i++) {const xx=x+4+hash(x,i+index)%Math.max(3,width-8), yy=y+3+hash(i,x)%Math.max(2,(rows[index+1]??224)-y-4);rect(c,i%2?'#a18d72':'#877760',xx,yy,2+(i%2),1);}
    }
  });
  for(let i=0;i<27;i++) {const x=hash(i,61)%384,y=183+hash(i,63)%40;rect(c,'#d5b993',x,y,1,1);}
}

interface Pose {
  shoulder: Point; rearShoulder: Point; elbow: Point; hand: Point;
  rearElbow: Point; rearHand: Point; hip: Point; knee: Point; foot: Point;
  rearKnee: Point; rearFoot: Point; torsoX: number; headX: number; offset: number;
}
interface SpriteStyle {
  fur: string[];
  rear: string[];
  legs: string[];
  arm: number;
  leg: number;
  headY: number;
  paw: number;
  bulk: number;
}
// Every species has its own silhouette, fur texture and face; shared joints keep
// the frames consistent with the same simulation timings and contact distances.
const SPRITES: Record<FighterId, SpriteStyle> = {
  leo: {
    fur: ['#946037','#d9a362','#f5cb89','#c7bb9b','#fbedd0'],
    rear: ['#6a4931','#a67a43','#c99456','#897e68','#c9b998'],
    legs: ['#183e39','#39785d','#77ac7c','#cbbf9d','#faf0d5'],
    arm: 9, leg: 11, headY: -62, paw: 5, bulk: 0,
  },
  koba: {
    fur: ['#292d44','#5b6b82','#99adba','#8d354a','#df7d79'],
    rear: ['#202336','#3a465d','#65778d','#6c2b41','#a74758'],
    legs: ['#252c41','#435168','#7a8da0','#91384b','#da7774'],
    arm: 14, leg: 13, headY: -63, paw: 7, bulk: 4,
  },
  raya: {
    fur: ['#a74e2a','#ed9850','#ffd58a','#393954','#8587ad'],
    rear: ['#743829','#b46a35','#df9854','#27283f','#626686'],
    legs: ['#ad562d','#e59147','#ffce83','#252c44','#9194b1'],
    arm: 8, leg: 10, headY: -62, paw: 5, bulk: -1,
  },
  bao: {
    fur: ['#151d2c','#364350','#687683','#93b39d','#d5f0ca'],
    rear: ['#111828','#273542','#4b5d69','#51775e','#93b89a'],
    legs: ['#141c2b','#35414e','#62767e','#70a788','#d6edc0'],
    arm: 11, leg: 12, headY: -61, paw: 6, bulk: 3,
  },
  nilo: {
    fur: ['#344d38','#65944d','#a3c978','#957141','#dfc48b'],
    rear: ['#263c30','#496c3c','#7ba459','#6c5333','#ba9e64'],
    legs: ['#304736','#5b8445','#92b369','#947044','#d6b981'],
    arm: 10, leg: 11, headY: -61, paw: 5, bulk: 1,
  },
  ruk: {
    fur: ['#434853','#7d8b99','#b6c6cd','#76518d','#bd91d3'],
    rear: ['#303540','#566575','#8c9daa','#563567','#9b6eb3'],
    legs: ['#35333f','#554d66','#9a84ab','#77508e','#c4a0d6'],
    arm: 13, leg: 14, headY: -61, paw: 7, bulk: 5,
  },
};

function poseFor(f: Fighter, frame: number): Pose {
  const style = SPRITES[f.id];
  const bounce = f.grounded && (f.action === 'idle' || f.action === 'walk') ? round(Math.sin(frame / (f.id === 'bao' ? 13 : 9))) : 0;
  const crouch = f.action === 'crouch', hurt = f.action === 'hurt', walk = f.action === 'walk';
  const o = (crouch ? 17 : 0) + bounce, tx = hurt ? -5 : 0, width = 8 + style.bulk;
  const p: Pose = {
    shoulder: [tx + width,-49 + o], rearShoulder: [tx - width - 1,-48 + o],
    elbow: [tx + 16 + style.bulk,-39 + o], hand: [tx + 18 + style.bulk,-52 + o],
    rearElbow: [tx - 16 - style.bulk,-36 + o], rearHand: [tx - 9 - style.bulk,-45 + o],
    hip: [tx,-29 + o], knee: [12,-16], foot: [18,-3], rearKnee: [-13,-16], rearFoot: [-19,-3],
    torsoX: tx, headX: tx + 2, offset: o,
  };
  if (f.id === 'koba') {
    p.shoulder = [tx + 13,-48 + o]; p.rearShoulder = [tx - 15,-47 + o];
    p.elbow = [tx + 24,-32 + o]; p.hand = [tx + 25,-42 + o];
    p.rearElbow = [tx - 25,-29 + o]; p.rearHand = [tx - 23,-39 + o]; p.headX = tx + 5;
  } else if (f.id === 'bao') {
    p.elbow = [tx + 22,-38 + o]; p.hand = [tx + 20,-49 + o];
    p.rearElbow = [tx - 20,-36 + o]; p.rearHand = [tx - 13,-47 + o];
    p.knee[0] = 14; p.rearKnee[0] = -15; p.headX = tx;
  } else if (f.id === 'nilo') {
    p.headX = tx + 3; p.hand = [tx + 24,-49 + o]; p.rearHand = [tx - 12,-44 + o];
  } else if (f.id === 'ruk') {
    p.headX = tx + 4; p.hand = [tx + 26,-46 + o]; p.elbow = [tx + 25,-34 + o];
    p.rearHand = [tx - 19,-43 + o]; p.rearElbow = [tx - 26,-31 + o];
  }
  if (walk) {
    const a = Math.sin(frame / (f.id === 'ruk' ? 8 : 6)), b = Math.cos(frame / 6);
    p.knee = [5 + a * 11,-15]; p.foot = [8 + a * 20,-3 - Math.max(0,b) * 4];
    p.rearKnee = [-6 - a * 10,-15]; p.rearFoot = [-8 - a * 20,-3 - Math.max(0,-b) * 4];
    p.hand[1] += a * 3; p.rearHand[1] -= a * 3;
  }
  if (crouch) { p.knee = [19,-9]; p.foot = [22,-3]; p.rearKnee = [-15,-8]; p.rearFoot = [-18,-3]; }
  if (!f.grounded) {
    p.knee = [12,-13]; p.foot = [15,-11]; p.rearKnee = [-10,-17]; p.rearFoot = [-16,-13];
    p.hand = [19 + style.bulk,-56]; p.rearHand[1] -= 5;
  }
  if (f.action === 'block') {
    p.elbow = [14,-41 + o]; p.hand = [13,-64 + o];
    p.rearElbow = [9,-40 + o]; p.rearHand = [19,-54 + o]; p.headX -= 3;
  }
  if (hurt) {
    p.elbow = [14,-35]; p.hand = [23,-43]; p.rearElbow = [-18,-34]; p.rearHand = [-28,-45]; p.headX -= 7;
  }
  if (f.action === 'win') {
    p.elbow = [15,-61]; p.hand = [18,-79]; p.rearElbow = [-17,-60]; p.rearHand = [-20,-78];
    if (f.id === 'bao') { p.hand = [20,-66]; p.rearHand = [-17,-60]; }
  }
  if (f.action === 'ko') {
    // A folded guard and bent knee keep the fallen sprite on the floor.
    p.elbow = [11,-39]; p.hand = [14,-48]; p.rearElbow = [-11,-37]; p.rearHand = [-5,-47];
    p.knee = [7,-16]; p.foot = [9,-3]; p.rearKnee = [-7,-13]; p.rearFoot = [-8,-4];
  }
  if (f.action === 'attack') {
    const t = f.attackFrame, spec = ATTACKS[f.id][f.attack ?? 'lp'];
    const extend = t < spec.startup ? Math.max(0,(t - 1) / Math.max(1,spec.startup - 1)) :
      t < spec.startup + spec.active ? 1 : Math.max(0,1 - (t - spec.startup - spec.active) / Math.min(12,spec.recovery));
    const punch = f.attack === 'lp' || f.attack === 'mp' || f.attack === 'hp';
    const kick = f.attack === 'lk' || f.attack === 'mk' || f.attack === 'hk';
    if (punch) {
      const height = f.attack === 'hp' ? -55 : f.attack === 'mp' ? -46 : -50;
      p.torsoX += extend * 4; p.headX += extend * 3;
      p.elbow = [16 + extend * 11,height + 5 + o];
      p.hand = [19 + extend * (spec.reach - 19),height + o]; p.rearHand = [-2,-50 + o];
      if (f.attack === 'hp') p.offset -= round(extend * 2);
    }
    if (kick) {
      const lift = f.attack === 'hk' ? 43 : f.attack === 'mk' ? 34 : 22;
      p.knee = [12 + extend * 15,-16 - extend * 16];
      p.foot = [18 + extend * (spec.reach - 18),-3 - extend * lift];
      p.hand = [19,-55]; p.torsoX -= extend * 3; p.headX -= extend * 4;
    }
    if (f.attack === 'special1') {
      p.elbow = [22 + extend * 10,-44]; p.hand = [25 + extend * (spec.reach - 25),-48];
      p.rearElbow = [-20,-39]; p.rearHand = [-27,-45]; p.headX += extend * 5;
      p.knee = [19,-14]; p.foot = [30,-3];
      if (f.id === 'raya') { p.headX += extend * 3; p.offset += extend * 3; p.rearHand = [5,-38]; }
      if (f.id === 'bao') { p.hand[1] = -43; p.rearHand = [3,-47]; p.headX -= 2; }
      if (f.id === 'ruk') { p.headX += extend * 17; p.offset += extend * 6; p.hand = [25,-34]; }
      if (f.id === 'nilo') { p.headX += extend * 9; p.rearHand = [1,-39]; }
    }
    if (f.attack === 'special2') {
      if (spec.projectile === 'ground') {
        const slam = t < spec.startup ? 0 : t < spec.startup + spec.active + 5 ? 1 : Math.max(0,1 - (t - spec.startup - spec.active - 5) / 14);
        p.elbow = [19,-61 + slam * 39]; p.hand = [23,-78 + slam * 68];
        p.rearElbow = [7,-61 + slam * 39]; p.rearHand = [15,-78 + slam * 68]; p.offset += slam * 8;
        if (f.id === 'ruk') { p.hand = [24,-42]; p.rearHand = [-11,-42]; p.foot = [22,-3 - (1 - slam) * 17]; }
      } else {
        p.elbow = [20,-39]; p.hand = [30,-35]; p.rearElbow = [-16,-36]; p.rearHand = [-23,-34]; p.headX += 5 * extend;
        if (f.id === 'bao') { p.hand = [30,-47]; p.rearHand = [14,-45]; p.elbow = [17,-41]; }
      }
    }
    if (f.attack === 'super') {
      const wave = Math.sin(t / 2.6);
      p.elbow = [21,-43 - wave * 8]; p.hand = [35 + wave * 8,-48 - wave * 17];
      p.rearElbow = [-14,-38]; p.rearHand = [10 - wave * 8,-51 + wave * 7]; p.headX += 4;
      if (f.id === 'bao') { p.hand = [36,-50 - wave * 13]; p.rearHand = [-20,-48 + wave * 11]; }
      if (f.id === 'nilo') { p.offset += 7; p.hand = [27,-35]; p.rearHand = [-13,-35]; p.headX += 7; }
      if (f.id === 'ruk') { p.headX += 15; p.offset += 7; p.hand = [25,-34]; p.rearHand = [-9,-34]; }
    }
  }
  return p;
}

function limb(c: CanvasRenderingContext2D, a: Point, b: Point, d: Point, width: number, colors: string[], wrap: boolean): void {
  beam(c,ink,a,b,width + 2); beam(c,ink,b,d,width + 2);
  beam(c,colors[0],a,b,width); beam(c,colors[0],b,d,width);
  beam(c,colors[1],[a[0] - 1,a[1] - 1],[b[0] - 1,b[1] - 2],width - 3);
  beam(c,colors[1],[b[0] - 1,b[1] - 2],[d[0] - 1,d[1] - 2],width - 3);
  beam(c,colors[2],[a[0] - 2,a[1] - 2],[b[0] - 2,b[1] - 3],Math.max(2,width - 6));
  if (wrap) {
    const wx = d[0] * .78 + b[0] * .22, wy = d[1] * .78 + b[1] * .22;
    beam(c,colors[3],[wx,wy],[d[0],d[1]],width + 1);
    beam(c,colors[4],[wx - 2,wy - 2],[d[0] - 2,d[1] - 2],width - 3);
    // Wrap seams follow the wrist's orientation.
    crossMark(c,'#6b6960',b,d,.78,width,1); crossMark(c,colors[0],b,d,.94,width,1);
  }
}
function crossMark(c: CanvasRenderingContext2D, color: string, a: Point, b: Point, t: number, width: number, thick: number): void {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx,dy) || 1;
  const x = a[0] + dx * t, y = a[1] + dy * t, px = -dy / len, py = dx / len;
  beam(c,color,[x - px * width / 2,y - py * width / 2],[x + px * width / 2,y + py * width / 2],thick);
}
function textureLimb(c: CanvasRenderingContext2D, f: FighterId, a: Point, b: Point, d: Point, width: number, rear: boolean): void {
  if (f === 'raya') {
    crossMark(c,rear ? '#442930' : '#422d31',a,b,.32,width - 2,2);
    crossMark(c,rear ? '#442930' : '#422d31',a,b,.75,width - 1,2);
    crossMark(c,rear ? '#442930' : '#422d31',b,d,.38,width - 2,2);
    crossMark(c,'#ffc67c',b,d,.46,width - 4,1);
  } else if (f === 'nilo') {
    for (let i = 1; i < 4; i++) {
      const t = i / 4, x = b[0] + (d[0] - b[0]) * t, y = b[1] + (d[1] - b[1]) * t;
      poly(c,rear ? '#749153' : '#afd17c',[[x-2,y],[x,y-2],[x+2,y],[x,y+1]]);
      rect(c,'#466640',x-2,y+1,3,1);
    }
  } else if (f === 'ruk') {
    crossMark(c,rear ? '#313b48' : '#4b5c6b',a,b,.48,width,2);
    crossMark(c,rear ? '#86919b' : '#d3d9d4',a,b,.42,width - 2,1);
    oval(c,rear ? '#596b78' : '#93a5af',b[0]-2,b[1]-1,width / 3,width / 3);
  } else if (f === 'koba') {
    const dx = d[0] - b[0], dy = d[1] - b[1];
    rect(c,rear ? '#657485' : '#a4b6be',b[0]+dx*.3-3,b[1]+dy*.3-3,3,1);
    rect(c,rear ? '#3b475e' : '#455469',b[0]+dx*.45+2,b[1]+dy*.45,2,2);
  }
}
function foot(c: CanvasRenderingContext2D, p: Point, id: FighterId, rear: boolean): void {
  const x = p[0], y = p[1], style = SPRITES[id], broad = id === 'ruk' || id === 'bao' || id === 'koba';
  const width = broad ? 12 : 10, base = rear ? style.rear[0] : style.fur[1];
  poly(c,ink,[[x-6,y-4],[x+3,y-5],[x+width,y-1],[x+width-1,y+3],[x-7,y+3]]);
  poly(c,base,[[x-5,y-3],[x+2,y-4],[x+width-1,y],[x+width-2,y+2],[x-5,y+2]]);
  rect(c,rear ? style.rear[1] : style.fur[2],x-1,y-2,width-3,1);
  for (let i = 0; i < 3; i++) {
    const xx = x + 3 + i * 3;
    rect(c,style.fur[0],xx,y,1,2);
    if (id === 'nilo' || id === 'raya' || id === 'leo') rect(c,rear ? '#cbbf8f' : '#fff0c5',xx+1,y+1,2,1);
    if (id === 'ruk') rect(c,rear ? '#737d87' : '#c9d0ca',xx,y,2,2);
  }
}
function paw(c: CanvasRenderingContext2D, f: Fighter, p: Point, rear: boolean): void {
  const style = SPRITES[f.id], colors = rear ? style.rear : style.fur;
  const radius = style.paw, openPalm = f.id === 'bao' && f.action === 'attack' && (f.attack === 'special1' || f.attack === 'special2' || f.attack === 'super');
  oval(c,ink,p[0]+1,p[1],radius+1,radius+1);
  oval(c,colors[1],p[0]+1,p[1]-1,radius,radius);
  rect(c,colors[2],p[0]-2,p[1]-radius+1,radius+1,2);
  rect(c,colors[0],p[0]+radius-2,p[1]-1,2,radius-1);
  for (let i = 0; i < (radius > 5 ? 3 : 2); i++) rect(c,colors[0],p[0]-2+i*3,p[1]+1,1,2);
  if (openPalm) {
    for (let i = 0; i < 3; i++) {
      rect(c,ink,p[0]+radius-1,p[1]-6+i*4,5,3);
      rect(c,'#acceb4',p[0]+radius,p[1]-6+i*4,3,2);
    }
    oval(c,'#789e87',p[0]+2,p[1],3,3); rect(c,'#dcf2c7',p[0]+2,p[1]-1,2,1);
  } else if (f.id === 'nilo' || f.id === 'raya') {
    for (let i = 0; i < 3; i++) rect(c,'#f3dfb4',p[0]+radius-1,p[1]-3+i*3,3,1);
  } else if (f.id === 'ruk') {
    rect(c,'#cbd3d2',p[0]-2,p[1]-4,7,2); rect(c,'#4c5a67',p[0],p[1]-2,1,5);
  }
}

function drawTail(c: CanvasRenderingContext2D, f: Fighter, p: Pose, frame: number): void {
  const o = p.offset, tx = p.torsoX, sway = round(Math.sin(frame / 13) * 3);
  if (f.id === 'leo' || f.id === 'raya') {
    const a: Point = [tx-9,-32+o], b: Point = [-29,-18+o], d: Point = [-38,-29+o+sway];
    beam(c,ink,a,b,5); beam(c,SPRITES[f.id].fur[1],a,b,3);
    beam(c,ink,b,d,5); beam(c,SPRITES[f.id].fur[2],b,d,3);
    if (f.id === 'leo') {
      poly(c,ink,[[d[0]-3,d[1]-6],[d[0]+3,d[1]-3],[d[0]+4,d[1]+3],[d[0]-1,d[1]+7],[d[0]-5,d[1]+2]]);
      oval(c,'#80552f',d[0]-1,d[1],3,5); rect(c,'#d49b48',d[0]-2,d[1]-3,1,3);
    } else {
      for (const t of [.2,.55,.85]) crossMark(c,'#422c31',a,b,t,4,2);
      for (const t of [.25,.65]) crossMark(c,'#422c31',b,d,t,4,2);
      rect(c,'#f5d6a8',d[0]-2,d[1]-3,4,2);
    }
  } else if (f.id === 'nilo') {
    const active = f.action === 'attack' && f.attack === 'super' && f.attackFrame >= ATTACKS.nilo.super.startup;
    const reach = active ? ATTACKS.nilo.super.reach - 7 : -49;
    const points: Point[] = active ? [[tx-8,-30+o],[15,-26+o],[reach-18,-37+o],[reach,-45+o],[reach-7,-30+o],[20,-16+o],[tx-11,-19+o]] :
      [[tx-8,-32+o],[-22,-25+o],[-38,-18+o],[-50,-22+o+sway],[-43,-10+o],[-22,-15+o],[tx-9,-20+o]];
    poly(c,ink,points);
    poly(c,'#476b3d',points.map(([x,y],i) => [x+(i<4?1:0),y+(i<4?2:-2)] as Point));
    if (active) {
      beam(c,'#95b66c',[tx,-25+o],[reach-8,-34+o],4);
      for (let x=17;x<reach-10;x+=10) poly(c,'#c2ce87',[[x,-30+o],[x+1,-39+o],[x+5,-31+o]]);
    } else {
      beam(c,'#8eae62',[-13,-25+o],[-38,-15+o],3);
      for (let i=0;i<3;i++) poly(c,'#bbcb82',[[-17-i*8,-27+o+i*3],[-21-i*8,-34+o+i*3],[-23-i*8,-24+o+i*3]]);
      rect(c,'#a1bb70',-34,-15+o,4,1);
    }
  } else if (f.id === 'ruk') {
    beam(c,ink,[tx-15,-31+o],[-27,-22+o+sway],4);
    beam(c,'#82919e',[tx-15,-31+o],[-27,-22+o+sway],2);
    oval(c,'#4b4b59',-28,-21+o+sway,2,3);
  }
}
function sash(c: CanvasRenderingContext2D, tx: number, y: number, dark: string, light: string, frame: number, length = 12): void {
  rect(c,ink,tx-13,y-1,27,5); rect(c,dark,tx-12,y,25,3); rect(c,light,tx-10,y,20,1);
  poly(c,ink,[[tx+6,y+2],[tx+12,y+2],[tx+17+Math.sin(frame/12)*2,y+length],[tx+10,y+length-2]]);
  poly(c,dark,[[tx+7,y+3],[tx+11,y+3],[tx+15+Math.sin(frame/12)*2,y+length-2],[tx+11,y+length-3]]);
  rect(c,light,tx+8,y+3,1,length-6); rect(c,light,tx+4,y+1,4,2);
}
function drawTorso(c: CanvasRenderingContext2D, f: Fighter, p: Pose, frame: number): void {
  const tx = p.torsoX, o = p.offset;
  if (f.id === 'leo' || f.id === 'raya') {
    const tiger = f.id === 'raya', fur = SPRITES[f.id].fur;
    poly(c,ink,[[tx-11,-53+o],[tx+8,-55+o],[tx+15,-45+o],[tx+11,-29+o],[tx-11,-28+o],[tx-15,-42+o]]);
    poly(c,fur[0],[[tx-10,-51+o],[tx+7,-53+o],[tx+13,-44+o],[tx+9,-30+o],[tx-10,-30+o],[tx-13,-42+o]]);
    poly(c,fur[1],[[tx-8,-50+o],[tx+5,-51+o],[tx+11,-44+o],[tx+6,-34+o],[tx-4,-31+o],[tx-11,-41+o]]);
    const chest = tiger ? '#f2dab2' : '#f2ce8d';
    poly(c,chest,[[tx-7,-49+o],[tx-1,-49+o],[tx+3,-45+o],[tx+2,-36+o],[tx-6,-34+o],[tx-9,-42+o]]);
    rect(c,tiger?'#ffefcf':'#ffe2a1',tx-5,-48+o,3,2);
    rect(c,tiger?'#bd9a74':'#9b703e',tx+1,-43+o,1,10);
    rect(c,tiger?'#d4b58d':'#b58446',tx-6,-38+o,11,1); rect(c,fur[2],tx-3,-34+o,7,2);
    if (tiger) {
      poly(c,'#352933',[[tx-12,-47+o],[tx-5,-44+o],[tx-10,-41+o]]);
      poly(c,'#352933',[[tx+10,-46+o],[tx+5,-42+o],[tx+12,-42+o]]);
      poly(c,'#352933',[[tx-12,-38+o],[tx-5,-35+o],[tx-11,-33+o]]);
      poly(c,'#352933',[[tx+10,-37+o],[tx+4,-34+o],[tx+9,-32+o]]);
    }
    poly(c,ink,[[tx-12,-31+o],[tx+12,-31+o],[tx+15,-22+o],[tx+2,-19+o],[tx-3,-22+o],[tx-13,-22+o]]);
    poly(c,tiger?'#393851':'#387761',[[tx-11,-29+o],[tx+10,-29+o],[tx+13,-23+o],[tx+2,-21+o],[tx-3,-24+o],[tx-12,-23+o]]);
    rect(c,tiger?'#959bc1':'#ded3ab',tx-10,-30+o,22,2);
    rect(c,tiger?'#5a638d':'#8c8765',tx,-29+o,4,3);
    rect(c,tiger?'#747fa2':'#83ae87',tx-9,-26+o,5,2);
    rect(c,tiger?'#211f36':'#1d4c40',tx+7,-26+o,4,4);
    if (tiger) sash(c,tx,-30+o,'#565e96','#c8d4e4',frame,13);
  } else if (f.id === 'koba') {
    poly(c,ink,[[tx-18,-52+o],[tx-11,-58+o],[tx+5,-58+o],[tx+17,-51+o],[tx+21,-43+o],[tx+14,-30+o],[tx+10,-23+o],[tx-10,-24+o],[tx-17,-35+o],[tx-21,-43+o]]);
    poly(c,'#43546d',[[tx-17,-50+o],[tx-10,-56+o],[tx+5,-56+o],[tx+16,-50+o],[tx+19,-43+o],[tx+12,-31+o],[tx+8,-25+o],[tx-8,-26+o],[tx-15,-35+o],[tx-19,-43+o]]);
    poly(c,'#788fa0',[[tx-15,-50+o],[tx-9,-54+o],[tx+3,-54+o],[tx+13,-49+o],[tx+16,-43+o],[tx+9,-37+o],[tx-1,-37+o],[tx-11,-38+o],[tx-16,-43+o]]);
    poly(c,'#aec1c6',[[tx-13,-48+o],[tx-7,-51+o],[tx-1,-49+o],[tx-2,-41+o],[tx-11,-41+o],[tx-14,-44+o]]);
    poly(c,'#98b0bb',[[tx+1,-50+o],[tx+10,-48+o],[tx+13,-45+o],[tx+7,-40+o],[tx+1,-41+o]]);
    rect(c,'#354356',tx-1,-50+o,2,14);
    poly(c,'#657a8b',[[tx-7,-37+o],[tx+8,-37+o],[tx+8,-29+o],[tx+3,-27+o],[tx-6,-29+o]]);
    rect(c,'#a0b2b8',tx-5,-35+o,4,3); rect(c,'#96abb5',tx+2,-35+o,4,3); rect(c,'#3e4c61',tx,-35+o,1,8);
    // The pale back/chest and broken shoulder tufts give Koba a silverback shape.
    for (const q of [[-17,-47],[-15,-52],[12,-49],[16,-43],[-9,-54]] as Point[]) {
      rect(c,'#b7c7c7',tx+q[0],q[1]+o,2,1); rect(c,'#2b374a',tx+q[0]+2,q[1]+o+2,2,2);
    }
    sash(c,tx,-28+o,'#a64b56','#f29684',frame,15);
  } else if (f.id === 'bao') {
    oval(c,ink,tx,-39+o,20,21);
    oval(c,'#bec9bd',tx,-40+o,18,19);
    poly(c,'#283441',[[tx-15,-55+o],[tx-7,-58+o],[tx+8,-57+o],[tx+16,-53+o],[tx+18,-44+o],[tx+11,-42+o],[tx-13,-43+o],[tx-19,-48+o]]);
    poly(c,'#54636b',[[tx-14,-54+o],[tx-7,-56+o],[tx+6,-55+o],[tx+11,-52+o],[tx+7,-49+o],[tx-10,-48+o]]);
    oval(c,'#e2e3cc',tx-2,-38+o,15,15); oval(c,'#fcf0d4',tx-5,-42+o,10,10);
    poly(c,'#a5b7ab',[[tx+10,-43+o],[tx+14,-38+o],[tx+11,-29+o],[tx+5,-26+o],[tx+8,-35+o]]);
    rect(c,'#82978e',tx+1,-30+o,2,1); rect(c,'#fff5d8',tx-8,-41+o,5,2);
    sash(c,tx,-27+o,'#45866a','#bce7ae',frame,14);
    rect(c,'#213f3c',tx-4,-27+o,6,5); rect(c,'#dbd18a',tx-3,-26+o,4,3); rect(c,'#55946f',tx-2,-25+o,2,1);
  } else if (f.id === 'nilo') {
    // A tapered armored back contrasts with the pale, segmented underside.
    poly(c,ink,[[tx-14,-54+o],[tx-3,-58+o],[tx+10,-53+o],[tx+16,-43+o],[tx+10,-27+o],[tx-9,-26+o],[tx-16,-42+o]]);
    poly(c,'#4d773f',[[tx-13,-52+o],[tx-3,-56+o],[tx+9,-51+o],[tx+14,-43+o],[tx+9,-29+o],[tx-8,-28+o],[tx-14,-42+o]]);
    poly(c,'#8eae60',[[tx-11,-50+o],[tx-4,-54+o],[tx+5,-49+o],[tx+7,-42+o],[tx-2,-33+o],[tx-9,-35+o]]);
    poly(c,'#d4cf91',[[tx+1,-51+o],[tx+8,-49+o],[tx+11,-42+o],[tx+7,-29+o],[tx-2,-29+o],[tx-3,-40+o]]);
    poly(c,'#f0dfaa',[[tx+1,-49+o],[tx+5,-49+o],[tx+7,-43+o],[tx+4,-31+o],[tx,-31+o],[tx-1,-39+o]]);
    for (let y=-44;y<-29;y+=5) { rect(c,'#96925f',tx-2,y+o,11,1); rect(c,'#f4e7b7',tx+1,y+o-1,5,1); }
    for (let y=-51;y<-29;y+=7) {
      poly(c,ink,[[tx-13,y+o],[tx-20,y-5+o],[tx-16,y+5+o]]);
      poly(c,'#a6c476',[[tx-14,y+o],[tx-18,y-3+o],[tx-15,y+3+o]]);
    }
    for (let i=0;i<4;i++) { rect(c,'#b9ca7f',tx-11+(i%2)*4,-46+o+i*5,3,2); rect(c,'#385b36',tx-10+(i%2)*4,-44+o+i*5,2,1); }
    sash(c,tx,-28+o,'#2f6971','#96d1c5',frame,10);
  } else {
    // A broad rhinoceros body has overlapping hide plates and a violet belt.
    poly(c,ink,[[tx-20,-51+o],[tx-11,-58+o],[tx+7,-58+o],[tx+20,-49+o],[tx+23,-41+o],[tx+17,-29+o],[tx+12,-23+o],[tx-12,-24+o],[tx-19,-33+o],[tx-23,-43+o]]);
    poly(c,'#657687',[[tx-19,-49+o],[tx-10,-56+o],[tx+7,-56+o],[tx+18,-48+o],[tx+21,-41+o],[tx+15,-30+o],[tx+11,-25+o],[tx-11,-26+o],[tx-17,-34+o],[tx-21,-43+o]]);
    poly(c,'#a0b2bb',[[tx-16,-49+o],[tx-9,-54+o],[tx+5,-54+o],[tx+15,-48+o],[tx+16,-42+o],[tx+7,-38+o],[tx-7,-38+o],[tx-17,-43+o]]);
    poly(c,'#c8d1cd',[[tx-13,-48+o],[tx-7,-51+o],[tx-2,-49+o],[tx-3,-43+o],[tx-12,-42+o]]);
    poly(c,'#7b8f9e',[[tx-10,-37+o],[tx+11,-37+o],[tx+12,-31+o],[tx+5,-27+o],[tx-8,-28+o]]);
    rect(c,'#435462',tx-1,-51+o,2,14); rect(c,'#4d5c69',tx-13,-39+o,29,2);
    rect(c,'#c1cac7',tx-10,-37+o,20,1); rect(c,'#4d5c69',tx-7,-32+o,17,1);
    rect(c,'#abbabf',tx-9,-48+o,1,4); rect(c,'#75889a',tx+11,-48+o,2,5);
    for (const [x,y] of [[-16,-45],[14,-43],[-11,-34],[8,-31]]) rect(c,'#3d4c5b',tx+x,y+o,2,1);
    sash(c,tx,-28+o,'#71508a','#d7a6df',frame,12);
    rect(c,'#323142',tx-3,-29+o,7,6); rect(c,'#c5b28b',tx-2,-28+o,5,4); rect(c,'#735782',tx-1,-27+o,3,2);
  }
}
function lionHead(c:CanvasRenderingContext2D,x:number,y:number,action:Fighter['action']):void{
  // Jagged mane silhouette, separated curls and a forward-projecting muzzle.
  poly(c,ink,[[x-11,y-13],[x-7,y-17],[x-4,y-14],[x+1,y-16],[x+6,y-12],[x+10,y-6],[x+9,y+4],[x+7,y+12],[x+2,y+17],[x-2,y+12],[x-8,y+14],[x-12,y+8],[x-17,y+8],[x-14,y+1],[x-18,y-3],[x-14,y-7],[x-14,y-11]]);
  poly(c,'#72452d',[[x-11,y-11],[x-7,y-15],[x-4,y-12],[x+1,y-14],[x+5,y-11],[x+8,y-5],[x+7,y+4],[x+5,y+11],[x+2,y+14],[x-2,y+9],[x-8,y+11],[x-11,y+6],[x-15,y+6],[x-12,y],[x-15,y-3],[x-12,y-6],[x-12,y-10]]);
  poly(c,'#b77638',[[x-10,y-10],[x-6,y-13],[x-3,y-11],[x+1,y-12],[x+4,y-9],[x+1,y-5],[x-2,y-3],[x-3,y+7],[x-7,y+9],[x-9,y+4],[x-12,y+3],[x-11,y-3]]);
  poly(c,'#da9c45',[[x-8,y-11],[x-5,y-12],[x-3,y-9],[x-5,y-5],[x-8,y-2],[x-10,y-5]]);
  rect(c,'#f0bf67',x-5,y-12,3,2);rect(c,'#d09240',x-12,y-5,2,4);rect(c,'#c4893c',x-8,y+2,2,4);rect(c,'#d79f47',x+1,y+9,2,3);
  rect(c,'#5a3a2b',x-13,y+3,2,3);rect(c,'#de9f48',x-5,y+8,2,3);rect(c,'#55362a',x-6,y-10,1,3);
  oval(c,ink,x+4,y-8,4,4);oval(c,'#c79756',x+4,y-8,3,3);rect(c,'#775347',x+3,y-9,2,2);
  poly(c,'#b57c43',[[x-2,y-8],[x+6,y-7],[x+9,y-2],[x+7,y+5],[x+1,y+7],[x-3,y+3],[x-3,y-3]]);
  poly(c,'#e2b16b',[[x-2,y-7],[x+5,y-6],[x+7,y-2],[x+5,y+2],[x,y+1],[x-3,y-2]]);
  rect(c,'#f6d28a',x,y-6,4,2);rect(c,ink,x+3,y-2,4,2);rect(c,'#fff0b9',x+4,y-2,1,1);rect(c,'#83572e',x+2,y-4,5,1);
  poly(c,ink,[[x+4,y+1],[x+10,y+1],[x+12,y+4],[x+9,y+7],[x+3,y+6],[x+1,y+3]]);
  poly(c,'#f5d79c',[[x+4,y+2],[x+9,y+2],[x+10,y+4],[x+8,y+6],[x+3,y+5],[x+2,y+3]]);
  rect(c,'#47362e',x+8,y+1,3,2);rect(c,'#ae814f',x+4,y+4,4,1);
  if(action==='attack'||action==='win') {rect(c,ink,x+5,y+5,5,3);rect(c,'#fff1c5',x+6,y+5,3,1);rect(c,'#b75b50',x+6,y+7,2,1);}
  else rect(c,'#543b2b',x+5,y+5,4,1);
  rect(c,'#fff0bd',x+3,y+2,2,1);
}
function gorillaHead(c:CanvasRenderingContext2D,x:number,y:number,action:Fighter['action']):void{
  poly(c,ink,[[x-9,y-7],[x-7,y-12],[x-2,y-15],[x+3,y-13],[x+7,y-9],[x+9,y-3],[x+12,y+2],[x+10,y+8],[x+5,y+11],[x-4,y+9],[x-9,y+5],[x-11,y-1]]);
  poly(c,'#42435b',[[x-8,y-7],[x-5,y-11],[x-1,y-13],[x+3,y-11],[x+6,y-8],[x+7,y-3],[x+10,y+2],[x+8,y+7],[x+3,y+9],[x-4,y+7],[x-8,y+3],[x-9,y-1]]);
  poly(c,'#68728a',[[x-7,y-7],[x-4,y-11],[x-1,y-12],[x+2,y-10],[x+4,y-6],[x,y-4],[x-5,y-2]]);
  rect(c,'#949da9',x-4,y-10,3,2);rect(c,'#768399',x-7,y-5,2,3);
  oval(c,'#292b40',x-6,y+1,3,4);rect(c,'#738397',x-7,y,2,3);
  poly(c,'#9b91a0',[[x,y-4],[x+6,y-4],[x+8,y],[x+10,y+3],[x+7,y+7],[x+1,y+7],[x-2,y+3]]);
  poly(c,'#c0aead',[[x+1,y-3],[x+5,y-3],[x+6,y],[x+2,y+1],[x-1,y+3],[x-1,y]]);
  rect(c,'#262136',x+1,y-3,7,2);rect(c,'#e8d69e',x+3,y-2,1,1);rect(c,'#463846',x+4,y+1,5,3);rect(c,'#211e30',x+5,y+2,1,1);rect(c,'#211e30',x+8,y+2,1,1);
  rect(c,'#dfc2af',x+1,y+4,3,1);rect(c,'#5b4453',x+3,y+5,5,1);
  if(action==='attack'||action==='win'){rect(c,'#241e31',x+3,y+5,6,3);rect(c,'#f4d9b9',x+4,y+5,4,1);rect(c,'#ae6571',x+4,y+7,3,1);}
  rect(c,'#6a5869',x+3,y+8,4,1);
}

function tigerHead(c: CanvasRenderingContext2D, x: number, y: number, action: Fighter['action']): void {
  // Two rounded dark ears, an orange skull and the white cheek ruff distinguish
  // Raya from Leo even before the striped body or long ringed tail is visible.
  oval(c,ink,x-6,y-10,5,5); oval(c,'#e4a361',x-6,y-10,3,3); rect(c,'#5b3936',x-7,y-11,3,2);
  oval(c,ink,x+6,y-9,4,5); oval(c,'#e4a361',x+6,y-9,3,3); rect(c,'#5b3936',x+5,y-10,2,2);
  poly(c,ink,[[x-10,y-6],[x-7,y-12],[x+2,y-13],[x+9,y-8],[x+10,y-2],[x+12,y+4],[x+8,y+10],[x-2,y+9],[x-7,y+5],[x-12,y+5]]);
  poly(c,'#b76737',[[x-9,y-5],[x-6,y-10],[x+2,y-11],[x+8,y-7],[x+8,y],[x+10,y+4],[x+7,y+8],[x-2,y+7],[x-6,y+3],[x-10,y+3]]);
  poly(c,'#eea75e',[[x-7,y-6],[x-4,y-10],[x+2,y-10],[x+6,y-6],[x+5,y],[x-2,y+2],[x-7,y-1]]);
  poly(c,'#ffe0a0',[[x-4,y-9],[x+1,y-9],[x+3,y-6],[x-1,y-4],[x-4,y-5]]);
  poly(c,'#f5dfb8',[[x-9,y],[x-3,y+1],[x,y+5],[x-3,y+8],[x-7,y+4],[x-11,y+4]]);
  poly(c,'#493137',[[x-8,y-7],[x-3,y-6],[x-6,y-4]]);
  poly(c,'#493137',[[x+4,y-10],[x+3,y-5],[x+7,y-7]]);
  poly(c,'#493137',[[x-9,y-2],[x-3,y-1],[x-6,y+1]]);
  poly(c,'#493137',[[x-7,y+3],[x-2,y+4],[x-4,y+6]]);
  rect(c,'#f5e7c6',x+1,y-3,6,2); rect(c,ink,x+2,y-2,5,2);
  rect(c,'#9be1b3',x+4,y-2,2,1); rect(c,'#fff6d7',x+4,y-2,1,1); rect(c,'#77412f',x+2,y-4,5,1);
  rect(c,'#3c2d31',x-3,y-2,3,1);rect(c,'#fff0c9',x-2,y-1,2,1);
  poly(c,ink,[[x+3,y+1],[x+10,y+1],[x+13,y+4],[x+10,y+8],[x+3,y+7],[x,y+4]]);
  poly(c,'#f6e3bc',[[x+4,y+2],[x+10,y+2],[x+11,y+4],[x+9,y+6],[x+3,y+5],[x+2,y+3]]);
  rect(c,'#674044',x+8,y+1,4,2); rect(c,'#f2b09a',x+9,y+1,2,1);
  if (action === 'attack' || action === 'win') {
    rect(c,ink,x+5,y+5,6,3); rect(c,'#fff2d4',x+6,y+5,4,1); rect(c,'#fff2d4',x+6,y+6,1,2);
    rect(c,'#c06b66',x+8,y+7,2,1);
  } else rect(c,'#684939',x+5,y+5,5,1);
  rect(c,'#493d36',x+4,y+3,1,1); rect(c,'#493d36',x+6,y+4,1,1);
  rect(c,'#fff5d4',x-2,y+3,4,1); rect(c,'#fff5d4',x-3,y+5,4,1);
}
function pandaHead(c: CanvasRenderingContext2D, x: number, y: number, action: Fighter['action']): void {
  oval(c,ink,x-10,y-11,6,6); oval(c,'#354550',x-10,y-12,4,4); rect(c,'#70838b',x-12,y-14,3,1);
  oval(c,ink,x+9,y-10,5,6); oval(c,'#354550',x+9,y-11,3,4);
  oval(c,ink,x,y-1,15,14); oval(c,'#c0c8b7',x,y-2,13,12);
  poly(c,'#f4eacf',[[x-9,y-9],[x-3,y-13],[x+5,y-11],[x+10,y-6],[x+9,y+2],[x+3,y+7],[x-7,y+5],[x-11,y-2]]);
  poly(c,'#fff4d7',[[x-6,y-10],[x-1,y-11],[x+3,y-9],[x+2,y-5],[x-4,y-3],[x-8,y-5]]);
  poly(c,'#263341',[[x-9,y-4],[x-6,y-7],[x-2,y-4],[x-3,y+2],[x-8,y+3],[x-11,y]]);
  poly(c,'#263341',[[x+4,y-6],[x+9,y-5],[x+10,y],[x+7,y+4],[x+3,y+1],[x+2,y-2]]);
  rect(c,'#536b75',x-8,y-3,4,1); rect(c,'#1a2631',x-7,y-2,4,2);
  rect(c,'#d2dab2',x-6,y-2,1,1);
  rect(c,'#50636b',x+4,y-3,5,1); rect(c,'#172430',x+4,y-2,5,2);
  rect(c,'#b8e4ae',x+6,y-2,2,1); rect(c,'#fff4d5',x+6,y-2,1,1);
  oval(c,'#d3d7bc',x+4,y+5,8,6); oval(c,'#fbefd0',x+3,y+4,6,4);
  poly(c,'#283844',[[x+2,y+2],[x+8,y+2],[x+7,y+5],[x+4,y+6],[x+2,y+4]]);
  rect(c,'#647581',x+3,y+2,3,1); rect(c,'#667569',x+5,y+6,1,2);
  if (action === 'attack' || action === 'win') { rect(c,'#3a3d38',x+3,y+7,6,2); rect(c,'#fff5cf',x+4,y+7,4,1); }
  else rect(c,'#707564',x+3,y+8,5,1);
  rect(c,'#e4ddbc',x-10,y+5,4,1); rect(c,'#939f94',x+10,y+6,2,2);
}
function crocodileHead(c: CanvasRenderingContext2D, x: number, y: number, action: Fighter['action']): void {
  const open = action === 'attack' || action === 'win';
  poly(c,ink,[[x-11,y-8],[x-7,y-13],[x,y-15],[x+6,y-12],[x+10,y-6],[x+17,y-4],[x+25,y-2],[x+27,y+4],[x+23,y+8],[x+11,y+10],[x+2,y+11],[x-9,y+6],[x-13,y]]);
  poly(c,'#41653d',[[x-10,y-7],[x-6,y-11],[x,y-13],[x+5,y-10],[x+8,y-4],[x+17,y-2],[x+24,y],[x+25,y+4],[x+22,y+6],[x+11,y+8],[x+2,y+9],[x-8,y+4],[x-11,y]]);
  poly(c,'#7fa754',[[x-8,y-7],[x-3,y-11],[x+1,y-10],[x+4,y-6],[x+2,y+2],[x-6,y+2],[x-9,y-2]]);
  poly(c,'#aecb77',[[x-5,y-10],[x-1,y-10],[x+1,y-7],[x-3,y-5],[x-6,y-5]]);
  // The eye sits above the snout on a raised brow, with a slit pupil.
  poly(c,ink,[[x+1,y-9],[x+6,y-10],[x+9,y-7],[x+7,y-3],[x+2,y-3]]);
  rect(c,'#b3c880',x+2,y-8,5,2); rect(c,'#e9d771',x+3,y-6,4,2); rect(c,'#222b2e',x+5,y-7,1,3);
  rect(c,'#fff4bd',x+3,y-6,1,1);
  poly(c,'#8cab58',[[x+8,y-4],[x+16,y-2],[x+24,y],[x+25,y+3],[x+13,y+3],[x+6,y+1]]);
  rect(c,'#ced894',x+11,y-1,10,1); rect(c,'#314c35',x+21,y+1,3,2);
  poly(c,'#d4c98f',[[x+1,y+5],[x+12,y+5],[x+25,y+4],[x+23,y+7],[x+12,y+9],[x+3,y+8],[x-1,y+6]]);
  rect(c,'#f3e2ac',x+7,y+6,12,1);
  if (open) {
    poly(c,ink,[[x+6,y+3],[x+26,y+3],[x+23,y+8],[x+7,y+9],[x+2,y+6]]);
    poly(c,'#894b4f',[[x+7,y+5],[x+23,y+5],[x+21,y+7],[x+7,y+7]]);
    rect(c,'#d8917b',x+8,y+7,10,1);
    for (let i=0;i<4;i++) poly(c,'#fff0ba',[[x+9+i*4,y+3],[x+11+i*4,y+3],[x+10+i*4,y+6]]);
    for (let i=0;i<3;i++) rect(c,'#f7e2a8',x+10+i*4,y+7,1,2);
  } else {
    rect(c,'#344e37',x+6,y+4,18,1);
    for (let i=0;i<4;i++) rect(c,'#f3e4b2',x+8+i*4,y+4,2,2);
  }
  for (const [dx,dy] of [[-8,-5],[-5,0],[-1,2],[9,-2],[15,0]]) {
    rect(c,'#afc77f',x+dx,y+dy,2,1); rect(c,'#476c3c',x+dx+1,y+dy+1,2,1);
  }
  poly(c,'#b8ca82',[[x-8,y-9],[x-11,y-15],[x-4,y-11]]);
}
function rhinoHead(c: CanvasRenderingContext2D, x: number, y: number, action: Fighter['action']): void {
  // Thick folds around a long square muzzle, two ears and an unmistakable horn.
  poly(c,ink,[[x-10,y-10],[x-3,y-14],[x+6,y-12],[x+12,y-7],[x+14,y-1],[x+22,y+1],[x+23,y+8],[x+19,y+13],[x+5,y+13],[x-6,y+8],[x-12,y+1]]);
  poly(c,'#61717f',[[x-9,y-9],[x-3,y-12],[x+5,y-10],[x+10,y-6],[x+12,y+1],[x+20,y+2],[x+21,y+7],[x+18,y+11],[x+5,y+11],[x-5,y+6],[x-10,y]]);
  poly(c,'#93a7b1',[[x-7,y-9],[x-2,y-11],[x+4,y-9],[x+7,y-5],[x+5,y+2],[x-2,y+4],[x-8,y]]);
  poly(c,'#c1cac7',[[x-5,y-9],[x-1,y-10],[x+2,y-7],[x,y-4],[x-5,y-3]]);
  poly(c,ink,[[x-10,y-7],[x-15,y-13],[x-14,y-19],[x-8,y-16],[x-5,y-11]]);
  poly(c,'#93a5ad',[[x-10,y-9],[x-13,y-14],[x-12,y-17],[x-8,y-14],[x-7,y-11]]);
  rect(c,'#556370',x-11,y-15,1,4);
  poly(c,ink,[[x+3,y-11],[x+5,y-19],[x+10,y-18],[x+10,y-12],[x+7,y-7]]);
  poly(c,'#b4bdba',[[x+5,y-12],[x+6,y-17],[x+8,y-17],[x+8,y-12],[x+6,y-9]]);
  poly(c,'#899ba7',[[x+5,y-2],[x+11,y],[x+18,y+2],[x+20,y+6],[x+17,y+10],[x+7,y+9],[x+3,y+6]]);
  rect(c,'#bdc6c2',x+7,y+2,11,1); rect(c,'#50616e',x+18,y+4,2,3); rect(c,'#d2d4c7',x+9,y+5,5,1);
  rect(c,'#35414f',x+2,y-5,7,2); rect(c,'#e9c2a2',x+5,y-4,2,1); rect(c,'#fbefd0',x+5,y-4,1,1);
  rect(c,'#536574',x+1,y-7,7,1); rect(c,'#637581',x-4,y+3,7,1);
  poly(c,ink,[[x+13,y+2],[x+17,y-4],[x+19,y-17],[x+22,y-11],[x+23,y-2],[x+22,y+4]]);
  poly(c,'#b8b198',[[x+15,y+1],[x+18,y-5],[x+19,y-14],[x+21,y-9],[x+21,y-2],[x+20,y+2]]);
  poly(c,'#f2dfaf',[[x+16,y],[x+18,y-5],[x+19,y-13],[x+19,y-3],[x+18,y+1]]);
  // A smaller rear horn remains visible behind the main one.
  poly(c,ink,[[x+8,y+1],[x+10,y-9],[x+13,y-2],[x+13,y+2]]);
  poly(c,'#dacba5',[[x+10,y],[x+11,y-6],[x+12,y],[x+12,y+1]]);
  if (action === 'attack' || action === 'win') { rect(c,ink,x+10,y+9,8,2); rect(c,'#eed7b0',x+11,y+9,5,1); }
  else rect(c,'#394956',x+10,y+9,8,1);
  rect(c,'#c2cac4',x-3,y-1,2,1); rect(c,'#455564',x+3,y+6,2,1);
}
function drawHead(c: CanvasRenderingContext2D, f: Fighter, x: number, y: number): void {
  switch (f.id) {
    case 'leo':
      lionHead(c,x,y,f.action);
      // Individual mane notches, ivory whiskers and a jaw shadow soften the blocky base.
      rect(c,'#f3c471',x-7,y-7,1,2); rect(c,'#573c2c',x-10,y+4,2,2);
      rect(c,'#573c2c',x-6,y+7,2,2); rect(c,'#f7d88e',x+2,y+7,1,2);
      rect(c,'#fff0cb',x+1,y+3,3,1); rect(c,'#fff0cb',x,y+5,4,1);
      rect(c,'#ba7741',x+2,y-4,1,2);
      break;
    case 'koba':
      gorillaHead(c,x,y,f.action);
      rect(c,'#b2c5cb',x-2,y-12,3,1); rect(c,'#334154',x-3,y-8,2,2);
      rect(c,'#d8cbb1',x+2,y-1,1,1); rect(c,'#d39b85',x+6,y-5,1,3);
      rect(c,'#596174',x-3,y+6,2,1);
      break;
    case 'raya': tigerHead(c,x,y,f.action); break;
    case 'bao': pandaHead(c,x,y,f.action); break;
    case 'nilo': crocodileHead(c,x,y,f.action); break;
    case 'ruk': rhinoHead(c,x,y,f.action); break;
  }
  if (f.action === 'hurt' || f.action === 'ko') {
    const eye: Record<FighterId, Point> = {leo:[4,-2],koba:[4,-2],raya:[4,-2],bao:[6,-2],nilo:[5,-6],ruk:[5,-4]};
    const q=eye[f.id]; rect(c,ink,x+q[0]-1,y+q[1],4,1);
    if (f.id === 'bao') rect(c,ink,x-7,y-2,4,1);
  }
}
const ENERGY: Record<FighterId, [string,string,string]> = {
  leo: ['#aa623b','#f4ad56','#fff1bd'],
  koba: ['#415f9c','#80bcdf','#e2f5eb'],
  raya: ['#bb503e','#ffa260','#fff0b6'],
  bao: ['#34795d','#78d7a3','#e3ffd4'],
  nilo: ['#345e59','#93bc72','#e6ecb8'],
  ruk: ['#705198','#b798e1','#f0dfed'],
};
function drawAttackEnergy(c: CanvasRenderingContext2D, f: Fighter, p: Pose): void {
  if (f.action !== 'attack' || !f.attack) return;
  const spec=ATTACKS[f.id][f.attack],t=f.attackFrame;
  if (t < spec.startup || t >= spec.startup + spec.active) return;
  const colors=ENERGY[f.id],o=p.offset;
  if (f.attack === 'special1' || f.attack === 'super') {
    for (let i=0;i<3;i++) rect(c,FIGHTERS[f.id].color,-33-i*5,-44+i*8+o,12+(i%2)*7,1);
    if (f.attack === 'special1') {
      if (f.id === 'leo' || f.id === 'raya') {
        for (let i=0;i<3;i++) beam(c,colors[2],[spec.reach-8,-54+i*4],[spec.reach+2,-48+i*4],1);
      } else if (f.id === 'bao') {
        poly(c,colors[1],[[spec.reach-4,-54],[spec.reach+2,-47],[spec.reach,-39],[spec.reach-2,-46]]);
        rect(c,colors[2],spec.reach-1,-47,2,4);
      } else if (f.id === 'ruk') {
        beam(c,colors[1],[37,-57+o],[spec.reach,-56+o],2); rect(c,colors[2],spec.reach-3,-58+o,4,2);
      }
    }
    if (f.attack === 'super') {
      if (f.id === 'leo' || f.id === 'raya') {
        for (let i=0;i<3;i++) {
          const sy=-62+i*9+round(Math.sin(t/3)*2);
          poly(c,colors[1],[[35,sy+9],[52,sy+4],[spec.reach-4,sy-2],[spec.reach-14,sy+4],[51,sy+8]]);
          poly(c,colors[2],[[43,sy+8],[57,sy+3],[spec.reach-4,sy-2],[spec.reach-12,sy+2],[54,sy+7]]);
        }
      } else if (f.id === 'bao') {
        const tip=spec.reach-6;
        for (let i=0;i<6;i++) {
          const angle=t*.14+i*Math.PI/3, y=-47+Math.sin(angle)*18, x=49+Math.cos(angle)*18;
          poly(c,colors[1],[[x,y-6],[x+8,y-3],[Math.min(tip,x+17),y],[x+4,y+3],[x-2,y+5]]);
          beam(c,colors[2],[x+1,y-2],[Math.min(tip,x+11),y],1);
        }
        rect(c,colors[2],tip,-48,3,4);
      } else if (f.id === 'nilo') {
        const tip=spec.reach-6;
        beam(c,colors[1],[23,-24+o],[tip,-37+o],3);
        beam(c,colors[2],[32,-25+o],[tip,-35+o],1);
        for (let i=0;i<4;i++) rect(c,'#c5e9d8',35+i*9,-19+o-i*4,3,1);
      } else if (f.id === 'ruk') {
        const tip=spec.reach-5;
        for (let i=0;i<3;i++) {
          const yy=-57+o+i*10;
          poly(c,colors[1],[[29,yy],[49,yy-3],[45,yy+1],[tip,yy-2],[tip-8,yy+3],[52,yy+4],[55,yy+1]]);
          beam(c,colors[2],[37,yy],[tip-4,yy],1);
        }
      } else {
        const tip=spec.reach-7;
        poly(c,colors[1],[[28,-53],[tip-9,-59],[tip+3,-48],[tip-4,-36],[31,-34],[45,-42]]);
        poly(c,colors[2],[[40,-49],[tip-10,-55],[tip,-48],[tip-7,-40],[40,-39],[50,-44]]);
        rect(c,'#fff9dc',tip-6,-48,6,3);
      }
    }
  }
  if (f.attack === 'special2' && spec.projectile === 'roar') {
    if (f.id === 'bao') {
      oval(c,colors[0],p.hand[0]+5,p.hand[1],6,8); oval(c,colors[1],p.hand[0]+6,p.hand[1],3,6);
      rect(c,colors[2],p.hand[0]+5,p.hand[1]-3,2,5);
    } else {
      rect(c,colors[2],p.headX+16,SPRITES[f.id].headY+4+o,5,1);
      rect(c,colors[1],p.headX+18,SPRITES[f.id].headY+1+o,5,1);
    }
  }
}

export function drawFighter(c: CanvasRenderingContext2D, f: Fighter, frame: number): void {
  const style=SPRITES[f.id],air=Math.max(0,FLOOR-f.y);
  c.save(); c.globalAlpha=.32;
  oval(c,'#121e28',round(f.x),FLOOR+1,Math.max(9,24+style.bulk-air*.07),4); c.restore();
  c.save(); c.translate(round(f.x),round(f.y)); c.scale(f.facing,1);
  if (f.action === 'ko') { c.translate(-29,-13); c.rotate(Math.PI/2); }
  const p=poseFor(f,frame),o=p.offset,tx=p.torsoX;
  drawTail(c,f,p,frame);
  limb(c,p.rearShoulder,p.rearElbow,p.rearHand,style.arm-1,style.rear,f.id !== 'bao');
  textureLimb(c,f.id,p.rearShoulder,p.rearElbow,p.rearHand,style.arm-1,true);
  paw(c,f,p.rearHand,true);
  // Legs and boots occupy the same contacts throughout walk, jump and kick frames.
  const rearHip: Point=[tx-6,-28+o],frontHip: Point=[tx+7,-28+o];
  limb(c,rearHip,p.rearKnee,p.rearFoot,style.leg-1,style.legs,false);
  textureLimb(c,f.id,rearHip,p.rearKnee,p.rearFoot,style.leg-1,true); foot(c,p.rearFoot,f.id,true);
  limb(c,frontHip,p.knee,p.foot,style.leg,style.legs,false);
  textureLimb(c,f.id,frontHip,p.knee,p.foot,style.leg,false); foot(c,p.foot,f.id,false);
  drawTorso(c,f,p,frame);
  limb(c,p.shoulder,p.elbow,p.hand,style.arm,style.fur,f.id !== 'bao');
  textureLimb(c,f.id,p.shoulder,p.elbow,p.hand,style.arm,false); paw(c,f,p.hand,false);
  // Neck pixels sit behind the jaw, so heads remain attached while leaning into a hit.
  if (f.id === 'nilo') { beam(c,ink,[tx+5,-51+o],[p.headX,style.headY+8+o],9); beam(c,'#86a758',[tx+5,-51+o],[p.headX,style.headY+8+o],7); }
  drawHead(c,f,p.headX,style.headY+o);
  drawAttackEnergy(c,f,p);
  c.restore();
}

export function drawEffects(c: CanvasRenderingContext2D, state: GameState, frame: number): void {
  for (const p of state.projectiles) {
    const facing=p.vx>=0?1:-1,id=state.fighters[p.owner].id,colors=ENERGY[id];
    c.save(); c.translate(round(p.x),round(p.y)); c.scale(facing,1);
    if (p.kind === 'roar') {
      if (id === 'bao') {
        // Jade leaves spiral through the palm's wave instead of a recolored roar.
        for (let i=0;i<4;i++) {
          const yy=Math.sin(frame*.2+i*1.6)*8,xx=8-i*7;
          poly(c,colors[1],[[xx-5,yy],[xx+3,yy-4],[xx+8,yy],[xx+1,yy+4]]);
          beam(c,colors[2],[xx-2,yy],[xx+5,yy],1);
        }
        rect(c,'#e4ffd6',8,-3,3,6);
      } else {
        for (let i=0;i<4;i++) {
          const x=-i*6;
          poly(c,[colors[0],colors[1],FIGHTERS[id].color,colors[2]][i],[[x+7,-10+i],[x+13,-5],[x+15,0],[x+13,5],[x+7,10-i],[x+5,7-i],[x+9,0],[x+5,-7+i]]);
        }
        rect(c,colors[2],10,-3,4,6); rect(c,colors[1],-22,-5,14,1); rect(c,colors[1],-18,4,10,1);
        if (id === 'raya') {
          for (let i=0;i<3;i++) poly(c,colors[2],[[-14-i*5,-7+i*6],[-4-i*5,-4+i*6],[-14-i*5,-2+i*6]]);
        }
      }
    } else if (id === 'nilo') {
      // Nilo's low wave has a hooked water crest and scattered white spray.
      poly(c,'#3d777d',[[-21,0],[-12,-8],[-2,-14],[8,-15],[14,-10],[11,-4],[5,-8],[0,-3],[15,0]]);
      poly(c,'#96c8b2',[[-14,0],[-6,-9],[3,-12],[10,-10],[8,-7],[3,-9],[-1,-3],[9,0]]);
      beam(c,'#e1f5d5',[-5,-9],[6,-12],2); rect(c,'#f0f4d4',9,-13,2,2);
      rect(c,'#b2ddd0',-19,1,34,2); rect(c,'#e7e9b9',-12,3,24,1);
    } else {
      poly(c,colors[0],[[-15,0],[-6,-10],[-2,-4],[4,-20],[9,-8],[14,-13],[16,0]]);
      poly(c,colors[1],[[-8,0],[-4,-6],[3,-15],[7,-5],[11,-9],[13,0]]);
      poly(c,colors[2],[[0,0],[3,-11],[6,-3],[9,-6],[10,0]]);
      rect(c,FIGHTERS[id].color,-23,1,39,2); rect(c,'#ecdfb9',-13,3,27,1);
      if (id === 'ruk') { beam(c,colors[2],[-11,-2],[-6,-12],1); beam(c,colors[2],[-6,-12],[-3,-8],1); }
    }
    c.restore();
  }
  for (const e of state.effects) {
    const age=e.maxLife-e.life,progress=age/e.maxLife,x=round(e.x),y=round(e.y);
    c.save(); c.globalAlpha=Math.max(0,1-progress*.85);
    if (e.kind === 'dust') {
      for (let i=0;i<5;i++) {
        const dx=(i-2)*(4+age*.3),dy=-Math.sin(i+1)*age*.25;
        oval(c,i%2?'#d6c3a0':'#a6947d',x+dx,y+dy,Math.max(1,4-progress*3),Math.max(1,2-progress));
      }
    } else {
      const block=e.kind==='block',superMove=e.kind==='super',special=e.kind==='special';
      const owner=state.fighters.find(f => f.facing === e.facing && f.action === 'attack') ?? state.fighters[0];
      const palette=ENERGY[owner.id],r=(superMove?20:block?10:14)+age*.6;
      const dark=block?'#7292cb':superMove||special?palette[1]:'#e68741';
      const light=block?'#b5e5fa':superMove||special?palette[2]:'#ffe4a0';
      for (let i=0;i<8;i++) {
        const angle=i*Math.PI/4+frame*.025,dx=Math.cos(angle),dy=Math.sin(angle);
        beam(c,dark,[x+dx*(r*.2),y+dy*(r*.2)],[x+dx*r,y+dy*r],i%2?2:3);
        beam(c,light,[x+dx*(r*.25),y+dy*(r*.25)],[x+dx*(r*.8),y+dy*(r*.8)],1);
      }
      if (age<4) poly(c,'#fff8d7',[[x-3,y-3],[x,y-9],[x+3,y-3],[x+9,y],[x+3,y+3],[x,y+8],[x-3,y+3],[x-8,y]]);
      for (let i=0;i<4;i++) {
        const dx=(i%2?1:-1)*(6+age),dy=(i<2?-1:1)*(4+age*.7); rect(c,light,x+dx,y+dy,2,2);
      }
    }
    c.restore();
  }
}
