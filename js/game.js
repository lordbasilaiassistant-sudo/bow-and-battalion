/* =========================================================================
   BOW & BATTALION — game.js
   ========================================================================= */
'use strict';

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.beginPath(); this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r); this.closePath(); return this;
  };
}

const $ = id => document.getElementById(id);
const cv = $('game'), ctx = cv.getContext('2d', { alpha: false });
let VS = 1, VOX = 0, VOY = 0;             // view scale / offset (letterbox)

function resize() {
  const r = cv.parentElement.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  const sx = cv.width / W, sy = cv.height / H;
  VS = Math.min(sx, sy);                  // fit — the whole battlefield must be visible
  VOX = (cv.width - W * VS) / 2;
  VOY = (cv.height - H * VS) * .44;       // field sits near center; the dock owns the soil band
}
addEventListener('resize', resize);

/* screen px -> world */
function toWorld(cx, cy) {
  const r = cv.getBoundingClientRect(), dpr = cv.width / r.width;
  return { x: ((cx - r.left) * dpr - VOX) / VS, y: ((cy - r.top) * dpr - VOY) / VS };
}

/* =========================================================================
   STATE
   ========================================================================= */
const HERO = { x: 222, y: 586 };

const G = {
  phase: 'title',            // title | battle | inter | over
  paused: false,
  t: 0, dt: 0,
  cityN: 1, city: null,
  gold: 420, rp: 0, score: 0,
  heroLv: 1, xp: 0, sp: 0,
  bow: 0,
  tech: new Set(), grades: {}, skills: {},
  wall: { hp: 1000, max: 1000 }, foeWall: { hp: 1000, max: 1000 },
  shield: 0,
  wind: 0, windT: 0,
  pop: 0,
  A: [],                     // combatants
  P: [],                     // projectiles
  FX: [],                    // beams / lingering fields
  foeBank: 0, foeTimer: 0, champUp: false, champTimer: 0,
  foeTurrets: [], turretAim: [-.4, -.4], turretRecoil: [0, 0], turretCd: [0, 0],
  arrow: 0, charge: 0, drawing: false, released: 0,
  mouse: { x: 900, y: 500 },
  combo: 0, comboT: 0,
  deployCd: 0, abilCd: {}, armed: null,
  rally: 0,
  killed: 0, shots: 0, hits: 0, headshots: 0,
  mods: null,
  levelT: 0,
  ended: 0,
};
ABILITIES.forEach(a => G.abilCd[a.id] = 0);

/* =========================================================================
   MODIFIERS
   ========================================================================= */
function recompute() {
  const m = {
    arrowDmg: 0, drawSpeed: 1, hs: 2.2, crit: .03, refund: 0, predict: 0,
    goldMul: 1, rpBonus: 0, popMax: 6,
    unitHp: 0, unitDmg: 0, infHp: 0, infDmg: 0, vehHp: 0, vehDmg: 0, vehSpd: 0, vehRate: 0,
    phalanx: 0, regenU: 0, splashR: 0, splashD: 0, vehSplash: 0,
    wallHp: 0, wallRegen: 0, turrets: 0, turretRate: 0, shieldMax: 0, thorns: 0,
    mageBoost: 0, healBoost: 0, wallDmg: 0,
    arrow: { std: 1 }, unit: { sword: 1, archer: 1 }, abil: {},
  };
  G.tech.forEach(id => { const t = TECHM[id]; if (t && t.fx) t.fx(m); });

  const gr = G.grades;
  m.popMax = 6 + (gr.slots || 0);
  m.infHp += .15 * (gr.drill || 0); m.infDmg += .12 * (gr.drill || 0);
  m.vehHp += .16 * (gr.plating || 0); m.vehDmg += .13 * (gr.plating || 0);
  m.healBoost += .20 * (gr.hospital || 0);
  m.mageBoost += .15 * (gr.conduit || 0);
  m.wallDmg += .12 * (gr.siege || 0);
  m.wallHp += .11 * (gr.walls || 0);
  m.goldMul += .11 * (gr.purse || 0);
  m.rpBonus += (gr.lab || 0);

  const sk = G.skills;
  m.arrowDmg += .07 * (sk.might || 0);
  m.drawSpeed += .07 * (sk.swift || 0);
  m.hs += .14 * (sk.eye || 0); m.crit += .02 * (sk.eye || 0);
  m.goldMul += .08 * (sk.greed || 0);
  m.unitDmg += .05 * (sk.lord || 0); m.unitHp += .05 * (sk.lord || 0);

  G.mods = m;
  const newMax = Math.round(1000 * (1 + m.wallHp));
  if (newMax !== G.wall.max) { const f = G.wall.hp / G.wall.max; G.wall.max = newMax; G.wall.hp = Math.min(newMax, Math.round(newMax * f)); }
  if (G.turretAim.length < m.turrets) { G.turretAim.push(-.4); G.turretRecoil.push(0); G.turretCd.push(0); }
  return m;
}
const bow = () => BOWS[G.bow];

/* =========================================================================
   COMBATANTS
   ========================================================================= */
/* readability scale: infantry drawn ~1.45x, vehicles ~1.2x (hitboxes scale with it) */
const bodyScale = def => def.fly ? 1.3 : def.veh ? 1.22 : 1.45;

function spawnUnit(def) {
  const m = G.mods, veh = !!def.veh;
  const hpMul = 1 + m.unitHp + (veh ? m.vehHp : m.infHp);
  const dmgMul = 1 + m.unitDmg + (veh ? m.vehDmg : m.infDmg);
  const lane = rnd(-16, 16);
  const c = {
    team: 1, def, id: def.id, x: MY_GATE - 16, y: def.fly ? 470 + rnd(-30, 30) : GROUND + lane, stance: def.stance,
    hp: def.hp * hpMul, max: def.hp * hpMul,
    dmg: def.dmg * dmgMul, rate: def.rate / (veh ? 1 + m.vehRate : 1),
    range: def.range, spd: def.spd * (veh ? 1 + m.vehSpd : 1),
    armor: def.armor, r: def.r * 1.15, pop: def.pop, veh, s: bodyScale(def),
    ph: rnd(TAU), cd: rnd(.1, .5), atk: 0, recoil: 0, dying: 0, charge: 0,
    fly: def.fly ? 1 : 0, burn: 0, burnDps: 0, hurtT: 0, sep: lane, bufT: 0,
  };
  G.A.push(c); G.pop += def.pop;
  fxSmoke(c.x, c.y - 8, 4, 12, '60,56,50', 22, .8);
  SFX.spawn();
  return c;
}

function spawnFoe(fd, champ) {
  const cy = G.city;
  let hp = fd.hp * cy.hpMul, dmg = fd.dmg * cy.dmgMul, r = fd.r * 1.15, spd = fd.spd, s = bodyScale(fd);
  let armor = fd.armor;
  let rate = fd.rate;
  if (champ) { hp *= champ.hp; dmg *= champ.dmg; r = champ.r; spd *= champ.spd; s = champ.r / 13; armor = Math.min(armor, .30); rate *= 1.6; }
  const lane = rnd(-16, 16);
  const c = {
    team: -1, def: fd, id: fd.id, x: EN_GATE + 16, y: fd.fly ? 470 + rnd(-40, 40) : GROUND + lane,
    stance: fd.stance, hp, max: hp, dmg, rate, range: fd.range, spd,
    armor, r, pop: 0, veh: !!fd.veh, s,
    ph: rnd(TAU), cd: rnd(.2, .8), atk: 0, recoil: 0, dying: 0, charge: 0,
    fly: fd.fly ? 1 : 0, burn: 0, burnDps: 0, hurtT: 0, sep: lane,
    champ: champ || null,
  };
  G.A.push(c);
  if (champ) {
    banner(champ.name, champ.title.toUpperCase());
    SFX.horn(); shake(16); flashScreen(.25, '#ff6a3a');
    fxExplosion(c.x, GROUND - 20, 70, { col: '255,90,50' });
  }
  return c;
}

const alive = c => c.dying === 0;
/* effective damage: RALLY horn (+60%) and a nearby war banner (+aura) multiply */
function dmgOf(c) {
  let d = c.dmg;
  if (c.team === 1 && G.rally > 0) d *= 1.6;
  if (c.bufT > 0) d *= 1 + (c.bufA || .25);
  return d;
}
function canTarget(a, b) { if (b.fly && (a.stance === 'melee')) return false; return true; }

