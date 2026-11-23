// Sereno · the one WebGL canvas. Every 3D act is pinned to a DOM element with [data-stage].
// The farmhouse is a pure function of scroll once it has popped in, so scrolling back up retraces its trip:
// hero → the day stage (sun and moon roll over it) → the page margin → the night garden.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { House } from './three/house.js';
import { Garden } from './three/garden.js';
import { Estate } from './three/estate.js';
import { V, UP, TAU, clamp01, smooth, seg, glowTexture } from './three/util.js';

const { MathUtils: M } = THREE;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const $ = (s) => document.querySelector(s);
const S = () => window.sereno || {};

function signalReady(ok) {
  window.__serenoWorld = { ready: true, ok };
  window.dispatchEvent(new CustomEvent('sereno:world-ready', { detail: { ok } }));
}

/* ---------------------------------------------------------------- renderer */

const canvas = document.getElementById('world');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (err) {
  console.warn('[sereno] WebGL unavailable, running without the 3D world.', err);
  root.classList.add('no-webgl');
  signalReady(false);
  throw err;
}
function setupRenderer(r) {
  r.setClearColor(0x000000, 0);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.0;
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
setupRenderer(renderer);

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.6;

const CAM_Z = 12;
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
camera.position.set(0, 0, CAM_Z);

/* ------------------------------------------------------------------ lights */

function addLights(target) {
  const hemi = new THREE.HemisphereLight('#f3f6ea', '#9b7a4c', 0.95);
  target.add(hemi);
  const key = new THREE.DirectionalLight('#ffe7c2', 2.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.025;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 40;
  const rim = new THREE.DirectionalLight('#a6d4ff', 1.4);
  rim.position.set(-6, 4, -6);
  const fill = new THREE.DirectionalLight('#ffd2a1', 0.5);
  fill.position.set(-7, 1, 5);
  target.add(key, key.target, rim, fill);
  return { hemi, key, rim, fill };
}
const L = addLights(scene);
const key = L.key;
const KEY_OFFSET = V(3.6, 6.8, 6.2);
const DAY = { hemiSky: new THREE.Color('#f3f6ea'), hemiGround: new THREE.Color('#9b7a4c'), key: new THREE.Color('#ffe7c2'), rim: new THREE.Color('#a6d4ff') };
const NIGHT = { hemiSky: new THREE.Color('#5a6aa8'), hemiGround: new THREE.Color('#2a2238'), key: new THREE.Color('#9fb4ff'), rim: new THREE.Color('#7f9cff') };

/* ------------------------------------------------------------ stage system */

const view = { w: 1, h: 1, phone: false };
const acts = [];

class Act {
  constructor(name, el, layout, shadow = 2.6) {
    this.name = name;
    this.el = el;
    this.layoutFn = layout;
    this.shadow = shadow;
    this.group = new THREE.Group();
    this.x = 0; this.y = 0; this.s = 1;
    this.dist = Infinity;
    this.onScreen = false;
    this.rect = null;
    scene.add(this.group);
    acts.push(this);
  }
  layout() {
    Object.assign(this, this.layoutFn(view));
  }
  /** World y = the stage's offset from the viewport centre, converted to world units. Placed even off screen. */
  place() {
    const r = (this.rect = this.el.getBoundingClientRect());
    const ih = window.innerHeight;
    const centre = r.top + r.height / 2;
    this.group.position.set(this.x, (-(centre - ih / 2) / ih) * view.h + this.y, 0);
    this.group.scale.setScalar(this.s);
    this.onScreen = r.bottom > -ih * 0.6 && r.top < ih * 1.6;
    this.group.visible = this.onScreen;
    this.dist = Math.abs(centre - ih / 2);
    this.group.updateMatrixWorld(true);
  }
}

const progressOf = (el) => {
  if (!el) return 0;
  const r = el.getBoundingClientRect();
  const span = r.height - window.innerHeight;
  return span > 0 ? clamp01(-r.top / span) : r.top <= 0 ? 1 : 0;
};

const heroEl = $('[data-stage="hero"]');
const staySec = $('#stay'), insideSec = $('#inside'), whereSec = $('#location');
const pricingGrid = $('.pricing__grid');

/* ---------------------------------------------------------------- the acts */

const hero = new Act('hero', heroEl, (v) =>
  v.phone
    ? { x: 0, y: -v.h * 0.27, s: Math.min(0.78, v.w * 0.21) }
    : { x: v.w * 0.22, y: -v.h * 0.1, s: Math.min(v.h * 0.2, v.w * 0.11) },
  2.2
);
hero.group.rotation.x = 0.3;

const stay = new Act('stay', $('[data-stage="stay"]'), (v) =>
  v.phone
    ? { x: 0, y: -v.h * 0.06, s: v.w * 0.19 }
    : { x: 0, y: -v.h * 0.09, s: Math.min(v.h * 0.17, v.w * 0.095) },
  2.2
);
const shadowBlob = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#3b2a18', transparent: true, opacity: 0, depthWrite: false })
);
shadowBlob.scale.set(2.8, 0.42, 1);
shadowBlob.position.set(0, -0.62, -0.6);
stay.group.add(shadowBlob);

const inside = new Act('inside', $('[data-stage="inside"]'), (v) =>
  v.phone
    ? { x: 0, y: -v.h * 0.17, s: v.w * 0.15 }
    : { x: v.w * 0.2, y: -v.h * 0.05, s: Math.min(v.w * 0.075, v.h * 0.145) },
  2.8
);
const garden = new Garden();
inside.group.add(garden.group);
window.addEventListener('sereno:mood', (e) => garden.setMood(e.detail.mood));

const where = new Act('where', $('[data-stage="estate"]'), (v) =>
  v.phone
    ? { x: 0, y: -v.h * 0.17, s: v.w * 0.125 }
    : { x: v.w * 0.2, y: -v.h * 0.03, s: Math.min(v.w * 0.068, v.h * 0.125) },
  4.2
);
where.group.rotation.x = 0.3;
const estate = new Estate();
where.group.add(estate.group);

/* ---------------------------------------------------------- the farmhouse */

const house = new House({ tile: true, seed: 3 });
scene.add(house.group);
const HERO_YAW = -0.55;
const intro = { t: reduce ? 1 : 0, running: false };
let heroLights = 0, heroLightsTarget = 0, heroDoor = 0, heroDoorTarget = 0;

/* ------------------------------------------------------------- the journey */

const pose = () => ({ p: V(), q: new THREE.Quaternion(), s: 1, sy: 1, sxz: 1 });
const A = pose(), B = pose(), C = pose(), D = pose(), OUT = pose();
const _e = new THREE.Euler(), _qs = new THREE.Quaternion(), _q = new THREE.Quaternion();
let gutterLeft = 64;

/** Elastic pop-in: overshoots a little, squashes, settles. */
function introScale(t) {
  if (t >= 1) return { s: 1, sy: 1 };
  const k = 1 - Math.pow(2, -9 * t) * Math.cos(t * 11);
  const sq = Math.sin(t * Math.PI * 3) * (1 - t) * 0.12;
  return { s: Math.max(0, k), sy: 1 - sq };
}

function heroPose(out, time) {
  const sway = Math.sin(time * 0.6) * 0.06;
  out.p.set(0, 0, 0).applyMatrix4(hero.group.matrixWorld);
  out.q.copy(hero.group.quaternion).multiply(_q.setFromEuler(_e.set(0, HERO_YAW + sway, 0)));
  const ii = introScale(intro.t);
  out.s = hero.s * ii.s;
  out.sy = ii.sy;
  out.sxz = 1 + (1 - ii.sy) * 0.5;
  return out;
}
function stagePose(out, time, e) {
  out.p.set(0, Math.sin(time * 1.1) * 0.05, 0).applyMatrix4(stay.group.matrixWorld);
  out.q.setFromEuler(_e.set(0.24, M.lerp(-0.75, 0.85, smooth(e)) + Math.sin(time * 0.5) * 0.04, 0, 'XYZ'));
  out.s = stay.s;
  out.sy = out.sxz = 1;
  return out;
}
/** In the middle of the left page margin, never closer than its own width to the edge. */
function gutterPose(out, time) {
  if (view.phone) {
    // no margin to park in on a phone: shrink away above the cards, grow back into the garden
    out.p.set(0, view.h * 0.25, 0);
    out.q.setFromEuler(_e.set(0.3, time * 0.6, 0, 'YXZ'));
    out.s = 0.0001;
    out.sy = out.sxz = 1;
    return out;
  }
  const ppw = window.innerHeight / view.h;
  const sG = M.clamp((gutterLeft * 0.8) / (2.6 * ppw), 0.22, 0.55);
  const wpx = 2.6 * sG * ppw;
  const xpx = Math.max(gutterLeft / 2, wpx * 0.55);
  out.p.set((xpx / window.innerWidth - 0.5) * view.w, view.h * 0.08 + Math.sin(time * 1.2) * 0.08, 0);
  out.q.setFromEuler(_e.set(0.3, time * 0.6, Math.sin(time * 0.9) * 0.06, 'YXZ'));
  out.s = sG;
  out.sy = out.sxz = 1;
  return out;
}
function blend(a, b, t, arc, out) {
  out.p.lerpVectors(a.p, b.p, t);
  out.p.y += Math.sin(Math.PI * t) * arc;
  out.q.slerpQuaternions(a.q, b.q, t);
  out.s = M.lerp(a.s, b.s, t);
  out.sy = M.lerp(a.sy, b.sy, t);
  out.sxz = M.lerp(a.sxz, b.sxz, t);
  return out;
}

/** 0 by day, 1 with every light on, from the clock in the stay section. */
const lightsAt = (e) => {
  const h = S().hourAt ? S().hourAt(e) : 12.5;
  return smooth(seg(h, 18.6, 19.8)) * (1 - smooth(seg(h, 30, 31.2)));
};

function updateJourney(dt, time, k, e, j, P) {
  heroPose(A, time);
  stagePose(B, time, e);
  let out;
  if (j <= 0) {
    if (k <= 0) out = A;
    else if (k >= 1) out = B;
    else {
      out = blend(A, B, smooth(k), 1.4, OUT);
      out.q.premultiply(_qs.setFromAxisAngle(UP, TAU * smooth(k))); // one full turn on the way
    }
  } else {
    gutterPose(C, time);
    garden.slotPose(D);
    if (j < 0.22) out = blend(B, C, smooth(j / 0.22), 0.5, OUT);
    else if (j < 0.56) out = C;
    else {
      out = blend(C, D, smooth((j - 0.56) / 0.44), 1.2, OUT);
      if (j < 1) out.q.premultiply(_qs.setFromAxisAngle(UP, -TAU * smooth((j - 0.56) / 0.44)));
    }
  }
  const g = house.group;
  g.visible = out.s > 0.001;
  g.position.copy(out.p);
  g.quaternion.copy(out.q);
  g.scale.set(out.s * out.sxz, out.s * out.sy, out.s * out.sxz);
  g.updateMatrixWorld(true);

  // lights and door: tapped on in the hero, by the clock on the stage, on for good in the garden
  heroLights = M.damp(heroLights, heroLightsTarget, 4, dt);
  heroDoor = M.damp(heroDoor, heroDoorTarget, 5, dt);
  const away = smooth(k);
  let lights, door;
  if (j > 0) {
    lights = smooth(seg(j, 0.7, 1));
    door = smooth(seg(P, 0.04, 0.25)) * 0.9;
  } else {
    lights = Math.max(heroLights * (1 - away), lightsAt(e) * away);
    door = heroDoor * (1 - away);
  }
  house.setLights(reduce && j >= 1 ? 1 : lights);
  house.setDoor(door);
  house.update(dt, time);

  const w = smooth(k) * (1 - smooth(j / 0.15));
  shadowBlob.material.opacity = 0.45 * w;
  shadowBlob.visible = w > 0.01;
}

/* ------------------------------------------------ tags and leader lines */

const tagEls = [...document.querySelectorAll('.tag')];
const leaderSvg = $('.leaders');
const leaders = tagEls.map(() => {
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  leaderSvg && leaderSvg.appendChild(p);
  return p;
});
const tagGeo = tagEls.map(() => ({ x: 0, y: 0, w: 0, h: 0 }));
function measureTags() {
  tagEls.forEach((el, n) => Object.assign(tagGeo[n], { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }));
  document.querySelectorAll('[data-spot]').forEach((el) => (el._cardW = el.lastElementChild.offsetWidth));
}
const _p = V();
function updateTags(e) {
  const sr = stay.rect;
  tagEls.forEach((el, n) => {
    const right = el.classList.contains('tag--r') ? 1 : 0;
    const idx = +el.dataset.i;
    const start = 0.04 + (idx * 2 + right) * 0.04;
    const v = smooth((e - start) / 0.05) * (1 - smooth((e - 0.33) / 0.05));
    const dx = (1 - v) * (right ? 26 : -26);
    el.style.opacity = v.toFixed(3);
    el.style.transform = `translate3d(${dx.toFixed(1)}px,0,0)`;
    el.style.visibility = v > 0.005 ? 'visible' : 'hidden';
    const path = leaders[n];
    if (view.phone || v < 0.01) {
      path.style.opacity = 0;
      return;
    }
    const anchor = house.anchors[el.dataset.anchor] || house.anchors.door;
    house.group.localToWorld(_p.copy(anchor)).project(camera);
    const px = (_p.x * 0.5 + 0.5) * window.innerWidth - sr.left;
    const py = (-_p.y * 0.5 + 0.5) * window.innerHeight - sr.top;
    const g = tagGeo[n];
    const ax = g.x + (right ? 0 : g.w) + dx + (right ? -8 : 8);
    const ay = g.y + g.h / 2;
    const mx = (ax + px) / 2;
    path.setAttribute('d', `M${ax.toFixed(1)} ${ay.toFixed(1)} C${mx.toFixed(1)} ${ay.toFixed(1)} ${mx.toFixed(1)} ${py.toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)}`);
    path.style.opacity = v.toFixed(3);
  });
}

/* ------------------------------------------------------- the night garden */

function updateGarden(P, dt, time) {
  const all = reduce ? 1 : null;
  garden.setGate(all ?? smooth(seg(P, 0.04, 0.25)));
  garden.setLit(all ?? seg(P, 0.3, 0.6));
  garden.setSettle(all ?? smooth(seg(P, 0.64, 0.78)));
  const tip = smooth(seg(P, 0.8, 0.97));
  garden.group.rotation.set(M.lerp(0.42, 0.62, tip), M.lerp(-0.5, 0.35, tip), 0);
  garden.group.position.y = M.lerp(0, -0.15, tip);
  garden.group.updateMatrixWorld(true);
  if (inside.onScreen) garden.update(dt, time, inside.s);
}

/* ------------------------------------------------------------ the estate */

const spotEls = [...document.querySelectorAll('[data-spot]')];
function updateEstate(dt, time, F) {
  const beta = M.lerp(1.15, -0.85, F);
  estate.group.rotation.y = beta;
  estate.update(dt, time);
  estate.group.updateMatrixWorld(true);
  const sr = where.rect;
  spotEls.forEach((el) => {
    const name = el.dataset.spot;
    const a = Math.atan2(Math.sin(estate.psi[name] + beta), Math.cos(estate.psi[name] + beta));
    const v = clamp01((0.42 - Math.abs(a)) / 0.14);
    el.classList.toggle('is-on', v > 0.5);
    estate.group.localToWorld(_p.copy(estate.hotspots[name])).project(camera);
    const x = (_p.x * 0.5 + 0.5) * window.innerWidth - sr.left;
    const y = (-_p.y * 0.5 + 0.5) * window.innerHeight - sr.top;
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    // card beside the dot (right, else left); when neither fits, clamp it inside the stage below the dot
    const cw = el._cardW || 240, pad = 16;
    let off = 22, beside = true;
    if (x + off + cw > sr.width - pad) off = -22 - cw;
    if (x + off < pad) {
      off = Math.min(pad - x, sr.width - pad - cw - x);
      beside = false;
    }
    const card = el.lastElementChild;
    card.style.left = `${off.toFixed(0)}px`;
    card.style.top = beside ? '-14px' : '24px';
    el.classList.toggle('is-flip', beside && off < 0);
  });
}

/* ----------------------------------------------- tap the house / bubble */

const bubble = document.getElementById('bubble');
const ON_PHRASES = ['Welcome home!', 'Come on in', 'Lights on!', 'All yours till 10'];
const OFF_PHRASES = ['Shh… so peaceful', 'Nap time', 'Lights off'];
let bubbleT = 0, phrase = 0;
function knock() {
  if (!hero.onScreen || intro.t < 1) return;
  heroLightsTarget = heroLightsTarget ? 0 : 1;
  heroDoorTarget = heroLightsTarget;
  const list = heroLightsTarget ? ON_PHRASES : OFF_PHRASES;
  if (bubble) {
    bubble.textContent = list[phrase++ % list.length];
    bubbleT = 1.9;
  }
  document.querySelectorAll('[data-ask]').forEach((b) => (b.textContent = heroLightsTarget ? 'Switch off the lights' : 'Switch on the lights'));
}
window.addEventListener('sereno:knock', knock);
document.querySelectorAll('[data-ask]').forEach((b) => b.addEventListener('click', knock));

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function hitsHouse(e) {
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObject(house.hit, false).length > 0;
}
heroEl.addEventListener('click', (e) => {
  if (e.target.closest('a, button, input')) return;
  if (hero.onScreen && hitsHouse(e)) knock();
});
heroEl.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  heroEl.classList.toggle('is-over-house', !e.target.closest('a, button') && hitsHouse(e));
});

