/* =========================================================================
   BOW & BATTALION — util.js
   math · rng · particles · decals · floating text · camera shake · synth sfx
   ========================================================================= */
'use strict';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const inv = (a, b, v) => b === a ? 0 : (v - a) / (b - a);
const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = arr => arr[(Math.random() * arr.length) | 0];
const chance = p => Math.random() < p;
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const sign = v => v < 0 ? -1 : 1;
const ease = {
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t * t,
  io: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  back: t => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2),
};
const approach = (v, target, d) => v < target ? Math.min(v + d, target) : Math.max(v - d, target);

/* deterministic value noise for terrain/texture — stable across frames */
function hash1(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }
function vnoise(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash1(i), hash1(i + 1), u); }
function fbm(x, oct = 4) { let a = .5, s = 0, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f); f *= 2; a *= .5; } return s; }

/* ============================= PARTICLES ============================= */
/* one flat pool, typed by `k`. Cheap, and drawn in two passes (normal / additive). */
const PART = [];
const PMAX = 1400;
function pspawn(o) {
  if (PART.length >= PMAX) PART.shift();
  o.age = 0; o.life = o.life || .6; o.vx = o.vx || 0; o.vy = o.vy || 0;
  o.g = o.g === undefined ? 0 : o.g; o.dr = o.dr || 0; o.rot = o.rot || 0;
  o.d = o.d === undefined ? .98 : o.d;
  PART.push(o); return o;
}
function partsUpdate(dt) {
  for (let i = PART.length - 1; i >= 0; i--) {
    const p = PART[i];
    p.age += dt;
    if (p.age >= p.life) { PART.splice(i, 1); continue; }
    p.vy += p.g * dt;
    const dd = Math.pow(p.d, dt * 60);
    p.vx *= dd; p.vy *= dd;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.rot += p.dr * dt;
    if (p.floor !== undefined && p.y > p.floor) { p.y = p.floor; p.vy *= -.32; p.vx *= .7; if (Math.abs(p.vy) < 8) p.vy = 0; }
  }
}

/* -------- emitters -------- */
function fxSpark(x, y, n, col, spd = 260, life = .4) {
  for (let i = 0; i < n; i++) {
    const a = rnd(TAU);
    pspawn({ k: 'spark', x, y, vx: Math.cos(a) * rnd(spd * .3, spd), vy: Math.sin(a) * rnd(spd * .3, spd),
      g: 620, life: rnd(life * .5, life), col, w: rnd(1, 2.4), add: 1, d: .94 });
  }
}
function fxSmoke(x, y, n, size = 16, col = '30,28,26', up = 26, life = 1.5) {
  for (let i = 0; i < n; i++)
    pspawn({ k: 'smoke', x: x + rnd(-6, 6), y: y + rnd(-6, 6), vx: rnd(-16, 16), vy: -rnd(up * .4, up),
      g: -6, life: rnd(life * .6, life * 1.4), r: rnd(size * .5, size), col, a: rnd(.22, .45), d: .985, rot: rnd(TAU), dr: rnd(-1, 1) });
}
function fxFire(x, y, n, size = 12, life = .5) {
  for (let i = 0; i < n; i++)
    pspawn({ k: 'fire', x: x + rnd(-4, 4), y: y + rnd(-4, 4), vx: rnd(-30, 30), vy: -rnd(20, 90),
      g: -40, life: rnd(life * .5, life), r: rnd(size * .4, size), add: 1, d: .93 });
}
function fxDebris(x, y, n, col = '#3a3630', floor) {
  for (let i = 0; i < n; i++) {
    const a = rnd(-Math.PI * .95, -Math.PI * .05);
    pspawn({ k: 'chunk', x, y, vx: Math.cos(a) * rnd(60, 300), vy: Math.sin(a) * rnd(80, 320),
      g: 900, life: rnd(.9, 2), col, w: rnd(2, 5.5), rot: rnd(TAU), dr: rnd(-9, 9), d: .995, floor });
  }
}
function fxBlood(x, y, n, col = '160,26,22', dir = 0) {
  for (let i = 0; i < n; i++) {
    const a = rnd(-Math.PI, 0) + dir * .3;
    pspawn({ k: 'blood', x, y, vx: Math.cos(a) * rnd(40, 240) + dir * 60, vy: Math.sin(a) * rnd(40, 220),
      g: 1100, life: rnd(.4, .9), col, w: rnd(1.5, 3.6), d: .99 });
  }
}
function fxCoins(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = rnd(-Math.PI * .88, -Math.PI * .12);
    pspawn({ k: 'coin', x, y, vx: Math.cos(a) * rnd(50, 210), vy: Math.sin(a) * rnd(120, 330),
      g: 780, life: rnd(.7, 1.25), w: rnd(2.6, 4.2), rot: rnd(TAU), dr: rnd(-11, 11), d: .995, floor: GROUND + rnd(0, 14) });
  }
}
function fxRing(x, y, r, col, life = .38, w = 3) { pspawn({ k: 'ring', x, y, r0: r * .18, r1: r, col, life, w, add: 1 }); }
function fxFlash(x, y, r, col = '255,220,150', life = .16) { pspawn({ k: 'flash', x, y, r, col, life, add: 1 }); }
function fxTrail(x, y, r, col, life = .3) { pspawn({ k: 'flash', x, y, r, col, life, add: 1, d: 1 }); }

