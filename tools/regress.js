/* Regression suite — run:  node tools/regress.js
   Each block re-measures a combat bug that was fixed, by driving the real
   step functions. These are behaviour probes, not unit tests: they print
   numbers so a balance change reads as a changed number, not a red X.
   The [R] block guards against over-fixing (the thing each fix touched
   must still work). Expected values are in the labels. */
'use strict';
const vm = require('vm');
const { boot, sandbox } = require('./harness');

const ctx = boot();
const R = code => vm.runInContext(code, ctx);

// shared helpers injected into the game's own context
R(`
  function __step(dt, n) {                      // frame()'s battle core, minus city/turret brains
    for (let k = 0; k < n; k++) {
      G.t += dt; G.levelT += dt;
      G.rally = Math.max(0, G.rally - dt);
      if (G.mods.wallRegen && G.wall.hp < G.wall.max) G.wall.hp = Math.min(G.wall.max, G.wall.hp + G.wall.max * G.mods.wallRegen * dt);
      for (const c of G.A) stepCombatant(c, dt);
      for (let i = G.A.length - 1; i >= 0; i--) if (G.A[i].dying > .85) G.A.splice(i, 1);
      stepProjectiles(dt);
    }
  }
  function __clean() { G.A.length = 0; G.P.length = 0; G.FX.length = 0; G.pop = 0; G.rally = 0;
    G.foeWall = { hp: 1e9, max: 1e9 };   // scenarios must not starve each other of castle
  }
  function __dummy(foe, x) {                    // an inert enemy that just stands there
    const f = spawnFoe(FOE[foe]); f.x = x; f.y = GROUND; f.spd = 0; f.dmg = 0;
    f.hp = 1e9; f.max = 1e9; f.rate = 1e9; f.cd = 1e9; return f;
  }
  startRun(false);
  G.gold = 1e9;
`);

const out = [];
const say = (k, v) => { out.push([k, v]); console.log('  ' + k.padEnd(52) + ' = ' + v); };

/* ---------------------------------------------------------------- 1 */
console.log('\n[1] melee/ram at the enemy wall with a foe 170px away');
say('siege ram wall damage over 10s', R(`(() => {
  __clean();
  const ram = spawnUnit(UNIT.ram); ram.x = EN_WALL - 20; ram.y = GROUND;
  __dummy('grunt', EN_WALL - 190);
  const b = G.foeWall.hp; __step(1/60, 600); return Math.round(b - G.foeWall.hp);
})()`));
say('swordsman line wall damage over 10s', R(`(() => {
  __clean();
  for (let i = 0; i < 4; i++) { const s = spawnUnit(UNIT.sword); s.x = EN_WALL - 20 - i * 8; s.y = GROUND; }
  __dummy('grunt', EN_WALL - 190);
  const b = G.foeWall.hp; __step(1/60, 600); return Math.round(b - G.foeWall.hp);
})()`));

/* ---------------------------------------------------------------- 2 */
console.log('\n[2] air units strafing a ground target (ideal = time/rate)');
say('sky corsair shots in 20s (ideal 33)', R(`(() => {
  __clean();
  const c = spawnUnit(UNIT.corsair); c.x = 800; c.y = 430;
  __dummy('grunt', 800);
  let n = 0; const op = G.P.push.bind(G.P); G.P.push = p => { n++; return op(p); };
  __step(1/60, 1200); G.P.push = op; return n;
})()`));
say('enemy gunship shots in 20s (ideal 28)', R(`(() => {
  __clean();
  const f = spawnFoe(FOE.wraith); f.x = 800; f.y = 430;
  const s = spawnUnit(UNIT.sword); s.x = 800; s.y = GROUND; s.spd = 0; s.dmg = 0; s.hp = 1e9; s.max = 1e9;
  let n = 0; const op = G.P.push.bind(G.P); G.P.push = p => { n++; return op(p); };
  __step(1/60, 1200); G.P.push = op; return n;
})()`));

/* ---------------------------------------------------------------- 3 */
console.log('\n[3] HEAVY MUNITIONS (+35% radius) applied how many times?');
say('mortar shell p.splash (base 56, want 56)', R(`(() => {
  __clean(); G.tech.add('t_big'); recompute();
  const crew = spawnUnit(UNIT.crew); crew.x = EN_WALL - 300; crew.y = GROUND; crew.cd = 0;
  __step(1/60, 2);
  const p = G.P[0]; return p ? +p.splash.toFixed(2) : 'no shell';
})()`));
say('furthest enemy damaged by one shell (px)', R(`(() => {
  __clean();
  const crew = spawnUnit(UNIT.crew); crew.x = 500; crew.y = GROUND; crew.cd = 0;
  const line = []; for (let i = 0; i < 30; i++) line.push(__dummy('grunt', 700 + i * 6));
  __step(1/60, 240);
  let far = 0; line.forEach(o => { if (o.hp < 1e9) far = Math.max(far, o.x - 700); });
  return far;
})()`));

/* ---------------------------------------------------------------- 4 */
console.log('\n[4] one mortar shell into the enemy wall');
say('crew base damage', R(`(() => { __clean(); G.tech.delete('t_big'); recompute();
  const c = spawnUnit(UNIT.crew); return Math.round(c.dmg); })()`));
say('wall hp lost by that one shell', R(`(() => {
  __clean();
  const crew = spawnUnit(UNIT.crew); crew.x = EN_WALL - 300; crew.y = GROUND; crew.cd = 0;
  const b = G.foeWall.hp;
  __step(1/60, 2); crew.cd = 1e9;              // exactly one shell in the air
  __step(1/60, 240);
  return Math.round(b - G.foeWall.hp);
})()`));