/* ----------------------------------------------------------------- pointer */

const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
window.addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

/* ------------------------------------------------------------------- start */

let started = false;
function start() {
  if (started) return;
  started = true;
  if (reduce) return;
  intro.running = true;
  gsap.delayedCall(1.6, () => {
    if (window.scrollY < 40) {
      heroDoorTarget = 1;
      if (bubble) { bubble.textContent = 'Welcome!'; bubbleT = 1.8; }
      gsap.delayedCall(1.6, () => { if (!heroLightsTarget) heroDoorTarget = 0; });
    }
  });
}
window.addEventListener('sereno:start', start);
if (window.__serenoStarted) start();

/* -------------------------------------------------------------------- loop */

const _v = V(), _w = V();
let lightAct = null, canvasFront = false;
const state = { arrived: false };

function frame(time, deltaMs) {
  const dt = Math.min(deltaMs / 1000, 1 / 20);
  const ih = window.innerHeight;
  if (intro.running && intro.t < 1) intro.t = Math.min(1, intro.t + dt / 1.3);

  // camera nudged by the pointer
  pointer.sx = M.damp(pointer.sx, pointer.x, 3, dt);
  pointer.sy = M.damp(pointer.sy, pointer.y, 3, dt);
  camera.position.set(pointer.sx * 0.35, pointer.sy * 0.22, CAM_Z);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  acts.forEach((a) => a.place());

  // scroll progress for every leg
  const hr = hero.rect;
  const k = clamp01(-hr.top / hr.height);
  const e = progressOf(staySec);
  const sr = staySec.getBoundingClientRect(), nr = insideSec.getBoundingClientRect();
  const j = clamp01((ih - sr.bottom) / (nr.top - sr.bottom + ih));
  const P = progressOf(insideSec);
  state.arrived = j >= 1;

  // the garden goes first so the landing pad is current for the house
  updateGarden(P, dt, time);
  updateJourney(dt, time, k, e, j, P);
  if (stay.onScreen) updateTags(e);
  if (where.onScreen) updateEstate(dt, time, progressOf(whereSec));

  // on the trips between acts the transparent, click-through canvas steps in front of the copy
  const front = (j > 0 && j < 1) || (k > 0.02 && k < 0.98);
  if (front !== canvasFront) {
    canvasFront = front;
    root.classList.toggle('canvas-front', front);
  }

  // dusk: the sky in the page decides how dark the 3D light gets
  const n = S().nightF || 0;
  L.hemi.intensity = M.lerp(0.95, 0.35, n);
  L.hemi.color.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, n);
  L.hemi.groundColor.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, n);
  key.intensity = M.lerp(2.6, 0.55, n);
  key.color.copy(DAY.key).lerp(NIGHT.key, n);
  L.rim.color.copy(DAY.rim).lerp(NIGHT.rim, n);
  L.fill.intensity = M.lerp(0.5, 0.15, n);
  scene.environmentIntensity = M.lerp(0.6, 0.18, n);

  // key light and its shadow camera follow the act nearest the viewport centre
  const nearest = acts.reduce((a, b) => (b.dist < a.dist ? b : a));
  key.position.copy(nearest.group.position).addScaledVector(KEY_OFFSET, nearest.s);
  key.target.position.copy(nearest.group.position);
  const ext = nearest.shadow * nearest.s;
  if (lightAct !== nearest || key.shadow.camera.right !== ext) {
    const c = key.shadow.camera;
    c.left = -ext; c.right = ext; c.top = ext; c.bottom = -ext;
    c.updateProjectionMatrix();
    lightAct = nearest;
  }

  // speech bubble floats over the roof
  if (bubble) {
    bubbleT = Math.max(0, bubbleT - dt);
    const on = bubbleT > 0 && hero.onScreen && k < 0.3;
    bubble.classList.toggle('is-on', on);
    if (on) {
      house.group.localToWorld(_v.copy(house.anchors.chimney));
      _w.copy(_v).project(camera);
      const x = (_w.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-_w.y * 0.5 + 0.5) * ih - 18;
      bubble.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-30%, -100%)`;
    }
  }

  renderer.render(scene, camera);
}

/* ------------------------------------------ rate-card photos from the house */

/** Renders the real farmhouse by day and by evening in an offscreen renderer, as WebP data URLs. */
function renderShots() {
  const W = 720, H = 540;
  const off = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  off.setPixelRatio(1);
  off.setSize(W, H, false);
  setupRenderer(off);
  const s = new THREE.Scene();
  s.environment = new THREE.PMREMGenerator(off).fromScene(new RoomEnvironment(), 0.04).texture;
  const l = addLights(s);
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.18 }));
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = -0.36;
  catcher.receiveShadow = true;
  s.add(catcher);
  const h = new House({ tile: true, seed: 3 });
  s.add(h.group);
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 60);
  const shots = {};
  const shoot = (name, yaw, night) => {
    h.group.rotation.y = yaw;
    h.setLights(night ? 1 : 0);
    h.setDoor(night ? 0.8 : 0);
    h.update(0, 1.2);
    h.group.updateMatrixWorld(true);
    s.environmentIntensity = night ? 0.2 : 0.6;
    l.hemi.intensity = night ? 0.4 : 0.95;
    l.hemi.color.set(night ? '#6b6fa8' : '#f3f6ea');
    l.key.intensity = night ? 0.8 : 2.6;
    l.key.color.set(night ? '#ff9f6b' : '#ffe7c2');
    l.key.position.set(night ? -4 : 3, night ? 3 : 7, 5);
    l.key.target.position.set(0, 0, 0);
    Object.assign(l.key.shadow.camera, { left: -2.4, right: 2.4, top: 2.4, bottom: -2.4 });
    l.key.shadow.camera.updateProjectionMatrix();
    cam.position.set(0, 2.1, 4.6);
    cam.lookAt(0, 0.3, 0);
    off.render(s, cam);
    shots[name] = off.domElement.toDataURL('image/webp', 0.86);
  };
  shoot('weekday', -0.45, false);
  shoot('weekend', 0.4, true);
  off.dispose();
  off.forceContextLoss();
  return shots;
}

/* -------------------------------------------------------------------- boot */

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  view.h = 2 * CAM_Z * Math.tan(M.degToRad(camera.fov / 2));
  view.w = view.h * camera.aspect;
  view.phone = w < 760;
  acts.forEach((a) => a.layout());
  gutterLeft = pricingGrid ? Math.max(0, pricingGrid.getBoundingClientRect().left) : w * 0.06;
  measureTags();
}
resize();
window.addEventListener('resize', resize);
if (document.fonts) document.fonts.ready.then(resize);

acts.forEach((a) => a.place());
updateGarden(0, 0, 0);
heroPose(A, 0);
house.setLights(0);
renderer.compile(scene, camera);
renderer.render(scene, camera);

try {
  window.serenoShots = renderShots();
  window.dispatchEvent(new CustomEvent('sereno:shots', { detail: window.serenoShots }));
} catch (err) {
  console.warn('[sereno] rate-card pictures could not be rendered', err);
}

gsap.ticker.add(frame);
requestAnimationFrame(() => signalReady(true));

// handy for tuning in the console
window.serenoWorld = { scene, camera, renderer, acts, house, garden, estate, view, knock, state };
