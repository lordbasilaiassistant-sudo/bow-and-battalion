/* =========================================================================
   BOW & BATTALION — art.js
   Hand-directed rendering: layered skies, parallax ruins, silhouette+rim-light
   combatants, procedurally destructible cities, baked ground decals.
   Nothing here is a rounded card.
   ========================================================================= */
'use strict';

const PAL = {
  'Dusk Plains': { sky:['#171232','#37214a','#7e3a45','#c4643a'], glow:'#ffb469', body:'#0e0a16',
    far:'#241a38', mid:'#191129', near:'#100b1c', gnd:['#3a2a2c','#241a1e','#140e12'], fog:'255,170,110', star:.6, disc:'#ffd9a0', discR:64, discY:.62 },
  'Ashfall':     { sky:['#150f0d','#2c1f19','#5c3620','#93521f'], glow:'#ff9a45', body:'#0c0908',
    far:'#241a15', mid:'#1a120f', near:'#0e0a08', gnd:['#3b2f26','#241c17','#12100d'], fog:'255,150,90', star:.15, disc:'#ff9a45', discR:52, discY:.66 },
  'Frostline':   { sky:['#08121f','#16324c','#3f6d90','#9dc4d9'], glow:'#dff2ff', body:'#0a1018',
    far:'#1b2f42', mid:'#122234', near:'#0a1420', gnd:['#4a5764','#2c3742','#161d25'], fog:'190,225,255', star:.85, disc:'#eaf7ff', discR:46, discY:.5 },
  'Bloodmoon':   { sky:['#160710','#3d0f1c','#75161f','#b4301f'], glow:'#ff5236', body:'#0d0508',
    far:'#2a0f18', mid:'#1c0a11', near:'#11060a', gnd:['#402126','#281319','#150a0e'], fog:'255,80,60', star:.5, disc:'#ff4b3a', discR:86, discY:.42 },
  'Stormfront':  { sky:['#080c14','#131c28','#26343f','#4d6070'], glow:'#a8c2d8', body:'#070a10',
    far:'#18222e', mid:'#111823', near:'#090d14', gnd:['#333c44','#20272e','#11151a'], fog:'170,195,220', star:0, disc:'#7d95a8', discR:38, discY:.36 },
};
const ALLY = { body:'#1b232f', dark:'#0e141c', trim:'#93aec9', metal:'#7e8fa3', cloth:'#28527d', accent:'#f0c264', skin:'#c99a6e' };
const ENEM = { body:'#241419', dark:'#130a0d', trim:'#b06055', metal:'#8a5a52', cloth:'#5c1a18', accent:'#ff6a44', skin:'#9a6a52' };

