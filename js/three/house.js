// Sereno · the farmhouse. Local axes: y up, the verandah and front door face +z.
// Built entirely in code. Windows, bulbs and the porch lamp share per-house materials so lights can fade on.
import * as THREE from 'three';
import { V, TAU, std, lowpoly, add, rod, rbox, rng, bake, shadows, sagPoints, glowTexture, makeTree, makePalm } from './util.js';

export const TILE_R = 1.3;

const W = 1.36, D = 0.84, H = 0.62, RH = 0.38; // walls and roof rise
const ZC = -0.14; // house centre, pushed back so the verandah fits on the lawn
const ZF = ZC + D / 2; // front wall
const PLINTH = 0.09;

export class House {
  /**
   * @param {object} o
   * @param {boolean} o.tile   stand the house on its own round lawn (the travelling one does)
   * @param {number}  o.seed
   */
  constructor({ tile = true, seed = 3 } = {}) {
    const R = rng(seed);
    this.group = new THREE.Group();
    const G = this.group;

    // per-house glow materials
    this.glass = new THREE.MeshStandardMaterial({ color: '#2e3d45', roughness: 0.22, metalness: 0.2, emissive: new THREE.Color('#ffae55'), emissiveIntensity: 0 });
    this.bulb = new THREE.MeshStandardMaterial({ color: '#f4e6c8', roughness: 0.4, emissive: new THREE.Color('#ffc46b'), emissiveIntensity: 0 });

    const wall = std('#f4ead8', { roughness: 0.9 });
    const stone = lowpoly('#b8a589');
    const roof = std('#c5623a', { roughness: 0.72 });
    const roofDark = std('#a44d2c', { roughness: 0.7 });
    const trim = std('#fffaf0');
    const wood = std('#a9744a', { roughness: 0.85 });
    const shutter = std('#3f6b5c', { roughness: 0.7 });
    const brick = lowpoly('#a5583b');

    /* ------------------------------------------------------------ body */
    add(G, new THREE.BoxGeometry(W, H, D), wall, 0, H / 2, ZC);
    add(G, new THREE.BoxGeometry(W + 0.05, PLINTH, D + 0.05), stone, 0, PLINTH / 2, ZC);

    const gable = new THREE.Shape();
    gable.moveTo(-D / 2, 0); gable.lineTo(D / 2, 0); gable.lineTo(0, RH); gable.closePath();
    const gGeo = new THREE.ExtrudeGeometry(gable, { depth: 0.02, bevelEnabled: false }).translate(0, 0, -0.01).rotateY(Math.PI / 2);
    [-1, 1].forEach((s) => add(G, gGeo, wall, s * (W / 2 - 0.011), H, ZC));

    // roof: two slabs meeting at a ridge along x, with tile rows
    const ang = Math.atan2(RH, D / 2);
    const slope = Math.hypot(D / 2, RH) + 0.16;
    [-1, 1].forEach((s) => {
      const slab = add(G, new THREE.BoxGeometry(W + 0.22, 0.05, slope), roof, 0, H + RH / 2 + 0.03, ZC + (s * D) / 4);
      slab.rotation.x = s * ang;
      for (let k = 0; k < 6; k++) {
        const row = add(slab, new THREE.BoxGeometry(W + 0.22, 0.016, 0.02), roofDark, 0, 0.032, -slope / 2 + 0.06 + k * ((slope - 0.1) / 5));
        void row;
      }
    });
    const ridge = add(G, new THREE.CylinderGeometry(0.042, 0.042, W + 0.26, 10).rotateZ(Math.PI / 2), roofDark, 0, H + RH + 0.035, ZC);
    void ridge;

    // chimney
    add(G, new THREE.BoxGeometry(0.13, 0.4, 0.13), brick, 0.4, H + RH - 0.02, ZC - 0.12);
    add(G, new THREE.BoxGeometry(0.17, 0.035, 0.17), lowpoly('#6e3a26'), 0.4, H + RH + 0.19, ZC - 0.12);
    this.chimneyTop = V(0.4, H + RH + 0.22, ZC - 0.12);

    /* ------------------------------------------------------- the door */
    add(G, new THREE.BoxGeometry(0.26, 0.42, 0.016), trim, 0, PLINTH + 0.2, ZF + 0.004);
    add(G, new THREE.PlaneGeometry(0.2, 0.355), this.glass, 0, PLINTH + 0.178, ZF + 0.0135);
    const door = new THREE.Group();
    door.position.set(-0.1, PLINTH, ZF + 0.02);
    add(door, new THREE.BoxGeometry(0.2, 0.355, 0.016), std('#2f5d57', { roughness: 0.6 }), 0.1, 0.178, 0);
    [0.09, 0.26].forEach((y) => add(door, new THREE.BoxGeometry(0.15, 0.1, 0.006), std('#28504a'), 0.1, y, 0.01));
    add(door, new THREE.SphereGeometry(0.014, 10, 8), std('#e0a83c', { metalness: 0.7, roughness: 0.3 }), 0.17, 0.17, 0.016);
    G.add(door);
    this.door = door;

    /* ------------------------------------------------------- windows */
    const frontWin = (x, z, rotY = 0) => {
      const w = new THREE.Group();
      w.position.set(x, 0.36, z);
      w.rotation.y = rotY;
      add(w, new THREE.BoxGeometry(0.2, 0.22, 0.012), this.glass, 0, 0, 0.004);
      add(w, new THREE.BoxGeometry(0.24, 0.026, 0.03), trim, 0, 0.122, 0.012);
      add(w, new THREE.BoxGeometry(0.26, 0.03, 0.05), trim, 0, -0.122, 0.02);
      [-0.11, 0.11].forEach((dx) => add(w, new THREE.BoxGeometry(0.024, 0.24, 0.026), trim, dx, 0, 0.012));
      add(w, new THREE.BoxGeometry(0.012, 0.22, 0.02), trim, 0, 0, 0.012);
      add(w, new THREE.BoxGeometry(0.2, 0.012, 0.02), trim, 0, 0, 0.012);
      [-1, 1].forEach((s) => {
        add(w, new THREE.BoxGeometry(0.09, 0.24, 0.014), shutter, s * 0.165, 0, 0.01);
        for (let k = 0; k < 4; k++) add(w, new THREE.BoxGeometry(0.075, 0.008, 0.008), std('#33584b'), s * 0.165, -0.08 + k * 0.055, 0.02);
      });
      G.add(w);
    };
    [-0.42, 0.42].forEach((x) => frontWin(x, ZF));
    [-0.32, 0.32].forEach((x) => frontWin(x, ZC - D / 2, Math.PI));
    [-1, 1].forEach((s) => frontWin(s * (W / 2), ZC, (s * Math.PI) / 2));
    // round attic windows in the gables
    [-1, 1].forEach((s) => {
      const o = add(G, new THREE.CylinderGeometry(0.055, 0.055, 0.012, 20).rotateZ(Math.PI / 2), this.glass, s * (W / 2 + 0.004), H + 0.13, ZC);
      void o;
      add(G, new THREE.TorusGeometry(0.058, 0.012, 6, 24).rotateY(Math.PI / 2), trim, s * (W / 2 + 0.01), H + 0.13, ZC);
    });

    /* ------------------------------------------------------ verandah */
    const VD = 0.42; // depth
    add(G, new THREE.BoxGeometry(W + 0.12, 0.06, VD), wood, 0, PLINTH - 0.03, ZF + VD / 2);
    for (let k = 0; k < 6; k++) add(G, new THREE.BoxGeometry(W + 0.12, 0.004, 0.004), std('#8c5d39'), 0, PLINTH + 0.001, ZF + 0.04 + k * 0.07);
    add(G, new THREE.BoxGeometry(0.36, 0.045, 0.11), wood, 0, 0.022, ZF + VD + 0.05);
    const PZ = ZF + VD - 0.04, PH = 0.56;
    const posts = [-0.66, -0.24, 0.24, 0.66];
    posts.forEach((x) => add(G, new THREE.CylinderGeometry(0.022, 0.026, PH - PLINTH, 8), trim, x, (PLINTH + PH) / 2, PZ));
    [[-0.66, -0.24], [0.24, 0.66]].forEach(([a, b]) => {
      [0.2, 0.28].forEach((y) => rod(G, V(a, y, PZ), V(b, y, PZ), 0.009, trim, 5));
      for (let x = a + 0.06; x < b - 0.03; x += 0.06) rod(G, V(x, PLINTH, PZ), V(x, 0.28, PZ), 0.006, trim, 4);
    });
    const vr = add(G, new THREE.BoxGeometry(W + 0.2, 0.03, VD + 0.08), roof, 0, (H - 0.04 + PH) / 2 + 0.012, ZF + VD / 2);
    vr.rotation.x = Math.atan2(H - 0.04 - PH, VD);
    add(G, new THREE.BoxGeometry(W + 0.12, 0.04, 0.03), wood, 0, PH - 0.005, PZ);

    // pots on the verandah
    [-0.5, 0.5].forEach((x) => {
      add(G, new THREE.CylinderGeometry(0.04, 0.03, 0.07, 10), lowpoly('#c1663f'), x, PLINTH + 0.035, ZF + 0.08);
      add(G, new THREE.IcosahedronGeometry(0.055, 0), lowpoly('#5b9e48'), x, PLINTH + 0.1, ZF + 0.08);
    });

    // string lights along the verandah beam
    const sprites = [];
    this.sprites = sprites;
    const addGlow = (p, size) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffc46b', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.position.copy(p);
      s.scale.setScalar(size);
      s.userData.base = size;
      G.add(s);
      sprites.push(s);
    };
    const wire = std('#2a2420');
    for (let i = 0; i < posts.length - 1; i++) {
      const a = V(posts[i], PH - 0.04, PZ + 0.02), b = V(posts[i + 1], PH - 0.04, PZ + 0.02);
      const pts = sagPoints(a, b, 0.05, 10);
      add(G, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.004, 4), wire);
      [0.2, 0.5, 0.8].forEach((t) => {
        const p = pts[Math.round(t * 10)].clone().add(V(0, -0.022, 0));
        add(G, new THREE.SphereGeometry(0.017, 8, 6), this.bulb, p.x, p.y, p.z);
        addGlow(p, 0.13);
      });
    }
    // porch lamp beside the door
    add(G, new THREE.BoxGeometry(0.05, 0.07, 0.05), this.bulb, 0.2, PLINTH + 0.33, ZF + 0.035);
    add(G, new THREE.BoxGeometry(0.065, 0.015, 0.065), std('#2a2420'), 0.2, PLINTH + 0.372, ZF + 0.035);
    addGlow(V(0.2, PLINTH + 0.33, ZF + 0.06), 0.3);

    /* ---------------------------------------------------------- lawn */
    if (tile) {
      add(G, new THREE.CylinderGeometry(TILE_R - 0.02, TILE_R - 0.22, 0.3, 28), lowpoly('#7a5233'), 0, -0.2, 0);
      add(G, new THREE.CylinderGeometry(TILE_R + 0.02, TILE_R - 0.02, 0.07, 48), std('#78b956', { roughness: 0.95 }), 0, -0.035, 0);

      // stepping stones to the verandah
      for (let i = 0; i < 4; i++) {
        const s = add(G, new THREE.CylinderGeometry(0.08, 0.09, 0.025, 9), lowpoly('#e3d7c3'), (R() - 0.5) * 0.06, 0.005, ZF + VD + 0.22 + i * 0.17);
        s.scale.set(1.2, 1, 0.85);
      }
      // lamp post by the path
      const lp = V(0.36, 0, 0.98);
      rod(G, lp, lp.clone().setY(0.46), 0.012, std('#2a2420'));
      add(G, new THREE.BoxGeometry(0.07, 0.09, 0.07), this.bulb, lp.x, 0.5, lp.z);
      add(G, new THREE.ConeGeometry(0.065, 0.05, 4).rotateY(Math.PI / 4), std('#2a2420'), lp.x, 0.57, lp.z);
      addGlow(V(lp.x, 0.5, lp.z), 0.34);
      this.lampPos = V(lp.x, 0.5, lp.z);

      // a bench on the lawn
      const bench = new THREE.Group();
      bench.position.set(-0.78, 0, 0.72);
      bench.rotation.y = 0.55;
      add(bench, rbox(0.36, 0.03, 0.11, 0.01), wood, 0, 0.14, 0);
      add(bench, rbox(0.36, 0.1, 0.02, 0.008), wood, 0, 0.21, -0.05);
      [-0.15, 0.15].forEach((x) => add(bench, new THREE.BoxGeometry(0.025, 0.14, 0.09), std('#5a3a24'), x, 0.07, 0));
      G.add(bench);

      const shade = makeTree(R);
      shade.position.set(-0.94, 0, -0.5);
      shade.scale.setScalar(0.95);
      G.add(shade);
      const palm = makePalm(R);
      palm.position.set(0.98, 0, -0.42);
      palm.scale.setScalar(0.8);
      G.add(palm);

      // hedges and flowers
      const hedge = lowpoly('#4e9640');
      [[-0.86, 0.3], [0.86, 0.3], [-0.52, 1.05], [0.98, 0.5]].forEach(([x, z]) => add(G, new THREE.IcosahedronGeometry(0.09 + R() * 0.05, 0), hedge, x, 0.06, z));
      const petals = ['#ff8a65', '#ffd166', '#fffaf0', '#f7a8c6'].map((c) => lowpoly(c));
      for (let i = 0; i < 26; i++) {
        const a = R() * TAU, r = 0.55 + R() * 0.68;
        const x = Math.sin(a) * r, z = Math.cos(a) * r;
        if (Math.abs(x) < 0.82 && z > -0.62 && z < ZF + VD + 0.15) continue; // not under the house
        if (Math.abs(x) < 0.2 && z > ZF) continue; // not on the path
        add(G, new THREE.IcosahedronGeometry(0.022, 0), petals[i % 4], x, 0.04, z);
      }
    }

    // smoke from the chimney
    const smokeMat = () => new THREE.MeshStandardMaterial({ color: '#f2efe9', roughness: 1, transparent: true, opacity: 0, depthWrite: false });
    this.smoke = Array.from({ length: 6 }, (_, i) => {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 1), smokeMat());
      m.userData.ph = i / 6;
      G.add(m);
      return m;
    });

    // an invisible box for clicks
    this.hit = add(G, new THREE.BoxGeometry(2.0, 1.3, 1.9), new THREE.MeshBasicMaterial({ visible: false }), 0, 0.55, 0.05);

    // warm light that spills out of the porch
    this.light = new THREE.PointLight('#ffb35c', 0, 0, 2);
    this.light.position.set(0, 0.42, ZF + 0.3);
    G.add(this.light);

    // points the page can point at (labels, hotspots)
    this.anchors = {
      door: V(0, PLINTH + 0.22, ZF + 0.03),
      verandah: V(-0.45, 0.22, PZ),
      lawn: V(-0.78, 0.18, 0.72),
      window: V(0.42, 0.36, ZF + 0.02),
      roof: V(-0.25, H + RH * 0.6, ZC + 0.12),
      lights: V(0.45, PH - 0.09, PZ + 0.02),
      chimney: this.chimneyTop.clone(),
    };

    shadows(G);
    this.hit.castShadow = this.hit.receiveShadow = false;
    bake(G, [this.door, this.hit, ...this.smoke, ...sprites]);

    this.lights = 0;
    this._s = V();
  }

  /** 0 = daylight, 1 = every window and bulb glowing. */
  setLights(v) {
    this.lights = v;
    this.glass.emissiveIntensity = v * 2.1;
    this.bulb.emissiveIntensity = 0.15 + v * 3.2;
  }

  /** 0 = shut, 1 = swung wide open. */
  setDoor(v) {
    this.door.rotation.y = -v * 1.55;
  }

  update(dt, time) {
    const v = this.lights;
    this.group.getWorldScale(this._s);
    const s = this._s.x;
    const flicker = 0.92 + 0.08 * Math.sin(time * 13.1) * Math.sin(time * 7.3);
    this.light.intensity = v * 2.6 * s * s * flicker;
    this.sprites.forEach((sp, i) => {
      sp.material.opacity = v * (0.75 + 0.25 * Math.sin(time * 3 + i * 1.7));
    });
    this.smoke.forEach((m) => {
      const t = (time * 0.22 + m.userData.ph) % 1;
      m.position.set(this.chimneyTop.x + Math.sin(t * 5 + m.userData.ph * 9) * 0.05 + t * 0.12, this.chimneyTop.y + t * 0.75, this.chimneyTop.z - t * 0.05);
      m.scale.setScalar(0.5 + t * 1.6);
      m.material.opacity = Math.sin(Math.PI * t) * 0.55;
    });
  }
}
