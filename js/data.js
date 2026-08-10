/* =========================================================================
   BOW & BATTALION — data.js
   world constants · icons · unit roster · enemy roster · arrows · abilities
   tech tree · armory grades · hero · level scaling · biomes
   ========================================================================= */
'use strict';

const W = 1600, H = 900;            // virtual resolution
const GROUND = 742;                  // battlefield floor
const MY_GATE = 268;                 // where my units walk out
const EN_GATE = 1338;                // where their units walk out
const MY_WALL = 246;                 // enemy melee stops here to hit my castle
const EN_WALL = 1360;                // my melee stops here to hit their castle

/* ============================== ICONS ==============================
   24x24 viewBox inner markup. currentColor everywhere. */
const I = {
  sword:'<path d="M4 20l3-1 10-10 3-5-5 3L5 17l-1 3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M6 18l1.6 1.6" stroke="currentColor" stroke-width="1.6"/>',
  shield:'<path d="M12 3l7 2.6v6c0 4.4-3 7.7-7 9.4-4-1.7-7-5-7-9.4v-6L12 3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 7v9" stroke="currentColor" stroke-width="1.3"/>',
  axe:'<path d="M6 21l8-11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M13 9c2-3 6-5 8-4 1 3-1 7-4 8l-2-1-2-3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  helm:'<path d="M5 11a7 7 0 0114 0v6a3 3 0 01-3 3H8a3 3 0 01-3-3v-6z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 12h6M12 4v3" stroke="currentColor" stroke-width="1.5"/>',
  bow:'<path d="M6 3c7 3 9 12 4 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M6 3l0 18" stroke="currentColor" stroke-width="1.2"/><path d="M4 12h15M15 9l4 3-4 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  musket:'<path d="M3 16l14-9 3 2-14 9-3-2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 15l2 4" stroke="currentColor" stroke-width="1.5"/>',
  mortar:'<path d="M8 20h9l-2-5H10l-2 5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M11 15l4-9 3 1-4 9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  tank:'<path d="M3 18h16a2 2 0 000-4H3a2 2 0 000 4z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 14v-3h9v3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 9h9" stroke="currentColor" stroke-width="1.6"/>',
  htank:'<path d="M2 19h18a2.5 2.5 0 000-5H2a2.5 2.5 0 000 5z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 14v-4h11v4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M11 8h11M20 6.5v3" stroke="currentColor" stroke-width="1.7"/>',
  arty:'<path d="M3 19h9l-2-4H5l-2 4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 15L20 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  mech:'<path d="M9 3h6v6H9z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 9l-4 5 2 7M15 9l4 5-2 7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M15 6h6" stroke="currentColor" stroke-width="1.6"/>',
  arrow:'<path d="M3 21L20 4M20 4h-6M20 4v6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  fire:'<path d="M12 22c4 0 6-2.6 6-6 0-4-4-5-3-10-4 2-4 5-4 6-1-1-1-2-1-3-2 2-4 4-4 7 0 3.4 2 6 6 6z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  split:'<path d="M3 20L18 8M3 20l7-2M18 8l-1-4 4 1-3 3z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M4 15l12-9M4 15l6-1M6 21l12-9" fill="none" stroke="currentColor" stroke-width="1.1" opacity=".65"/>',
  pierce:'<path d="M2 12h18M20 12l-5-4M20 12l-5 4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8 6v12M13 7v10" stroke="currentColor" stroke-width="1.1" opacity=".55"/>',
  bomb:'<circle cx="11" cy="15" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M15 10l3-3M18 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
  bolt:'<path d="M13 2L5 13h5l-2 9 9-12h-5l1-8z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  eye:'<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  tower:'<path d="M6 21V8l3-2 3 2 3-2 3 2v13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M6 12h12M11 21v-5h2v5" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  wrench:'<path d="M20 5a5 5 0 01-7 6L6 18l-2-2 7-7a5 5 0 016-7l-3 3 1 3 3 1 2-3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  horn:'<path d="M4 14c0-5 5-9 11-9l5-1-2 4 2 1-4 2c-1 5-5 8-9 8-2 0-3-2-3-5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  aegis:'<path d="M12 2l8 3v7c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V5l8-3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8.5 12l2.5 2.5L16 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  gate:'<path d="M4 21V9l8-6 8 6v12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 21v-6a3 3 0 016 0v6" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  coin:'<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 7v10M9.5 9.5h4a1.8 1.8 0 010 3.6h-3a1.8 1.8 0 000 3.6h4" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  flask:'<path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 16h10" stroke="currentColor" stroke-width="1.4"/>',
  star:'<path d="M12 2.5l2.7 6.2 6.8.6-5.1 4.4 1.5 6.6L12 16.8 6.1 20.3l1.5-6.6L2.5 9.3l6.8-.6L12 2.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
  napalm:'<path d="M3 20h18" stroke="currentColor" stroke-width="1.6"/><path d="M6 20c0-3 2-4 2-7 2 1 2 3 2 4 1-2 1-4 0-6 3 1 5 4 5 6 0 2-1 3-2 3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M16 20c1-2 3-3 4-2" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  barrage:'<path d="M4 21h16" stroke="currentColor" stroke-width="1.5"/><path d="M7 21l1-6M12 21l0-8M17 21l-1-6" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="9" r="1.6" fill="currentColor"/><circle cx="16" cy="12" r="1.6" fill="currentColor"/>',
  boot:'<path d="M5 4h5v9l6 3v5H5V4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M5 17h11" stroke="currentColor" stroke-width="1.3"/>',
  plate:'<path d="M4 6h16v12H4z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4 10h16M4 14h16M9 6v12M15 6v12" stroke="currentColor" stroke-width="1.1" opacity=".6"/>',
  skull:'<path d="M12 3a8 8 0 00-8 8c0 3 1.6 4.6 2.5 5.4V20h11v-3.6C18.4 15.6 20 14 20 11a8 8 0 00-8-8z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="9" cy="11" r="1.8" fill="currentColor"/><circle cx="15" cy="11" r="1.8" fill="currentColor"/>',
  heart:'<path d="M12 20s-7-4.4-7-9.6C5 7.5 7 6 9 6c1.3 0 2.4.7 3 1.8C12.6 6.7 13.7 6 15 6c2 0 4 1.5 4 4.4C19 15.6 12 20 12 20z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 12h2l1-2 1.5 3 1-1.5h1.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
  flag:'<path d="M6 21V4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M6 5h11l-2.5 3.5L17 12H6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  orb:'<circle cx="12" cy="13" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 4v2M5 6.5l1.4 1.4M19 6.5l-1.4 1.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M9.5 11.5a3 3 0 013-2" fill="none" stroke="currentColor" stroke-width="1.2"/>',
  ram:'<path d="M3 14h15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18 14l3-2v4l-3-2z" fill="currentColor"/><path d="M6 14V9l3 2 3-2 3 2V9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="7" cy="18" r="2" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="14" cy="18" r="2" fill="none" stroke="currentColor" stroke-width="1.4"/>',
};
const svg = (k, cls = '') => `<svg viewBox="0 0 24 24" class="${cls}" fill="none">${I[k] || ''}</svg>`;