function fxExplosion(x, y, r, opt = {}) {
  const col = opt.col || '255,170,60';
  fxFlash(x, y, r * 1.5, col, .13);
  fxRing(x, y, r * 1.6, opt.ring || 'rgba(255,205,130,.85)', .34, 3.5);
  fxFire(x, y, 14 + (r / 6 | 0), r * .5, .55);
  fxSpark(x, y, 16 + (r / 5 | 0), opt.spark || '#ffd68a', r * 7, .5);
  fxSmoke(x, y, 8 + (r / 9 | 0), r * .55, opt.smoke || '38,32,28', 40, 1.8);
  if (opt.debris !== false) fxDebris(x, y, 6, opt.dcol || '#2c2823', opt.floor);
}

/* ============================= DECALS ============================= */
/* baked onto a persistent ground layer so hundreds cost nothing */
const DECALS = [];
function decal(o) { DECALS.push(o); if (DECALS.length > 220) DECALS.shift(); }

/* ============================= FLOATING TEXT ============================= */
const FTEXT = [];
function ftext(x, y, txt, col = '#fff', size = 14, opt = {}) {
  FTEXT.push({ x, y, txt, col, size, age: 0, life: opt.life || 1.1, vy: opt.vy === undefined ? -46 : opt.vy,
    vx: opt.vx || rnd(-14, 14), crit: opt.crit || 0, w: opt.w || 0 });
  if (FTEXT.length > 60) FTEXT.shift();
}
function ftextUpdate(dt) {
  for (let i = FTEXT.length - 1; i >= 0; i--) {
    const t = FTEXT[i]; t.age += dt;
    if (t.age > t.life) { FTEXT.splice(i, 1); continue; }
    t.y += t.vy * dt; t.x += t.vx * dt; t.vy += 42 * dt;
  }
}

/* ============================= CAMERA / SHAKE ============================= */
const CAM = { sx: 0, sy: 0, mag: 0, rot: 0, zoom: 1, hitstop: 0, tint: null, tintA: 0 };
function shake(mag, rot = 0) { CAM.mag = Math.min(48, CAM.mag + mag); if (rot) CAM.rot = Math.min(.05, CAM.rot + rot); }
function hitstop(t) { CAM.hitstop = Math.max(CAM.hitstop, t); }
function flashScreen(a, col) { CAM.tintA = Math.max(CAM.tintA, a); CAM.tint = col || '#fff'; }
function camUpdate(dt) {
  CAM.mag *= Math.pow(.0035, dt); CAM.rot *= Math.pow(.002, dt);
  if (CAM.mag < .05) CAM.mag = 0;
  CAM.sx = rnd(-CAM.mag, CAM.mag); CAM.sy = rnd(-CAM.mag, CAM.mag) * .7;
  CAM.tintA = Math.max(0, CAM.tintA - dt * 3.4);
}