function nearestEnemy(c, maxD) {
  let best = null, bd = maxD || 1e9;
  for (const o of G.A) {
    if (o.team === c.team || !alive(o) || !canTarget(c, o)) continue;
    const d = Math.abs(o.x - c.x) + Math.abs(o.y - c.y) * .6;
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
/* furthest-advanced friendly shock unit — the line the shooters sit behind */
function frontline(team) {
  let best = null;
  for (const o of G.A) {
    if (o.team !== team || !alive(o) || o.fly) continue;
    if (o.stance !== 'melee' && o.stance !== 'armor') continue;
    if (!best || (o.x - best.x) * team > 0) best = o;
  }
  return best ? best.x : null;
}
/* someone of my own team directly ahead within d? (keeps ranks from stacking) */
function blockedAhead(c, d) {
  for (const o of G.A) {
    if (o === c || o.team !== c.team || !alive(o) || o.fly !== c.fly) continue;
    if (o.engaged) continue;                 // fighters don't block — flow around them
    if (o.stance !== c.stance) continue;     // only your own kind forms your queue —
                                             // melee streams past held archers, tanks past infantry
    const rel = (o.x - c.x) * c.team;
    if (rel > 0 && rel < d && Math.abs(o.y - c.y) < 20) return true;
  }
  return false;
}
const gapTo = (a, b) => Math.hypot(b.x - a.x, (b.y - a.y) * .9) - (a.r + b.r);

function stepCombatant(c, dt) {
  if (c.dying > 0) { c.dying += dt; return; }
  c.hurtT = Math.max(0, c.hurtT - dt);
  c.bufT = Math.max(0, (c.bufT || 0) - dt);
  if (c.batter > 0) { c.batterT -= dt; if (c.batterT <= 0) { c.batter--; c.batterT = .55; } }
  c.recoil = Math.max(0, c.recoil - dt * 5);
  c.atk = Math.max(0, c.atk - dt * 3.6);
  c.cd -= dt * (c.team === 1 && G.rally > 0 ? 1.35 : 1);

  /* burn */
  if (c.burn > 0) {
    c.burn -= dt; hurt(c, c.burnDps * dt, { silent: 1, src: 1 });
    if (chance(dt * 14)) fxFire(c.x + rnd(-6, 6), c.y - rnd(6, 30), 1, 6, .35);
    if (c.dying) return;
  }
  if (c.team === 1 && G.mods.regenU && !c.veh && c.hp < c.max) c.hp = Math.min(c.max, c.hp + c.max * G.mods.regenU * dt);

  const spdM = (c.team === 1 && G.rally > 0 ? 1.45 : 1);
  const wallX = c.team === 1 ? EN_WALL : MY_WALL;
  const e = nearestEnemy(c, 1400);
  const dirF = c.team;                       // +1 = my units walk right

  let move = 0, firing = null;

  if (c.stance === 'melee') {
    if (e && gapTo(c, e) <= c.range * .8) firing = e;
    else if ((wallX - c.x) * dirF <= c.r + 34 && (!e || gapTo(c, e) > 260)) firing = 'wall';
    else move = dirF;
  } else if (c.stance === 'armor') {
    if (e && gapTo(c, e) <= c.range * .88) { firing = e; if (gapTo(c, e) > c.range * .55) move = dirF * .35; }
    else if ((wallX - c.x) * dirF <= c.range * .8) firing = 'wall';
    else move = dirF;
  } else if (c.stance === 'ranged') {
    const fl = frontline(c.team);
    /* hold WELL behind the shock line; with no line up, hug home; with no
       enemies at all, walk into range of their castle and shell it */
    const threat = e && gapTo(c, e) <= c.range * 1.15;
    if (e && gapTo(c, e) <= c.range * .94) {
      firing = e;
      if (gapTo(c, e) < c.range * .48) move = -dirF;               // kite hard
    } else if (!threat && Math.abs(wallX - c.x) <= c.range * .9) {
      firing = 'wall';                                             // no one in reach — siege the walls
    } else {
      /* advance: behind the shock line if one exists, else toward wall range */
      let hold = wallX - c.range * .8 * dirF;
      if (fl !== null && (hold - (fl - 165 * dirF)) * dirF > 0) hold = fl - 165 * dirF;
      if (threat) hold = Math.min(hold * dirF, (e.x - c.range * .8 * dirF) * dirF) * dirF;
      move = (hold - c.x) * dirF > 10 ? dirF : ((hold - c.x) * dirF < -34 ? -dirF * .8 : 0);
    }
  } else if (c.stance === 'siege') {
    const hold = c.team === 1 ? MY_GATE + 74 : EN_GATE - 74;
    if ((hold - c.x) * dirF > 8) move = dirF;
    if (e && gapTo(c, e) <= c.range) firing = e;
    else if (Math.abs(wallX - c.x) <= c.range) firing = 'wall';
  } else if (c.stance === 'support') {
    /* trail the shock line; heal or wave the banner, never fight */
    const fl = frontline(c.team);
    const hold = fl !== null ? fl - 130 * dirF : (c.team === 1 ? MY_GATE + 150 : EN_GATE - 150);
    move = (hold - c.x) * dirF > 12 ? dirF : ((hold - c.x) * dirF < -40 ? -dirF * .8 : 0);
    if (c.def.heal && c.cd <= 0) {
      let tgt = null, worst = 1;
      for (const o of G.A) {
        if (o.team !== c.team || !alive(o) || o === c || o.hp >= o.max) continue;
        if (Math.hypot(o.x - c.x, o.y - c.y) > c.range) continue;
        const f = o.hp / o.max;
        if (f < worst) { worst = f; tgt = o; }
      }
      if (tgt) {
        c.cd = c.rate; c.atk = 1;
        const amt = c.def.heal * (1 + G.mods.mageBoost + G.mods.healBoost);
        tgt.hp = Math.min(tgt.max, tgt.hp + amt);
        ftext(tgt.x, tgt.y - 54 * (tgt.s || 1), '+' + Math.round(amt), '#8fe8a0', 18, { life: .85 });
        fxSpark(tgt.x, tgt.y - 30, 5, '#9ff0aa', 70, .5);
        if (chance(.5)) SFX.ui();
      }
    }
    if (c.def.aura) {
      for (const o of G.A) {
        if (o.team !== c.team || !alive(o) || o === c) continue;
        if (Math.abs(o.x - c.x) < c.range && Math.abs(o.y - c.y) < 80) { o.bufT = .35; o.bufA = c.def.aura * (1 + G.mods.mageBoost * .5); }
      }
    }
  } else if (c.stance === 'air') {
    const t = e || null;
    if (t && gapTo(c, t) <= c.range * .9) { firing = t; move = 0; }
    else if (t) move = sign(t.x - c.x);                       // chase in either direction
    else if ((wallX - c.x) * dirF <= c.range * .7) firing = 'wall';
    else move = dirF;
    c.x = clamp(c.x, 70, W - 70);                             // never fly off the field
    c.y = lerp(c.y, 430 + Math.sin(G.t * .8 + c.ph) * 34, dt * 2);
  }

  c.engaged = !!firing;

  /* march */
  if (move !== 0) {
    const mobbing = (wallX - c.x) * dirF < 150 || (e && gapTo(c, e) < 130);   // storming a gate or a scrum: pack in
    if (!mobbing && move > 0 === (dirF > 0) && blockedAhead(c, c.r * 2 + 12)) move = 0;
    c.x += move * c.spd * spdM * dt;
    c.ph += dt * (c.veh ? 6 : 9) * Math.abs(move) * (c.spd / 42);
    if (!c.fly) c.x = clamp(c.x, MY_WALL - 30, EN_WALL + 30);
  } else if (c.stance !== 'air') c.ph += dt * .6;

  /* fight */
  if (firing && c.cd <= 0) {
    c.cd = c.rate;
    c.atk = 1; c.recoil = 1;
    if (firing === 'wall') attackWall(c);
    else attackTarget(c, firing);
  }
}

function attackWall(c) {
  const foe = c.team === -1;
  const tgt = foe ? G.wall : G.foeWall;
  const wallX = c.team === 1 ? EN_WALL : MY_WALL;
  if (c.stance === 'melee') {
    let d = dmgOf(c) * (c.def.ram || 1) * (c.champ ? .5 : 1) * (c.team === 1 ? 1 + G.mods.wallDmg : 1);
    if (c.def.suicide) {
      d = c.dmg; fxExplosion(c.x, GROUND - 14, 70, { col: '255,140,60' });
      SFX.boom(1.1); shake(12); Art.decalScorch(c.x, GROUND + 6, 60);
      kill(c, true);
    }
    damageWall(tgt, d, wallX, foe);
    SFX.clash();
  } else {
    shoot(c, { x: wallX + (c.team === 1 ? 30 : -30), y: GROUND - rnd(40, 110), wall: 1 });
  }
}
function attackTarget(c, e) {
  if (c.def.chain) {
    G.FX.push({ k: 'arc', x1: c.x, y1: c.y - 34, x2: e.x, y2: e.y - 24, t: 0, life: .22 });
    chain(e, dmgOf(c) * (1 + G.mods.mageBoost), c.def.chain);
    return;
  }
  if (c.stance === 'melee') {
    if (c.def.suicide) {
      fxExplosion(c.x, GROUND - 14, 76, { col: '255,140,60' }); SFX.boom(1.1); shake(10);
      Art.decalScorch(c.x, GROUND + 6, 62);
      splash(c.x, GROUND - 14, 76, c.dmg, c.team, { pierce: 1 });
      kill(c, true); return;
    }
    hurt(e, dmgOf(c), { src: c.x });
    SFX.clash();
    fxSpark(e.x + (c.x < e.x ? -e.r : e.r), e.y - 22, 4, '#ffd9a0', 160, .25);
  } else shoot(c, e);
}

/* =========================================================================
   PROJECTILES
   ========================================================================= */
function shoot(c, tgt) {
  const sx = c.x + (c.r + 4) * c.team, sy = c.y - (c.veh ? 26 : 28) * (c.s || 1);
  const tx = tgt.x !== undefined ? tgt.x : tgt.x, ty = (tgt.y !== undefined ? tgt.y : GROUND) - (tgt.wall ? 0 : 20);
  const d = c.def;
  const P = { team: c.team, dmg: dmgOf(c) * (d.fireF ? 1 + G.mods.mageBoost : 1), x: sx, y: sy, r: 3, src: c,
    splash: (d.splash || 0) * (1 + G.mods.splashR * (c.team === 1 ? 1 : 0)) * (c.champ ? .6 : 1),
    wallMul: c.champ ? .5 : 1, fireF: d.fireF ? 1 : 0 };

  if (d.beam) {                                   /* rail walker */
    c.charge = 1;
    G.FX.push({ k: 'beam', x1: sx, y1: sy, x2: c.team === 1 ? EN_WALL + 20 : MY_WALL - 20, y2: sy, t: 0, life: .32, team: c.team });
    beamHit(c, sy);
    SFX.zap(); shake(4); fxFlash(sx, sy, 40, '150,235,255', .2);
    return;
  }
  if (d.lob) {                                    /* mortar / trebuchet arc */
    const dx = tx - sx, dy = ty - sy, g = 900;
    const tt = clamp(Math.abs(dx) / 300, .7, 2.6);
    P.vx = dx / tt; P.vy = (dy - .5 * g * tt * tt) / tt; P.g = g; P.k = 'shell'; P.lob = 1;
    SFX.cannon(); fxSmoke(sx, sy, 4, 12, '70,66,58', 30, 1); fxFlash(sx, sy, 26, '255,190,110', .12);
    if (c.veh) shake(2);
  } else if (d.veh) {                             /* tank gun */
    const a = Math.atan2(ty - sy, tx - sx);
    P.vx = Math.cos(a) * 700; P.vy = Math.sin(a) * 700; P.g = 90; P.k = 'shell';
    SFX.cannon(); shake(2.5);
    fxFlash(sx + 14 * c.team, sy, 30, '255,200,130', .1);
    fxSmoke(sx + 16 * c.team, sy, 3, 9, '80,74,66', 16, .7);
    fxSpark(sx + 18 * c.team, sy, 5, '#ffd58a', 200, .22);
  } else if (d.arc) {                              /* archers */
    const dx = tx - sx, dy = ty - sy, g = 500;
    const tt = clamp(Math.abs(dx) / 420, .35, 1.5);
    P.vx = dx / tt; P.vy = (dy - .5 * g * tt * tt) / tt; P.g = g; P.k = 'arrow';
    SFX.shoot(.5);
  } else {                                         /* musket / rifle */
    const a = Math.atan2(ty - sy, tx - sx);
    P.vx = Math.cos(a) * 950; P.vy = Math.sin(a) * 950; P.g = 40; P.k = 'bullet';
    SFX.gun();
    fxFlash(sx + 12 * c.team, sy, 20, '255,225,160', .07);
  }
  P.wall = tgt.wall ? 1 : 0;
  G.P.push(P);
}

function beamHit(c, sy) {
  const list = [];
  for (const o of G.A) {
    if (o.team === c.team || !alive(o)) continue;
    if (Math.abs(o.y - sy) < 46 && (o.x - c.x) * c.team > 0) list.push(o);
  }
  list.forEach(o => hurt(o, c.dmg, { pierce: 1, src: c.x }));
  const wallX = c.team === 1 ? EN_WALL : MY_WALL;
  if (Math.abs(sy - (GROUND - 60)) < 120) damageWall(c.team === 1 ? G.foeWall : G.wall, c.dmg * .5 * (c.team === 1 ? 1 + G.mods.wallDmg : 1), wallX, c.team === -1);
}

function heroShoot() {
  const p = clamp(G.charge, .12, 1), b = bow();
  const a = Math.atan2(G.mouse.y - HERO.y, G.mouse.x - HERO.x);
  const type = ARROWS[G.arrow];
  const spd = (520 + 880 * p) * b.vel;
  const base = b.dmg * (1 + G.mods.arrowDmg) * (.55 + p * .75);

  const mk = (ang, dmgMul, kind) => {
    G.P.push({
      team: 1, hero: 1, kind, x: HERO.x + Math.cos(ang) * 24, y: HERO.y + Math.sin(ang) * 24,
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, g: 500, k: 'heroArrow',
      dmg: base * dmgMul, pierce: kind === 'bodkin' ? 5 : 0, hitList: [], r: 4,
      trail: [], born: G.t, x0: HERO.x,
    });
  };

  if (type.id === 'split') { mk(a - .105, .62); mk(a, .62); mk(a + .105, .62); }
  else mk(a, 1, type.id);

  G.shots++;
  G.charge = 0; G.released = .12;
  SFX.shoot(p);
  fxSpark(HERO.x + Math.cos(a) * 26, HERO.y + Math.sin(a) * 26, 5, '#ffe6b0', 130, .22);
  if (type.cost) { G.gold -= type.cost; }
  shake(1.6 + p * 2.2);
}

function stepProjectiles(dt) {
  for (let i = G.P.length - 1; i >= 0; i--) {
    const p = G.P[i];
    p.vy += p.g * dt;
    if (p.hero) p.vx += G.wind * 18 * dt;
    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;

    if (p.hero) {
      p.trail.push(p.x, p.y); if (p.trail.length > 22) p.trail.splice(0, 2);
      if (p.kind === 'fire' && chance(dt * 40)) fxFire(p.x, p.y, 1, 5, .3);
      if (p.kind === 'storm' && chance(dt * 30)) fxSpark(p.x, p.y, 1, '#9fe6ff', 60, .2);
    }

    /* hit combatants along the segment */
    let hit = null, hx = 0, hy = 0;
    for (const o of G.A) {
      if (!alive(o)) continue;
      if (p.hero ? false : o.team === p.team) continue;   // hero shafts spare no one
      if (p.hitList && p.hitList.indexOf(o) >= 0) continue;
      if (segHit(p.x, p.y, nx, ny, o.x, o.y - (o.fly ? 0 : 24 * (o.s || 1)), o.r + 6)) { hit = o; hx = nx; hy = ny; break; }
    }

    if (hit) { onProjectileHit(p, hit, hx, hy); if (p.dead) { G.P.splice(i, 1); continue; } }

    /* walls */
    const hitMy = nx <= MY_WALL && p.team === -1, hitEn = nx >= EN_WALL && p.team === 1;
    if ((hitMy || hitEn) && ny > GROUND - 280) {
      const tgt = hitEn ? G.foeWall : G.wall;
      damageWall(tgt, p.dmg * (p.wallMul || 1) * (p.team === 1 ? 1 + G.mods.wallDmg : 1), hitEn ? EN_WALL : MY_WALL, hitMy);
      impact(p, nx, ny); G.P.splice(i, 1); continue;
    }
    /* ground */
    if (ny >= GROUND) {
      impact(p, nx, GROUND);
      if (p.hero) breakCombo();
      G.P.splice(i, 1); continue;
    }
    if (nx < -80 || nx > W + 80 || ny < -600) { G.P.splice(i, 1); continue; }
    p.x = nx; p.y = ny;
  }

  /* lingering fields (napalm) + beams */
  for (let i = G.FX.length - 1; i >= 0; i--) {
    const f = G.FX[i]; f.t += dt;
    if (f.k === 'fire') {
      if (chance(dt * 34)) fxFire(rnd(f.x - f.w, f.x + f.w), GROUND - rnd(0, 26), 1, 11, .55);
      if (chance(dt * 8)) fxSmoke(rnd(f.x - f.w, f.x + f.w), GROUND - 22, 1, 18, '46,38,32', 32, 1.6);
      for (const o of G.A) if (o.team !== f.team && alive(o) && Math.abs(o.x - f.x) < f.w && !o.fly) {
        hurt(o, f.dps * dt, { silent: 1, src: f.x }); o.burn = Math.max(o.burn, .8); o.burnDps = Math.max(o.burnDps, f.dps * .35);
      }
    }
    if (f.t >= f.life) G.FX.splice(i, 1);
  }
}

function segHit(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1, dy = y2 - y1;
  const L = dx * dx + dy * dy;
  let t = L ? ((cx - x1) * dx + (cy - y1) * dy) / L : 0;
  t = clamp(t, 0, 1);
  const px = x1 + dx * t, py = y1 + dy * t;
  return (px - cx) * (px - cx) + (py - cy) * (py - cy) <= r * r;
}

function onProjectileHit(p, o, x, y) {
  if (p.hero && o.team === 1) {
    /* you shot your own soldier. */
    hurt(o, p.dmg, { src: p.x, silent: 1 });
    ftext(o.x, o.y - 52 * (o.s || 1), 'FRIENDLY — ' + Math.round(p.dmg), '#ff8a7a', 19, { crit: 1 });
    fxBlood(x, y, 6, '150,22,20', sign(p.vx));
    SFX.thud(); breakCombo();
    if (p.kind === 'fire') { o.burn = 3.2; o.burnDps = p.dmg * .22; igniteGround(x, p.dmg); }
    if (p.kind === 'bomb') { p.dead = 1; boom(x, y, 96, p.dmg * .9, 1, true); return; }
    if (p.pierce > 0) { p.pierce--; p.hitList.push(o); p.vx *= .84; p.vy *= .84; return; }
    p.dead = 1; return;
  }
  if (p.hero) {
    const top = o.y - (o.fly ? 10 : 44 * (o.s || 1));
    const headZone = top + (o.fly ? 12 : 15 * (o.s || 1));
    const head = !o.veh && y <= headZone;
    let dmg = p.dmg, crit = false, tag = null;
    if (head) { dmg *= G.mods.hs; tag = 'HEADSHOT'; }
    else if (chance(G.mods.crit)) { dmg *= 1.8; crit = true; tag = 'CRIT'; }

    const dist = Math.abs(o.x - p.x0);
    if (dist > 700) { dmg *= 1.18; }

    hurt(o, dmg, { pierce: p.kind === 'bodkin', src: p.x, hero: 1, tag });

    if (head) {
      SFX.headshot(); hitstop(.055); shake(4); G.headshots++;
      ftext(o.x, top - 6, 'HEADSHOT', '#ffe27a', 27, { crit: 1, life: 1.1 });
      fxRing(x, y, 34, 'rgba(255,225,150,.9)', .3, 2.5);
      if (G.mods.refund && ARROWS[G.arrow].cost) G.gold += Math.round(ARROWS[G.arrow].cost * G.mods.refund);
    } else if (crit) { SFX.crit(); ftext(o.x, top, 'CRIT', '#ff9d5a', 22, { crit: 1 }); }
    else SFX.hit();

    G.hits++;
    addCombo();

    if (p.kind === 'fire') { o.burn = 3.2; o.burnDps = p.dmg * .22; fxFire(x, y, 8, 10, .5); igniteGround(x, p.dmg); }
    if (p.kind === 'bomb') { p.dead = 1; boom(x, y, 96, p.dmg * .9, 1, true); return; }
    if (p.kind === 'storm') { p.dead = 1; chain(o, p.dmg * .6, 6); return; }

    if (p.pierce > 0) { p.pierce--; p.hitList.push(o); p.vx *= .84; p.vy *= .84; fxBlood(x, y, 6, '150,22,20', sign(p.vx)); return; }
    p.dead = 1; impact(p, x, y); return;
  }

  /* unit fire */
  if (p.splash) {
    p.dead = 1; boom(x, y, p.splash, p.dmg, p.team === 1);
    if (p.fireF) G.FX.push({ k: 'fire', x, w: 50, dps: p.dmg * .4, team: p.team, t: 0, life: 3 });
    return;
  }
  hurt(o, p.dmg, { src: p.x });
  p.dead = 1; impact(p, x, y);
}

function impact(p, x, y) {
  if (p.k === 'shell' || p.splash) {
    boom(x, y, p.splash || 42, p.dmg * (p.splash ? 1 : .6), p.team === 1);
    if (p.fireF) G.FX.push({ k: 'fire', x, w: 50, dps: p.dmg * .4, team: p.team, t: 0, life: 3 });
  } else if (p.hero) {
    if (p.kind === 'bomb') boom(x, y, 96, p.dmg * .9, 1, true);
    else if (p.kind === 'fire') { fxFire(x, y, 6, 9, .5); fxSpark(x, y, 5, '#ffb060', 130, .3); igniteGround(x, p.dmg); }
    else { fxSpark(x, y, 4, '#c9b48a', 110, .25); }
    if (y >= GROUND - 2) DECALS.push({ x, y: GROUND, a: Math.atan2(p.vy, p.vx), t: 0 });
  } else {
    fxSpark(x, y, 4, '#ffd08a', 130, .2);
  }
}

/* a patch of burning ground — hero fire burns BOTH armies (team 0 = everyone) */
function igniteGround(x, dmg) {
  G.FX.push({ k: 'fire', x, w: 54, dps: Math.max(14, dmg * .5), team: 0, t: 0, life: 3.6 });
  Art.decalScorch(x, GROUND + 4, 46);
}

function boom(x, y, r, dmg, mine, ffAll) {
  r *= 1 + (mine ? G.mods.splashR : 0);
  dmg *= 1 + (mine ? G.mods.splashD : 0);
  fxExplosion(x, y, r, { floor: GROUND });
  SFX.boom(clamp(r / 70, .6, 1.6)); shake(clamp(r / 9, 2, 14));
  flashScreen(clamp(r / 900, .03, .14), '#ffbb77');
  if (y > GROUND - 40) Art.decalScorch(x, GROUND + 4, r * .8);
  splash(x, y, r, dmg, ffAll ? 0 : (mine ? 1 : -1));
  const wallX = mine ? EN_WALL : MY_WALL;
  if (Math.abs(x - wallX) < r * 1.1) damageWall(mine ? G.foeWall : G.wall, dmg * .6 * (mine ? 1 + G.mods.wallDmg : 1), wallX, !mine);
}
function splash(x, y, r, dmg, team, opt) {
  for (const o of G.A) {
    if (o.team === team || !alive(o)) continue;
    const d = Math.hypot(o.x - x, (o.y - 18 - y) * .8);
    if (d < r + o.r) {
      let f = 1 - d / (r + o.r);
      let dd = dmg * (.4 + f * .6);
      if (o.veh && G.mods.vehSplash && o.team === 1) dd *= (1 - G.mods.vehSplash);
      hurt(o, dd, Object.assign({ src: x }, opt || {}));
    }
  }
}
function chain(from, dmg, n) {
  let cur = from, hitl = [from];
  hurt(from, dmg, { pierce: 1, src: from.x });
  for (let i = 1; i < n; i++) {
    let best = null, bd = 220;
    for (const o of G.A) {
      if (o.team === from.team || !alive(o) || hitl.indexOf(o) >= 0) continue;
      const d = Math.hypot(o.x - cur.x, o.y - cur.y);
      if (d < bd) { bd = d; best = o; }
    }
    if (!best) break;
    G.FX.push({ k: 'arc', x1: cur.x, y1: cur.y - 22, x2: best.x, y2: best.y - 22, t: 0, life: .22 });
    hurt(best, dmg * Math.pow(.86, i), { pierce: 1, src: cur.x });
    fxSpark(best.x, best.y - 22, 6, '#9fe6ff', 160, .3);
    hitl.push(best); cur = best;
  }
  SFX.zap(); flashScreen(.09, '#a8e8ff');
}

/* =========================================================================
   DAMAGE
   ========================================================================= */
function hurt(c, amount, opt) {
  opt = opt || {};
  if (c.dying) return;
  let d = amount;
  if (!opt.pierce) {
    d *= (1 - c.armor);
    if (c.def.block) {
      const fromFront = opt.src !== undefined ? ((opt.src - c.x) * c.team > 0) : true;
      if (fromFront) {
        const worn = clamp(1 - (c.batter || 0) * .13, .28, 1);   // shield wears down
        d *= (1 - c.def.block * worn);
        c.batter = Math.min(8, (c.batter || 0) + 1); c.batterT = 1.7;
        if (chance(.3)) fxSpark(c.x + 10 * c.team, c.y - 26, 3, '#cfd6e2', 130, .2);
      }
    }
    if (c.team === 1 && G.mods.phalanx) {
      for (const o of G.A) if (o !== c && o.team === 1 && alive(o) && Math.abs(o.x - c.x) < 46) { d *= (1 - G.mods.phalanx); break; }
    }
  }
  d = Math.max(d, amount * .12);          // bludgeon floor - armor stacking never zeroes a hit
  c.hp -= d; c.hurtT = .12;
  if (!opt.silent) {
    const col = opt.hero ? (opt.tag === 'HEADSHOT' ? '#ffe27a' : opt.tag === 'CRIT' ? '#ff9d5a' : '#fff2d6')
      : (c.team === 1 ? '#ff9c8a' : '#ffd9b8');
    if (!opt.tag) ftext(c.x + rnd(-8, 8), c.y - 46 * (c.s || 1), Math.round(d), col, opt.hero ? 23 : 17);
    if (opt.hero) fxBlood(opt.srcX || c.x, c.y - 26, c.veh ? 0 : 7, c.team === 1 ? '150,22,20' : '150,22,20', c.team === 1 ? -1 : 1);
  }
  /* my wall thorns */
  if (c.team === -1 && G.mods.thorns && Math.abs(c.x - MY_WALL) < 40) { /* applied in wall step */ }
  if (c.hp <= 0) kill(c);
}

function kill(c, quiet) {
  if (c.dying) return;
  c.dying = .001; c.hp = 0;
  if (c.team === 1) G.pop = Math.max(0, G.pop - (c.pop || 0));
  if (c.veh) {
    fxExplosion(c.x, c.y - 18, 60, { floor: GROUND }); SFX.boom(1); shake(7);
    Art.decalWreck(c.x, c.y + 6, c.r, c.team === -1);
  } else {
    if (!quiet) { fxBlood(c.x, c.y - 26, 14, '150,22,20'); Art.decalBlood(c.x, c.y + 8, 5); }
    SFX.thud();
  }
  if (c.team === -1) {
    const g = Math.round((c.def.gold || 8) * (c.champ ? c.champ.gold / 60 : 1) * G.mods.goldMul * (1 + G.combo * .04));
    const xp = Math.round((c.def.xp || 5) * (c.champ ? c.champ.xp / 40 : 1));
    G.gold += g; addXp(xp); G.killed++;
    fxCoins(c.x, c.y - 22, clamp(Math.round(g / 7), 3, 11));
    G.goldPulse = 1;
    G.score += Math.round((c.def.xp || 5) * 10 * (1 + G.combo * .1));
    ftext(c.x + rnd(-10, 10), c.y - 60, '+' + g, '#ffd970', 19, { life: .95 });
    if (c.champ) {
      banner(c.champ.name + ' FALLS', 'THE CITY REELS');
      SFX.victory(); shake(20); flashScreen(.3, '#ffd9a0');
      fxExplosion(c.x, c.y - 30, 150, { col: '255,180,90' });
      damageWall(G.foeWall, G.foeWall.max * .12, EN_WALL, false);
    }
    if (chance(.35)) SFX.coin();
  }
}

function damageWall(tgt, d, wallX, isMine) {
  if (tgt.hp <= 0) return;
  if (isMine && G.shield > 0) {
    const abs = Math.min(G.shield, d); G.shield -= abs; d -= abs;
    fxRing(160, GROUND - 60, 232, 'rgba(150,240,255,.7)', .3, 2);
    if (abs > 0) ftext(wallX + 30, GROUND - 150, 'ABSORBED', '#8fe6ff', 17);
    if (d <= 0) return;
  }
  tgt.hp = Math.max(0, tgt.hp - d);
  fxSpark(wallX + (isMine ? 8 : -8), GROUND - rnd(30, 110), 6, isMine ? '#c8b48a' : '#e2a878', 200, .3);
  fxDebris(wallX + (isMine ? 10 : -10), GROUND - rnd(30, 100), 3, '#3a3630', GROUND + 20);
  if (isMine) {
    shake(Math.min(9, d / 24)); SFX.thud();
    if (d > 30) flashScreen(.06, '#ff6a4a');
    ftext(wallX + 40, GROUND - 130, '-' + Math.round(d), '#ff8a7a', 19);
  } else {
    ftext(wallX - 40, GROUND - 130, '-' + Math.round(d), '#ffd9a0', 19);
    if (d > 40) shake(3);
  }
}

/* =========================================================================
   COMBO / XP
   ========================================================================= */
function addCombo() {
  G.combo++; G.comboT = 3.4;
  if (G.combo >= 2) { $('comboTag').hidden = false; $('comboTxt').textContent = G.combo; $('comboTag').style.animation = 'none'; void $('comboTag').offsetWidth; $('comboTag').style.animation = ''; }
}
function breakCombo() { if (G.combo >= 3) toast('COMBO BROKEN ×' + G.combo, 'bad'); G.combo = 0; $('comboTag').hidden = true; }
function addXp(n) {
  G.xp += n;
  let need = xpFor(G.heroLv);
  while (G.xp >= need) {
    G.xp -= need; G.heroLv++; G.sp++;
    SFX.levelup(); flashScreen(.22, '#bfe6ff');
    banner('LEVEL ' + G.heroLv, 'A SKILL POINT AWAITS');
    fxRing(HERO.x, HERO.y, 120, 'rgba(160,225,255,.9)', .8, 4);
    toast('LEVEL UP — SPEND IT IN THE WAR COUNCIL', 'tech');
    need = xpFor(G.heroLv);
  }
  syncHud();
}

/* =========================================================================
   TURRETS
   ========================================================================= */
function stepTurrets(dt) {
  const base = GROUND + 6;
  const keepH = 250 + Math.min(9, G.grades.walls || 0) * 11;
  for (let i = 0; i < G.mods.turrets; i++) {
    const tx = i === 0 ? 150 : 46, ty = base - (i === 0 ? keepH : 176) - 12;
    G.turretRecoil[i] = Math.max(0, (G.turretRecoil[i] || 0) - dt * 3);
    G.turretCd[i] = (G.turretCd[i] || 0) - dt * (1 + G.mods.turretRate);
    let best = null, bd = 760;
    for (const o of G.A) { if (o.team !== -1 || !alive(o)) continue; const d = Math.hypot(o.x - tx, o.y - ty); if (d < bd) { bd = d; best = o; } }
    if (best) {
      const a = Math.atan2(best.y - 24 - ty, best.x - tx);
      G.turretAim[i] = lerp(G.turretAim[i] || 0, a, dt * 6);
      if (G.turretCd[i] <= 0) {
        G.turretCd[i] = 1.5;
        G.turretRecoil[i] = 1;
        const dmg = 30 + (G.cityN * 2.5);
        G.P.push({ team: 1, dmg, x: tx + Math.cos(a) * 22, y: ty + Math.sin(a) * 22, vx: Math.cos(a) * 880, vy: Math.sin(a) * 880, g: 120, k: 'bolt', r: 3 });
        SFX.shoot(.8); fxFlash(tx + Math.cos(a) * 24, ty + Math.sin(a) * 24, 22, '255,220,160', .1);
      }
    } else G.turretAim[i] = lerp(G.turretAim[i] || 0, -.35, dt * 2);
  }
  /* enemy city guns */
  G.foeTurrets.forEach(t => {
    t.recoil = Math.max(0, t.recoil - dt * 3); t.cd -= dt;
    let best = null, bd = 800;
    for (const o of G.A) { if (o.team !== 1 || !alive(o)) continue; const d = Math.hypot(o.x - t.x, o.y - t.y); if (d < bd) { bd = d; best = o; } }
    if (best) {
      const a = Math.atan2(best.y - 24 - t.y, best.x - t.x);
      t.aim = lerp(t.aim, a, dt * 5);
      if (t.cd <= 0) {
        t.cd = 1.9; t.recoil = 1;
        const dmg = 26 + G.cityN * 3;
        G.P.push({ team: -1, dmg, x: t.x + Math.cos(a) * 22, y: t.y + Math.sin(a) * 22, vx: Math.cos(a) * 820, vy: Math.sin(a) * 820, g: 120, k: 'bolt', r: 3, splash: 26 });
        SFX.gun();
      }
    } else t.aim = lerp(t.aim, Math.PI + .35, dt * 2);
  });
}

/* =========================================================================
   ENEMY CITY BRAIN
   ========================================================================= */
function pickFoe(cy) {
  const opts = cy.roster.filter(r => r.cost <= G.foeBank);
  if (!opts.length) return null;
  let tot = 0; opts.forEach(o => tot += o.w);
  let r = Math.random() * tot, sel = opts[0];
  for (const o of opts) { r -= o.w; if (r <= 0) { sel = o; break; } }
  G.foeBank -= sel.cost;
  return spawnFoe(sel.f);
}

function stepCity(dt) {
  const cy = G.city;
  const bossOut = G.champUp && G.A.some(c => c.champ && !c.dying);
  G.foeBank += cy.income * (bossOut ? .4 : 1) * dt;
  G.foeTimer -= dt;
  const cap = Math.min(64, 24 + G.cityN * 2);
  const foeCount = G.A.reduce((n, c) => n + (c.team === -1 && alive(c) ? 1 : 0), 0);

  if (G.foeTimer <= 0 && foeCount < cap) {
    G.foeTimer = clamp(1.5 - G.cityN * .04, .34, 1.5);
    pickFoe(cy);
  }

  /* ASSAULT SURGE — the city empties its coffers in one push. Later cities
     surge harder and more often; unprepared armies get rolled. */
  G.surgeT -= dt;
  if (G.surgeT <= 0) {
    G.surgeT = clamp(40 - G.cityN * 1.1, 16, 40);
    const burst = Math.min(2 + Math.floor(G.cityN / 2), 12);
    let sent = 0;
    for (let i = 0; i < burst && foeCount + sent < cap + 6; i++) { if (!pickFoe(cy)) break; sent++; }
    if (sent >= 3) { banner('ASSAULT', cy.name.toUpperCase() + ' EMPTIES ITS GATES'); SFX.horn(); shake(6); }
  }
  /* champion */
  if (cy.champ && !G.champUp) {
    G.champTimer += dt;
    if (G.champTimer > 48 || G.foeWall.hp / G.foeWall.max < .72) { G.champUp = true; spawnFoe(FOE[cy.champ.base], cy.champ); }
  }
}

/* =========================================================================
   ABILITIES
   ========================================================================= */
function useAbility(id, wx) {
  const a = ABIL[id];
  if (!G.mods.abil[id]) { SFX.deny(); return; }
  if (G.abilCd[id] > 0) { SFX.deny(); return; }
  if (a.target && wx === undefined) { G.armed = G.armed === id ? null : id; SFX.ui(); syncDock(); return; }
  G.abilCd[id] = a.cd; G.armed = null;
  if (id === 'barrage') {
    for (let i = 0; i < 6; i++) setTimeout(() => {
      if (G.phase !== 'battle') return;
      const x = wx + rnd(-70, 70);
      boom(x, GROUND - 10, 74, 90 + G.cityN * 9, true);
    }, i * 150);
    toast('BARRAGE — SHOT OUT', 'good'); SFX.horn();
  } else if (id === 'napalm') {
    G.FX.push({ k: 'fire', x: wx, w: 110, dps: 60 + G.cityN * 6, team: 1, t: 0, life: 8 });
    Art.decalScorch(wx, GROUND + 6, 130);
    toast('NAPALM — THE LANE BURNS', 'good'); SFX.boom(1.3); shake(8); flashScreen(.16, '#ff9040');
  } else if (id === 'rally') {
    G.rally = 9; toast('RALLY — FORWARD!', 'good'); SFX.horn(); flashScreen(.14, '#ffd9a0');
    G.A.forEach(c => { if (c.team === 1 && alive(c)) fxRing(c.x, c.y - 20, 40, 'rgba(255,210,120,.8)', .5, 2); });
  } else if (id === 'repair') {
    const amt = G.wall.max * .28;
    G.wall.hp = Math.min(G.wall.max, G.wall.hp + amt);
    toast('REPAIR — +' + Math.round(amt) + ' WALL', 'good'); SFX.buy();
    for (let i = 0; i < 16; i++) fxSpark(rnd(10, MY_WALL), GROUND - rnd(20, 130), 1, '#8fffa8', 90, .6);
  }
  syncDock();
}

/* =========================================================================
   LEVEL FLOW
   ========================================================================= */
function banner(top, sub) {
  $('bTop').textContent = top; $('bSub').textContent = sub;
  const b = $('banner'); b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}
function toast(msg, cls) {
  const d = document.createElement('div'); d.className = 'toast ' + (cls || ''); d.textContent = msg;
  $('toasts').appendChild(d); setTimeout(() => d.remove(), 2600);
}

/* re-derive a carried-over soldier's stats from current mods (they rested + refit) */
function refreshUnit(c) {
  const m = G.mods, def = c.def, veh = !!def.veh;
  const hpMul = 1 + m.unitHp + (veh ? m.vehHp : m.infHp);
  const dmgMul = 1 + m.unitDmg + (veh ? m.vehDmg : m.infDmg);
  c.max = def.hp * hpMul; c.hp = c.max;
  c.dmg = def.dmg * dmgMul;
  c.rate = def.rate / (veh ? 1 + m.vehRate : 1);
  c.spd = def.spd * (veh ? 1 + m.vehSpd : 1);
  c.burn = 0; c.burnDps = 0; c.dying = 0; c.cd = rnd(.2, .8); c.atk = 0; c.hurtT = 0;
}

function startCity(n) {
  G.cityN = n;
  const cy = makeCity(n); G.city = cy;
  Art.setCity(cy);

  /* the army marches with you — survivors carry to the next city */
  let survivors = G.A.filter(c => c.team === 1 && !c.dying);
  if (!survivors.length && G.pendingArmy) {           // restored from a save
    survivors = G.pendingArmy.map(id => UNIT[id]).filter(Boolean).map(def => ({
      team: 1, def, id: def.id, stance: def.stance, armor: def.armor, range: def.range,
      r: def.r * 1.15, pop: def.pop, veh: !!def.veh, s: bodyScale(def), fly: 0,
      ph: rnd(TAU), recoil: 0, charge: 0, sep: rnd(-12, 12), champ: null,
    }));
  }
  G.pendingArmy = null;

  G.A.length = 0; G.P.length = 0; G.FX.length = 0; PART.length = 0; FTEXT.length = 0; DECALS.length = 0;
  recompute();
  G.pop = 0;
  survivors.forEach((c, i) => {
    refreshUnit(c);
    c.x = MY_GATE - 10 + (i % 5) * 26 + rnd(-6, 6);
    c.y = GROUND + (c.sep = rnd(-12, 12));
    G.A.push(c); G.pop += c.pop;
  });
  if (survivors.length) toast(survivors.length + ' VETERANS MARCH WITH YOU', 'good');

  G.foeBank = cy.budget0; G.foeTimer = 1.2; G.champUp = false; G.champTimer = 0;
  G.surgeT = n === 1 ? 55 : 40;
  G.foeWall = { hp: cy.castleHp, max: cy.castleHp };
  recompute();
  G.wall.hp = G.wall.max;
  G.shield = G.mods.shieldMax;
  G.wind = rnd(-2.6, 2.6); G.windT = 0;
  G.rally = 0; G.combo = 0; G.levelT = 0; G.ended = 0;
  ABILITIES.forEach(a => G.abilCd[a.id] = 4);
  G.foeTurrets = [];
  const base = GROUND + 6;
  const spots = [[EN_WALL + 49, base - 224], [EN_WALL + 133, base - 302]];
  for (let i = 0; i < cy.turrets; i++) G.foeTurrets.push({ x: spots[i % 2][0], y: spots[i % 2][1], aim: Math.PI + .3, recoil: 0, cd: 3 });

  G.phase = 'battle'; G.paused = false; $('pause').hidden = true;
  $('inter').hidden = true; $('over').hidden = true;
  $('campBar').classList.add('on');
  banner(cy.name.toUpperCase(), (cy.ep ? cy.ep.toUpperCase() + ' · ' : '') + 'CITY ' + n);
  if (n === 1) setTimeout(() => toast('MUSTER SWORDSMEN [Q] AND ARCHERS [A] — THEY MARCH, YOU SHOOT', 'tech'), 2600);
  SFX.horn();
  syncHud(); syncDock(); buildTech(); buildArmory(); buildHero();
  save();
}

function cityFalls() {
  if (G.ended) return; G.ended = 1;
  G.phase = 'inter';
  const cy = G.city;
  const gold = cy.goldRw, rp = cy.rpRw + G.mods.rpBonus;
  G.gold += gold; G.rp += rp;
  const sc = 2000 * G.cityN; G.score += sc;
  addXp(Math.round(90 + G.cityN * 34));
  SFX.victory(); flashScreen(.4, '#ffe6b0'); shake(26);
  for (let i = 0; i < 26; i++) setTimeout(() => fxExplosion(rnd(EN_WALL, W), GROUND - rnd(20, 260), rnd(40, 110), { col: '255,170,70' }), i * 90);
  for (let i = 0; i < 12; i++) setTimeout(() => fxCoins(rnd(EN_WALL, W - 60), GROUND - rnd(60, 200), 7), i * 130);
  hitstop(.18);

  $('interKicker').textContent = 'THE WALLS ARE BROKEN';
  $('interTitle').textContent = cy.name.toUpperCase() + ' HAS FALLEN';
  $('interRewards').innerHTML =
    rwd('g', '+' + gold, 'PLUNDER') + rwd('r', '+' + rp, 'RESEARCH') +
    rwd('s', '+' + sc.toLocaleString(), 'SCORE') + rwd('s', G.killed, 'SLAIN');
  const nx = makeCity(G.cityN + 1);
  $('nextCity').innerHTML = `<div class="nk">NEXT ON THE ROAD</div><div class="nn">${nx.name}${nx.ep ? ', ' + nx.ep : ''}</div>
    <div class="nt">${nx.traits.map(t => `<i title="${t.note}">${t.name}</i>`).join('') || '<i>NO KNOWN DOCTRINE</i>'}</div>`;
  setTimeout(() => { $('inter').hidden = false; }, 1300);
  syncHud(); save();
}

function defeat() {
  if (G.ended) return; G.ended = 1;
  G.phase = 'over';
  SFX.fall(); shake(34); flashScreen(.5, '#ff4a2a');
  for (let i = 0; i < 20; i++) setTimeout(() => fxExplosion(rnd(0, MY_WALL), GROUND - rnd(20, 200), rnd(40, 100), { col: '255,120,50' }), i * 110);
  $('oStats').innerHTML =
    rwd('s', G.cityN, 'CITIES REACHED') + rwd('s', (G.cityN - 1), 'CITIES BROKEN') +
    rwd('g', G.score.toLocaleString(), 'SCORE') + rwd('r', G.heroLv, 'HERO LEVEL') +
    rwd('s', G.headshots, 'HEADSHOTS');
  setTimeout(() => { $('over').hidden = false; }, 1500);
  localStorage.removeItem('bowbat_save');
}
const rwd = (k, v, l) => `<div class="rwd ${k}"><div class="v">${v}</div><div class="k">${l}</div></div>`;

/* =========================================================================
   HERO
   ========================================================================= */
function stepHero(dt) {
  if (G.drawing) {
    const rate = 1 / (0.68 / (bow().draw * G.mods.drawSpeed));
    if (G.charge < 1) { G.charge = Math.min(1, G.charge + rate * dt); if (chance(dt * 6)) SFX.draw(); }
  }
  G.released = Math.max(0, G.released - dt);
}

function trajectory() {
  const p = clamp(G.charge, .12, 1), b = bow();
  const a = Math.atan2(G.mouse.y - HERO.y, G.mouse.x - HERO.x);
  const spd = (520 + 880 * p) * b.vel;
  let x = HERO.x, y = HERO.y, vx = Math.cos(a) * spd, vy = Math.sin(a) * spd;
  const pts = [], dt = 1 / 45;
  for (let i = 0; i < 130; i++) {
    vy += 500 * dt; vx += G.wind * 18 * dt;
    x += vx * dt; y += vy * dt;
    pts.push(x, y);
    if (y > GROUND || x > EN_WALL + 20 || x < 0) break;
  }
  return pts;
}

/* =========================================================================
   MAIN LOOP
   ========================================================================= */
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
  if (CAM.hitstop > 0) { CAM.hitstop -= dt; dt *= .12; }
  G.dt = dt;

  if (G.phase === 'battle' && !G.paused) {
    G.t += dt; G.levelT += dt;
    stepHero(dt);
    G.windT += dt;
    if (G.windT > 9) { G.windT = 0; G.wind = clamp(G.wind + rnd(-1.4, 1.4), -3.2, 3.2); }
    G.rally = Math.max(0, G.rally - dt);
    G.deployCd = Math.max(0, G.deployCd - dt);
    /* war-tax: the fortress earns while it stands, so reinforcement never stalls */
    G.gold += (2.4 + .35 * (G.grades.purse || 0)) * dt;
    ABILITIES.forEach(a => { if (G.abilCd[a.id] > 0) G.abilCd[a.id] = Math.max(0, G.abilCd[a.id] - dt); });
    if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) breakCombo(); }

    /* wall regen + thorns */
    if (G.mods.wallRegen && G.wall.hp < G.wall.max) G.wall.hp = Math.min(G.wall.max, G.wall.hp + G.wall.max * G.mods.wallRegen * dt);
    if (G.mods.thorns) for (const o of G.A) if (o.team === -1 && alive(o) && Math.abs(o.x - MY_WALL) < 44) hurt(o, G.mods.thorns * dt, { silent: 1, src: 0 });

    stepCity(dt); stepTurrets(dt);
    for (const c of G.A) stepCombatant(c, dt);
    for (let i = G.A.length - 1; i >= 0; i--) if (G.A[i].dying > .85) G.A.splice(i, 1);
    stepProjectiles(dt);

    if (G.foeWall.hp <= 0) cityFalls();
    else if (G.wall.hp <= 0) defeat();
  }

  partsUpdate(dt); ftextUpdate(dt); camUpdate(dt);
  render();
  if (G.phase === 'battle') { hudTick += dt; if (hudTick > .1) { hudTick = 0; syncHud(); syncDock(); } }
}
let hudTick = 0;