/* ============================== BIOMES ============================== */
/* palettes live in art.js PAL, keyed by name */
const BIOMES = [
  { name:'Dusk Plains', w:'ember' },
  { name:'Ashfall',     w:'ash' },
  { name:'Frostline',   w:'snow' },
  { name:'Bloodmoon',   w:'ember' },
  { name:'Stormfront',  w:'rain' },
];

/* ============================== ARROWS ============================== */
/* stance-free hero ammunition. cost = gold per shot (0 = free) */
const ARROWS = [
  { id:'std',   name:'WAR SHAFT', icon:'arrow',  cost:0,  key:'1', unlocked:true,
    desc:'Standard bodkin-tipped shaft. Free, fast, and lethal in the right hands.' },
  { id:'fire',  name:'FIREBRAND', icon:'fire',   cost:6,  key:'2',
    desc:'Pitch-soaked head. Ignites the target AND leaves the ground burning where it lands. Burns friend and foe alike.' },
  { id:'split', name:'SPLIT SHOT',icon:'split',  cost:9,  key:'3',
    desc:'Three shafts loosed in a fan. Each deals 62% damage — devastating up close.' },
  { id:'bodkin',name:'BODKIN',    icon:'pierce', cost:8,  key:'4',
    desc:'Armour-piercing needle. Punches through up to 5 bodies and ignores armour.' },
  { id:'bomb',  name:'FIREPOT',   icon:'bomb',   cost:16, key:'5',
    desc:'Clay bomb lashed to the shaft. Detonates on impact in a wide blast.' },
  { id:'storm', name:'STORMNOCK', icon:'bolt',   cost:22, key:'6',
    desc:'Charged head that arcs lightning between up to 6 nearby enemies.' },
];

