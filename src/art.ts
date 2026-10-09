import { FLOOR, type Fighter, type GameState } from './types';
import { ATTACKS } from './combat';

// Everything is painted on the game's native 384 × 224 pixel grid.
// Scanline primitives keep edges crisp even for articulated sprite pieces.
type Point = [number, number];
const ink = '#141425';
const round = Math.round;
let arenaImage: HTMLImageElement | null = null;
export function setArenaImage(image: HTMLImageElement): void { arenaImage = image; }
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

export function drawArena(c: CanvasRenderingContext2D, frame: number): void {
  c.imageSmoothingEnabled = false;
  if (arenaImage) {
    c.drawImage(arenaImage,0,0,384,224);
    // Tiny, slow fireflies animate the generated setting without repainting its stone floor.
    for (let i=0;i<5;i++) {
      const x=round(24+i*79+Math.sin(frame/95+i*2)*7), y=round(127+Math.sin(frame/76+i)*12);
      const alpha=(Math.sin(frame/31+i*3)+1)*.2;
      c.save();c.globalAlpha=alpha;rect(c,'#ffdb82',x,y,1,1);c.restore();
    }
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

interface Pose { shoulder: Point; rearShoulder: Point; elbow: Point; hand: Point; rearElbow: Point; rearHand: Point; hip: Point; knee: Point; foot: Point; rearKnee: Point; rearFoot: Point; torsoX: number; headX: number; offset: number; }
function poseFor(f: Fighter, frame: number): Pose {
  const gorilla=f.id==='koba', bounce=f.grounded && (f.action==='idle'||f.action==='walk') ? round(Math.sin(frame/9)*1) : 0;
  const crouch=f.action==='crouch', hurt=f.action==='hurt', walk=f.action==='walk';
  const o=(crouch?17:0)+bounce, tx=hurt?-5:0;
  const p:Pose={shoulder:[tx+8,-48+o],rearShoulder:[tx-9,-47+o],elbow:[tx+16,-39+o],hand:[tx+18,-51+o],rearElbow:[tx-16,-36+o],rearHand:[tx-9,-44+o],hip:[tx,-29+o],knee:[12,-16],foot:[18,-3],rearKnee:[-13,-16],rearFoot:[-19,-3],torsoX:tx,headX:tx+2,offset:o};
  if(gorilla) {p.shoulder=[tx+12,-47+o];p.rearShoulder=[tx-14,-46+o];p.elbow=[tx+23,-31+o];p.hand=[tx+25,-40+o];p.rearElbow=[tx-25,-28+o];p.rearHand=[tx-24,-38+o];p.headX=tx+5;}
  if(walk) {const a=Math.sin(frame/6),b=Math.cos(frame/6);p.knee=[5+a*11,-15];p.foot=[8+a*20,-3-Math.max(0,b)*4];p.rearKnee=[-6-a*10,-15];p.rearFoot=[-8-a*20,-3-Math.max(0,-b)*4];p.hand[1]+=a*3;p.rearHand[1]-=a*3;}
  if(crouch) {p.knee=[19,-9];p.foot=[22,-3];p.rearKnee=[-15,-8];p.rearFoot=[-18,-3];}
  if(!f.grounded){p.knee=[12,-13];p.foot=[15,-11];p.rearKnee=[-10,-17];p.rearFoot=[-16,-13];p.hand=[19,-55];}
  if(f.action==='block'){p.elbow=[14,-41+o];p.hand=[13,-62+o];p.rearElbow=[9,-40+o];p.rearHand=[19,-54+o];p.headX-=3;}
  if(hurt){p.elbow=[14,-35];p.hand=[23,-43];p.rearElbow=[-18,-34];p.rearHand=[-28,-45];p.headX-=7;}
  if(f.action==='win'){p.elbow=[15,-61];p.hand=[18,-79];p.rearElbow=[-17,-60];p.rearHand=[-20,-78];}
  if(f.action==='attack') {
    const t=f.attackFrame, spec=ATTACKS[f.id][f.attack ?? 'lp'];
    const extend=t<spec.startup ? Math.max(0,(t-1)/Math.max(1,spec.startup-1)) : t<spec.startup+spec.active ? 1 : Math.max(0,1-(t-spec.startup-spec.active)/Math.min(12,spec.recovery));
    const punch=f.attack==='lp'||f.attack==='mp'||f.attack==='hp',kick=f.attack==='lk'||f.attack==='mk'||f.attack==='hk';
    if(punch) {p.torsoX+=extend*4;p.headX+=extend*3;p.elbow=[16+extend*11,-45+o];p.hand=[19+extend*(spec.reach-19),-49+o];p.rearHand=[-2,-49+o];}
    if(kick){p.knee=[12+extend*15,-16-extend*16];p.foot=[18+extend*(spec.reach-18),-3-extend*(f.attack==='hk'?43:29)];p.hand=[19,-55];p.torsoX-=extend*3;p.headX-=extend*4;}
    if(f.attack==='special1') {p.elbow=[26,-43];p.hand=[44,-47];p.rearElbow=[-20,-39];p.rearHand=[-27,-45];p.headX+=5;p.knee=[19,-14];p.foot=[30,-3];}
    if(f.attack==='special2') {
      if(gorilla){
        // Wind both hands above the head, then strike the paving on the active frame.
        const slam=t<spec.startup?0:t<spec.startup+spec.active+5?1:Math.max(0,1-(t-spec.startup-spec.active-5)/14);
        p.elbow=[19,-61+slam*39];p.hand=[23,-77+slam*67];p.rearElbow=[7,-61+slam*39];p.rearHand=[15,-77+slam*67];p.offset+=slam*8;
      }else{p.elbow=[20,-38];p.hand=[30,-33];p.rearElbow=[-16,-36];p.rearHand=[-23,-33];p.headX+=5*extend;}
    }
    if(f.attack==='super'){const wave=Math.sin(t/2.6);p.elbow=[21,-43-wave*8];p.hand=[35+wave*8,-48-wave*17];p.rearElbow=[-14,-38];p.rearHand=[10-wave*8,-51+wave*7];p.headX+=4;}
  }
  return p;
}
function limb(c:CanvasRenderingContext2D,a:Point,b:Point,d:Point,width:number,colors:string[],wrap:boolean):void{
  beam(c,ink,a,b,width+2);beam(c,ink,b,d,width+2);
  beam(c,colors[0],a,b,width);beam(c,colors[0],b,d,width);
  beam(c,colors[1],[a[0]-1,a[1]-1],[b[0]-1,b[1]-2],width-3);
  beam(c,colors[1],[b[0]-1,b[1]-2],[d[0]-1,d[1]-2],width-3);
  beam(c,colors[2],[a[0]-2,a[1]-2],[b[0]-2,b[1]-3],Math.max(2,width-6));
  if(wrap){const wx=d[0]*.78+b[0]*.22,wy=d[1]*.78+b[1]*.22;beam(c,colors[3],[wx,wy],[d[0],d[1]],width+1);beam(c,colors[4],[wx-2,wy-2],[d[0]-2,d[1]-2],width-3);rect(c,ink,d[0]-3,d[1]+3,6,1);}
}
function foot(c:CanvasRenderingContext2D,p:Point,lion:boolean,rear:boolean):void{
  const x=p[0],y=p[1];
  poly(c,ink,[[x-6,y-4],[x+3,y-5],[x+10,y],[x+9,y+3],[x-7,y+3]]);
  poly(c,rear?(lion?'#957043':'#343b50'):(lion?'#d1a364':'#65748a'),[[x-5,y-3],[x+2,y-4],[x+8,y],[x+7,y+2],[x-5,y+2]]);
  rect(c,lion?'#ead092':'#97a0aa',x,y-2,5,1);rect(c,lion?'#675037':'#35344a',x+3,y+1,1,1);rect(c,lion?'#675037':'#35344a',x+6,y+1,1,1);
}
function lionHead(c:CanvasRenderingContext2D,x:number,y:number,action:Fighter['action']):void{
  // Jagged mane silhouette, separated curls and a forward-projecting muzzle.
  poly(c,ink,[[x-9,y-12],[x-6,y-14],[x-3,y-12],[x+3,y-13],[x+7,y-10],[x+10,y-6],[x+9,y+3],[x+7,y+9],[x+2,y+13],[x-2,y+9],[x-8,y+10],[x-11,y+5],[x-14,y+6],[x-12,y-1],[x-14,y-5],[x-10,y-5]]);
  poly(c,'#80502e',[[x-9,y-10],[x-5,y-12],[x+2,y-11],[x+6,y-8],[x+8,y-4],[x+7,y+3],[x+5,y+9],[x+1,y+10],[x-2,y+6],[x-7,y+8],[x-9,y+3],[x-11,y+3],[x-10,y-2],[x-11,y-5],[x-8,y-5]]);
  poly(c,'#b77638',[[x-8,y-9],[x-3,y-11],[x+3,y-10],[x+5,y-7],[x+1,y-5],[x-2,y-3],[x-3,y+4],[x-6,y+5],[x-8,y+2],[x-9,y-2]]);
  rect(c,'#e0aa52',x-5,y-10,3,2);rect(c,'#d09240',x-8,y-6,2,4);rect(c,'#c4893c',x-6,y+1,2,4);rect(c,'#d79f47',x+1,y+6,2,3);
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

export function drawFighter(c:CanvasRenderingContext2D,f:Fighter,frame:number):void{
  const lion=f.id==='leo', air=Math.max(0,FLOOR-f.y);
  c.save();c.globalAlpha=.3;oval(c,'#121e28',round(f.x),FLOOR+1,Math.max(9,24-air*.07),4);c.restore();
  c.save();c.translate(round(f.x),round(f.y));c.scale(f.facing,1);
  if(f.action==='ko') {
    oval(c,ink,0,-5,33,7);oval(c,lion?'#9a6839':'#454659',0,-6,31,6);
    rect(c,lion?'#37725a':'#68768d',-16,-10,24,8);rect(c,lion?'#ac814c':'#4c536b',8,-8,18,7);
    if(lion)lionHead(c,-23,-10,'ko');else gorillaHead(c,-23,-9,'ko');
    rect(c,lion?'#e2b67c':'#9fa9b8',21,-6,9,3);c.restore();return;
  }
  const p=poseFor(f,frame),o=p.offset,tx=p.torsoX;
  const fur=lion?['#a76f3a','#d3a061','#f0c682','#d4c6ac','#f3e6c7']:['#41465e','#68748b','#96a0ac','#943d4d','#d06866'];
  const rear=lion?['#815932','#aa7c44','#ca9c59','#9a927f','#c4bba4']:['#303447','#505b73','#728095','#743346','#ac535b'];
  // Tail sits behind the lion's rear leg.
  if(lion){const sway=round(Math.sin(frame/13)*3);beam(c,ink,[-9,-32+o],[-29,-18+o],4);beam(c,'#b88242',[-9,-32+o],[-29,-18+o],2);beam(c,ink,[-29,-18+o],[-35,-26+o+sway],4);beam(c,'#c49857',[-29,-18+o],[-35,-26+o+sway],2);oval(c,'#80552f',-35,-28+o+sway,3,5);rect(c,'#d49b48',-36,-30+o+sway,1,3);}
  limb(c,p.rearShoulder,p.rearElbow,p.rearHand,lion?8:13,rear,true);
  // Legs are painted back-to-front, so a lifted kick reads clearly.
  const pants=lion?['#235344','#43846b','#74aa86','#c6bca0','#e5dec2']:['#3f435a','#5a657c','#818fa0','#903b4b','#c85a60'];
  limb(c,[tx-6,-28+o],p.rearKnee,p.rearFoot,lion?10:12,pants,false);foot(c,p.rearFoot,lion,true);
  limb(c,[tx+7,-28+o],p.knee,p.foot,lion?12:13,pants,false);foot(c,p.foot,lion,false);
  if(lion){
    poly(c,ink,[[tx-10,-52+o],[tx+8,-54+o],[tx+15,-44+o],[tx+11,-29+o],[tx-11,-28+o],[tx-15,-42+o]]);
    poly(c,'#a97841',[[tx-9,-50+o],[tx+7,-52+o],[tx+13,-43+o],[tx+9,-30+o],[tx-10,-30+o],[tx-13,-42+o]]);
    poly(c,'#dbaa66',[[tx-8,-49+o],[tx+5,-50+o],[tx+10,-43+o],[tx+6,-34+o],[tx-4,-31+o],[tx-10,-40+o]]);
    poly(c,'#f2ce8d',[[tx-7,-48+o],[tx-1,-48+o],[tx+2,-44+o],[tx-1,-38+o],[tx-6,-39+o],[tx-9,-43+o]]);
    rect(c,'#9b703e',tx+1,-42+o,1,9);rect(c,'#b58446',tx-6,-37+o,11,1);rect(c,'#cfa15b',tx-3,-34+o,7,2);
    poly(c,ink,[[tx-12,-31+o],[tx+12,-31+o],[tx+15,-22+o],[tx+2,-19+o],[tx-3,-22+o],[tx-13,-22+o]]);
    poly(c,'#387761',[[tx-11,-29+o],[tx+10,-29+o],[tx+13,-23+o],[tx+2,-21+o],[tx-3,-24+o],[tx-12,-23+o]]);
    rect(c,'#a2c299',tx-9,-29+o,20,2);rect(c,'#ded3ab',tx-10,-30+o,22,2);rect(c,'#8c8765',tx,-29+o,4,3);
    rect(c,'#83ae87',tx-9,-26+o,5,2);rect(c,'#1d4c40',tx+7,-26+o,4,4);
  }else{
    poly(c,ink,[[tx-17,-51+o],[tx-10,-57+o],[tx+5,-57+o],[tx+16,-50+o],[tx+20,-43+o],[tx+14,-30+o],[tx+10,-23+o],[tx-10,-24+o],[tx-16,-35+o],[tx-20,-43+o]]);
    poly(c,'#4c516b',[[tx-16,-49+o],[tx-9,-55+o],[tx+5,-55+o],[tx+15,-49+o],[tx+18,-43+o],[tx+12,-31+o],[tx+8,-25+o],[tx-8,-26+o],[tx-14,-35+o],[tx-18,-43+o]]);
    poly(c,'#768397',[[tx-14,-49+o],[tx-8,-53+o],[tx+3,-53+o],[tx+12,-48+o],[tx+15,-43+o],[tx+9,-37+o],[tx-1,-37+o],[tx-10,-38+o],[tx-15,-43+o]]);
    poly(c,'#a0aab2',[[tx-12,-47+o],[tx-6,-50+o],[tx-1,-48+o],[tx-2,-41+o],[tx-10,-40+o],[tx-13,-43+o]]);
    poly(c,'#8c96a6',[[tx+1,-49+o],[tx+9,-47+o],[tx+12,-44+o],[tx+7,-40+o],[tx+1,-41+o]]);
    rect(c,'#393c53',tx-1,-49+o,2,13);poly(c,'#657187',[[tx-6,-36+o],[tx+8,-36+o],[tx+8,-29+o],[tx+3,-27+o],[tx-5,-29+o]]);
    rect(c,'#8994a2',tx-4,-34+o,4,3);rect(c,'#85909e',tx+2,-34+o,4,3);rect(c,'#3e435b',tx,-34+o,1,7);
    rect(c,ink,tx-12,-28+o,24,5);rect(c,'#a64b56',tx-11,-27+o,23,3);rect(c,'#e88479',tx-9,-27+o,18,1);
    poly(c,'#c45a5d',[[tx+6,-26+o],[tx+11,-26+o],[tx+16,-13+o],[tx+11,-14+o]]);rect(c,'#f18a77',tx+10,-23+o,1,7);
    // Small fur breaks keep the shoulders from reading as smooth plastic.
    for(const q of [[-16,-46],[-14,-51],[12,-48],[15,-43],[-8,-53]] as Point[])rect(c,'#a0a9b4',tx+q[0],q[1]+o,2,1);
  }
  limb(c,p.shoulder,p.elbow,p.hand,lion?9:14,fur,true);
  // Closed fist has knuckle clusters and an outlined thumb.
  oval(c,ink,p.hand[0]+1,p.hand[1],lion?5:7,lion?5:7);oval(c,fur[1],p.hand[0]+1,p.hand[1]-1,lion?4:6,lion?4:6);
  rect(c,fur[2],p.hand[0]-1,p.hand[1]-4,lion?4:6,2);rect(c,fur[0],p.hand[0]+3,p.hand[1]-1,2,4);
  rect(c,ink,p.hand[0],p.hand[1]+2,3,1);
  if(lion)lionHead(c,p.headX,-59+o,f.action);else gorillaHead(c,p.headX,-60+o,f.action);
  // Special attacks add bright speed accents without concealing the sprite.
  if(f.action==='attack'&&(f.attack==='special1'||f.attack==='super')){
    const energy=lion?'#ffe0a1':'#a9d8ff';
    const t=f.attackFrame;
    const spec=ATTACKS[f.id][f.attack];
    if(t>=spec.startup&&t<spec.startup+spec.active){
      for(let i=0;i<3;i++)rect(c,energy,-32-i*5,-44+i*8+o,12+(i%2)*7,1);
      if(f.attack==='super'){
        // Visible energy reaches the same distance as the super's collision range.
        if(lion){
          for(let i=0;i<3;i++){
            const sy=-62+i*9+round(Math.sin(t/3)*2);
            poly(c,'#f1a954',[[35,sy+9],[52,sy+4],[spec.reach-4,sy-2],[spec.reach-14,sy+4],[51,sy+8]]);
            poly(c,'#fff0bb',[[43,sy+8],[57,sy+3],[spec.reach-4,sy-2],[spec.reach-12,sy+2],[54,sy+7]]);
          }
        }else{
          const tip=spec.reach-7;
          poly(c,'#699eda',[[28,-53],[tip-9,-59],[tip+3,-48],[tip-4,-36],[31,-34],[45,-42]]);
          poly(c,'#b6e7f1',[[40,-49],[tip-10,-55],[tip,-48],[tip-7,-40],[40,-39],[50,-44]]);
          rect(c,'#f3f6dc',tip-6,-48,6,3);
        }
      }
    }
  }
  c.restore();
}

export function drawEffects(c:CanvasRenderingContext2D,state:GameState,frame:number):void{
  for(const p of state.projectiles){
    const facing=p.vx>=0?1:-1;c.save();c.translate(round(p.x),round(p.y));c.scale(facing,1);
    if(p.kind==='roar'){
      for(let i=0;i<4;i++){const x=-i*6;poly(c,['#95613d','#da8844','#f3c76d','#ffe9af'][i],[[x+7,-10+i],[x+13,-5],[x+15,0],[x+13,5],[x+7,10-i],[x+5,7-i],[x+9,0],[x+5,-7+i]]);}
      rect(c,'#fff0bd',10,-3,4,6);rect(c,'#ffc362',-22,-5,14,1);rect(c,'#eaa14d',-18,4,10,1);
    }else{
      poly(c,'#637bcd',[[-15,0],[-6,-10],[-2,-4],[4,-20],[9,-8],[14,-13],[16,0]]);
      poly(c,'#99bfec',[[-8,0],[-4,-6],[3,-15],[7,-5],[11,-9],[13,0]]);
      poly(c,'#e0f5ee',[[0,0],[3,-11],[6,-3],[9,-6],[10,0]]);
      rect(c,'#b4cbdf',-23,1,39,2);rect(c,'#ecdfb9',-13,3,27,1);
    }c.restore();
  }
  for(const e of state.effects){
    const age=e.maxLife-e.life,progress=age/e.maxLife,x=round(e.x),y=round(e.y);
    c.save();c.globalAlpha=Math.max(0,1-progress*.85);
    if(e.kind==='dust'){
      for(let i=0;i<5;i++){const dx=(i-2)*(4+age*.3),dy=-Math.sin(i+1)*age*.25;oval(c,i%2?'#d6c3a0':'#a6947d',x+dx,y+dy,Math.max(1,4-progress*3),Math.max(1,2-progress));}
    }else{
      const block=e.kind==='block',superMove=e.kind==='super';const r=(superMove?20:block?10:14)+age*.6;
      const dark=block?'#7292cb':superMove?'#da779e':'#e68741',light=block?'#b5e5fa':superMove?'#ffd4e2':'#ffe4a0';
      for(let i=0;i<8;i++){
        const angle=i*Math.PI/4+frame*.025, dx=Math.cos(angle),dy=Math.sin(angle);
        beam(c,dark,[x+dx*(r*.2),y+dy*(r*.2)],[x+dx*r,y+dy*r],i%2?2:3);
        beam(c,light,[x+dx*(r*.25),y+dy*(r*.25)],[x+dx*(r*.8),y+dy*(r*.8)],1);
      }
      if(age<4){poly(c,'#fff8d7',[[x-3,y-3],[x,y-9],[x+3,y-3],[x+9,y],[x+3,y+3],[x,y+8],[x-3,y+3],[x-8,y]]);}
      for(let i=0;i<4;i++){const dx=(i%2?1:-1)*(6+age),dy=(i<2?-1:1)*(4+age*.7);rect(c,light,x+dx,y+dy,2,2);}
    }c.restore();
  }
}