/* =========================================================================
   RENDER
   ========================================================================= */
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!G.city) { ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, cv.width, cv.height); return; }

  /* fill bands outside the 16:9 battlefield so it reads as one scene, not letterbox */
  const p = Art.pal;
  ctx.fillStyle = p ? p.sky[0] : '#05060a'; ctx.fillRect(0, 0, cv.width, cv.height);
  const wBot = VOY + H * VS;
  if (wBot < cv.height) { ctx.fillStyle = p ? p.gnd[2] : '#05060a'; ctx.fillRect(0, wBot - 1, cv.width, cv.height - wBot + 2); }

  ctx.setTransform(VS, 0, 0, VS, VOX + CAM.sx * VS, VOY + CAM.sy * VS);

  Art.drawSky(ctx, G.t);
  Art.drawMid(ctx);
  Art.drawGround(ctx);
  drawDecals();
  Art.enemyCity(ctx, G, G.t);
  Art.myCastle(ctx, G, G.t);

  /* combatants: fliers first (further), then ground by depth lane */
  const list = G.A.slice().sort((a, b) => (a.fly ? 0 : 1) - (b.fly ? 0 : 1) || a.y - b.y);
  for (const c of list) drawCombatant(c);

  drawProjectiles();
  drawFields();
  Art.particles(ctx);
  Art.floaters(ctx);
  drawHero();
  Art.drawNear(ctx);
  Art.weather(ctx, G.dt, G.t);
  drawReticle();

  /* screen tint */
  if (CAM.tintA > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = CAM.tintA * .55;
    ctx.fillStyle = CAM.tint; ctx.fillRect(-100, -100, W + 200, H + 200); ctx.restore();
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function drawDecals() {
  ctx.save(); ctx.strokeStyle = 'rgba(70,60,48,.55)'; ctx.lineWidth = 1.6;
  for (const d of DECALS) {
    ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(clamp(d.a, .5, 1.35));
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-16, -13); ctx.stroke(); ctx.restore();
  }
  ctx.restore();
}