/* ============================== PLAYER UNITS ==============================
   stance:  melee  → charge to contact
            ranged → hold behind the melee line, fire from distance
            armor  → advance, but engage at medium range (tanks push)
            siege  → hold near home, lob at long range
*/
const UNITS = [
  { id:'sword',  name:'SWORDSMAN', icon:'sword',  key:'Q', stance:'melee',  pop:1, cost:35,
    hp:120, dmg:11, rate:.72, range:48, spd:44, armor:.05, r:13,
    desc:'Line infantry. Cheap, fast to the front, dies for the banner.' },
  { id:'shield', name:'SHIELDMAN', icon:'shield', key:'W', stance:'melee',  pop:1, cost:60,
    hp:290, dmg:9,  rate:1.0, range:44, spd:33, armor:.35, block:.6, r:14,
    desc:'Tower shield blunts frontal fire by 60%. The wall your archers live behind.' },
  { id:'zerk',   name:'BERSERKER', icon:'axe',    key:'E', stance:'melee',  pop:2, cost:105,
    hp:230, dmg:26, rate:.55, range:50, spd:62, armor:.1, r:14,
    desc:'Sprints the field and hacks through ranks. Glass, but very sharp glass.' },
  { id:'knight', name:'KNIGHT',    icon:'helm',   key:'R', stance:'melee',  pop:3, cost:190,
    hp:640, dmg:34, rate:.85, range:54, spd:38, armor:.5, r:16,
    desc:'Plate-clad shock trooper. Halves incoming damage and does not break.' },

  { id:'archer', name:'ARCHER',    icon:'bow',    key:'A', stance:'ranged', pop:1, cost:45,
    hp:80,  dmg:13, rate:1.05, range:300, spd:40, armor:0, r:12, arc:.18,
    desc:'Holds behind the line and rains shafts over your infantry.' },
  { id:'musket', name:'MUSKETEER', icon:'musket', key:'S', stance:'ranged', pop:1, cost:80,
    hp:95,  dmg:24, rate:1.35, range:360, spd:38, armor:.05, r:12,
    desc:'Flat, fast lead. Slow to reload but hits far harder than a bow.' },
  { id:'crew',   name:'MORTAR CREW',icon:'mortar',key:'D', stance:'ranged', pop:2, cost:150,
    hp:110, dmg:44, rate:2.5, range:470, spd:30, armor:.05, r:13, splash:56, lob:1,
    desc:'Lobs shells over the melee scrum. Splash damage clears packed ranks.' },

  { id:'ltank',  name:'LIGHT TANK',icon:'tank',   key:'F', stance:'armor',  pop:2, cost:210,
    hp:520, dmg:38, rate:1.6, range:330, spd:46, armor:.4, r:18, splash:34, veh:1,
    desc:'Fast tracked gun. Pushes with the melee line and shells what it meets.' },
  { id:'htank',  name:'HEAVY TANK',icon:'htank',  key:'G', stance:'armor',  pop:3, cost:380,
    hp:1150,dmg:72, rate:2.1, range:380, spd:32, armor:.6, r:22, splash:48, veh:1,
    desc:'A moving fortress. Sixty percent damage reduction and a gun to match.' },
  { id:'arty',   name:'ARTILLERY', icon:'arty',   key:'H', stance:'siege',  pop:3, cost:330,
    hp:280, dmg:110,rate:3.6, range:1080, spd:20, armor:.15, r:18, splash:90, lob:1, veh:1,
    desc:'Sits near the gate and drops ruin across the field — even on their castle.' },
  { id:'mech',   name:'RAIL WALKER',icon:'mech',  key:'J', stance:'armor',  pop:4, cost:620,
    hp:1500,dmg:150,rate:3.0, range:620, spd:30, armor:.55, r:26, beam:1, veh:1,
    desc:'Bipedal railgun platform. Its beam pierces every body in the lane.' },

  { id:'medic',  name:'CHIRURGEON', icon:'heart',  key:'K', stance:'support', pop:1, cost:120,
    hp:90,  dmg:0,  rate:1.3, range:180, spd:44, armor:0, r:12, heal:26,
    desc:'Field surgeon. Follows the line and mends the most wounded soul near her. Cannot fight.' },
  { id:'banner', name:'BANNERMAN',  icon:'flag',   key:'L', stance:'support', pop:1, cost:150,
    hp:170, dmg:0,  rate:1,   range:150, spd:46, armor:.1, r:13, aura:.25,
    desc:'Carries the war banner. Every ally near it strikes 25% harder. Kill the banner, break the men.' },
  { id:'pyro',   name:'PYROMANCER', icon:'fire',   key:'U', stance:'ranged',  pop:2, cost:210,
    hp:100, dmg:36, rate:2.3, range:390, spd:34, armor:0, r:12, splash:42, lob:1, fireF:1,
    desc:'Hurls gouts of living flame that burst and leave the ground burning. Area denial in a robe.' },
  { id:'caller', name:'STORMCALLER',icon:'orb',    key:'I', stance:'ranged',  pop:2, cost:270,
    hp:110, dmg:32, rate:2.0, range:350, spd:34, armor:0, r:12, chain:4,
    desc:'Calls lightning that arcs through up to four packed enemies. The counter to conscript floods.' },
  { id:'corsair',name:'SKY CORSAIR',icon:'bolt',   key:'O', stance:'air',     pop:3, cost:390,
    hp:380, dmg:26, rate:.6,  range:270, spd:72, armor:.2, r:16, fly:1,
    desc:'Your own wings. Duels enemy gunships and strafes the ground untouchable by melee.' },
  { id:'ram',    name:'SIEGE RAM',  icon:'ram',    key:'P', stance:'melee',   pop:3, cost:300,
    hp:950, dmg:9,  rate:1.5, range:44, spd:30, armor:.45, r:20, ram:8, veh:1,
    desc:'Nearly useless in a brawl. Utterly monstrous against walls: eight-fold damage to castles.' },
];
const UNIT = {}; UNITS.forEach(u => UNIT[u.id] = u);