const Art = (() => {
  let bg = null, mid = null, near = null, gnd = null, gctx = null;   // cached layers
  let biome = null, pal = null, city = null, T = 0;
  let clouds = [], stars = [], skyline = [];

  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  /* ---------------------------------------------------------------- SKY */
  function buildSky() {
    bg = mk(W, H); const c = bg.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, GROUND + 30);
    g.addColorStop(0, pal.sky[0]); g.addColorStop(.42, pal.sky[1]);
    g.addColorStop(.78, pal.sky[2]); g.addColorStop(1, pal.sky[3]);
    c.fillStyle = g; c.fillRect(0, 0, W, GROUND + 30);

    /* stars */
    if (pal.star > 0) {
      for (let i = 0; i < 260; i++) {
        const x = hash1(i * 3.1 + city.seed * 90) * W, y = hash1(i * 7.7 + 5) * GROUND * .62;
        const a = pal.star * (.15 + hash1(i * 2.3) * .85) * (1 - y / (GROUND * .8));
        c.fillStyle = `rgba(255,244,222,${a.toFixed(3)})`;
        const s = hash1(i * 11.3) > .93 ? 1.9 : 1;
        c.fillRect(x, y, s, s);
      }
    }
    /* celestial disc, low over the enemy city */
    const dx = W * .78, dy = GROUND * pal.discY, R = pal.discR;
    c.globalCompositeOperation = 'lighter';
    const rg = c.createRadialGradient(dx, dy, R * .3, dx, dy, R * 7);
    rg.addColorStop(0, hexA(pal.glow, .45)); rg.addColorStop(.25, hexA(pal.glow, .13)); rg.addColorStop(1, hexA(pal.glow, 0));
    c.fillStyle = rg; c.fillRect(0, 0, W, GROUND + 30);
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = pal.disc; c.beginPath(); c.arc(dx, dy, R, 0, TAU); c.fill();
    /* craters on big discs */
    if (R > 60) { c.fillStyle = 'rgba(0,0,0,.10)';
      for (let i = 0; i < 9; i++) { const a = hash1(i * 5.5) * TAU, rr = hash1(i * 9.1) * R * .7;
        c.beginPath(); c.arc(dx + Math.cos(a) * rr, dy + Math.sin(a) * rr, R * (.06 + hash1(i * 3.3) * .13), 0, TAU); c.fill(); } }

    /* horizon haze */
    const hz = c.createLinearGradient(0, GROUND - 190, 0, GROUND + 20);
    hz.addColorStop(0, hexA(pal.glow, 0)); hz.addColorStop(1, hexA(pal.glow, .3));
    c.globalCompositeOperation = 'lighter'; c.fillStyle = hz; c.fillRect(0, GROUND - 190, W, 210);
    c.globalCompositeOperation = 'source-over';
  }

  function hexA(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  /* ------------------------------------------------------- RIDGE / RUINS */
  function ridgePath(c, y0, amp, seedOff, res = 26) {
    c.beginPath(); c.moveTo(-20, GROUND + 40);
    for (let x = -20; x <= W + 20; x += res) {
      const n = fbm(x * .0022 + seedOff, 5);
      const n2 = fbm(x * .0091 + seedOff * 2, 3);
      c.lineTo(x, y0 - n * amp - n2 * amp * .28);
    }
    c.lineTo(W + 20, GROUND + 40); c.closePath();
  }

  function buildMid() {
    mid = mk(W, H); const c = mid.getContext('2d');
    /* far ridge */
    c.fillStyle = pal.far; ridgePath(c, GROUND - 96, 210, city.seed * 7); c.fill();
    /* rim light on far ridge from the disc side */
    c.save(); c.globalCompositeOperation = 'lighter';
    const rg = c.createLinearGradient(W * .5, 0, W, 0);
    rg.addColorStop(0, hexA(pal.glow, 0)); rg.addColorStop(1, hexA(pal.glow, .14));
    c.fillStyle = rg; ridgePath(c, GROUND - 96, 210, city.seed * 7); c.fill(); c.restore();

    /* mid ridge + ruined towers */
    c.fillStyle = pal.mid; ridgePath(c, GROUND - 44, 128, city.seed * 13 + 40); c.fill();

    /* broken siege towers / dead trees along the mid band */
    for (let i = 0; i < 16; i++) {
      const x = hash1(i * 4.4 + city.seed * 30) * W;
      const h = 40 + hash1(i * 8.8) * 92;
      const yb = GROUND - 26 - fbm(x * .0022 + city.seed * 13 + 40, 4) * 22;
      c.fillStyle = pal.mid;
      if (hash1(i * 2.2) > .45) {           /* ruined tower */
        const w = 16 + hash1(i * 6.1) * 16;
        c.beginPath(); c.moveTo(x, yb); c.lineTo(x + 1, yb - h);
        for (let k = 0; k < 4; k++) c.lineTo(x + w * (k + .5) / 4, yb - h + (hash1(i * 3 + k) * 16 - 4));
        c.lineTo(x + w, yb); c.closePath(); c.fill();
      } else {                               /* dead tree */
        c.strokeStyle = pal.mid; c.lineWidth = 3.2; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x, yb); c.lineTo(x + hash1(i) * 8 - 4, yb - h);
        for (let k = 0; k < 4; k++) { const ty = yb - h * (.4 + k * .16), s = (k % 2 ? 1 : -1);
          c.moveTo(x + (ty - yb) * .06, ty); c.lineTo(x + s * (10 + hash1(i * k + 1) * 16), ty - 12 - hash1(k) * 12); }
        c.stroke();
      }
    }
    /* fog band */
    c.globalCompositeOperation = 'lighter';
    const fg = c.createLinearGradient(0, GROUND - 150, 0, GROUND);
    fg.addColorStop(0, `rgba(${pal.fog},0)`); fg.addColorStop(1, `rgba(${pal.fog},.10)`);
    c.fillStyle = fg; c.fillRect(0, GROUND - 150, W, 152);
  }

  function buildNear() {
    near = mk(W, 190); const c = near.getContext('2d');
    c.fillStyle = pal.near;
    /* foreground berm silhouette drawn along the bottom of the screen */
    c.beginPath(); c.moveTo(-10, 190);
    for (let x = -10; x <= W + 10; x += 22) c.lineTo(x, 150 - fbm(x * .006 + 9 + city.seed * 5, 3) * 34);
    c.lineTo(W + 10, 190); c.closePath(); c.fill();
    /* scrub */
    c.strokeStyle = pal.near; c.lineWidth = 2;
    for (let i = 0; i < 90; i++) {
      const x = hash1(i * 5.3 + city.seed) * W, y = 152 - fbm(x * .006 + 9 + city.seed * 5, 3) * 30;
      c.beginPath();
      for (let k = 0; k < 3; k++) { c.moveTo(x, y); c.lineTo(x + (k - 1) * 5 + hash1(i * k) * 4, y - 9 - hash1(i + k) * 12); }
      c.stroke();
    }
  }

  /* ------------------------------------------------------------- GROUND */
  function buildGround() {
    gnd = mk(W, H - GROUND + 60); gctx = gnd.getContext('2d');
    const c = gctx, hh = gnd.height;
    const g = c.createLinearGradient(0, 0, 0, hh);
    g.addColorStop(0, pal.gnd[0]); g.addColorStop(.34, pal.gnd[1]); g.addColorStop(1, pal.gnd[2]);
    c.fillStyle = g; c.fillRect(0, 0, W, hh);
    /* horizon rim on the soil */
    c.globalCompositeOperation = 'lighter';
    const rg = c.createLinearGradient(0, 0, 0, 26);
    rg.addColorStop(0, hexA(pal.glow, .22)); rg.addColorStop(1, hexA(pal.glow, 0));
    c.fillStyle = rg; c.fillRect(0, 0, W, 26);
    c.globalCompositeOperation = 'source-over';
    /* grain: ruts, stones, old craters */
    for (let i = 0; i < 340; i++) {
      const x = hash1(i * 2.7 + city.seed * 60) * W, y = hash1(i * 5.1) * hh;
      const a = .04 + hash1(i * 3.9) * .10;
      c.fillStyle = `rgba(0,0,0,${a})`;
      c.beginPath(); c.ellipse(x, y, 8 + hash1(i * 1.3) * 46, 1.4 + hash1(i * 7.7) * 4, 0, 0, TAU); c.fill();
    }
    for (let i = 0; i < 60; i++) {
      const x = hash1(i * 9.3 + 4) * W, y = 14 + hash1(i * 3.1) * (hh - 20);
      c.fillStyle = `rgba(255,235,205,${(.02 + hash1(i) * .05).toFixed(3)})`;
      c.beginPath(); c.ellipse(x, y, 3 + hash1(i * 2) * 9, 1.2 + hash1(i * 4) * 2.6, 0, 0, TAU); c.fill();
    }
    /* the road: a compacted lane between the two gates */
    c.fillStyle = 'rgba(0,0,0,.10)';
    c.beginPath(); c.moveTo(MY_GATE - 40, 6); c.lineTo(EN_GATE + 40, 6);
    c.lineTo(EN_GATE + 90, hh * .55); c.lineTo(MY_GATE - 90, hh * .55); c.closePath(); c.fill();
  }

  /* bake a decal permanently into the ground layer */
  function bake(fn) { if (!gctx) return; gctx.save(); gctx.translate(0, -GROUND + 60); fn(gctx); gctx.restore(); }

  function decalBlood(x, y, n, col = '86,14,12') {
    bake(c => {
      for (let i = 0; i < n; i++) {
        c.fillStyle = `rgba(${col},${(.10 + Math.random() * .2).toFixed(2)})`;
        c.beginPath(); c.ellipse(x + rnd(-26, 26), y + rnd(-7, 9), rnd(3, 15), rnd(1.4, 4.5), rnd(TAU), 0, TAU); c.fill();
      }
    });
  }
  function decalScorch(x, y, r) {
    bake(c => {
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(6,4,3,.62)'); g.addColorStop(.55, 'rgba(12,8,6,.34)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.save(); c.translate(x, y); c.scale(1, .34); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.restore();
      c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1;
      for (let i = 0; i < 7; i++) { const a = rnd(TAU); c.beginPath(); c.moveTo(x, y);
        c.lineTo(x + Math.cos(a) * r * rnd(.7, 1.3), y + Math.sin(a) * r * .34 * rnd(.7, 1.3)); c.stroke(); }
    });
  }
  function decalWreck(x, y, s, foe) {
    bake(c => {
      c.fillStyle = 'rgba(10,8,8,.7)'; c.save(); c.translate(x, y); c.scale(1, .3);
      c.beginPath(); c.arc(0, 0, s * 1.5, 0, TAU); c.fill(); c.restore();
      c.fillStyle = foe ? '#1a1012' : '#161b22';
      c.save(); c.translate(x, y); c.rotate(rnd(-.24, .24));
      c.fillRect(-s, -s * .42, s * 2, s * .42);
      c.fillRect(-s * .5, -s * .74, s * .9, s * .34);
      c.fillStyle = '#0a0708'; c.fillRect(-s * .2, -s * .9, s * 1.5, s * .12);
      c.restore();
    });
  }

  /* ------------------------------------------------------------ SKYLINE */
  function buildSkyline() {
    skyline = [];
    for (let i = 0; i < 26; i++) {
      const x = EN_GATE + 30 + i * 24 + hash1(i * 3.3 + city.seed * 20) * 18;
      skyline.push({ x, w: 14 + hash1(i * 5.1) * 26, h: 40 + hash1(i * 7.9 + city.seed) * 150,
        spire: hash1(i * 2.1) > .62, lit: hash1(i * 4.7) > .45 });
    }
  }

  /* ------------------------------------------------------------- PUBLIC */
  function setCity(cy) {
    city = cy; biome = cy.biome; pal = PAL[biome.name] || PAL['Dusk Plains'];
    buildSky(); buildMid(); buildNear(); buildGround(); buildSkyline();
    clouds = []; for (let i = 0; i < 7; i++) clouds.push({ x: rnd(-200, W), y: rnd(60, GROUND - 260), s: rnd(.6, 1.9), v: rnd(3, 11), a: rnd(.05, .17) });
    DECALS.length = 0;
  }

  function drawSky(ctx, t) {
    ctx.drawImage(bg, 0, 0);
    /* drifting cloud banks — cheap soft ellipses, additive at the horizon */
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    clouds.forEach(cl => {
      cl.x += cl.v * .016; if (cl.x > W + 260) cl.x = -280;
      const g = ctx.createRadialGradient(cl.x, cl.y, 0, cl.x, cl.y, 190 * cl.s);
      g.addColorStop(0, `rgba(${pal.fog},${cl.a})`); g.addColorStop(1, `rgba(${pal.fog},0)`);
      ctx.fillStyle = g; ctx.save(); ctx.translate(cl.x, cl.y); ctx.scale(1, .30); ctx.translate(-cl.x, -cl.y);
      ctx.beginPath(); ctx.arc(cl.x, cl.y, 190 * cl.s, 0, TAU); ctx.fill(); ctx.restore();
    });
    ctx.restore();
  }
  function drawMid(ctx) { ctx.drawImage(mid, 0, 0); }
  function drawGround(ctx) { ctx.drawImage(gnd, 0, GROUND - 60); }
  function drawNear(ctx) { ctx.drawImage(near, 0, H - 150); }

  /* ------------------------------------------------------------ WEATHER */
  const wx = [];
  function weather(ctx, dt, t) {
    const kind = biome.w;
    const want = kind === 'rain' ? 210 : kind === 'snow' ? 150 : 90;
    while (wx.length < want) wx.push({ x: rnd(-100, W + 100), y: rnd(-100, H), s: rnd(.4, 1.4), p: rnd(TAU) });
    ctx.save();
    if (kind === 'rain') {
      ctx.strokeStyle = 'rgba(180,205,235,.30)'; ctx.lineWidth = 1.1;
      ctx.beginPath();
      wx.forEach(p => { p.y += (760 + p.s * 420) * dt; p.x -= 130 * dt;
        if (p.y > H) { p.y = -20; p.x = rnd(-60, W + 160); }
        ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 5, p.y + 20 + p.s * 12); });
      ctx.stroke();
    } else if (kind === 'snow') {
      ctx.fillStyle = 'rgba(226,242,255,.6)';
      wx.forEach(p => { p.y += (26 + p.s * 34) * dt; p.p += dt * 1.6; p.x += Math.sin(p.p) * 16 * dt;
        if (p.y > H) { p.y = -10; p.x = rnd(0, W); }
        ctx.globalAlpha = .25 + p.s * .4; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * 1.7, 0, TAU); ctx.fill(); });
      ctx.globalAlpha = 1;
    } else {
      ctx.globalCompositeOperation = 'lighter';
      const emb = kind === 'ember';
      wx.forEach(p => { p.y -= (16 + p.s * 30) * dt; p.p += dt * 2.1; p.x += Math.sin(p.p) * 20 * dt;
        if (p.y < -12) { p.y = H + rnd(0, 120); p.x = rnd(0, W); }
        const a = (.16 + p.s * .38) * (emb ? 1 : .5);
        ctx.fillStyle = emb ? `rgba(255,${140 + p.s * 70 | 0},60,${a})` : `rgba(190,180,168,${a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (emb ? 1.5 : 1.9), 0, TAU); ctx.fill(); });
    }
    ctx.restore();
  }

  /* =====================================================================
     COMBATANT RENDERING — silhouette body, rim light from the enemy horizon
     ===================================================================== */

  function shadow(ctx, x, y, w, a = .42) {
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.beginPath(); ctx.ellipse(x, y, w, w * .26, 0, 0, TAU); ctx.fill();
  }
  /* rim: paint a thin lit edge on the side facing the burning horizon (right) */
  function rim(ctx, path, col, w = 1.6, dx = 1.4) {
    ctx.save(); ctx.translate(dx, -1); ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.lineJoin = 'round'; ctx.stroke(path); ctx.restore();
  }

  /* ---------- humanoid ---------- */
  function human(ctx, o) {
    const { x, y, s, dir, ph, P, atk } = o;   // P = palette, atk 0..1 swing
    const H2 = 44 * s;                          // full height
    const hipY = y - H2 * .46, shY = y - H2 * .80, headY = y - H2 * .93;
    const stride = Math.sin(ph) * .55, stride2 = Math.sin(ph + Math.PI) * .55;
    const bob = Math.abs(Math.sin(ph)) * 1.6 * s;
    const gx = x, gy = y;
    ctx.save(); ctx.translate(0, -bob);

    /* legs */
    ctx.strokeStyle = P.dark; ctx.lineWidth = 4.4 * s; ctx.lineCap = 'round';
    [stride, stride2].forEach((st, i) => {
      const kneeX = gx + st * 9 * s * dir, kneeY = hipY + H2 * .24;
      const footX = gx + st * 16 * s * dir, footY = gy - Math.max(0, Math.sin(ph + i * Math.PI)) * 4 * s;
      ctx.beginPath(); ctx.moveTo(gx, hipY); ctx.lineTo(kneeX, kneeY); ctx.lineTo(footX, footY); ctx.stroke();
    });

    /* torso */
    const tp = new Path2D();
    tp.moveTo(gx - 7 * s, hipY + 2 * s); tp.lineTo(gx - 8.5 * s, shY);
    tp.lineTo(gx + 8.5 * s, shY); tp.lineTo(gx + 7 * s, hipY + 2 * s); tp.closePath();
    ctx.fillStyle = P.body; ctx.fill(tp);
    /* cloth sash */
    ctx.fillStyle = P.cloth; ctx.fillRect(gx - 8 * s, shY + 6 * s, 17 * s, 5 * s);

    /* head + helm */
    ctx.fillStyle = P.skin; ctx.beginPath(); ctx.arc(gx + 1.4 * s * dir, headY, 5.2 * s, 0, TAU); ctx.fill();
    const hp = new Path2D();
    hp.moveTo(gx - 6 * s, headY + 1.5 * s); hp.arc(gx + .6 * s * dir, headY - .6 * s, 6.1 * s, Math.PI, 0);
    hp.lineTo(gx + 6.4 * s, headY + 2.6 * s); hp.lineTo(gx - 6 * s, headY + 2.6 * s); hp.closePath();
    ctx.fillStyle = P.metal; ctx.fill(hp);
    if (o.plume) { ctx.strokeStyle = P.accent; ctx.lineWidth = 2.4 * s; ctx.beginPath();
      ctx.moveTo(gx, headY - 6 * s); ctx.quadraticCurveTo(gx - 5 * s * dir, headY - 13 * s, gx - 11 * s * dir, headY - 8 * s); ctx.stroke(); }
    if (o.eyes) { ctx.fillStyle = P.accent; ctx.fillRect(gx + 2 * s * dir, headY - .4 * s, 3.6 * s * dir, 1.5 * s); }

    /* cape */
    if (o.cape) {
      ctx.fillStyle = P.cloth; ctx.beginPath();
      ctx.moveTo(gx - 6 * s * dir, shY - 1 * s);
      ctx.quadraticCurveTo(gx - 15 * s * dir - Math.sin(ph) * 4 * s, hipY + 4 * s, gx - 9 * s * dir, hipY + 13 * s);
      ctx.lineTo(gx - 2 * s * dir, hipY + 4 * s); ctx.closePath(); ctx.fill();
    }

    /* arms + weapon */
    const swing = atk ? Math.sin(atk * Math.PI) : 0;
    ctx.strokeStyle = P.body; ctx.lineWidth = 3.6 * s;
    const handX = gx + (7 + swing * 9) * s * dir, handY = shY + (6 - swing * 9) * s;
    ctx.beginPath(); ctx.moveTo(gx + 3 * s * dir, shY + 2 * s); ctx.lineTo(handX, handY); ctx.stroke();

    if (o.weapon === 'sword') {
      ctx.save(); ctx.translate(handX, handY); ctx.rotate((-.5 - swing * 1.9) * dir);
      ctx.fillStyle = P.metal; ctx.fillRect(0, -1.4 * s, 20 * s * dir, 2.8 * s);
      ctx.fillStyle = P.accent; ctx.fillRect(-2 * s * dir, -4 * s, 2.4 * s * dir, 8 * s);
      ctx.restore();
    } else if (o.weapon === 'axe') {
      ctx.save(); ctx.translate(handX, handY); ctx.rotate((-.9 - swing * 2.2) * dir);
      ctx.strokeStyle = '#4a3524'; ctx.lineWidth = 2.6 * s;
      ctx.beginPath(); ctx.moveTo(-4 * s * dir, 2 * s); ctx.lineTo(19 * s * dir, -3 * s); ctx.stroke();
      ctx.fillStyle = P.metal; ctx.beginPath();
      ctx.moveTo(14 * s * dir, -2 * s); ctx.quadraticCurveTo(22 * s * dir, -13 * s, 25 * s * dir, -1 * s);
      ctx.quadraticCurveTo(21 * s * dir, 5 * s, 14 * s * dir, 1 * s); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (o.weapon === 'bow') {
      const dr = o.reload || 0;
      ctx.save(); ctx.translate(gx + 9 * s * dir, shY + 4 * s); ctx.scale(dir, 1);
      ctx.strokeStyle = '#6b4a28'; ctx.lineWidth = 2.2 * s;
      ctx.beginPath(); ctx.arc(0, 0, 13 * s, -1.15, 1.15); ctx.stroke();
      const pull = -6 * s * (1 - dr);
      ctx.strokeStyle = 'rgba(240,235,215,.75)'; ctx.lineWidth = 1 * s;
      ctx.beginPath(); ctx.moveTo(13 * s * Math.cos(-1.15), 13 * s * Math.sin(-1.15));
      ctx.lineTo(pull, 0); ctx.lineTo(13 * s * Math.cos(1.15), 13 * s * Math.sin(1.15)); ctx.stroke();
      if (dr < .9) { ctx.strokeStyle = P.trim; ctx.lineWidth = 1.4 * s;
        ctx.beginPath(); ctx.moveTo(pull, 0); ctx.lineTo(pull + 20 * s, 0); ctx.stroke(); }
      ctx.restore();
    } else if (o.weapon === 'musket') {
      ctx.save(); ctx.translate(gx + 3 * s * dir, shY + 5 * s); ctx.scale(dir, 1); ctx.rotate(-.12);
      ctx.strokeStyle = '#3c2a1c'; ctx.lineWidth = 3 * s;
      ctx.beginPath(); ctx.moveTo(-6 * s, 4 * s); ctx.lineTo(6 * s, 0); ctx.stroke();
      ctx.strokeStyle = P.metal; ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.moveTo(4 * s, 0); ctx.lineTo(24 * s, -3 * s); ctx.stroke();
      ctx.restore();
    } else if (o.weapon === 'staff') {
      ctx.save(); ctx.translate(gx + 8 * s * dir, shY + 3 * s);
      ctx.strokeStyle = '#5a4630'; ctx.lineWidth = 2.4 * s;
      ctx.beginPath(); ctx.moveTo(-2 * s * dir, 14 * s); ctx.lineTo(4 * s * dir, -14 * s); ctx.stroke();
      const oc = o.orb || '#cfd8e8';
      ctx.fillStyle = oc; ctx.beginPath(); ctx.arc(5 * s * dir, -16 * s, 3.2 * s, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      const og = ctx.createRadialGradient(5 * s * dir, -16 * s, 0, 5 * s * dir, -16 * s, 12 * s);
      og.addColorStop(0, oc); og.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = .35 + Math.sin(ph * 2) * .12;
      ctx.fillStyle = og; ctx.beginPath(); ctx.arc(5 * s * dir, -16 * s, 12 * s, 0, TAU); ctx.fill();
      ctx.restore();
    } else if (o.weapon === 'flag') {
      ctx.save(); ctx.translate(gx + 7 * s * dir, shY + 4 * s);
      ctx.strokeStyle = '#5a4630'; ctx.lineWidth = 2.4 * s;
      ctx.beginPath(); ctx.moveTo(-1 * s * dir, 12 * s); ctx.lineTo(2 * s * dir, -26 * s); ctx.stroke();
      ctx.fillStyle = P.accent;
      ctx.beginPath(); ctx.moveTo(2 * s * dir, -26 * s);
      ctx.quadraticCurveTo((2 + 13 + Math.sin(ph * 3) * 3) * s * dir, -22 * s, (2 + 15) * s * dir, -17 * s);
      ctx.lineTo(2.4 * s * dir, -14 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.beginPath(); ctx.moveTo(2 * s * dir, -20 * s); ctx.lineTo((2 + 12) * s * dir, -19 * s); ctx.lineTo(2.4 * s * dir, -14 * s); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (o.weapon === 'tube') {   /* mortar crew */
      ctx.save(); ctx.translate(gx + 6 * s * dir, y - 4 * s); ctx.scale(dir, 1);
      ctx.fillStyle = P.dark; ctx.beginPath();
      ctx.moveTo(-9 * s, 0); ctx.lineTo(9 * s, 0); ctx.lineTo(5 * s, -5 * s); ctx.lineTo(-5 * s, -5 * s); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = P.metal; ctx.lineWidth = 5.5 * s; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(-2 * s, -4 * s); ctx.lineTo(13 * s, -20 * s); ctx.stroke();
      ctx.restore();
    }

    /* shield on the leading arm */
    if (o.shield) {
      ctx.save(); ctx.translate(gx + 11 * s * dir, shY + 8 * s);
      const sp = new Path2D();
      sp.moveTo(-1 * s * dir, -17 * s); sp.lineTo(7 * s * dir, -14 * s); sp.lineTo(7 * s * dir, 12 * s);
      sp.lineTo(-1 * s * dir, 17 * s); sp.closePath();
      ctx.fillStyle = P.metal; ctx.fill(sp);
      ctx.fillStyle = P.cloth; ctx.save(); ctx.scale(.62, .62); ctx.fill(sp); ctx.restore();
      ctx.strokeStyle = P.accent; ctx.lineWidth = 1.2 * s; ctx.stroke(sp);
      ctx.restore();
    }
    ctx.restore();

    /* rim light */
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .5;
    ctx.strokeStyle = pal.glow; ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(gx + 8.5 * s - bob * 0, shY - bob); ctx.lineTo(gx + 7 * s, hipY + 2 * s - bob);
    ctx.moveTo(gx + 5.6 * s, headY - 3 * s - bob); ctx.lineTo(gx + 6.4 * s, headY + 2 * s - bob);
    ctx.stroke(); ctx.restore();
  }

  /* ---------- tank ---------- */
  function tank(ctx, o) {
    const { x, y, s, dir, ph, P, heavy, recoil, turn } = o;
    const bw = (heavy ? 40 : 32) * s, bh = (heavy ? 15 : 12) * s;
    const trackY = y - 4 * s;
    ctx.save();
    /* tracks */
    ctx.fillStyle = P.dark;
    ctx.beginPath(); ctx.roundRect(x - bw, trackY - 8 * s, bw * 2, 12 * s, 5 * s); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1.4;
    const off = (ph * 9) % 9;
    for (let i = -bw; i < bw; i += 9) { ctx.beginPath();
      ctx.moveTo(x + i + off, trackY - 8 * s); ctx.lineTo(x + i + off, trackY + 4 * s); ctx.stroke(); }
    /* road wheels */
    ctx.fillStyle = '#0a0c10';
    for (let i = -bw + 7 * s; i < bw - 4 * s; i += 11 * s) { ctx.beginPath(); ctx.arc(x + i, trackY - 1 * s, 4.2 * s, 0, TAU); ctx.fill(); }
    /* hull with sloped glacis */
    const hp = new Path2D();
    hp.moveTo(x - bw * .92, trackY - 8 * s);
    hp.lineTo(x - bw * .62, trackY - 8 * s - bh);
    hp.lineTo(x + bw * .70, trackY - 8 * s - bh);
    hp.lineTo(x + bw * .96, trackY - 8 * s - bh * .45);
    hp.lineTo(x + bw * .96, trackY - 8 * s); hp.closePath();
    ctx.fillStyle = P.body; ctx.fill(hp);
    ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fill(hp);
    /* turret */
    const tx = x - bw * .06, ty = trackY - 8 * s - bh;
    const tp = new Path2D();
    tp.moveTo(tx - 13 * s, ty); tp.lineTo(tx - 9 * s, ty - 9 * s);
    tp.lineTo(tx + 11 * s, ty - 9 * s); tp.lineTo(tx + 15 * s, ty); tp.closePath();
    ctx.fillStyle = P.body; ctx.fill(tp);
    ctx.strokeStyle = P.trim; ctx.lineWidth = 1; ctx.globalAlpha = .35; ctx.stroke(tp); ctx.globalAlpha = 1;
    /* barrel */
    ctx.save(); ctx.translate(tx + 10 * s * dir, ty - 5 * s); ctx.rotate((turn || 0) * dir);
    ctx.fillStyle = P.metal;
    ctx.fillRect(-recoil * 6 * s * dir, -2 * s, (heavy ? 34 : 26) * s * dir, 4 * s);
    ctx.fillStyle = P.dark; ctx.fillRect(((heavy ? 30 : 22) * s - recoil * 6 * s) * dir, -3 * s, 5 * s * dir, 6 * s);
    ctx.restore();
    /* hatch + antenna */
    ctx.strokeStyle = P.trim; ctx.lineWidth = 1.2; ctx.globalAlpha = .6;
    ctx.beginPath(); ctx.moveTo(tx - 6 * s, ty - 9 * s); ctx.lineTo(tx - 9 * s, ty - 20 * s); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.restore();
    /* rim */
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .45;
    ctx.strokeStyle = pal.glow; ctx.lineWidth = 1.3; ctx.stroke(hp); ctx.stroke(tp); ctx.restore();
  }

  /* ---------- artillery ---------- */
  function arty(ctx, o) {
    const { x, y, s, dir, P, elev, recoil } = o;
    ctx.save();
    ctx.fillStyle = P.dark;
    ctx.beginPath(); ctx.roundRect(x - 24 * s, y - 12 * s, 48 * s, 10 * s, 4 * s); ctx.fill();
    ctx.fillStyle = '#0a0c10';
    for (let i = -18; i <= 18; i += 12) { ctx.beginPath(); ctx.arc(x + i * s, y - 6 * s, 4 * s, 0, TAU); ctx.fill(); }
    const bp = new Path2D();
    bp.moveTo(x - 20 * s, y - 12 * s); bp.lineTo(x - 14 * s, y - 24 * s);
    bp.lineTo(x + 10 * s, y - 24 * s); bp.lineTo(x + 18 * s, y - 12 * s); bp.closePath();
    ctx.fillStyle = P.body; ctx.fill(bp);
    ctx.save(); ctx.translate(x + 2 * s * dir, y - 22 * s); ctx.rotate(-(elev || .6) * dir);
    ctx.fillStyle = P.metal; ctx.fillRect(-recoil * 8 * s * dir, -3 * s, 46 * s * dir, 5.5 * s);
    ctx.fillStyle = P.dark; ctx.fillRect((42 * s - recoil * 8 * s) * dir, -4.5 * s, 6 * s * dir, 8.5 * s);
    ctx.restore();
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .45;
    ctx.strokeStyle = pal.glow; ctx.lineWidth = 1.3; ctx.stroke(bp); ctx.restore();
  }

  /* ---------- walker / mech ---------- */
  function mech(ctx, o) {
    const { x, y, s, dir, ph, P, charge, recoil } = o;
    const hipY = y - 40 * s;
    ctx.save();
    ctx.strokeStyle = P.dark; ctx.lineWidth = 6 * s; ctx.lineCap = 'round';
    [0, Math.PI].forEach(off => {
      const st = Math.sin(ph + off);
      const kx = x - 12 * s * dir + st * 8 * s, ky = hipY + 18 * s;
      const fx = x + st * 20 * s * dir, fy = y - Math.max(0, Math.sin(ph + off)) * 6 * s;
      ctx.beginPath(); ctx.moveTo(x, hipY); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.fillStyle = P.dark; ctx.fillRect(fx - 8 * s * dir, fy - 3 * s, 16 * s * dir, 4 * s);
    });
    const bp = new Path2D();
    bp.moveTo(x - 16 * s, hipY + 4 * s); bp.lineTo(x - 13 * s, hipY - 20 * s);
    bp.lineTo(x + 13 * s, hipY - 20 * s); bp.lineTo(x + 17 * s, hipY + 2 * s); bp.closePath();
    ctx.fillStyle = P.body; ctx.fill(bp);
    ctx.fillStyle = P.cloth; ctx.fillRect(x - 8 * s, hipY - 15 * s, 16 * s, 5 * s);
    /* cockpit glow */
    ctx.fillStyle = P.accent; ctx.globalAlpha = .8;
    ctx.fillRect(x + 4 * s * dir, hipY - 16 * s, 8 * s * dir, 3.4 * s); ctx.globalAlpha = 1;
    /* railgun */
    ctx.save(); ctx.translate(x + 8 * s * dir, hipY - 12 * s);
    ctx.fillStyle = P.metal; ctx.fillRect(-recoil * 9 * s * dir, -4 * s, 50 * s * dir, 7 * s);
    ctx.fillStyle = P.dark; ctx.fillRect(20 * s * dir, -7 * s, 7 * s * dir, 13 * s);
    if (charge > 0) {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(50 * s * dir, 0, 0, 50 * s * dir, 0, 22 * s * charge);
      g.addColorStop(0, 'rgba(150,235,255,.9)'); g.addColorStop(1, 'rgba(90,180,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(50 * s * dir, 0, 22 * s * charge, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .5;
    ctx.strokeStyle = pal.glow; ctx.lineWidth = 1.4; ctx.stroke(bp); ctx.restore();
  }

  /* ---------- siege ram ---------- */
  function ram(ctx, o) {
    const { x, y, s, dir, ph, P } = o;
    ctx.save();
    /* wheels */
    ctx.fillStyle = '#171310';
    [-16, 0, 16].forEach(wx => { ctx.beginPath(); ctx.arc(x + wx * s, y - 5 * s, 6 * s, 0, TAU); ctx.fill(); });
    ctx.strokeStyle = 'rgba(255,240,210,.12)'; ctx.lineWidth = 1.4;
    [-16, 0, 16].forEach(wx => { ctx.beginPath(); ctx.arc(x + wx * s, y - 5 * s, 3.4 * s, ph, ph + 4); ctx.stroke(); });
    /* timber frame + peaked hide roof */
    const fp = new Path2D();
    fp.moveTo(x - 24 * s, y - 9 * s); fp.lineTo(x - 17 * s, y - 30 * s);
    fp.lineTo(x + 17 * s, y - 30 * s); fp.lineTo(x + 24 * s, y - 9 * s); fp.closePath();
    ctx.fillStyle = P.body; ctx.fill(fp);
    ctx.fillStyle = '#3d2c1c'; ctx.beginPath();
    ctx.moveTo(x - 20 * s, y - 28 * s); ctx.lineTo(x, y - 38 * s); ctx.lineTo(x + 20 * s, y - 28 * s); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1.2;
    for (let k = -14; k <= 14; k += 7) { ctx.beginPath(); ctx.moveTo(x + k * s, y - 29 * s); ctx.lineTo(x + k * s, y - 10 * s); ctx.stroke(); }
    /* the swinging log with an iron head */
    const sw = Math.sin(ph * 2.2) * 5 * s;
    ctx.strokeStyle = '#54402a'; ctx.lineWidth = 5 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 16 * s + sw * .3, y - 18 * s); ctx.lineTo(x + (20 * s + sw) * dir, y - 16 * s); ctx.stroke();
    ctx.fillStyle = P.metal;
    ctx.beginPath(); ctx.moveTo(x + (20 * s + sw) * dir, y - 20 * s);
    ctx.lineTo(x + (30 * s + sw) * dir, y - 16 * s); ctx.lineTo(x + (20 * s + sw) * dir, y - 12 * s); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .4;
    ctx.strokeStyle = pal.glow; ctx.lineWidth = 1.3; ctx.stroke(fp); ctx.restore();
  }

  /* ---------- gunship ---------- */
  function gunship(ctx, o) {
    const { x, y, s, dir, ph, P } = o;
    ctx.save(); ctx.translate(x, y + Math.sin(ph * .7) * 3 * s);
    const bp = new Path2D();
    bp.moveTo(-26 * s * dir, 0); bp.lineTo(-14 * s * dir, -9 * s);
    bp.lineTo(16 * s * dir, -8 * s); bp.lineTo(28 * s * dir, 2 * s);
    bp.lineTo(14 * s * dir, 8 * s); bp.lineTo(-18 * s * dir, 7 * s); bp.closePath();
    ctx.fillStyle = P.body; ctx.fill(bp);
    ctx.fillStyle = P.accent; ctx.globalAlpha = .85;
    ctx.beginPath(); ctx.ellipse(18 * s * dir, 0, 7 * s, 4 * s, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    /* rotor blur */
    ctx.strokeStyle = 'rgba(200,215,235,.30)'; ctx.lineWidth = 2.4 * s;
    ctx.beginPath(); ctx.ellipse(0, -12 * s, 34 * s * (.7 + Math.abs(Math.sin(ph * 9)) * .3), 3 * s, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = P.dark; ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.moveTo(0, -9 * s); ctx.lineTo(0, -1 * s); ctx.stroke();
    /* weapon pods */
    ctx.fillStyle = P.dark;
    ctx.fillRect(-8 * s * dir, 6 * s, 20 * s * dir, 4 * s);
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .45;
    ctx.strokeStyle = pal.glow; ctx.lineWidth = 1.3; ctx.translate(x, y + Math.sin(ph * .7) * 3 * s);
    ctx.stroke(bp); ctx.restore();
  }

  /* ===================================================================
     MY FORTRESS — grows with curtain-wall grade, sprouts turrets
     =================================================================== */
  function myCastle(ctx, g, t) {
    const grade = g.grades.walls || 0;
    const keepH = 250 + Math.min(9, grade) * 11;
    const dmg = 1 - g.wall.hp / g.wall.max;
    const base = GROUND + 6;
    const stone = '#3a3e49', stone2 = '#2b2f38', trim = '#565d6b';

    ctx.save();
    /* --- outer bailey wall --- */
    ctx.fillStyle = stone2;
    ctx.fillRect(0, base - 116, MY_WALL, 122);
    ctx.fillStyle = stone;
    ctx.fillRect(0, base - 116, MY_WALL, 12);
    for (let x = 6; x < MY_WALL - 4; x += 22) { ctx.fillStyle = stone; ctx.fillRect(x, base - 132, 13, 18); }
    /* wall banding */
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    for (let y = base - 100; y < base; y += 17) ctx.fillRect(0, y, MY_WALL, 2);
    ctx.fillStyle = 'rgba(255,235,200,.035)';
    for (let x = 0; x < MY_WALL; x += 34) ctx.fillRect(x, base - 116, 2, 122);

    /* --- gate --- */
    ctx.fillStyle = '#181b21';
    ctx.beginPath(); ctx.moveTo(MY_WALL - 54, base); ctx.lineTo(MY_WALL - 54, base - 62);
    ctx.arc(MY_WALL - 32, base - 62, 22, Math.PI, 0); ctx.lineTo(MY_WALL - 10, base); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#4a4231'; ctx.lineWidth = 2.4;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(MY_WALL - 52 + i * 10, base - 82); ctx.lineTo(MY_WALL - 52 + i * 10, base); ctx.stroke(); }
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(MY_WALL - 54, base - 62 + i * 16); ctx.lineTo(MY_WALL - 10, base - 62 + i * 16); ctx.stroke(); }
    /* gate lantern */
    glowDot(ctx, MY_WALL - 62, base - 92, 22, '255,190,110', .5 + Math.sin(t * 3.1) * .08);

    /* --- side tower --- */
    tower(ctx, 32, base, 60, 176, stone, stone2, trim);
    /* --- main keep --- */
    tower(ctx, 108, base, 84, keepH, stone, stone2, trim, true);
    /* --- forward tower (archer platform base) --- */
    tower(ctx, 196, base, 52, 150, stone, stone2, trim);

    /* windows */
    ctx.fillStyle = 'rgba(255,186,102,.85)';
    [[46, 120], [46, 74], [124, 150], [148, 110], [124, 70], [208, 96], [208, 58]].forEach(([wx2, wy]) => {
      const f = .72 + Math.sin(t * 2.3 + wx2) * .12;
      ctx.globalAlpha = f; ctx.fillRect(wx2, base - wy, 7, 12); ctx.globalAlpha = 1;
      glowDot(ctx, wx2 + 3, base - wy + 6, 16, '255,180,90', .28 * f);
    });

    /* banners */
    banner(ctx, 150, base - keepH + 6, 62, '#c2a24a', '#8f2f28', t, g.wind, 'bolt');
    banner(ctx, 46, base - 176 + 6, 40, '#c2a24a', '#2f5c8f', t, g.wind, null);

    /* braziers on the wall */
    [70, 172, 232].forEach((bx, i) => {
      ctx.fillStyle = '#22262e'; ctx.fillRect(bx - 5, base - 140, 10, 9);
      const f = .8 + Math.sin(t * 6 + i * 2) * .2;
      glowDot(ctx, bx, base - 143, 30 * f, '255,150,60', .5);
      if (chance(.28)) fxFire(bx, base - 142, 1, 5, .5);
    });

    /* ballista turrets */
    for (let i = 0; i < g.mods.turrets; i++) {
      const tx = i === 0 ? 150 : 46, ty = base - (i === 0 ? keepH : 176) - 4;
      ballista(ctx, tx, ty, g.turretAim[i] || -.4, g.turretRecoil[i] || 0, trim);
    }

    /* aegis shield dome */
    if (g.shield > 0) {
      const a = .10 + (g.shield / Math.max(1, g.mods.shieldMax)) * .16;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gg = ctx.createRadialGradient(130, base - 60, 40, 130, base - 60, 230);
      gg.addColorStop(0, `rgba(120,220,255,0)`); gg.addColorStop(.72, `rgba(120,220,255,${a * .5})`);
      gg.addColorStop(1, `rgba(150,240,255,${a})`);
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(130, base - 60, 230, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(160,240,255,${a * 2.4})`; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(130, base - 60, 228 + Math.sin(t * 2) * 3, -Math.PI * .96, Math.PI * .1); ctx.stroke();
      ctx.restore();
    }

    /* battle damage */
    if (dmg > .12) {
      ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 2.4;
      const n = Math.floor(dmg * 14);
      for (let i = 0; i < n; i++) {
        const sx = hash1(i * 3.3) * MY_WALL, sy = base - 20 - hash1(i * 7.1) * 110;
        ctx.beginPath(); ctx.moveTo(sx, sy);
        ctx.lineTo(sx + hash1(i * 2.1) * 22 - 11, sy + 20 + hash1(i * 5.5) * 26);
        ctx.stroke();
      }
      if (dmg > .45 && chance(.3)) fxSmoke(rnd(10, MY_WALL), base - rnd(60, 140), 1, 16, '40,36,32', 24, 2.2);
      if (dmg > .7 && chance(.16)) fxFire(rnd(10, MY_WALL), base - rnd(40, 120), 1, 8, .7);
    }
    ctx.restore();
  }

  function tower(ctx, x, base, w, h, stone, stone2, trim, keep) {
    ctx.fillStyle = stone2; ctx.fillRect(x, base - h, w, h);
    ctx.fillStyle = 'rgba(255,240,215,.05)'; ctx.fillRect(x, base - h, w * .3, h);
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(x + w * .68, base - h, w * .32, h);
    /* machicolation */
    ctx.fillStyle = stone; ctx.fillRect(x - 5, base - h - 10, w + 10, 12);
    for (let i = 0; i <= w + 4; i += 15) { ctx.fillStyle = stone; ctx.fillRect(x - 5 + i, base - h - 26, 9, 18); }
    /* stones */
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    for (let y = base - h + 12; y < base; y += 15) ctx.fillRect(x, y, w, 1.6);
    if (keep) {
      ctx.fillStyle = '#243347';
      ctx.beginPath(); ctx.moveTo(x - 10, base - h - 26); ctx.lineTo(x + w / 2, base - h - 78);
      ctx.lineTo(x + w + 10, base - h - 26); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.06)';
      ctx.beginPath(); ctx.moveTo(x - 10, base - h - 26); ctx.lineTo(x + w / 2, base - h - 78);
      ctx.lineTo(x + w / 2, base - h - 26); ctx.closePath(); ctx.fill();
    }
  }

  function banner(ctx, x, y, len, pole, cloth, t, wind, sig) {
    ctx.strokeStyle = '#4c4536'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 54); ctx.stroke();
    ctx.fillStyle = pole; ctx.beginPath(); ctx.arc(x, y - 56, 3, 0, TAU); ctx.fill();
    const wv = (wind || 0) * .5;
    ctx.fillStyle = cloth; ctx.beginPath(); ctx.moveTo(x + 1, y - 52);
    for (let i = 0; i <= 6; i++) {
      const f = i / 6, ww = Math.sin(t * 3.4 + f * 4 + wv) * (3 + f * 6);
      ctx.lineTo(x + 1 + f * len * .55, y - 52 + ww + f * 2);
    }
    for (let i = 6; i >= 0; i--) {
      const f = i / 6, ww = Math.sin(t * 3.4 + f * 4 + wv) * (3 + f * 6);
      ctx.lineTo(x + 1 + f * len * .55, y - 52 + ww + f * 2 + 26 - f * 7);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fill();
    ctx.fillStyle = cloth; ctx.globalAlpha = .9; ctx.fill(); ctx.globalAlpha = 1;
    if (sig) { ctx.save(); ctx.translate(x + len * .16, y - 40 + Math.sin(t * 3.4 + 1) * 3);
      ctx.fillStyle = 'rgba(245,225,170,.85)'; ctx.beginPath();
      ctx.moveTo(3, -7); ctx.lineTo(-3, 1); ctx.lineTo(1, 1); ctx.lineTo(-2, 8); ctx.lineTo(5, -1); ctx.lineTo(1, -1); ctx.closePath();
      ctx.fill(); ctx.restore(); }
  }

  function ballista(ctx, x, y, aim, recoil, trim) {
    ctx.save(); ctx.translate(x, y - 8);
    ctx.fillStyle = '#2a2f38'; ctx.fillRect(-13, -3, 26, 9);
    ctx.rotate(aim);
    ctx.strokeStyle = '#4b4231'; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(-10 + recoil * 6, 0); ctx.lineTo(22, 0); ctx.stroke();
    ctx.strokeStyle = '#6d5f45'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(10, -13); ctx.lineTo(10, 13); ctx.stroke();
    ctx.strokeStyle = 'rgba(240,230,205,.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(10, -13); ctx.lineTo(-2 + recoil * 8, 0); ctx.lineTo(10, 13); ctx.stroke();
    ctx.restore();
  }

  function glowDot(ctx, x, y, r, rgb, a) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
  }

  /* ===================================================================
     ENEMY CITY — styled per city, breaks apart as its walls fall
     =================================================================== */
  function enemyCity(ctx, g, t) {
    const cy = g.city, st = cy.style, base = GROUND + 6;
    const frac = g.foeWall.hp / g.foeWall.max;
    const ruin = 1 - frac;

    ctx.save();
    /* --- background skyline --- */
    skyline.forEach((b, i) => {
      const broken = ruin > .35 && hash1(i * 2.9 + cy.seed) < (ruin - .35) * 1.3;
      const h = b.h * (broken ? .45 + hash1(i) * .2 : 1);
      ctx.fillStyle = st.roof;
      ctx.fillRect(b.x, base - 120 - h, b.w, h + 40);
      if (b.spire && !broken) {
        ctx.beginPath(); ctx.moveTo(b.x - 3, base - 120 - h); ctx.lineTo(b.x + b.w / 2, base - 150 - h);
        ctx.lineTo(b.x + b.w + 3, base - 120 - h); ctx.closePath(); ctx.fill();
      }
      if (b.lit && !broken) {
        ctx.fillStyle = hexA(st.glow, .5);
        ctx.fillRect(b.x + b.w * .3, base - 100 - h * .6, 3, 5);
      }
      if (broken && chance(.06)) fxSmoke(b.x + b.w / 2, base - 120 - h, 1, 16, '46,40,36', 30, 3);
    });

    /* --- curtain wall --- */
    const wallH = 138;
    ctx.fillStyle = st.stone; ctx.fillRect(EN_WALL, base - wallH, W - EN_WALL, wallH + 6);
    ctx.fillStyle = 'rgba(0,0,0,.30)'; ctx.fillRect(EN_WALL, base - wallH, 16, wallH + 6);
    for (let x = EN_WALL + 4; x < W; x += 24) { ctx.fillStyle = st.trim; ctx.fillRect(x, base - wallH - 16, 14, 18); }
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    for (let y = base - wallH + 14; y < base; y += 16) ctx.fillRect(EN_WALL, y, W - EN_WALL, 2);

    /* --- gate: units pour out of a lit maw --- */
    const gx = EN_GATE + 14;
    ctx.fillStyle = '#0a0608';
    ctx.beginPath(); ctx.moveTo(gx - 26, base); ctx.lineTo(gx - 26, base - 54);
    ctx.arc(gx, base - 54, 26, Math.PI, 0); ctx.lineTo(gx + 26, base); ctx.closePath(); ctx.fill();
    glowDot(ctx, gx, base - 30, 78, hexToRgb(st.glow), .30 + Math.sin(t * 2.2) * .06);
    ctx.strokeStyle = hexA(st.glow, .35); ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const yy = base - 8 - i * 14;
      ctx.beginPath(); ctx.moveTo(gx - 24, yy); ctx.lineTo(gx + 24, yy); ctx.stroke(); }

    /* --- towers: they fall as the walls fall --- */
    const towers = [
      { x: EN_WALL + 26, h: 210, w: 46 },
      { x: EN_WALL + 104, h: 288, w: 58 },
      { x: EN_WALL + 186, h: 232, w: 50 },
    ];
    towers.forEach((tw, i) => {
      const thresh = [.72, .40, .16][i];
      const alive = frac > thresh;
      const h = alive ? tw.h : tw.h * (.28 + hash1(i + cy.seed) * .12);
      ctx.fillStyle = st.stone; ctx.fillRect(tw.x, base - h, tw.w, h);
      ctx.fillStyle = 'rgba(0,0,0,.26)'; ctx.fillRect(tw.x + tw.w * .66, base - h, tw.w * .34, h);
      ctx.fillStyle = st.trim; ctx.fillRect(tw.x - 5, base - h - 10, tw.w + 10, 12);
      if (alive) {
        for (let k = 0; k <= tw.w + 4; k += 15) ctx.fillRect(tw.x - 5 + k, base - h - 24, 9, 16);
        ctx.fillStyle = st.roof;
        ctx.beginPath(); ctx.moveTo(tw.x - 8, base - h - 24); ctx.lineTo(tw.x + tw.w / 2, base - h - 24 - tw.w * 1.15);
        ctx.lineTo(tw.x + tw.w + 8, base - h - 24); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.25)';
        ctx.beginPath(); ctx.moveTo(tw.x + tw.w / 2, base - h - 24 - tw.w * 1.15);
        ctx.lineTo(tw.x + tw.w + 8, base - h - 24); ctx.lineTo(tw.x + tw.w / 2, base - h - 24); ctx.closePath(); ctx.fill();
        /* lit windows */
        for (let k = 0; k < 4; k++) {
          const wy = base - h + 34 + k * 42; if (wy > base - 20) break;
          ctx.fillStyle = hexA(st.glow, .7 + Math.sin(t * 2 + k + i) * .16);
          ctx.fillRect(tw.x + tw.w * .34, wy, 7, 13);
          glowDot(ctx, tw.x + tw.w * .34 + 3, wy + 6, 17, hexToRgb(st.glow), .3);
        }
      } else {
        /* jagged broken crown */
        ctx.fillStyle = st.stone; ctx.beginPath(); ctx.moveTo(tw.x, base - h);
        for (let k = 0; k <= 5; k++) ctx.lineTo(tw.x + tw.w * k / 5, base - h - hash1(k * 3 + i) * 26);
        ctx.lineTo(tw.x + tw.w, base - h + 4); ctx.closePath(); ctx.fill();
        if (chance(.14)) fxSmoke(tw.x + tw.w / 2, base - h, 1, 20, '42,34,30', 34, 3);
        if (chance(.07)) fxFire(tw.x + rnd(0, tw.w), base - h, 1, 9, .8);
      }
    });

    /* --- city banner with a generated sigil --- */
    cityBanner(ctx, EN_WALL + 133, base - 300, cy, t, g.wind);

    /* --- their wall guns --- */
    for (let i = 0; i < (g.foeTurrets ? g.foeTurrets.length : 0); i++) {
      const tt = g.foeTurrets[i];
      ctx.save(); ctx.translate(tt.x, tt.y);
      ctx.fillStyle = st.trim; ctx.fillRect(-14, -4, 28, 10);
      ctx.rotate(tt.aim);
      ctx.fillStyle = '#1a1416'; ctx.fillRect(-6 + tt.recoil * 7, -3, 30, 6);
      ctx.restore();
    }

    /* --- damage --- */
    if (ruin > .1) {
      ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 2.6;
      const n = Math.floor(ruin * 18);
      for (let i = 0; i < n; i++) {
        const sx = EN_WALL + hash1(i * 3.7 + cy.seed) * (W - EN_WALL), sy = base - 16 - hash1(i * 5.9) * 120;
        ctx.beginPath(); ctx.moveTo(sx, sy);
        ctx.lineTo(sx + hash1(i * 2.3) * 26 - 13, sy + 22 + hash1(i * 6.1) * 30); ctx.stroke();
      }
      if (ruin > .35 && chance(.3)) fxSmoke(rnd(EN_WALL, W), base - rnd(50, 150), 1, 20, '44,36,32', 30, 2.6);
      if (ruin > .6 && chance(.22)) fxFire(rnd(EN_WALL, W), base - rnd(30, 130), 1, 10, .8);
    }
    ctx.restore();
  }

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  }

  function cityBanner(ctx, x, y, cy, t, wind) {
    const st = cy.style;
    ctx.save();
    ctx.strokeStyle = '#2a2228'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 8); ctx.stroke();
    const w = 52, h = 86;
    ctx.beginPath(); ctx.moveTo(x - w / 2, y);
    for (let i = 0; i <= 5; i++) { const f = i / 5;
      ctx.lineTo(x - w / 2 + f * w, y + Math.sin(t * 2.1 + f * 3 + wind) * 3); }
    ctx.lineTo(x + w / 2, y + h - 12); ctx.lineTo(x, y + h); ctx.lineTo(x - w / 2, y + h - 12);
    ctx.closePath();
    ctx.fillStyle = st.flag; ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.moveTo(x + w * .16, y); ctx.lineTo(x + w / 2, y);
    ctx.lineTo(x + w / 2, y + h - 12); ctx.lineTo(x + w * .16, y + h - 6); ctx.closePath(); ctx.fill();
    /* sigil — deterministic from the city seed */
    ctx.save(); ctx.translate(x, y + 36); ctx.scale(1.5, 1.5);
    ctx.strokeStyle = 'rgba(12,8,10,.85)'; ctx.fillStyle = 'rgba(14,9,11,.85)'; ctx.lineWidth = 1.6;
    const k = (cy.seed * 6) | 0;
    ctx.beginPath();
    if (k === 0) { ctx.moveTo(0, -10); ctx.lineTo(7, 8); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill(); }
    else if (k === 1) { ctx.arc(0, 0, 8, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, TAU); ctx.fill(); }
    else if (k === 2) { ctx.moveTo(-8, -8); ctx.lineTo(8, 8); ctx.moveTo(8, -8); ctx.lineTo(-8, 8); ctx.stroke(); }
    else if (k === 3) { for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5;
        ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); ctx.lineTo(Math.cos(a + TAU / 10) * 4, Math.sin(a + TAU / 10) * 4); }
      ctx.closePath(); ctx.fill(); }
    else if (k === 4) { ctx.moveTo(0, -10); ctx.lineTo(9, -2); ctx.lineTo(6, 9); ctx.lineTo(-6, 9); ctx.lineTo(-9, -2);
      ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, 6); ctx.stroke(); }
    else { ctx.moveTo(-9, 6); ctx.quadraticCurveTo(0, -14, 9, 6); ctx.quadraticCurveTo(0, 0, -9, 6); ctx.fill(); }
    ctx.restore();
    ctx.restore();
  }

  /* ===================================================================
     PARTICLES
     =================================================================== */
  function particles(ctx) {
    /* normal pass */
    for (const p of PART) {
      if (p.add) continue;
      const f = p.age / p.life, a = 1 - f;
      if (p.k === 'smoke') {
        ctx.globalAlpha = p.a * a * .9;
        const r = p.r * (.5 + f * 1.7);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, `rgba(${p.col},.85)`); g.addColorStop(1, `rgba(${p.col},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
      } else if (p.k === 'chunk') {
        ctx.globalAlpha = Math.min(1, a * 2.4); ctx.fillStyle = p.col;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillRect(-p.w / 2, -p.w / 2, p.w, p.w * .74); ctx.restore();
      } else if (p.k === 'coin') {
        ctx.globalAlpha = Math.min(1, a * 3);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        const sq = Math.abs(Math.cos(p.rot * 1.4)) * p.w;  /* spin foreshortening */
        ctx.fillStyle = '#8a5e14'; ctx.fillRect(-sq, -p.w, sq * 2, p.w * 2);
        ctx.fillStyle = '#ffd15e'; ctx.fillRect(-sq * .8, -p.w * .8, sq * 1.6, p.w * 1.6);
        if (((p.rot * 3) | 0) % 4 === 0) { ctx.fillStyle = '#fff6cf'; ctx.fillRect(-sq * .35, -p.w * .8, sq * .5, p.w * .55); }
        ctx.restore();
      } else if (p.k === 'blood') {
        ctx.globalAlpha = Math.min(1, a * 2.2); ctx.fillStyle = `rgb(${p.col})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.w * (1 - f * .4), 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    /* additive pass */
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of PART) {
      if (!p.add) continue;
      const f = p.age / p.life, a = 1 - f;
      if (p.k === 'coin') {
        ctx.globalAlpha = a * .5;
        const gg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.w * 3.2);
        gg.addColorStop(0, 'rgba(255,215,110,.8)'); gg.addColorStop(1, 'rgba(255,190,80,0)');
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(p.x, p.y, p.w * 3.2, 0, TAU); ctx.fill();
      } else if (p.k === 'spark') {
        ctx.globalAlpha = a; ctx.strokeStyle = p.col; ctx.lineWidth = p.w;
        ctx.beginPath(); ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * .012, p.y - p.vy * .012); ctx.stroke();
      } else if (p.k === 'fire') {
        const r = p.r * (1 - f * .55);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, `rgba(255,245,215,${a * .95})`);
        g.addColorStop(.35, `rgba(255,170,60,${a * .7})`);
        g.addColorStop(1, `rgba(190,50,20,0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
      } else if (p.k === 'ring') {
        ctx.globalAlpha = a * a; ctx.strokeStyle = p.col; ctx.lineWidth = p.w * (1 - f * .7);
        ctx.beginPath(); ctx.arc(p.x, p.y, lerp(p.r0, p.r1, ease.out(f)), 0, TAU); ctx.stroke();
      } else if (p.k === 'flash') {
        const r = p.r * (1 + f * .5);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, `rgba(${p.col},${a * .9})`); g.addColorStop(1, `rgba(${p.col},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
      }
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }

  function floaters(ctx) {
    ctx.save(); ctx.textAlign = 'center';
    for (const t of FTEXT) {
      const f = t.age / t.life, a = f < .12 ? f / .12 : 1 - Math.max(0, (f - .55) / .45);
      const sc = 1 + (1 - Math.min(1, f * (t.crit ? 6 : 7))) * (t.crit ? .9 : .4);
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = `${t.crit ? '' : ''}${(t.size * sc) | 0}px ${t.crit ? 'Haettenschweiler, Impact, sans-serif' : '"Trebuchet MS", sans-serif'}`;
      ctx.lineWidth = 4.6; ctx.strokeStyle = 'rgba(0,0,0,.88)';
      ctx.strokeText(t.txt, t.x, t.y); ctx.fillStyle = t.col; ctx.fillText(t.txt, t.x, t.y);
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }

  return {
    setCity, drawSky, drawMid, drawGround, drawNear, weather,
    myCastle, enemyCity, human, tank, arty, mech, gunship, ram,
    particles, floaters, shadow, glowDot, hexA, hexToRgb,
    decalBlood, decalScorch, decalWreck, bake,
    get pal() { return pal; },
  };
})();