function visual(c) {
  const P = c.team === 1 ? ALLY : ENEM;
  const s = (c.s || 1);
  const dir = c.team;
  const o = { x: c.x, y: c.y, s, dir, ph: c.ph, P, atk: c.atk, recoil: c.recoil, charge: c.charge };
  switch (c.id) {
    case 'sword': case 'grunt': o.weapon = 'sword'; break;
    case 'shield': case 'shieldF': o.weapon = 'sword'; o.shield = 1; break;
    case 'zerk': case 'runner': o.weapon = 'axe'; o.eyes = c.team === -1; break;
    case 'knight': o.weapon = 'sword'; o.shield = 1; o.plume = 1; o.cape = 1; break;
    case 'brute': o.weapon = 'axe'; o.plume = 1; o.eyes = 1; break;
    case 'sapper': o.weapon = 'axe'; o.eyes = 1; break;
    case 'archer': case 'bowF': o.weapon = 'bow'; o.reload = clamp(1 - c.cd / Math.max(.01, c.rate), 0, 1); break;
    case 'musket': case 'gunF': o.weapon = 'musket'; break;
    case 'crew': case 'mortF': o.weapon = 'tube'; break;
    case 'medic': o.weapon = 'staff'; o.orb = '#8fe8a0'; break;
    case 'pyro': o.weapon = 'staff'; o.orb = '#ff9040'; o.cape = 1; break;
    case 'caller': o.weapon = 'staff'; o.orb = '#8fd8ff'; o.cape = 1; break;
    case 'banner': o.weapon = 'flag'; break;
  }
  return o;
}