/* ============================== ENEMY UNITS ============================== */
const FOES = [
  { id:'grunt',  name:'Grunt',      stance:'melee',  hp:88,  dmg:9,  rate:.8,  range:46, spd:42, armor:0,   r:13, cost:30,  from:1,  w:10, gold:12, xp:6 },
  { id:'runner', name:'Ravager',    stance:'melee',  hp:70,  dmg:14, rate:.5,  range:44, spd:76, armor:0,   r:12, cost:38,  from:2,  w:7,  gold:11, xp:7 },
  { id:'shieldF',name:'Bulwark',    stance:'melee',  hp:280, dmg:9,  rate:1.0, range:44, spd:30, armor:.35, block:.62, r:15, cost:60, from:3, w:7, gold:16, xp:11 },
  { id:'bowF',   name:'Skirmisher', stance:'ranged', hp:85,  dmg:13, rate:1.1, range:290, spd:38, armor:0,  r:12, cost:48, from:2,  w:8,  gold:13, xp:9, arc:.18 },
  { id:'brute',  name:'Brute',      stance:'melee',  hp:560, dmg:38, rate:1.2, range:58, spd:30, armor:.35, r:19, cost:120, from:5, w:6,  gold:30, xp:22 },
  { id:'sapper', name:'Sapper',     stance:'melee',  hp:120, dmg:150,rate:9,   range:40, spd:82, armor:0,   r:13, cost:70,  from:4,  w:5,  gold:20, xp:14, suicide:1 },
  { id:'gunF',   name:'Fusilier',   stance:'ranged', hp:110, dmg:26, rate:1.4, range:355, spd:36, armor:.05,r:12, cost:85,  from:6,  w:7,  gold:22, xp:15 },
  { id:'mortF',  name:'Bombardier', stance:'ranged', hp:130, dmg:46, rate:2.6, range:460, spd:28, armor:.05,r:13, cost:150, from:8, w:5, gold:34, xp:24, splash:58, lob:1 },
  { id:'ltankF', name:'Raid Tank',  stance:'armor',  hp:620, dmg:42, rate:1.7, range:330, spd:44, armor:.42,r:18, cost:200, from:7, w:6, gold:44, xp:32, splash:34, veh:1 },
  { id:'htankF', name:'Siege Tank', stance:'armor',  hp:1450,dmg:82, rate:2.2, range:390, spd:28, armor:.62,r:22, cost:400, from:11,w:5, gold:80, xp:60, splash:50, veh:1 },
  { id:'catF',   name:'Trebuchet',  stance:'siege',  hp:340, dmg:120,rate:4.0, range:1080, spd:18, armor:.15,r:18, cost:340, from:9, w:4, gold:70, xp:48, splash:86, lob:1, veh:1 },
  { id:'wraith', name:'Gunship',    stance:'air',    hp:400, dmg:22, rate:.7,  range:250, spd:64, armor:.2, r:16, cost:260, from:10,w:4, gold:60, xp:44, fly:1 },
];
const FOE = {}; FOES.forEach(f => FOE[f.id] = f);

/* champions — one per 5 levels, escalating */
const CHAMPS = [
  { id:'ironclad', name:'IRONCLAD',  title:'the Unbroken',   base:'htankF', hp:2.4, dmg:.9,  r:34, spd:.7, gold:420, xp:320 },
  { id:'warlord',  name:'THE WARLORD',title:'Butcher of Nine',base:'brute', hp:2.8, dmg:1.1, r:36, spd:1.0, gold:520, xp:400 },
  { id:'skyfall',  name:'SKYFALL',   title:'Iron Vulture',   base:'wraith', hp:2.5, dmg:1.0, r:34, spd:1.1, gold:600, xp:460 },
  { id:'basilisk', name:'BASILISK',  title:'Wall-Eater',     base:'catF',  hp:3.0, dmg:1.0, r:34, spd:.8, gold:700, xp:540 },
];

/* ============================== ABILITIES ============================== */
const ABILITIES = [
  { id:'barrage', name:'BARRAGE', icon:'barrage', key:'Z', cd:34, target:1,
    desc:'Call six mortar shells onto a marked position. Heavy splash, no friendly fire.' },
  { id:'napalm',  name:'NAPALM',  icon:'napalm',  key:'X', cd:46, target:1,
    desc:'Paint a burning wall across the field for eight seconds. Nothing crosses it whole.' },
  { id:'rally',   name:'RALLY',   icon:'horn',    key:'C', cd:52,
    desc:'Sound the horn: every soldier you own gains +60% damage and +45% speed for 9s.' },
  { id:'repair',  name:'REPAIR',  icon:'wrench',  key:'V', cd:60,
    desc:'Emergency crews restore 28% of your fortress in one surge.' },
];
const ABIL = {}; ABILITIES.forEach(a => ABIL[a.id] = a);

/* ============================== HERO WEAPONS ============================== */
const BOWS = [
  { name:'HUNTING BOW',      dmg:30,  draw:1.00, vel:1.00, cost:0 },
  { name:'YEW LONGBOW',      dmg:46,  draw:1.05, vel:1.08, cost:260 },
  { name:'COMPOSITE WARBOW', dmg:68,  draw:1.10, vel:1.16, cost:640 },
  { name:'SIEGE ARBALEST',   dmg:102, draw:0.92, vel:1.32, cost:1400 },
  { name:'STORMLANCE',       dmg:152, draw:1.16, vel:1.42, cost:2900 },
  { name:'SUNSPEAR BALLISTA',dmg:225, draw:1.22, vel:1.55, cost:6200 },
  { name:'GODSBANE',         dmg:330, draw:1.30, vel:1.7,  cost:13000 },
];

/* hero skill lines — 1 point per level */
const SKILLS = [
  { id:'might', name:'MIGHT',    icon:'sword', max:20, desc:'+7% bow damage per rank.' },
  { id:'swift', name:'QUICKNOCK',icon:'boot',  max:20, desc:'+7% draw speed per rank.' },
  { id:'eye',   name:'DEADEYE',  icon:'eye',   max:20, desc:'+0.14x headshot multiplier and +2% critical chance per rank.' },
  { id:'greed', name:'AVARICE',  icon:'coin',  max:20, desc:'+8% gold from every kill per rank.' },
  { id:'lord',  name:'WARLORD',  icon:'horn',  max:20, desc:'+5% damage and +5% health for every soldier you field, per rank.' },
];

/* ============================== ARMORY GRADES ==============================
   repeatable gold purchases. cost = base * mul^level */
