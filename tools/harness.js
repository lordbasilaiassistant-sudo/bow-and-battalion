/* Headless harness for BOW & BATTALION.
   Stubs just enough DOM/canvas/PWA surface to load util+data+art+game in Node
   and drive the REAL step functions — so combat behaviour can be measured
   instead of eyeballed. No build step, no dependencies:  node tools/regress.js
   (rAF is throttled in a hidden Chrome tab, which is why in-browser waiting
   does not work for this; drive the loop yourself, here or in the console.) */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'js');
const NOOP = function () { return undefined; };

function makeCtx2d() {
  const t = { canvas: { width: 1600, height: 900 } };
  return new Proxy(t, {
    get(o, k) {
      if (k in o) return o[k];
      if (typeof k === 'symbol') return undefined;
      if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern')
        return () => ({ addColorStop() { } });
      if (k === 'measureText') return () => ({ width: 10 });
      return NOOP;
    },
    set(o, k, v) { o[k] = v; return true; },
  });
}
const CTX2D = makeCtx2d();

function elem(tag) {
  const o = {
    tagName: tag, style: {}, dataset: {}, width: 0, height: 0, hidden: false,
    innerHTML: '', textContent: '', title: '', offsetWidth: 100, value: '',
    classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } },
    appendChild(c) { return c; }, remove() { }, insertBefore(c) { return c; },
    querySelectorAll() { return []; }, querySelector() { return elem('div'); },
    addEventListener() { }, removeEventListener() { }, setAttribute() { }, getAttribute() { return null; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1600, height: 900 }; },
    getContext() { return CTX2D; }, focus() { }, blur() { },
  };
  o.parentElement = o;
  return new Proxy(o, {
    get(t, k) { if (k in t) return t[k]; if (typeof k === 'symbol') return undefined; return NOOP; },
    set(t, k, v) { t[k] = v; return true; },
  });
}

const els = {};
const document = {
  getElementById(id) { return els[id] || (els[id] = elem('div')); },
  createElement(tag) { return elem(tag); },
  createElementNS(ns, tag) { return elem(tag); },
  querySelectorAll() { return []; },
  querySelector() { return elem('div'); },
  addEventListener() { }, removeEventListener() { },
  hidden: false,
};
document.body = elem('body');

const store = {};
const localStorage = {
  getItem(k) { return k in store ? store[k] : null; },
  setItem(k, v) { store[k] = String(v); },
  removeItem(k) { delete store[k]; },
  clear() { for (const k of Object.keys(store)) delete store[k]; },
};

function CanvasRenderingContext2D() { }
CanvasRenderingContext2D.prototype = {};
function Path2D() { return new Proxy({}, { get: () => NOOP, set: () => true }); }

const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  Math, JSON, Date, Object, Array, String, Number, Boolean, Set, Map, Error, Symbol,
  Uint8ClampedArray, Float32Array, isNaN, parseInt, parseFloat,
  document, localStorage, CanvasRenderingContext2D, Path2D,
  performance: { now: () => Number(process.hrtime.bigint() / 1000000n) },
  devicePixelRatio: 1,
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => { },
  addEventListener: () => { }, removeEventListener: () => { },
  AudioContext: undefined, webkitAudioContext: undefined,
  location: { reload() { } },
  innerWidth: 1600, innerHeight: 900,
  /* upstream's mobile/PWA pass reaches for these at load time */
  matchMedia: () => ({ matches: false, addEventListener() { }, removeEventListener() { }, addListener() { }, removeListener() { } }),
  navigator: { serviceWorker: { register: () => Promise.resolve({}), ready: Promise.resolve({}),
      addEventListener() { }, removeEventListener() { }, controller: null },
    standalone: false, userAgent: 'node' },
  screen: { width: 1600, height: 900, orientation: { type: 'landscape-primary', lock: () => Promise.resolve(), unlock() { }, addEventListener() { } } },
  visualViewport: { width: 1600, height: 900, scale: 1, offsetTop: 0, addEventListener() { }, removeEventListener() { } },
  orientation: 0,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* root: which copy of the js/ folder to load. seed: deterministic Math.random. */
function boot(root, seed) {
  const box = Object.assign({}, sandbox);
  box.window = box; box.globalThis = box; box.self = box;
  if (seed !== undefined) {
    const rng = mulberry32(seed);
    box.Math = Object.create(Math);
    box.Math.random = rng;
  }
  const ctx = vm.createContext(box);
  for (const f of ['util.js', 'data.js', 'art.js', 'game.js']) {
    const src = fs.readFileSync(path.join(root || ROOT, f), 'utf8');
    vm.runInContext(src, ctx, { filename: f });
  }
  return ctx;
}

module.exports = { boot, sandbox, els, localStorage, store, ROOT };