function drawCombatant(c) {
  const dead = c.dying > 0;
  ctx.save();
  if (dead) {
    const f = clamp(c.dying / .85, 0, 1);
    ctx.globalAlpha = 1 - f * .85;
    ctx.translate(c.x, c.y); ctx.rotate(ease.out(f) * 1.5 * (c.team === 1 ? -1 : 1)); ctx.translate(-c.x, -c.y);
  }
  if (!c.fly) Art.shadow(ctx, c.x, c.y + 2, c.r * 1.3 * (c.s || 1), dead ? .18 : .38);

  const o = visual(c);
  if (c.hurtT > 0 && !dead) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; }

  if (c.id === 'ltank' || c.id === 'htank' || c.id === 'ltankF' || c.id === 'htankF') {
    o.heavy = (c.id === 'htank' || c.id === 'htankF'); o.turn = -.12; Art.tank(ctx, o);
  } else if (c.id === 'arty' || c.id === 'catF') { o.elev = .62; Art.arty(ctx, o); }
  else if (c.id === 'mech') Art.mech(ctx, o);
  else if (c.id === 'ram') Art.ram(ctx, o);
  else if (c.fly) Art.gunship(ctx, o);
  else Art.human(ctx, o);

  if (c.hurtT > 0 && !dead) {
    ctx.globalAlpha = c.hurtT * 2.4;
    ctx.fillStyle = 'rgba(255,190,170,.5)';
    ctx.fillRect(c.x - c.r, c.y - 48 * (c.s || 1), c.r * 2, 48 * (c.s || 1));
    ctx.restore();
  }
  ctx.restore();

  if (dead) return;
  /* health pip */
  if (c.hp < c.max - .5) {
    const w = Math.max(22, c.r * 2.2), f = clamp(c.hp / c.max, 0, 1);
    const y = c.y - (c.fly ? 26 : 52 * (c.s || 1));
    ctx.fillStyle = 'rgba(0,0,0,.66)'; ctx.fillRect(c.x - w / 2 - 1, y - 1, w + 2, 6);
    ctx.fillStyle = c.team === 1 ? '#7fd4ff' : '#e2523a';
    ctx.fillRect(c.x - w / 2, y, w * f, 4);
  }
  if (c.champ) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    Art.glowDot(ctx, c.x, c.y - 30, 70, '255,80,40', .18 + Math.sin(G.t * 4) * .05);
    ctx.restore();
    ctx.fillStyle = '#ffb0a0'; ctx.font = '10px "Trebuchet MS"'; ctx.textAlign = 'center';
    ctx.fillText(c.champ.name, c.x, c.y - 64 * (c.s || 1));
  }
  if (G.rally > 0 && c.team === 1) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    Art.glowDot(ctx, c.x, c.y - 16, 34, '255,190,90', .12 + Math.sin(G.t * 8 + c.ph) * .04);
    ctx.restore();
  }
}