const GRADES = [
  { id:'slots',  name:'ARMY SLOTS',    icon:'plate', base:110, mul:1.30, max:22, unit:'+1 SLOT',
    desc:'Field more soldiers at once. Every unit occupies slots equal to its weight.' },
  { id:'drill',  name:'INFANTRY DRILL',icon:'helm',  base:150, mul:1.36, max:12, unit:'+15% HP / +12% DMG',
    desc:'Drill your infantry harder. Applies to swordsmen, shieldmen, berserkers, knights, archers, musketeers and crews.' },
  { id:'plating',name:'ARMOR PLATING', icon:'tank',  base:260, mul:1.38, max:12, unit:'+16% HP / +13% DMG',
    desc:'Welded appliqué and better optics for every tracked and walking vehicle you own.' },
  { id:'walls',  name:'CURTAIN WALL',  icon:'gate',  base:180, mul:1.32, max:15, unit:'+11% FORTRESS HP',
    desc:'Thicker stone, deeper foundations. Also fully repairs the wall on purchase.' },
  { id:'purse',  name:'WAR CHEST',     icon:'coin',  base:190, mul:1.38, max:12, unit:'+11% GOLD',
    desc:'Better looting parties and cleaner books. More gold from every corpse, every level, and a fatter war-tax every second.' },
  { id:'lab',    name:'FIELD LABORATORY',icon:'flask',base:300, mul:1.45, max:10, unit:'+1 RESEARCH / LEVEL',
    desc:'Camp scholars dissect enemy wreckage between engagements. More research per level cleared.' },
  { id:'hospital',name:'FIELD HOSPITAL', icon:'heart', base:220, mul:1.36, max:8, unit:'+20% HEALING',
    desc:'Better salves, cleaner blades. Chirurgeons and every healing effect mend harder.' },
  { id:'conduit', name:'ARCANE CONDUITS',icon:'orb',   base:260, mul:1.38, max:8, unit:'+15% MAGE DAMAGE',
    desc:'Channeled leylines feed the college. Pyromancer flame and Stormcaller lightning strike harder.' },
  { id:'siege',   name:'SIEGECRAFT',     icon:'ram',   base:240, mul:1.35, max:10, unit:'+12% WALL DAMAGE',
    desc:'Engineers school the whole army in breaking stone. Every source you own hits castles harder.' },
];
const GRADE = {}; GRADES.forEach(g => GRADE[g.id] = g);
const gradeCost = (g, lv) => Math.round(g.base * Math.pow(g.mul, lv) / 5) * 5;

/* ============================== TECH TREE ==============================
   branch rows × tier columns. cost in RESEARCH. */
const BRANCHES = [
  { id:'bow',   name:'BOWLINE',  sub:'HERO ARMAMENT' },
  { id:'inf',   name:'INFANTRY', sub:'THE PUSH' },
  { id:'ord',   name:'ORDNANCE', sub:'FIRE SUPPORT' },
  { id:'arm',   name:'ARMOR',    sub:'TRACKED STEEL' },
  { id:'arc',   name:'ARCANUM',  sub:'MAGI & MIRACLES' },
  { id:'cmd',   name:'COMMAND',  sub:'FORTRESS & WILL' },
];