/* ============================= SYNTH SFX ============================= */
/* pure WebAudio — zero asset files, zero load time */
const SFX = (() => {
  let ac = null, master = null, noiseBuf = null, muted = false, last = {};
  function ctx() {
    if (!ac) {
      const A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
      ac = new A();
      master = ac.createGain(); master.gain.value = .5; master.connect(ac.destination);
      const len = ac.sampleRate * 1.2; noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function gate(key, ms) { const t = performance.now(); if (last[key] && t - last[key] < ms) return false; last[key] = t; return true; }
  function env(node, t0, a, dur, peak) {
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    node.connect(g); g.connect(master); return g;
  }
  function tone(f, dur, type = 'sine', peak = .3, f2 = null, a = .004, delay = 0) {
    if (muted || !ctx()) return; const t0 = ac.currentTime + delay;
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
    env(o, t0, a, dur, peak); o.start(t0); o.stop(t0 + dur + .02);
  }
  function noise(dur, freq = 1200, peak = .3, q = 1, type = 'lowpass', f2 = null, delay = 0) {
    if (muted || !ctx()) return; const t0 = ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = type; bp.frequency.setValueAtTime(freq, t0); bp.Q.value = q;
    if (f2) bp.frequency.exponentialRampToValueAtTime(Math.max(40, f2), t0 + dur);
    s.connect(bp); env(bp, t0, .006, dur, peak); s.start(t0); s.stop(t0 + dur + .02);
  }
  return {
    get muted() { return muted; },
    toggle() { muted = !muted; return muted; },
    vol(v) { if (ctx()) master.gain.value = v; },
    unlock() { ctx(); },

    draw() { if (gate('draw', 120)) { noise(.22, 380, .07, 1, 'bandpass', 900); tone(120, .18, 'triangle', .05, 190); } },
    shoot(p) { noise(.14, 900 + p * 900, .17, 1.4, 'bandpass', 260); tone(300 + p * 260, .1, 'triangle', .1, 90); },
    hit() { if (gate('hit', 26)) { noise(.08, 900, .16, .8, 'lowpass', 220); tone(160, .07, 'square', .06, 60); } },
    thud() { if (gate('thud', 40)) { noise(.13, 420, .2, .7, 'lowpass', 90); tone(90, .14, 'sine', .16, 42); } },
    headshot() { tone(1400, .09, 'square', .13, 2100); tone(2100, .22, 'sine', .12, 1200, .003, .04); noise(.1, 5000, .1, 2, 'bandpass', 2000); },
    crit() { tone(880, .16, 'sawtooth', .1, 1600); },
    gun() { if (gate('gun', 45)) { noise(.07, 2400, .11, .9, 'lowpass', 500); tone(220, .05, 'square', .05, 70); } },
    cannon() { if (gate('cannon', 70)) { noise(.3, 700, .3, .6, 'lowpass', 70); tone(78, .34, 'sine', .28, 34); tone(150, .12, 'square', .1, 50); } },
    boom(size = 1) { if (gate('boom', 55)) { noise(.55 * size, 500, .34, .5, 'lowpass', 48); tone(62, .5 * size, 'sine', .3, 26); noise(.16, 3000, .13, 1, 'highpass', 700); } },
    clash() { if (gate('clash', 55)) { noise(.09, 4200, .12, 3, 'bandpass', 2600); tone(rnd(700, 1100), .09, 'square', .05, 400); } },
    zap() { noise(.2, 2600, .16, 2, 'bandpass', 600); tone(1500, .16, 'sawtooth', .09, 220); },
    coin() { tone(1250, .07, 'square', .07, 1800); tone(1900, .1, 'square', .06, 2300, .003, .05); },
    ui() { tone(620, .05, 'triangle', .07, 760); },
    buy() { tone(520, .07, 'triangle', .09, 700); tone(780, .12, 'triangle', .08, 990, .004, .06); tone(1180, .16, 'sine', .06, 1180, .004, .13); },
    deny() { tone(180, .14, 'sawtooth', .1, 100); },
    levelup() { [523, 659, 784, 1047].forEach((f, i) => tone(f, .34, 'triangle', .12, f, .006, i * .085)); noise(.5, 3000, .06, 1, 'highpass', 900, .1); },
    horn() { tone(146, 1.0, 'sawtooth', .13, 150); tone(220, 1.0, 'sawtooth', .09, 226, .05); tone(73, 1.2, 'sine', .12, 74, .04); },
    fall() { tone(200, 1.4, 'sawtooth', .18, 42); noise(1.2, 700, .2, .5, 'lowpass', 60); },
    victory() { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, .5, 'triangle', .11, f, .008, i * .1)); },
    spawn() { if (gate('spawn', 60)) { tone(300, .1, 'triangle', .07, 460); noise(.12, 1400, .06, 1, 'bandpass', 700); } },
  };
})();