function drawProjectiles() {
  for (const p of G.P) {
    if (p.hero) {
      /* ribbon trail */
      if (p.trail.length > 3) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const col = p.kind === 'fire' ? '255,150,60' : p.kind === 'storm' ? '140,225,255' : p.kind === 'bomb' ? '255,190,90' : '235,225,190';
        for (let i = 0; i < p.trail.length - 2; i += 2) {
          const f = i / p.trail.length;
          ctx.strokeStyle = `rgba(${col},${(f * .5).toFixed(3)})`; ctx.lineWidth = 1 + f * 2.4;
          ctx.beginPath(); ctx.moveTo(p.trail[i], p.trail[i + 1]); ctx.lineTo(p.trail[i + 2], p.trail[i + 3]); ctx.stroke();
        }
        ctx.restore();
      }
      const a = Math.atan2(p.vy, p.vx);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
      ctx.strokeStyle = '#d8cba6'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(6, 0); ctx.stroke();
      ctx.fillStyle = p.kind === 'bomb' ? '#3a3a44' : '#e8e2cc';
      if (p.kind === 'bomb') { ctx.beginPath(); ctx.arc(6, 0, 5, 0, TAU); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-1, -3); ctx.lineTo(-1, 3); ctx.closePath(); ctx.fill(); }
      ctx.strokeStyle = '#8a7f66'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-12, -3.4); ctx.moveTo(-16, 0); ctx.lineTo(-12, 3.4); ctx.stroke();
      ctx.restore();
      if (p.kind === 'fire') Art.glowDot(ctx, p.x, p.y, 22, '255,140,50', .5);
      if (p.kind === 'storm') Art.glowDot(ctx, p.x, p.y, 20, '120,220,255', .55);
    } else if (p.k === 'shell') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      Art.glowDot(ctx, p.x, p.y, 14, p.team === 1 ? '255,200,130' : '255,130,90', .55);
      ctx.restore();
      ctx.fillStyle = p.team === 1 ? '#efdcb4' : '#e8b0a0';
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.fillRect(-5, -2, 10, 4); ctx.restore();
      if (chance(.5)) fxSmoke(p.x, p.y, 1, 5, '90,84,74', 6, .5);
    } else if (p.k === 'bullet' || p.k === 'bolt') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = p.team === 1 ? 'rgba(255,232,180,.9)' : 'rgba(255,150,110,.9)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .016, p.y - p.vy * .016); ctx.stroke();
      ctx.restore();
    } else { /* unit arrows */
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.strokeStyle = p.team === 1 ? '#cdbf9c' : '#c09080'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(4, 0); ctx.stroke(); ctx.restore();
    }
  }
}

function drawFields() {
  for (const f of G.FX) {
    if (f.k === 'beam') {
      const a = 1 - f.t / f.life;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(160,235,255,${a * .9})`; ctx.lineWidth = 7 * a;
      ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 2.4 * a;
      ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke();
      ctx.restore();
    } else if (f.k === 'arc') {
      const a = 1 - f.t / f.life;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(170,235,255,${a})`; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(f.x1, f.y1);
      const n = 5;
      for (let i = 1; i < n; i++) {
        const t = i / n;
        ctx.lineTo(lerp(f.x1, f.x2, t) + rnd(-11, 11), lerp(f.y1, f.y2, t) + rnd(-11, 11));
      }
      ctx.lineTo(f.x2, f.y2); ctx.stroke(); ctx.restore();
    } else if (f.k === 'fire') {
      const a = clamp(1 - f.t / f.life, 0, 1);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(0, GROUND - 60, 0, GROUND + 6);
      g.addColorStop(0, `rgba(255,140,40,0)`); g.addColorStop(1, `rgba(255,110,30,${.24 * a})`);
      ctx.fillStyle = g; ctx.fillRect(f.x - f.w, GROUND - 60, f.w * 2, 66);
      ctx.restore();
    }
  }
}