const TECH = [
  /* ---- BOWLINE ---- */
  { id:'t_fire',  b:'bow', t:0, name:'FIRE ARROWS', icon:'fire', cost:2, req:[],
    d:'Unlocks the <b>FIREBRAND</b> shaft — ignites its target and sets the ground ablaze where it strikes. Fire does not check banners: your own men burn too.', fx:g=>g.arrow.fire=1 },
  { id:'t_split', b:'bow', t:1, name:'SPLIT SHOT', icon:'split', cost:3, req:['t_fire'],
    d:'Unlocks <b>SPLIT SHOT</b> — three shafts in a fan at 62% damage each.', fx:g=>g.arrow.split=1 },
  { id:'t_bodkin',b:'bow', t:2, name:'BODKIN HEADS', icon:'pierce', cost:5, req:['t_split'],
    d:'Unlocks <b>BODKIN</b> — pierces five bodies and ignores all armour.', fx:g=>g.arrow.bodkin=1 },
  { id:'t_bomb',  b:'bow', t:3, name:'FIREPOTS', icon:'bomb', cost:8, req:['t_bodkin'],
    d:'Unlocks <b>FIREPOT</b> — an explosive shaft with a wide blast radius.', fx:g=>g.arrow.bomb=1 },
  { id:'t_storm', b:'bow', t:4, name:'STORM NOCK', icon:'bolt', cost:13, req:['t_bomb'],
    d:'Unlocks <b>STORMNOCK</b> — lightning chains between six enemies.', fx:g=>g.arrow.storm=1 },
  { id:'t_eye',   b:'bow', t:2, name:'EAGLE EYE', icon:'eye', cost:4, req:['t_split'], row:1,
    d:'Renders a live ballistic arc while drawing, wind included.', fx:g=>g.predict=1 },
  { id:'t_dead',  b:'bow', t:4, name:'DEADEYE DOCTRINE', icon:'star', cost:11, req:['t_eye'], row:1,
    d:'Headshots deal <span class="eff">+1.2x</span> extra and refund half the arrow cost.', fx:g=>{g.hs+=1.2;g.refund=.5} },

  /* ---- INFANTRY ---- */
  { id:'t_shield',b:'inf', t:0, name:'SHIELD WALL', icon:'shield', cost:2, req:[],
    d:'Unlocks the <b>SHIELDMAN</b> — 60% frontal damage reduction. Your archers need him.', fx:g=>g.unit.shield=1 },
  { id:'t_zerk',  b:'inf', t:1, name:'BERSERKER RITES', icon:'axe', cost:4, req:['t_shield'],
    d:'Unlocks the <b>BERSERKER</b> — fastest melee on the field.', fx:g=>g.unit.zerk=1 },
  { id:'t_knight',b:'inf', t:3, name:'KNIGHTHOOD', icon:'helm', cost:9, req:['t_zerk'],
    d:'Unlocks the <b>KNIGHT</b> — heavy plate, heavy sword, holds a lane alone.', fx:g=>g.unit.knight=1 },
  { id:'t_phal',  b:'inf', t:2, name:'PHALANX DRILL', icon:'plate', cost:6, req:['t_shield'], row:1,
    d:'Melee units in contact with an ally take <span class="eff">-22% damage</span>.', fx:g=>g.phalanx=.22 },
  { id:'t_vet',   b:'inf', t:4, name:'VETERAN CORPS', icon:'star', cost:12, req:['t_knight'],
    d:'All infantry gain <span class="eff">+25% health</span> and heal 2% per second out of combat.', fx:g=>{g.infHp+=.25;g.regenU=.02} },

  { id:'t_medic', b:'inf', t:1, name:'FIELD CHIRURGEONS', icon:'heart', cost:4, req:['t_shield'], row:1,
    d:'Unlocks the <b>CHIRURGEON</b> - a battlefield healer who mends your most wounded soldier. Armies that heal outlast armies that do not.', fx:g=>g.unit.medic=1 },
  { id:'t_banner',b:'inf', t:3, name:'WAR BANNERS', icon:'flag', cost:7, req:['t_medic'], row:1,
    d:'Unlocks the <b>BANNERMAN</b> - allies near the banner strike <span class="eff">+25% harder</span>. Protect it.', fx:g=>g.unit.banner=1 },

  /* ---- ORDNANCE ---- */
  { id:'t_musket',b:'ord', t:0, name:'BLACK POWDER', icon:'musket', cost:3, req:[],
    d:'Unlocks the <b>MUSKETEER</b> — flat trajectory, brutal damage.', fx:g=>g.unit.musket=1 },
  { id:'t_crew',  b:'ord', t:1, name:'MORTAR CREWS', icon:'mortar', cost:5, req:['t_musket'],
    d:'Unlocks the <b>MORTAR CREW</b> — lobbed splash over your own line.', fx:g=>g.unit.crew=1 },
  { id:'t_barr',  b:'ord', t:2, name:'CALL FOR FIRE', icon:'barrage', cost:7, req:['t_crew'],
    d:'Unlocks the <b>BARRAGE</b> command — six shells wherever you mark.', fx:g=>g.abil.barrage=1 },
  { id:'t_arty',  b:'ord', t:3, name:'SIEGE BATTERY', icon:'arty', cost:10, req:['t_crew'],
    d:'Unlocks <b>ARTILLERY</b> — full-field range. It can shell their castle from your gate.', fx:g=>g.unit.arty=1 },
  { id:'t_nap',   b:'ord', t:4, name:'NAPALM STORES', icon:'napalm', cost:12, req:['t_barr'],
    d:'Unlocks the <b>NAPALM</b> command — a burning wall across the lane.', fx:g=>g.abil.napalm=1 },
  { id:'t_big',   b:'ord', t:4, name:'HEAVY MUNITIONS', icon:'bomb', cost:14, req:['t_arty'], row:1,
    d:'All explosions gain <span class="eff">+35% radius</span> and <span class="eff">+20% damage</span>.', fx:g=>{g.splashR+=.35;g.splashD+=.2} },

  { id:'t_ram',   b:'ord', t:1, name:'SIEGE RAMS', icon:'ram', cost:5, req:[], row:1,
    d:'Unlocks the <b>SIEGE RAM</b> - a rolling battering engine dealing <span class="eff">8x damage to castle walls</span>.', fx:g=>g.unit.ram=1 },

  /* ---- ARMOR ---- */
  { id:'t_ltank', b:'arm', t:1, name:'LIGHT ARMOR', icon:'tank', cost:6, req:[],
    d:'Unlocks the <b>LIGHT TANK</b> — pushes with the melee line and shells what it meets.', fx:g=>g.unit.ltank=1 },
  { id:'t_htank', b:'arm', t:3, name:'HEAVY ARMOR', icon:'htank', cost:12, req:['t_ltank'],
    d:'Unlocks the <b>HEAVY TANK</b> — 1150 health behind 60% damage reduction.', fx:g=>g.unit.htank=1 },
  { id:'t_react', b:'arm', t:2, name:'REACTIVE PLATING', icon:'plate', cost:8, req:['t_ltank'], row:1,
    d:'Vehicles take <span class="eff">-25% splash damage</span> and shrug off the first hit each engagement.', fx:g=>g.vehSplash=.25 },
  { id:'t_eng',   b:'arm', t:4, name:'OVERDRIVE ENGINES', icon:'boot', cost:11, req:['t_htank'], row:1,
    d:'All vehicles gain <span class="eff">+30% speed</span> and reload <span class="eff">18% faster</span>.', fx:g=>{g.vehSpd+=.3;g.vehRate+=.18} },
  { id:'t_mech',  b:'arm', t:5, name:'RAIL WALKER', icon:'mech', cost:20, req:['t_htank'],
    d:'Unlocks the <b>RAIL WALKER</b> — a piercing railgun that deletes whole columns.', fx:g=>g.unit.mech=1 },

  /* ---- ARCANUM ---- */
  { id:'t_pyro',  b:'arc', t:0, name:'PYROMANCY', icon:'fire', cost:4, req:[],
    d:'Unlocks the <b>PYROMANCER</b> - bursting fireballs that leave the ground burning where they land.', fx:g=>g.unit.pyro=1 },
  { id:'t_caller',b:'arc', t:2, name:'STORMCALLING', icon:'orb', cost:7, req:['t_pyro'],
    d:'Unlocks the <b>STORMCALLER</b> - lightning that arcs through four packed enemies at once.', fx:g=>g.unit.caller=1 },
  { id:'t_corsair',b:'arc', t:4, name:'SKY CORSAIRS', icon:'bolt', cost:11, req:['t_caller'],
    d:'Unlocks the <b>SKY CORSAIR</b> - your own air power. Enemy swords cannot answer what flies.', fx:g=>g.unit.corsair=1 },
  { id:'t_focus', b:'arc', t:3, name:'ARCANE FOCUS', icon:'star', cost:9, req:['t_caller'], row:1,
    d:'Healing, flame and lightning all strike <span class="eff">35% harder</span>. The college earns its keep.', fx:g=>g.mageBoost+=.35 },

  /* ---- COMMAND ---- */
  { id:'t_ball',  b:'cmd', t:0, name:'WALL BALLISTA', icon:'tower', cost:3, req:[],
    d:'Mounts an auto-firing ballista on your keep. It never sleeps.', fx:g=>g.turrets+=1 },
  { id:'t_rep',   b:'cmd', t:1, name:'REPAIR CREWS', icon:'wrench', cost:4, req:['t_ball'],
    d:'The fortress mends <span class="eff">0.6% of maximum health per second</span>.', fx:g=>g.wallRegen+=.006 },
  { id:'t_rally', b:'cmd', t:2, name:'WAR HORN', icon:'horn', cost:6, req:['t_rep'],
    d:'Unlocks the <b>RALLY</b> command — a battle-wide surge of speed and fury.', fx:g=>g.abil.rally=1 },
  { id:'t_repa',  b:'cmd', t:2, name:'SIEGE ENGINEERS', icon:'wrench', cost:7, req:['t_rep'], row:1,
    d:'Unlocks the <b>REPAIR</b> command — restores 28% of the fortress instantly.', fx:g=>g.abil.repair=1 },
  { id:'t_twin',  b:'cmd', t:3, name:'TWIN BATTERY', icon:'tower', cost:10, req:['t_rally'],
    d:'A second ballista, and both fire <span class="eff">30% faster</span>.', fx:g=>{g.turrets+=1;g.turretRate+=.3} },
  { id:'t_aegis', b:'cmd', t:4, name:'AEGIS FIELD', icon:'aegis', cost:15, req:['t_twin'],
    d:'A regenerating shield absorbs the first 600 damage, then recharges between levels.', fx:g=>g.shieldMax+=600 },
  { id:'t_gate',  b:'cmd', t:5, name:'TITAN GATE', icon:'gate', cost:22, req:['t_aegis'],
    d:'<span class="eff">+60% fortress health</span> and attackers at your wall take 30 damage per second.', fx:g=>{g.wallHp+=.6;g.thorns+=30} },
];
const TECHM = {}; TECH.forEach(t => TECHM[t.id] = t);