/* ---------------------------------------------------------------- 5 */
console.log('\n[5] army restored from a save');
say('restored units [id, fly, y]', R(`(() => {
  __clean(); G.pendingArmy = ['corsair', 'sword']; startCity(2);
  return JSON.stringify(G.A.map(c => [c.id, c.fly, Math.round(c.y)]));
})()`));

/* ---------------------------------------------------------------- 6 */
console.log('\n[6] RALLY (+60% dmg) on the Rail Walker beam');
const beam = R(`(() => {
  const run = rally => {
    __clean(); G.rally = rally;
    const m = spawnUnit(UNIT.mech); m.x = 1000; m.y = GROUND; m.cd = 0;
    const f = __dummy('grunt', 1200);
    for (let i = 0; i < 200 && f.hp >= 1e9; i++) __step(1/60, 1);
    return Math.round(1e9 - f.hp);
  };
  return JSON.stringify([run(0), run(9)]);
})()`);
say('beam hit dmg [no rally, rally]', beam);

/* ---------------------------------------------------------------- 7 */
console.log('\n[7] clicking an ability outside battle');
say('repair during intermission [wallHp, cd]', R(`(() => {
  __clean(); G.phase = 'inter'; G.mods.abil.repair = 1; G.abilCd.repair = 0;
  G.wall.hp = 100; useAbility('repair');
  const r = [Math.round(G.wall.hp), G.abilCd.repair]; G.phase = 'battle'; return JSON.stringify(r);
})()`));

/* ---------------------------------------------------------------- 8 */
console.log('\n[8] pausing mid-draw');
say('G.drawing after togglePause()', R(`(() => {
  G.phase = 'battle'; G.paused = false; G.drawing = true; G.charge = .5;
  togglePause(); const r = G.drawing; togglePause(); G.drawing = false; return r;
})()`));

/* ---------------------------------------------------------------- 9 */
console.log('\n[9] VETERAN CORPS regen ("2%/s out of combat")');
say('hp regained while locked in melee (10s)', R(`(() => {
  __clean(); G.tech.add('t_vet'); recompute();
  const s = spawnUnit(UNIT.sword); s.x = 800; s.y = GROUND; s.hp = 10;
  const f = __dummy('grunt', 830);
  __step(1/60, 600); return Math.round(s.hp - 10) + ' (engaged=' + !!s.engaged + ')';
})()`));

/* ---------------------------------------------------------------- 10 */
console.log('\n[10] hero arrow ground decals');
say('DECALS after 400 arrows into the dirt', R(`(() => {
  DECALS.length = 0;
  for (let i = 0; i < 400; i++) impact({ hero: 1, kind: 'std', vx: 200, vy: 300, dmg: 10, k: 'heroArrow' }, 500 + i, GROUND);
  return DECALS.length;
})()`));

/* ------------------------------------------------- regression counter-checks */
console.log('\n[R] did the fixes break the thing they touched?');
say('R1 regen OUT of combat, 10s (want ~24)', R(`(() => {
  __clean(); G.tech.add('t_vet'); recompute();
  const s = spawnUnit(UNIT.sword); s.x = 800; s.y = GROUND; s.hp = 10; s.spd = 0;
  __step(1/60, 600); return Math.round(s.hp - 10);
})()`));
say('R2 melee still fights a foe in reach first', R(`(() => {
  __clean();
  const s = spawnUnit(UNIT.sword); s.x = EN_WALL - 20; s.y = GROUND;
  const f = __dummy('grunt', EN_WALL - 45);
  const wb = G.foeWall.hp; __step(1/60, 300);
  return 'foeHp-' + Math.round(1e9 - f.hp) + ' wall-' + Math.round(wb - G.foeWall.hp);
})()`));
say('R3 hero firepot beside the wall still cracks it', R(`(() => {
  __clean(); const b = G.foeWall.hp;
  boom(EN_WALL - 30, GROUND - 10, 96, 200, 1, true);      // same call impact() makes
  return Math.round(b - G.foeWall.hp);
})()`));
say('R4 BARRAGE on the wall still cracks it', R(`(() => {
  __clean(); G.mods.abil.barrage = 1; G.abilCd.barrage = 0; G.armed = null;
  const b = G.foeWall.hp; useAbility('barrage', EN_WALL - 20);
  return 'queued(async) cd-' + G.abilCd.barrage;
})()`));
say('R5 shell that hits a UNIT still splashes the wall', R(`(() => {
  __clean();
  const crew = spawnUnit(UNIT.crew); crew.x = EN_WALL - 400; crew.y = GROUND; crew.cd = 0;
  __dummy('grunt', EN_WALL - 25);
  const b = G.foeWall.hp; __step(1/60, 2); crew.cd = 1e9; __step(1/60, 240);
  return Math.round(b - G.foeWall.hp);
})()`));
say('R6 air vs air still uses the true 3D gap', R(`(() => {
  __clean();
  const c = spawnUnit(UNIT.corsair); c.x = 800; c.y = 430;
  const f = spawnFoe(FOE.wraith); f.x = 800; f.y = 430; f.spd = 0; f.dmg = 0; f.hp = 1e9; f.max = 1e9; f.rate = 1e9; f.cd = 1e9;
  let n = 0; const op = G.P.push.bind(G.P); G.P.push = p => { n++; return op(p); };
  __step(1/60, 300); G.P.push = op; return n + ' shots in 5s';
})()`));
say('R7 champion splash still halved', R(`(() => {
  __clean(); const ch = spawnFoe(FOE.catF, CHAMPS[3]); ch.x = 1200; ch.y = GROUND; ch.cd = 0;
  __dummy('grunt', 600); __step(1/60, 4);
  const p = G.P[0]; return p ? 'splash-' + Math.round(p.splash) + ' (base 86)' : 'no shell';
})()`));

console.log('\n--- done ---');