/* ---- the archer on the wall ---- */
function drawHero() {
  const a = Math.atan2(G.mouse.y - HERO.y, G.mouse.x - HERO.x);
  const p = G.charge, rel = G.released;
  ctx.save();
  Art.shadow(ctx, HERO.x, HERO.y + 12, 14, .3);
  /* body */
  const P = { body: '#1a222e', dark: '#0d131b', trim: '#93aec9', metal: '#8393a6', cloth: '#2c5c8f', accent: '#f0c264', skin: '#c99a6e' };
  ctx.strokeStyle = P.dark; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(HERO.x - 2, HERO.y + 2); ctx.lineTo(HERO.x - 8, HERO.y + 13); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(HERO.x - 2, HERO.y + 2); ctx.lineTo(HERO.x + 8, HERO.y + 13); ctx.stroke();
  /* cloak */
  ctx.fillStyle = P.cloth;
  ctx.beginPath(); ctx.moveTo(HERO.x - 5, HERO.y - 12);
  ctx.quadraticCurveTo(HERO.x - 20 - G.wind * 2, HERO.y + 2, HERO.x - 12, HERO.y + 16);
  ctx.lineTo(HERO.x - 1, HERO.y + 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = P.body;
  ctx.beginPath(); ctx.moveTo(HERO.x - 7, HERO.y + 4); ctx.lineTo(HERO.x - 8, HERO.y - 13);
  ctx.lineTo(HERO.x + 8, HERO.y - 13); ctx.lineTo(HERO.x + 7, HERO.y + 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = P.skin; ctx.beginPath(); ctx.arc(HERO.x + 2, HERO.y - 20, 5.4, 0, TAU); ctx.fill();
  ctx.fillStyle = P.metal; ctx.beginPath(); ctx.arc(HERO.x + 1, HERO.y - 21, 6.2, Math.PI, 0); ctx.fill();
  ctx.fillStyle = P.accent; ctx.fillRect(HERO.x + 3, HERO.y - 21, 4, 1.6);
  /* quiver */
  ctx.strokeStyle = '#5a4326'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(HERO.x - 9, HERO.y - 10); ctx.lineTo(HERO.x - 12, HERO.y + 2); ctx.stroke();
  ctx.strokeStyle = '#cbbf9d'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(HERO.x - 9 + i * 1.6, HERO.y - 11); ctx.lineTo(HERO.x - 12 + i * 1.8, HERO.y - 20); ctx.stroke(); }

  /* bow */
  ctx.save(); ctx.translate(HERO.x, HERO.y - 8); ctx.rotate(a);
  const R = 22, pull = -6 - p * 13 + rel * 26;
  ctx.strokeStyle = '#6f4d29'; ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.arc(0, 0, R, -1.22, 1.22); ctx.stroke();
  ctx.strokeStyle = '#4a3419'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, 0, R, -1.22, 1.22); ctx.stroke();
  ctx.strokeStyle = 'rgba(245,240,220,.85)'; ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(R * Math.cos(-1.22), R * Math.sin(-1.22)); ctx.lineTo(pull, 0);
  ctx.lineTo(R * Math.cos(1.22), R * Math.sin(1.22)); ctx.stroke();
  if (G.drawing || rel > 0) {
    const at = ARROWS[G.arrow];
    ctx.strokeStyle = '#d8cba6'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(pull, 0); ctx.lineTo(pull + 34, 0); ctx.stroke();
    ctx.fillStyle = at.id === 'fire' ? '#ff8a3a' : at.id === 'storm' ? '#8fe0ff' : at.id === 'bomb' ? '#4a4a56' : '#efe8d2';
    ctx.beginPath(); ctx.arc(pull + 34, 0, at.id === 'bomb' ? 4.4 : 2.6, 0, TAU); ctx.fill();
    if (at.id === 'fire') Art.glowDot(ctx, pull + 34, 0, 16, '255,140,50', .6);
    if (at.id === 'storm') Art.glowDot(ctx, pull + 34, 0, 16, '120,220,255', .6);
  }
  /* draw glow */
  if (p > .05) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    Art.glowDot(ctx, 0, 0, 26 + p * 30, p > .96 ? '255,230,150' : '150,190,230', .12 + p * .3);
    ctx.restore();
  }
  ctx.restore();
  ctx.restore();

  /* trajectory — short instinct hint always; full wind-true arc with Eagle Eye */
  if (G.drawing) {
    let pts = trajectory();
    if (!G.mods.predict) pts = pts.slice(0, Math.max(10, pts.length * .30) & ~1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < pts.length - 2; i += 2) {
      const f = i / pts.length;
      if ((i / 2) % 3 !== 0) continue;
      ctx.fillStyle = `rgba(255,225,160,${(.45 * (1 - f)).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(pts[i], pts[i + 1], 1.9 - f, 0, TAU); ctx.fill();
    }
    if (pts.length > 2) {
      const ex = pts[pts.length - 2], ey = pts[pts.length - 1];
      ctx.strokeStyle = 'rgba(255,220,150,.5)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(ex, ey, 9, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }
}

function drawReticle() {
  const m = G.mouse;
  if (G.armed) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const w = G.armed === 'napalm' ? 110 : 80;
    ctx.strokeStyle = 'rgba(255,140,60,.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(m.x - w, GROUND); ctx.lineTo(m.x + w, GROUND); ctx.stroke();
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(m.x - w, GROUND - 70); ctx.lineTo(m.x - w, GROUND);
    ctx.moveTo(m.x + w, GROUND - 70); ctx.lineTo(m.x + w, GROUND); ctx.stroke();
    ctx.setLineDash([]);
    Art.glowDot(ctx, m.x, GROUND - 10, 70, '255,130,50', .2);
    ctx.restore();
  }
  ctx.save();
  ctx.translate(m.x, m.y);
  const p = G.charge;
  ctx.strokeStyle = p > .96 ? 'rgba(255,225,140,.95)' : 'rgba(230,236,246,.7)';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(-5, 0); ctx.moveTo(5, 0); ctx.lineTo(13, 0);
  ctx.moveTo(0, -13); ctx.lineTo(0, -5); ctx.moveTo(0, 5); ctx.lineTo(0, 13); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 2, 0, TAU); ctx.stroke();
  if (p > 0) {
    ctx.strokeStyle = p > .96 ? '#ffe27a' : '#8fd0ff'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.arc(0, 0, 19, -Math.PI / 2, -Math.PI / 2 + TAU * p); ctx.stroke();
    if (p > .96) { ctx.save(); ctx.globalCompositeOperation = 'lighter';
      Art.glowDot(ctx, 0, 0, 30, '255,220,130', .3); ctx.restore(); }
  }
  ctx.restore();
}

/* =========================================================================
   HUD
   ========================================================================= */
function syncHud() {
  const wf = clamp(G.wall.hp / G.wall.max, 0, 1);
  $('castleBar').style.width = (wf * 100).toFixed(1) + '%';
  $('castleTxt').textContent = Math.ceil(G.wall.hp) + ' / ' + G.wall.max;
  $('shieldChip').hidden = !(G.shield > 0); if (G.shield > 0) $('shieldTxt').textContent = Math.ceil(G.shield);
  $('regenChip').hidden = !G.mods.wallRegen;
  $('popTxt').textContent = G.pop + '/' + G.mods.popMax;
  $('goldTxt').textContent = Math.floor(G.gold).toLocaleString();
  if (G.goldPulse) {
    G.goldPulse = 0;
    const el = $('goldTxt').parentElement;
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }
  $('rpTxt').textContent = G.rp;
  $('scoreTxt').textContent = G.score.toLocaleString();
  const w = G.wind;
  $('windArrow').textContent = w > .25 ? '→' : w < -.25 ? '←' : '·';
  $('windArrow').style.color = Math.abs(w) > 1.8 ? '#ff9a6a' : '#9aa8bb';
  $('windTxt').textContent = Math.abs(w).toFixed(1);
  $('heroLv').textContent = G.heroLv;
  $('bowName').textContent = bow().name;
  $('xpBar').style.width = clamp(G.xp / xpFor(G.heroLv), 0, 1) * 100 + '%';
  $('spTag').hidden = G.sp <= 0; $('spTxt').textContent = G.sp;
  if (G.city) {
    $('cityNum').textContent = G.cityN;
    $('cityName').textContent = G.city.name;
    $('cityName').title = G.city.title;
    $('cityTraits').innerHTML = G.city.traits.map(t => `<i title="${t.note}">${t.name.split(' ')[0]}</i>`).join('');
    $('campName').textContent = G.city.name.toUpperCase() + ' — WALLS';
    $('campBarFill').style.width = clamp(G.foeWall.hp / G.foeWall.max, 0, 1) * 100 + '%';
  }
  $('popcap').textContent = G.pop + ' / ' + G.mods.popMax + ' SLOTS';
}

/* =========================================================================
   DOCK
   ========================================================================= */
function buildDock() {
  const ar = $('arrowRow'); ar.innerHTML = '';
  ARROWS.forEach((a, i) => {
    const d = document.createElement('div');
    d.className = 'slot'; d.dataset.arrow = i;
    d.innerHTML = `<span class="key">${a.key}</span><span class="glyph">${svg(a.icon)}</span>
      <span class="nm">${a.name}</span><span class="cost">${a.cost ? '◍' + a.cost : 'FREE'}</span>`;
    d.onclick = () => selectArrow(i);
    d.onmouseenter = () => { }; d.title = a.name + ' — ' + a.desc;
    ar.appendChild(d);
  });
  const ur = $('unitRow'); ur.innerHTML = '';
  UNITS.forEach(u => {
    const d = document.createElement('div');
    d.className = 'slot'; d.dataset.unit = u.id;
    d.innerHTML = `<span class="key">${u.key}</span><span class="glyph">${svg(u.icon)}</span>
      <span class="nm">${u.name}</span><span class="cost">◍${u.cost}</span>`;
    d.onclick = () => deploy(u.id);
    d.title = `${u.name} · ${u.pop} slot${u.pop > 1 ? 's' : ''} · ${u.stance.toUpperCase()}\n${u.desc}\nHP ${u.hp} · DMG ${u.dmg} · RANGE ${u.range}`;
    ur.appendChild(d);
  });
  const br = $('abilityRow'); br.innerHTML = '';
  ABILITIES.forEach(a => {
    const d = document.createElement('div');
    d.className = 'slot'; d.dataset.abil = a.id;
    d.innerHTML = `<span class="key">${a.key}</span><span class="glyph">${svg(a.icon)}</span>
      <span class="nm">${a.name}</span><span class="cost">${a.cd}s</span>
      <div class="cd" style="transform:scaleY(0)"></div><div class="cdTxt"></div>`;
    d.onclick = () => useAbility(a.id);
    d.title = a.name + ' — ' + a.desc;
    br.appendChild(d);
  });
}

function syncDock() {
  if (!G.mods) return;
  $('arrowRow').querySelectorAll('.slot').forEach((el, i) => {
    const a = ARROWS[i], un = a.unlocked || G.mods.arrow[a.id];
    el.classList.toggle('locked', !un);
    el.classList.toggle('sel', G.arrow === i);
    el.classList.toggle('broke', !!(a.cost && G.gold < a.cost));
  });
  $('unitRow').querySelectorAll('.slot').forEach(el => {
    const u = UNIT[el.dataset.unit], un = !!G.mods.unit[u.id];
    const afford = G.gold >= u.cost && G.pop + u.pop <= G.mods.popMax;
    el.classList.toggle('locked', !un);
    el.classList.toggle('broke', un && !afford);
  });
  $('abilityRow').querySelectorAll('.slot').forEach(el => {
    const a = ABIL[el.dataset.abil], un = !!G.mods.abil[a.id];
    el.classList.toggle('locked', !un);
    el.classList.toggle('armed', G.armed === a.id);
    const cd = G.abilCd[a.id] || 0;
    el.querySelector('.cd').style.transform = 'scaleY(' + clamp(cd / a.cd, 0, 1) + ')';
    el.querySelector('.cdTxt').textContent = cd > 0 ? Math.ceil(cd) : '';
  });
}

function selectArrow(i) {
  const a = ARROWS[i];
  if (!(a.unlocked || G.mods.arrow[a.id])) { SFX.deny(); toast('NOT YET RESEARCHED', 'bad'); return; }
  G.arrow = i; SFX.ui(); syncDock();
}

function deploy(id) {
  const u = UNIT[id];
  if (!G.mods.unit[id]) { SFX.deny(); toast('NOT YET RESEARCHED', 'bad'); return; }
  if (G.phase !== 'battle') { SFX.deny(); return; }
  if (G.deployCd > 0) return;
  if (G.pop + u.pop > G.mods.popMax) { SFX.deny(); toast('NO ARMY SLOTS — BUY MORE IN THE ARMORY', 'bad'); return; }
  if (G.gold < u.cost) { SFX.deny(); toast('NOT ENOUGH GOLD', 'bad'); return; }
  G.gold -= u.cost; G.deployCd = .16;
  spawnUnit(u);
  syncHud(); syncDock();
}

/* =========================================================================
   WAR COUNCIL — doctrine tree
   ========================================================================= */
const NODE_W = 124, NODE_H = 112, COL = 156, ROW = 124, LEFT = 138;
function techLayout() {
  const bands = {}; let y = 10;
  BRANCHES.forEach(b => {
    const rows = TECH.filter(t => t.b === b.id).reduce((m, t) => Math.max(m, t.row || 0), 0) + 1;
    bands[b.id] = { y, rows, h: rows * ROW + 18 };
    y += bands[b.id].h;
  });
  return { bands, height: y };
}
function techState(t) {
  if (G.tech.has(t.id)) return 'owned';
  const ok = t.req.every(r => G.tech.has(r));
  if (!ok) return 'lockd';
  return G.rp >= t.cost ? 'avail' : 'lockd2';
}
function buildTech() {
  const host = $('techInner'), lay = techLayout();
  host.style.height = lay.height + 'px';
  host.querySelectorAll('.node,.branchLbl').forEach(n => n.remove());
  const svgEl = $('techLines'); svgEl.setAttribute('viewBox', `0 0 1400 ${lay.height}`);
  svgEl.style.height = lay.height + 'px'; svgEl.innerHTML = '';

  BRANCHES.forEach(b => {
    const band = lay.bands[b.id];
    const l = document.createElement('div');
    l.className = 'branchLbl'; l.style.top = (band.y + band.h / 2 - 22) + 'px';
    l.innerHTML = `${b.name}<small>${b.sub}</small>`;
    host.appendChild(l);
  });

  const pos = {};
  TECH.forEach(t => {
    const band = lay.bands[t.b];
    pos[t.id] = { x: LEFT + t.t * COL, y: band.y + (t.row || 0) * ROW + 6 };
  });

  TECH.forEach(t => {
    t.req.forEach(r => {
      const a = pos[r], b2 = pos[t.id]; if (!a) return;
      const st = G.tech.has(t.id) ? '#c39a35' : (G.tech.has(r) ? '#3f6272' : '#241f18');
      const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2, x2 = b2.x, y2 = b2.y + NODE_H / 2;
      const mx = (x1 + x2) / 2;
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`);
      p.setAttribute('stroke', st); p.setAttribute('stroke-width', G.tech.has(t.id) ? 2.2 : 1.4);
      p.setAttribute('fill', 'none');
      if (G.tech.has(t.id)) p.setAttribute('filter', 'drop-shadow(0 0 4px rgba(220,170,60,.5))');
      svgEl.appendChild(p);
    });
  });

  TECH.forEach(t => {
    const st = techState(t), p = pos[t.id];
    const d = document.createElement('div');
    d.className = 'node ' + (st === 'lockd2' ? 'lockd' : st);
    d.style.left = p.x + 'px'; d.style.top = p.y + 'px';
    d.innerHTML = `<span class="tier">T${t.t + 1}</span><span class="nIco">${svg(t.icon)}</span>
      <span class="nName">${t.name}</span><span class="nCost">✦ ${t.cost}</span>`;
    d.onmouseenter = () => showTip(t, st);
    d.onclick = () => buyTech(t);
    host.appendChild(d);
  });
}
function showTip(t, st) {
  const owned = st === 'owned';
  const missing = t.req.filter(r => !G.tech.has(r)).map(r => TECHM[r].name);
  let hint = owned ? '<span class="buyhint">ADOPTED</span>'
    : missing.length ? `<span class="no">REQUIRES ${missing.join(' + ')}</span>`
      : G.rp >= t.cost ? '<span class="buyhint">CLICK TO ADOPT</span>'
        : `<span class="no">NEEDS ${t.cost - G.rp} MORE RESEARCH</span>`;
  $('techTip').innerHTML = `<b>${t.name}</b> — ${t.d} &nbsp; ${hint}`;
}
function buyTech(t) {
  if (G.tech.has(t.id)) { SFX.deny(); return; }
  if (!t.req.every(r => G.tech.has(r))) { SFX.deny(); toast('PREREQUISITE MISSING', 'bad'); return; }
  if (G.rp < t.cost) { SFX.deny(); toast('NOT ENOUGH RESEARCH', 'bad'); return; }
  G.rp -= t.cost; G.tech.add(t.id); recompute();
  SFX.buy(); toast('ADOPTED — ' + t.name, 'tech');
  buildTech(); syncCouncil('rp'); syncHud(); syncDock(); buildArmory(); save();
}