/* ============================== ENEMY CITIES ==============================
   The campaign is not waves — it is a road of cities. Each one is a named
   power with its own doctrine, sigil and architecture, and each is stronger
   than the last. Break the walls, take the city, march on the next. */

const CITY_A = ['Iron','Ash','Grim','Black','Storm','Bone','Red','Cinder','Dread','Gol','Kar','Vor','Mor','Hal','Drak','Ser','Thal','Rav','Umbr','Skar','Vel','Nor','Char','Wyrm','Gloam','Bru','Har','Zel'];
const CITY_B = ['maw','hold','fell','reach','spire','gard','mere','crag','vault','forge','watch','barrow','keep','march','hollow','throne','bane','gate','wick','stead','helm','carn','dross','fane'];
const CITY_EP = ['the Unbowed','the Ninefold','of the Long Siege','the Wound','of Broken Oaths','the Gilded','the Sleepless','of Iron Rain','the Drowned','of Ten Thousand','the Unnumbered','of the Black Sun','the Hungering','of Cold Fire','the Last Wall','of the Red March'];

/* deterministic per-index so a saved campaign always meets the same cities */
function chash(n, salt) { const s = Math.sin((n * 12.9898 + salt * 78.233)) * 43758.5453; return s - Math.floor(s); }

const CITY_TRAITS = [
  { id:'legion',  name:'LEVY DOCTRINE',   note:'Endless conscripts. Cheap bodies, relentless push.',
    w:{grunt:2.2,runner:1.7,shieldF:1.3}, costMul:.82, income:1.05 },
  { id:'archery', name:'ARCHERY ORDER',   note:'Massed bowmen and fusiliers behind a shield line.',
    w:{bowF:2.6,gunF:2.2,shieldF:1.5}, income:1.0 },
  { id:'ironworks',name:'IRONWORKS',      note:'Tracked steel. Their foundries never cool.',
    w:{ltankF:2.6,htankF:2.2}, earlier:{ltankF:-3,htankF:-4}, income:1.08 },
  { id:'siege',   name:'SIEGE MASTERS',   note:'Trebuchets and bombardiers that outrange your wall.',
    w:{catF:2.8,mortF:2.4}, earlier:{catF:-3,mortF:-3}, income:1.04 },
  { id:'zealots', name:'ZEALOT CULT',     note:'Sappers and ravagers hurled at your gate without pause.',
    w:{sapper:2.8,runner:2.2,brute:1.4}, costMul:.88, income:1.12 },
  { id:'wealth',  name:'MERCHANT PRINCES',note:'Deep coffers. They field more than they should be able to.',
    income:1.34, hp:.94 },
  { id:'bastion', name:'BASTION WARDENS', note:'Thick walls and mounted batteries. Bring artillery.',
    hp:1.5, turret:1, income:.94 },
  { id:'sky',     name:'SKY LANCERS',     note:'Gunships that ignore your infantry entirely.',
    w:{wraith:3.0}, earlier:{wraith:-4}, income:1.02 },
  { id:'brutal',  name:'BLOOD LEGION',    note:'Brutes and heavies. Nothing they field dies quickly.',
    w:{brute:2.6,htankF:1.6,shieldF:1.4}, dmg:1.12, income:1.0 },
];

