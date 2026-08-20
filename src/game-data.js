export const PARTS = [
  'Rocket','Drill','Soccer','Durian','Lightning','Boomerang',
  'Drone','Forcefield','Laser','Shield','Molotov','Brick'
];

// Internal field names are kept compatible with the original optimizer engine.
// UI terminology: Y = Epic, R = Legend, Rainbow = Eternal.
export const FIELDS = ['P0','P1','P2','Y0','Y1','Y2','Y3','R0','R1','R2','R3','R4','Rainbow'];
export const ENERGY = {Y0:50,Y1:100,Y2:150,Y3:200,R0:300,R1:400,R2:550,R3:700,R4:850,Rainbow:1000};
export const TIE_LEVELS = ['Rainbow','R4','R3','R2','R1','R0','Y3','Y2','Y1','Y0','P2','P1','P0'];
export const RED_LEVELS = ['Rainbow','R4','R3','R2','R1','R0'];
export const SUPPORT_LEVELS = ['Rainbow','R4','R3','R2','R1','R0','Y3','Y2','Y1','Y0'];

export const PAIRS = [
  ['Rocket','Drill'],
  ['Soccer','Durian'],
  ['Lightning','Boomerang'],
  ['Drone','Forcefield'],
  ['Laser','Shield'],
  ['Molotov','Brick'],
];

export const PAIR_NAMES = {
  'Rocket|Drill':'Rocket Twinborn',
  'Soccer|Durian':'Soccer Twinborn',
  'Lightning|Boomerang':'Lightning Twinborn',
  'Drone|Forcefield':'Drone Twinborn',
  'Laser|Shield':'Laser Twinborn',
  'Molotov|Brick':'Molotov Twinborn',
};

export function pairKey(pair){ return pair.join('|'); }
export function pairLabel(pair){ return `${PAIR_NAMES[pairKey(pair)] || pair.join(' + ')} (${pair[0]} + ${pair[1]})`; }

export function levelName(level){
  if(level === 'Rainbow') return 'Eternal';
  if(level.startsWith('R')) return `Legend ${level.slice(1)}`;
  if(level.startsWith('Y')) return `Epic ${level.slice(1)}`;
  if(level.startsWith('P')) return `Purple ${level.slice(1)}`;
  return level;
}

export function rarityLevelToField(rarity, level){
  if(rarity === 'Purple') return `P${level}`;
  if(rarity === 'Epic') return `Y${level}`;
  if(rarity === 'Legend') return `R${level}`;
  if(rarity === 'Eternal') return 'Rainbow';
  return null;
}

export function fieldToRarityLevel(field){
  if(field === 'Rainbow') return {rarity:'Eternal', level:0};
  if(field.startsWith('P')) return {rarity:'Purple', level:Number(field.slice(1))};
  if(field.startsWith('Y')) return {rarity:'Epic', level:Number(field.slice(1))};
  if(field.startsWith('R')) return {rarity:'Legend', level:Number(field.slice(1))};
  return null;
}

export function blankInventory(){
  const inv = {};
  for(const p of PARTS){
    inv[p] = {};
    for(const f of FIELDS) inv[p][f] = 0;
  }
  return inv;
}

export function cloneInventory(inv){
  const out = blankInventory();
  for(const p of PARTS) for(const f of FIELDS) out[p][f] = Number(inv?.[p]?.[f] || 0);
  return out;
}

export function screenshotPreset(){
  const v = blankInventory();
  for(const p of ['Rocket','Forcefield','Drill','Lightning','Drone','Laser']) v[p].R4++;
  for(const p of ['Shield','Brick','Boomerang','Durian','Soccer','Molotov']) v[p].R3++;
  v.Drone.R0++;
  v.Shield.Y3++;
  for(const p of ['Drill','Drone']) v[p].Y3++;
  for(const p of ['Forcefield','Shield','Durian','Soccer','Drone','Molotov']) v[p].Y2++;
  for(const p of ['Rocket','Brick','Boomerang','Durian','Lightning','Soccer','Forcefield']) v[p].Y1++;
  for(const p of ['Drill','Lightning','Drone','Laser']) v[p].Y0++;
  v.Rocket.P2++;
  for(const p of ['Forcefield','Drill','Drone','Laser']) v[p].P2++;
  for(const p of ['Rocket','Forcefield','Shield','Boomerang','Durian','Drill','Lightning','Soccer','Drone','Laser','Molotov']) v[p].P1++;
  for(const p of ['Forcefield','Drill','Soccer','Drone','Laser']) v[p].P0++;
  return v;
}

export function defaultTwinbornOwned(){
  return Object.fromEntries(PAIRS.map(pair => [pairKey(pair), true]));
}

export function emptyTargets(){ return Object.fromEntries(PARTS.map(p => [p, true])); }