/* =========================================================================
   WAR COUNCIL — armory
   ========================================================================= */
function buildArmory() {
  const host = $('armGrid'); host.innerHTML = '';
  GRADES.forEach(g => {
    const lv = G.grades[g.id] || 0, maxed = lv >= g.max, cost = gradeCost(g, lv);
    const can = !maxed && G.gold >= cost;
    const d = document.createElement('div');
    d.className = 'gcard ' + (maxed ? 'max' : can ? 'can' : 'no');
    let pips = ''; for (let i = 0; i < g.max; i++) pips += `<i class="${i < lv ? 'on' : ''}"></i>`;
    d.innerHTML = `<div class="gIco">${svg(g.icon)}</div><div class="gBody">
      <div class="gName"><span>${g.name}</span><span class="gLv">${lv} / ${g.max}</span></div>
      <div class="gEff">${g.unit}</div>
      <div class="gDesc">${g.desc}</div>
      <div class="gPips">${pips}</div>
      <div class="gBuy">${maxed ? 'MASTERED' : '◍ ' + cost.toLocaleString()}</div></div>`;
    if (!maxed) d.onclick = () => buyGrade(g);
    host.appendChild(d);
  });

  const rack = $('bowRack'); rack.innerHTML = '';
  BOWS.forEach((b, i) => {
    const owned = i <= G.bow, eq = i === G.bow;
    const can = !owned && i === G.bow + 1 && G.gold >= b.cost;
    const d = document.createElement('div');
    d.className = 'bowCard ' + (eq ? 'owned eq' : owned ? 'owned' : (i === G.bow + 1 ? (can ? 'can' : 'no') : 'no'));
    d.innerHTML = `<div class="bwN">${b.name}</div>
      <div class="bwS">DAMAGE <b>${b.dmg}</b><br>DRAW <b>${(b.draw * 100).toFixed(0)}%</b> · VELOCITY <b>${(b.vel * 100).toFixed(0)}%</b></div>
      <div class="bwP ${owned ? 'own' : ''}">${eq ? 'IN HAND' : owned ? 'OWNED' : '◍ ' + b.cost.toLocaleString()}</div>`;
    if (!owned && i === G.bow + 1) d.onclick = () => buyBow(i);
    rack.appendChild(d);
  });
}
function buyGrade(g) {
  const lv = G.grades[g.id] || 0; if (lv >= g.max) return;
  const cost = gradeCost(g, lv);
  if (G.gold < cost) { SFX.deny(); toast('NOT ENOUGH GOLD', 'bad'); return; }
  G.gold -= cost; G.grades[g.id] = lv + 1; recompute();
  if (g.id === 'walls') G.wall.hp = G.wall.max;
  SFX.buy(); toast(g.name + ' → ' + (lv + 1), 'good');
  buildArmory(); syncCouncil('gold'); syncHud(); save();
}
function buyBow(i) {
  const b = BOWS[i];
  if (i !== G.bow + 1) return;
  if (G.gold < b.cost) { SFX.deny(); toast('NOT ENOUGH GOLD', 'bad'); return; }
  G.gold -= b.cost; G.bow = i; recompute();
  SFX.levelup(); toast('ARMED — ' + b.name, 'good');
  buildArmory(); syncCouncil(); syncHud(); save();
}

/* =========================================================================
   WAR COUNCIL — hero
   ========================================================================= */
function buildHero() {
  $('hLvBig').textContent = G.heroLv;
  const need = xpFor(G.heroLv);
  $('hXpBig').style.width = clamp(G.xp / need, 0, 1) * 100 + '%';
  $('hXpTxt').textContent = Math.floor(G.xp) + ' / ' + need + ' XP';
  $('heroSp').textContent = G.sp + ' UNSPENT';
  const host = $('skillGrid'); host.innerHTML = '';
  SKILLS.forEach(s => {
    const r = G.skills[s.id] || 0, can = G.sp > 0 && r < s.max;
    const d = document.createElement('div');
    d.className = 'sk ' + (can ? 'can' : '');
    let pips = ''; for (let i = 0; i < s.max; i++) pips += `<i class="${i < r ? 'on' : ''}"></i>`;
    d.innerHTML = `<div class="skIco">${svg(s.icon)}</div><div style="flex:1;min-width:0">
      <div class="skN"><span>${s.name}</span><span class="skR">${r} / ${s.max}</span></div>
      <div class="skD">${s.desc}</div><div class="skPips">${pips}</div></div>`;
    if (can) d.onclick = () => { G.sp--; G.skills[s.id] = r + 1; recompute(); SFX.buy(); toast(s.name + ' → ' + (r + 1), 'tech'); buildHero(); syncHud(); save(); };
    host.appendChild(d);
  });
}

function syncCouncil(spent) {
  $('techRp').textContent = G.rp; $('techGold').textContent = Math.floor(G.gold).toLocaleString();
  if (spent) {
    const el = spent === 'rp' ? $('techRp').parentElement : $('techGold').parentElement;
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }
}
function openCouncil(tab) {
  $('tech').hidden = false; G.paused = true;
  if (tab) switchTab(tab);
  buildTech(); buildArmory(); buildHero(); syncCouncil(); SFX.ui();
}
function closeCouncil() {
  $('tech').hidden = true;
  G.paused = !$('pause').hidden;      // only the pause menu keeps the game held
  SFX.ui();
}
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === name));
  $('paneTree').classList.toggle('on', name === 'tree');
  $('paneArmory').classList.toggle('on', name === 'armory');
  $('paneHero').classList.toggle('on', name === 'hero');
}

/* =========================================================================
   SAVE
   ========================================================================= */
function save() {
  try {
    localStorage.setItem('bowbat_save', JSON.stringify({
      v: 1, cityN: G.cityN, gold: G.gold, rp: G.rp, score: G.score,
      heroLv: G.heroLv, xp: G.xp, sp: G.sp, bow: G.bow,
      tech: [...G.tech], grades: G.grades, skills: G.skills,
      killed: G.killed, headshots: G.headshots,
      army: G.A.filter(c => c.team === 1 && !c.dying).map(c => c.id),
    }));
  } catch (e) { }
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem('bowbat_save') || 'null');
    if (!s || s.v !== 1) return null;
    return s;
  } catch (e) { return null; }
}
function applySave(s) {
  G.cityN = s.cityN; G.gold = s.gold; G.rp = s.rp; G.score = s.score;
  G.heroLv = s.heroLv; G.xp = s.xp; G.sp = s.sp; G.bow = s.bow;
  G.tech = new Set(s.tech); G.grades = s.grades || {}; G.skills = s.skills || {};
  G.killed = s.killed || 0; G.headshots = s.headshots || 0;
  G.pendingArmy = s.army || null;
  recompute();
}

/* =========================================================================
   INPUT
   ========================================================================= */
function fieldClick(e) {
  const w = toWorld(e.clientX, e.clientY);
  if (G.armed) { useAbility(G.armed, w.x); return true; }
  return false;
}
cv.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  SFX.unlock();
  if (G.phase !== 'battle' || G.paused) return;
  if (fieldClick(e)) return;
  G.drawing = true; G.charge = 0;
});
addEventListener('mouseup', e => {
  if (e.button !== 0) return;
  if (G.drawing) {
    const a = ARROWS[G.arrow];
    if (a.cost && G.gold < a.cost) { toast('NO GOLD FOR ' + a.name + ' — LOOSING A WAR SHAFT', 'bad'); G.arrow = 0; syncDock(); }
    heroShoot(); syncHud(); syncDock();
  }
  G.drawing = false;
});
addEventListener('mousemove', e => { const w = toWorld(e.clientX, e.clientY); G.mouse.x = w.x; G.mouse.y = w.y; });
cv.addEventListener('contextmenu', e => { e.preventDefault(); if (G.armed) { G.armed = null; syncDock(); } });

const UNIT_KEYS = {}; UNITS.forEach(u => UNIT_KEYS[u.key] = u.id);
const ABIL_KEYS = {}; ABILITIES.forEach(a => ABIL_KEYS[a.key] = a.id);

addEventListener('keydown', e => {
  const k = e.key.toUpperCase();
  if (k === 'ESCAPE') {
    if (!$('tech').hidden) { closeCouncil(); return; }
    if (G.phase === 'battle') togglePause();
    return;
  }
  if (k === 'T') { if ($('tech').hidden) { if (G.phase === 'battle' || G.phase === 'inter') openCouncil(); } else closeCouncil(); return; }
  if (k === 'M') { const m = SFX.toggle(); toast(m ? 'SOUND OFF' : 'SOUND ON'); return; }
  if (k === ' ') {
    e.preventDefault();
    if (G.phase === 'inter' && !$('inter').hidden) nextCity();
    else if (G.phase === 'title') startRun(false);
    return;
  }
  if (G.phase !== 'battle' || G.paused) return;
  if (k >= '1' && k <= '6') { selectArrow(+k - 1); return; }
  if (UNIT_KEYS[k]) { deploy(UNIT_KEYS[k]); return; }
  if (ABIL_KEYS[k]) { useAbility(ABIL_KEYS[k]); return; }
});

function togglePause() {
  if (G.phase !== 'battle') return;
  G.paused = !G.paused;
  $('pause').hidden = !G.paused;
  if (!G.paused) $('tech').hidden = true;
}

/* =========================================================================
   FLOW
   ========================================================================= */
function startRun(cont) {
  const s = cont ? load() : null;
  if (s) applySave(s);
  else {
    G.cityN = 1; G.gold = 420; G.rp = 4; G.score = 0; G.heroLv = 1; G.xp = 0; G.sp = 0;
    G.bow = 0; G.tech = new Set(); G.grades = {}; G.skills = {};
    G.killed = 0; G.headshots = 0; G.shots = 0; G.hits = 0;
    recompute();
  }
  $('title').classList.add('hide');
  setTimeout(() => { $('title').style.display = 'none'; }, 600);
  G.paused = false; $('pause').hidden = true;
  startCity(G.cityN);
  SFX.unlock();
}
function nextCity() {
  $('inter').hidden = true;
  startCity(G.cityN + 1);
}

/* backgrounded tab = explicit pause, so returning never reads as a stall */
document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.phase === 'battle' && !G.paused) { G.paused = true; $('pause').hidden = false; }
});

/* =========================================================================
   WIRE UI
   ========================================================================= */
$('btnPlay').onclick = () => startRun(false);
$('btnContinue').onclick = () => startRun(true);
$('btnTech').onclick = () => ($('tech').hidden ? openCouncil() : closeCouncil());
$('btnTechClose').onclick = closeCouncil;
$('btnInterTech').onclick = () => openCouncil();
$('btnTechP').onclick = () => openCouncil();
$('btnNext').onclick = nextCity;
$('btnPause').onclick = togglePause;
$('btnResume').onclick = togglePause;
$('btnMute').onclick = () => { const m = SFX.toggle(); $('btnMute').style.opacity = m ? .4 : 1; toast(m ? 'SOUND OFF' : 'SOUND ON'); };
$('btnAbandon').onclick = () => { localStorage.removeItem('bowbat_save'); location.reload(); };
$('btnRetry').onclick = () => location.reload();
document.querySelectorAll('.tab').forEach(t => t.onclick = () => { switchTab(t.dataset.tab); SFX.ui(); });
$('tech').addEventListener('click', e => { if (e.target.id === 'tech') closeCouncil(); });

/* =========================================================================
   BOOT
   ========================================================================= */
resize();
recompute();
buildDock();
{
  const s = load();
  if (s && s.cityN > 1) { $('btnContinue').hidden = false; $('contWave').textContent = s.cityN; }
  /* title screen still needs a living backdrop */
  G.city = makeCity(s ? s.cityN : 1);
  Art.setCity(G.city);
  G.foeWall = { hp: G.city.castleHp, max: G.city.castleHp };
  G.mouse.x = 1000; G.mouse.y = 420;
}
requestAnimationFrame(frame);