/* architecture / palette style per city */
const CITY_STYLES = [
  { id:'stone',   stone:'#4a4038', trim:'#6b5a44', roof:'#5d2a26', glow:'#ff7a3a', flag:'#b8342a' },
  { id:'iron',    stone:'#3a3f47', trim:'#5d6874', roof:'#2c3138', glow:'#7fd0ff', flag:'#2f6fa8' },
  { id:'bone',    stone:'#5b564a', trim:'#8b8674', roof:'#3d3a32', glow:'#d8e88a', flag:'#8a8a3c' },
  { id:'obsidian',stone:'#2a2430', trim:'#463a52', roof:'#1c1720', glow:'#c07aff', flag:'#7a3ab8' },
  { id:'ember',   stone:'#4a2f28', trim:'#75452f', roof:'#3a1c18', glow:'#ff9a3a', flag:'#c8451c' },
  { id:'frost',   stone:'#3d4a52', trim:'#5f7684', roof:'#28323a', glow:'#8ff0ff', flag:'#3a8ab0' },
];

function makeCity(n) {
  const r1 = chash(n, 1), r2 = chash(n, 2), r3 = chash(n, 3), r4 = chash(n, 4), r5 = chash(n, 5);
  const name = CITY_A[(r1 * CITY_A.length) | 0] + CITY_B[(r2 * CITY_B.length) | 0];
  const ep = n >= 3 ? CITY_EP[(r3 * CITY_EP.length) | 0] : null;

  /* trait count grows with the road */
  const traits = [];
  const pool = CITY_TRAITS.slice();
  const tCount = n === 1 ? 0 : n < 4 ? 1 : n < 10 ? 2 : 3;
  for (let i = 0; i < tCount; i++) {
    const idx = (chash(n, 10 + i) * pool.length) | 0;
    traits.push(pool.splice(idx, 1)[0]);
  }

  const s = Math.pow(n, 1.16);
  let hp = 580 + 420 * s;
  let income = .9 + .5 * n + n * n * .024;
  let dmg = 1 + .072 * (n - 1);
  let turret = n >= 6 ? 1 : 0;
  if (n >= 15) turret = 2;
  traits.forEach(t => {
    if (t.hp) hp *= t.hp;
    if (t.income) income *= t.income;
    if (t.dmg) dmg *= t.dmg;
    if (t.turret) turret += t.turret;
  });

  /* weighted roster available to this city */
  const roster = [];
  FOES.forEach(f => {
    let from = f.from;
    traits.forEach(t => { if (t.earlier && t.earlier[f.id]) from = Math.max(1, from + t.earlier[f.id]); });
    if (n < from) return;
    let w = f.w * (1 + Math.min(1.1, (n - from) * .06));
    traits.forEach(t => { if (t.w && t.w[f.id]) w *= t.w[f.id]; });
    let cost = f.cost;
    traits.forEach(t => { if (t.costMul) cost *= t.costMul; });
    roster.push({ f, w, cost: Math.round(cost) });
  });

  return {
    n, name, ep, traits,
    title: name + (ep ? ', ' + ep : ''),
    style: CITY_STYLES[(r4 * CITY_STYLES.length) | 0],
    seed: r5,
    castleHp: Math.round(hp),
    income, dmgMul: dmg,
    hpMul: 1 + .088 * (n - 1),
    budget0: Math.round(38 + 30 * n),
    roster,
    turrets: turret,
    champ: n % 5 === 0 ? CHAMPS[((n / 5 | 0) - 1) % CHAMPS.length] : null,
    goldRw: Math.round(140 + 86 * n + n * n * 2),
    rpRw: 2 + Math.floor(n / 2) + (n % 5 === 0 ? 3 : 0),
    biome: BIOMES[((n - 1) / 3 | 0) % BIOMES.length],
  };
}

const xpFor = lv => Math.round(58 * Math.pow(lv, 1.42));
