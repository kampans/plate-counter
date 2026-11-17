/**
 * ipf-plates.js
 * ---------------------------------------------------------------------------
 * Procedural, Eleiko-style IPF "calibrated" powerlifting plates and a
 * competition barbell for Three.js. No downloaded assets: everything is built
 * from LatheGeometry profiles and canvas textures.
 *
 * What the plates have (modelled on the look of thin IPF calibrated plates):
 *   - thin cast-iron profile, thickness derived from weight and diameter
 *   - raised outer lip with a rounded edge and an angled groove round the rim
 *   - recessed face with a raised hub ring and a bright steel bore
 *   - raised weight lettering on both faces (canvas texture + bump map)
 *   - colour coding: 25 red, 20 blue, 15 yellow, 10 green, 5 white,
 *     2.5 black, 1.25 chrome
 *
 * Requires three r152 or newer (uses texture.colorSpace, mergeGeometries).
 * Browser only (uses <canvas> for textures).
 *
 * All dimensions below are in MILLIMETRES. The rig group is scaled by
 * `unitScale` (default 0.001 = scene units are metres).
 *
 * Bar axis = world X. The "right" sleeve is +X, the "left" sleeve is -X.
 *
 * Quick start:
 *   import { createPlateRig, applyStudioEnvironment } from './ipf-plates.js';
 *   applyStudioEnvironment(renderer, scene);          // makes metal look right
 *   const rig = createPlateRig({ onChange: render }); // onChange optional
 *   scene.add(rig.group);
 *   rig.addPlate(25);   // slides a plate onto BOTH sleeves
 *   rig.removePlate();  // removes the most recent plate (last in, first out)
 *   rig.clear();
 *
 * Dimensions are estimates. Diameters of the 25 kg plate (450 mm), the bar
 * (2200 mm, 29 mm shaft, 50 mm sleeve) and the colour coding follow IPF / IWF
 * conventions; thicknesses are derived from weight so heavier plates are
 * thicker, and every number can be overridden in PLATE_SPECS / PLATE_CONFIG.
 * ---------------------------------------------------------------------------
 */

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// mergeGeometries was called mergeBufferGeometries before r151.
const mergeGeometries =
  BufferGeometryUtils.mergeGeometries ?? BufferGeometryUtils.mergeBufferGeometries;

const { clamp } = THREE.MathUtils;

/* ========================================================================== */
/* CONFIG - edit these, not the builders                                       */
/* ========================================================================== */

export const PLATE_CONFIG = {
  /** Scene units per millimetre. 0.001 = metres, 0.01 = centimetres. */
  unitScale: 0.001,

  /**
   * 'stylized': 25 and 20 kg are 450 mm, 15 kg is 400 mm, 10 kg is 350 mm
   *             (the progressive taper wanted for this site).
   * 'ipf':      25 / 20 / 15 / 10 kg are all 450 mm, like real competition plates.
   */
  diameterMode: 'stylized',

  /** Show plates on both sleeves. false = right (+X) sleeve only. */
  mirror: true,

  /** Sleeve hole radius (50 mm sleeve + a little clearance). */
  boreRadius: 25.5,

  /** Effective density used to derive thickness from weight (kg/m^3). */
  density: 6800,

  /** Tiny gap between stacked plates (mm). Stops faces z-fighting. */
  plateGap: 0.4,

  /** Face lettering canvas size in px. 512 is plenty; 1024 for hero shots. */
  textureSize: 512,
  anisotropy: 8,
  bumpScale: 1.2,

  /** Bar (IPF style). */
  barLength: 2200,
  sleeveLength: 415, // loadable sleeve length from the end of the bar
  shaftRadius: 14.5, // 29 mm shaft
  sleeveRadius: 25, // 50 mm sleeve
  barBaseWeight: 20,

  /** Collar. */
  collarWidth: 28,

  /** Animation. */
  addMs: 460,
  removeMs: 300,
  slideDistance: 650, // mm the plate travels in from / out to
  overshoot: 1.1, // easeOutBack overshoot, 0 = none

  castShadow: true,
  receiveShadow: true,

  /** Called every animation frame while something is moving (e.g. your render()). */
  onChange: null,
};

/**
 * Per-weight look. `diameter` is in mm, per diameterMode.
 * `thickness` (mm) is optional; leave it out to derive it from weight.
 * Colours are hex numbers; textColor is the raised lettering colour.
 */
export const PLATE_SPECS = {
  25: { color: 0xc8102e, textColor: '#ffffff', finish: 'paint', diameter: { ipf: 450, stylized: 450 } },
  20: { color: 0x1c4fa6, textColor: '#ffffff', finish: 'paint', diameter: { ipf: 450, stylized: 450 } },
  15: { color: 0xf2c200, textColor: '#1b1b1b', finish: 'paint', diameter: { ipf: 450, stylized: 400 } },
  10: { color: 0x1f8a4c, textColor: '#ffffff', finish: 'paint', diameter: { ipf: 450, stylized: 350 } },
  5: { color: 0xf3f3ee, textColor: '#1b1b1b', finish: 'paint', diameter: { ipf: 260, stylized: 260 } },
  2.5: { color: 0x1b1b1d, textColor: '#ffffff', finish: 'paint', diameter: { ipf: 200, stylized: 200 } },
  1.25: { color: 0xd3d7da, textColor: '#222222', finish: 'chrome', diameter: { ipf: 160, stylized: 160 } },
};

export const PLATE_WEIGHTS = [25, 20, 15, 10, 5, 2.5, 1.25];

/* ========================================================================== */
/* Small geometry helpers                                                      */
/* ========================================================================== */

/** Mirror a [radius, axis] path across the mid plane. */
const mirrorPath = (path) => path.map(([r, a]) => [r, -a]);

/** LatheGeometry from [radius, axis] pairs. Axis = local Y. */
const lathe = (path, segments) =>
  new THREE.LatheGeometry(path.map(([r, y]) => new THREE.Vector2(r, y)), segments);

/** Merge, then free the source geometries. */
function merge(geos) {
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  return merged;
}

/** Local Y axis -> world X axis (so +Y maps to +X). */
const alongX = (geo) => geo.rotateZ(-Math.PI / 2);

function specFor(weight) {
  const spec = PLATE_SPECS[String(weight)];
  if (!spec) throw new Error(`ipf-plates: no spec for a ${weight} kg plate`);
  return spec;
}

/** Radius and thickness (mm) for a plate. */
export function getPlateDimensions(weight, cfg = PLATE_CONFIG) {
  const spec = specFor(weight);
  const R = spec.diameter[cfg.diameterMode] / 2;
  const areaM2 = (Math.PI * (R * R - cfg.boreRadius ** 2)) / 1e6;
  const t = spec.thickness ?? clamp((weight / (cfg.density * areaM2)) * 1000, 9, 40);
  return { R, t, spec };
}

/* ========================================================================== */
/* Plate                                                                       */
/* ========================================================================== */

/**
 * Builds the plate body from side-profile paths revolved round the bar axis.
 * Each path is its own lathe so creases stay crisp; only the rounded edge arc
 * is smooth. Parts are merged into two geometries: painted body and steel.
 */
function buildPlateGeometry(weight, cfg) {
  const { R, t, spec } = getPlateDimensions(weight, cfg);
  const h = t / 2;
  const rHole = cfg.boreRadius;
  const rHub = rHole + clamp(R * 0.09, 8, 18); // raised hub ring outer radius
  const d = clamp(t * 0.14, 1.2, 3); // face recess depth
  const hubRise = 0.5; // hub sits just below the lip plane
  const slope = 1.2; // radial run of the little ramps
  const lipW = clamp(R * 0.06, 7, 14);
  const rLipIn = R - lipW; // inner radius of the raised lip
  const er = Math.min(t * 0.3, 5); // rounded outer edge radius
  const segs = R > 150 ? 72 : 56;

  const paint = [];
  const steel = [];
  const both = (list, p) => list.push(p, mirrorPath(p));

  // Steel: hub top rings and the bore.
  both(steel, [[rHole, h - hubRise], [rHub, h - hubRise]]);
  steel.push([[rHole, -(h - hubRise)], [rHole, h - hubRise]]);

  // Painted body, front half (mirrored to the back).
  both(paint, [[rHub, h - hubRise], [rHub + slope, h - d]]); // hub wall
  both(paint, [[rHub + slope, h - d], [rLipIn, h - d]]); // recessed face
  both(paint, [[rLipIn, h - d], [rLipIn + slope, h]]); // lip inner ramp
  both(paint, [[rLipIn + slope, h], [R - er, h]]); // lip top
  const arc = [];
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    arc.push([R - er + er * Math.sin(a), h - er + er * Math.cos(a)]);
  }
  both(paint, arc); // rounded edge

  // Rim: angled groove round the circumference on plates thick enough for it.
  if (t >= 14) {
    const gy = (h - er) * 0.5;
    const gd = 2;
    both(paint, [[R, h - er], [R, gy]]);
    both(paint, [[R, gy], [R - gd, 0]]);
  } else {
    paint.push([[R, -(h - er)], [R, h - er]]);
  }

  const paintGeo = alongX(merge(paint.map((p) => lathe(p, segs))));
  const steelGeo = alongX(merge(steel.map((p) => lathe(p, segs))));

  // Area of the recessed face that carries the lettering.
  const face = {
    inner: rHub + slope + 0.4,
    outer: rLipIn - 0.4,
    x: h - d + 0.35, // lettering plane, just above the recessed face
  };

  return { paintGeo, steelGeo, face, R, t, spec };
}

/** Canvas lettering: colour map + black/white bump map. */
function makeFaceTextures(weight, face, spec, cfg) {
  const size = cfg.textureSize;
  const ppm = size / (2 * face.outer); // pixels per mm
  const w = face.outer - face.inner;
  const m = (face.outer + face.inner) / 2; // mid radius of the annulus
  const big = w >= 90;
  const fs = big ? clamp(w * 0.42, 12, 80) : w * 0.6; // number height in mm
  const label = String(weight);
  const font = (px, wt) => `${wt} ${px}px "Arial Black", Impact, Arial, sans-serif`;

  const draw = (ctx, color) => {
    const cx = size / 2;
    const cy = size / 2;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font(fs * ppm, 900);
    ctx.fillText(label, cx, cy - m * ppm); // number at 12 o'clock
    if (big) {
      ctx.font = font(fs * 0.4 * ppm, 800);
      ctx.fillText('KG', cx, cy - (m - fs * 0.75) * ppm);
      ctx.font = font(fs * 0.2 * ppm, 700);
      ctx.fillText('CALIBRATED', cx, cy + m * ppm); // 6 o'clock
    } else {
      ctx.font = font(fs * 0.5 * ppm, 800);
      ctx.fillText('KG', cx, cy + m * ppm);
    }
  };

  const make = (bg, fg) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, size, size);
    }
    draw(ctx, fg);
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = cfg.anisotropy;
    return tex;
  };

  const map = make(null, spec.textColor);
  map.colorSpace = THREE.SRGBColorSpace;
  const bump = make('#000000', '#ffffff');
  return { map, bump };
}

/** Builds one plate prototype (Group with +X as the outward face). */
function buildPlatePrototype(weight, cfg) {
  const { paintGeo, steelGeo, face, R, t, spec } = buildPlateGeometry(weight, cfg);
  const chrome = spec.finish === 'chrome';

  const bodyMat = new THREE.MeshStandardMaterial({
    color: spec.color,
    roughness: chrome ? 0.22 : 0.42,
    metalness: chrome ? 0.95 : 0.12,
    side: THREE.DoubleSide,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xb9bdc2,
    roughness: 0.3,
    metalness: 0.9,
    side: THREE.DoubleSide,
  });

  const { map, bump } = makeFaceTextures(weight, face, spec, cfg);
  const textMat = new THREE.MeshStandardMaterial({
    map,
    bumpMap: bump,
    bumpScale: cfg.bumpScale,
    transparent: true,
    roughness: 0.55,
    metalness: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  // RingGeometry UVs span the OUTER radius, which is what the canvas assumes.
  const faceGeo = new THREE.RingGeometry(face.inner, face.outer, 96, 1);

  const group = new THREE.Group();
  group.name = `plate-${weight}kg`;
  group.add(new THREE.Mesh(paintGeo, bodyMat), new THREE.Mesh(steelGeo, steelMat));
  for (const side of [1, -1]) {
    const ring = new THREE.Mesh(faceGeo, textMat);
    ring.rotation.y = side * (Math.PI / 2); // +Z normal -> +/-X
    ring.position.x = side * face.x;
    ring.renderOrder = 1;
    group.add(ring);
  }
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = cfg.castShadow;
      o.receiveShadow = cfg.receiveShadow;
    }
  });
  group.userData = { weight, thickness: t, radius: R };

  return {
    group,
    dispose() {
      [paintGeo, steelGeo, faceGeo].forEach((g) => g.dispose());
      [bodyMat, steelMat, textMat].forEach((m) => m.dispose());
      map.dispose();
      bump.dispose();
    },
  };
}

/** A single static plate, for previews. Remember to call .dispose(). */
export function createPlate(weight, options = {}) {
  const cfg = { ...PLATE_CONFIG, ...options };
  const proto = buildPlatePrototype(weight, cfg);
  proto.group.scale.setScalar(cfg.unitScale);
  return proto;
}

/* ========================================================================== */
/* Bar and collar                                                              */
/* ========================================================================== */

function knurlTexture(repeatU, repeatV) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5;
  for (let i = -64; i <= 128; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 64, 64);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i + 64, 0);
    ctx.lineTo(i, 64);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatU, repeatV);
  tex.anisotropy = 4;
  return tex;
}

/** Bar with both sleeves. Returns { group, loadStartX, dispose }. */
function buildBar(cfg) {
  const half = cfg.barLength / 2;
  const sx = half - cfg.sleeveLength; // sleeve shoulder (mm from centre)
  const flangeW = 10;
  const loadStartX = sx + flangeW; // first plate sits here
  const rShaft = cfg.shaftRadius;
  const rSleeve = cfg.sleeveRadius;
  const disposables = [];
  const track = (o) => (disposables.push(o), o);

  const steel = track(new THREE.MeshStandardMaterial({ color: 0xc4c8cc, roughness: 0.38, metalness: 0.9 }));
  const chrome = track(new THREE.MeshStandardMaterial({ color: 0xdfe2e5, roughness: 0.18, metalness: 1, side: THREE.DoubleSide }));
  const knurlMap = track(knurlTexture(Math.round((2 * Math.PI * rShaft) / 1.4), 800));
  const knurled = track(new THREE.MeshStandardMaterial({ color: 0xaeb2b7, roughness: 0.5, metalness: 0.85, bumpMap: knurlMap, bumpScale: 1.5 }));

  const group = new THREE.Group();
  group.name = 'ipf-bar';
  const add = (geo, mat) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cfg.castShadow;
    m.receiveShadow = cfg.receiveShadow;
    group.add(m);
    track(geo);
  };

  // Shaft: knurled centre, smooth outer sections.
  const knurlHalf = 560;
  add(alongX(new THREE.CylinderGeometry(rShaft, rShaft, knurlHalf * 2, 48, 1, true)), knurled);
  const outerLen = sx - knurlHalf;
  for (const s of [1, -1]) {
    const g = new THREE.CylinderGeometry(rShaft, rShaft, outerLen, 48, 1, true);
    g.translate(0, s * (knurlHalf + outerLen / 2), 0);
    add(alongX(g), steel);
  }

  // Grip marks (rings) 810 mm apart, as on IPF bars.
  for (const s of [1, -1]) {
    const ring = new THREE.TorusGeometry(rShaft + 0.15, 0.9, 8, 40);
    ring.rotateY(Math.PI / 2); // axis Z -> X
    ring.translate(s * 405, 0, 0);
    add(ring, steel);
  }

  // Sleeves: flange + loadable sleeve with a chamfered end cap.
  const sleevePaths = [
    [[rSleeve, loadStartX], [rSleeve, half - 3], [rSleeve - 2.5, half], [0, half]],
    [[rShaft, sx], [rSleeve + 4.5, sx]],
    [[rSleeve + 4.5, sx], [rSleeve + 4.5, loadStartX]],
    [[rSleeve + 4.5, loadStartX], [rSleeve, loadStartX]],
  ];
  const sleeveGeos = [];
  for (const p of sleevePaths) {
    sleeveGeos.push(lathe(p, 64), lathe(mirrorPath(p), 64));
  }
  add(alongX(merge(sleeveGeos)), chrome);

  return {
    group,
    loadStartX,
    dispose: () => disposables.forEach((d) => d.dispose?.()),
  };
}

/** Spring-clip style competition collar, centred on x = 0 with its axis on X. */
function buildCollar(cfg) {
  const w = cfg.collarWidth / 2;
  const rIn = cfg.sleeveRadius + 0.6;
  const rOut = 34;
  const body = [
    [[rOut - 2, -w], [rOut, -w + 2], [rOut, w - 2], [rOut - 2, w]],
    [[rIn, -w], [rOut - 2, -w]],
    [[rOut - 2, w], [rIn, w]],
    [[rIn, -w], [rIn, w]],
  ].map((p) => lathe(p, 48));
  const bodyGeo = alongX(merge(body));

  // Lever on top. Pre-rotation, -X maps to +Y world after alongX().
  const lever = new THREE.BoxGeometry(10, cfg.collarWidth - 6, 16);
  lever.translate(-(rOut + 3), 0, 0);
  alongX(lever);

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd9dce0, roughness: 0.25, metalness: 0.95, side: THREE.DoubleSide });
  const leverMat = new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.4, metalness: 0.2 });

  const group = new THREE.Group();
  const a = new THREE.Mesh(bodyGeo, bodyMat);
  const b = new THREE.Mesh(lever, leverMat);
  [a, b].forEach((m) => {
    m.castShadow = cfg.castShadow;
    m.receiveShadow = cfg.receiveShadow;
  });
  group.add(a, b);
  return {
    group,
    dispose() {
      bodyGeo.dispose();
      lever.dispose();
      bodyMat.dispose();
      leverMat.dispose();
    },
  };
}

/* ========================================================================== */
/* The rig: bar + stacked plates + animation                                   */
/* ========================================================================== */

const easeOutCubic = (k) => 1 - (1 - k) ** 3;
const easeInCubic = (k) => k ** 3;
const easeOutBack = (s) => (k) => {
  const c3 = s + 1;
  return 1 + c3 * (k - 1) ** 3 + s * (k - 1) ** 2;
};

export function createPlateRig(options = {}) {
  const cfg = { ...PLATE_CONFIG, ...options };

  const group = new THREE.Group();
  group.name = 'ipf-barbell';
  group.scale.setScalar(cfg.unitScale); // everything inside is in mm

  const bar = buildBar(cfg);
  group.add(bar.group);

  const plateRoot = new THREE.Group();
  group.add(plateRoot);

  // Collars (right, and left if mirrored).
  const collarProto = buildCollar(cfg);
  const collarR = collarProto.group;
  const collarL = cfg.mirror ? collarProto.group.clone() : null;
  if (collarL) collarL.rotation.y = Math.PI;
  plateRoot.add(collarR);
  if (collarL) plateRoot.add(collarL);

  const protos = new Map(); // weight -> built prototype (shared by every plate)
  const stack = []; // entries, last = most recent
  const collar = { x: 0, tween: null };

  /* ---- tiny tween engine (no GSAP needed) ---- */
  const tweens = new Set();
  let raf = 0;

  function tick(now) {
    for (const tw of [...tweens]) {
      const k = clamp((now - tw.start) / tw.ms, 0, 1);
      tw.update(tw.from + (tw.to - tw.from) * tw.ease(k));
      if (k >= 1) {
        tweens.delete(tw);
        tw.done?.();
      }
    }
    cfg.onChange?.();
    raf = tweens.size ? requestAnimationFrame(tick) : 0;
  }

  function startTween({ from, to, ms, ease, update, done }) {
    if (ms <= 0) {
      update(to);
      done?.();
      return null;
    }
    const tw = { from, to, ms, ease, update, done, start: performance.now() };
    tweens.add(tw);
    if (!raf) raf = requestAnimationFrame(tick);
    return tw;
  }

  function cancelTween(tw) {
    if (tw) tweens.delete(tw);
  }

  /* ---- layout ---- */
  const platePos = (entry) => {
    entry.right.position.x = entry.x;
    if (entry.left) entry.left.position.x = -entry.x;
  };

  function stackEnd() {
    let x = bar.loadStartX;
    for (const e of stack) x += e.t + cfg.plateGap;
    return x;
  }

  function moveCollar(ms = cfg.addMs) {
    const to = stackEnd() + cfg.collarWidth / 2 + 1;
    cancelTween(collar.tween);
    collar.tween = startTween({
      from: collar.x || to,
      to,
      ms,
      ease: easeOutCubic,
      update: (v) => {
        collar.x = v;
        collarR.position.x = v;
        if (collarL) collarL.position.x = -v;
      },
    });
    if (to + cfg.collarWidth / 2 > cfg.barLength / 2 - 4) {
      console.warn('ipf-plates: the stack is longer than the loadable sleeve.');
    }
  }

  function getProto(weight) {
    const key = String(weight);
    if (!protos.has(key)) protos.set(key, buildPlatePrototype(weight, cfg));
    return protos.get(key);
  }

  /* ---- public API ---- */

  /** Slide a plate onto the bar. Resolves when the animation finishes. */
  function addPlate(weight, { animate = true } = {}) {
    const proto = getProto(weight);
    const t = proto.group.userData.thickness;
    const target = stackEnd() + t / 2;

    const right = proto.group.clone();
    const left = cfg.mirror ? proto.group.clone() : null;
    if (left) left.rotation.y = Math.PI;
    plateRoot.add(right);
    if (left) plateRoot.add(left);

    const entry = { weight, t, x: target, right, left, tween: null };
    stack.push(entry);
    moveCollar(animate ? cfg.addMs : 0);

    if (!animate) {
      platePos(entry);
      cfg.onChange?.();
      return Promise.resolve();
    }
    entry.x = target + cfg.slideDistance;
    platePos(entry);
    return new Promise((resolve) => {
      entry.tween = startTween({
        from: entry.x,
        to: target,
        ms: cfg.addMs,
        ease: easeOutBack(cfg.overshoot),
        update: (v) => {
          entry.x = v;
          platePos(entry);
        },
        done: resolve,
      });
    });
  }

  /** Remove the most recent plate (last in, first out). Resolves with its weight. */
  function removePlate({ animate = true } = {}) {
    const entry = stack.pop();
    if (!entry) return Promise.resolve(null);
    cancelTween(entry.tween);
    moveCollar(animate ? cfg.removeMs : 0);

    const finish = () => {
      plateRoot.remove(entry.right);
      if (entry.left) plateRoot.remove(entry.left);
      cfg.onChange?.();
    };
    if (!animate) {
      finish();
      return Promise.resolve(entry.weight);
    }
    return new Promise((resolve) => {
      entry.tween = startTween({
        from: entry.x,
        to: entry.x + cfg.slideDistance,
        ms: cfg.removeMs,
        ease: easeInCubic,
        update: (v) => {
          entry.x = v;
          platePos(entry);
        },
        done: () => {
          finish();
          resolve(entry.weight);
        },
      });
    });
  }

  /** Remove every plate. */
  function clear(opts) {
    const all = [];
    while (stack.length) all.push(removePlate(opts));
    return Promise.all(all).then(() => undefined);
  }

  /** Weights currently on one side, oldest first. */
  const getWeights = () => stack.map((e) => e.weight);

  /** Bar + plates on both sides (or one side if mirror is false), in kg. */
  const totalKg = (barKg = cfg.barBaseWeight) =>
    barKg + getWeights().reduce((a, b) => a + b, 0) * (cfg.mirror ? 2 : 1);

  /** World-space centre of the right sleeve's loadable area. Aim the camera here. */
  const focus = new THREE.Vector3(
    ((bar.loadStartX + cfg.barLength / 2) / 2) * cfg.unitScale,
    0,
    0,
  );

  function dispose() {
    tweens.clear();
    if (raf) cancelAnimationFrame(raf);
    protos.forEach((p) => p.dispose());
    protos.clear();
    bar.dispose();
    collarProto.dispose();
    group.removeFromParent();
  }

  // Start with the collar seated against the sleeve flange.
  moveCollar(0);

  return { group, addPlate, removePlate, clear, getWeights, totalKg, focus, config: cfg, dispose };
}

/* ========================================================================== */
/* Lighting helper                                                             */
/* ========================================================================== */

/**
 * Metal (bar, bore, chrome plates) renders almost black without something to
 * reflect. Call this once: it sets a neutral studio environment map.
 * Still add one directional light for shadows if you want them.
 */
export function applyStudioEnvironment(renderer, scene, intensity = 1) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment(renderer);
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  if ('environmentIntensity' in scene) scene.environmentIntensity = intensity;
  pmrem.dispose();
  room.dispose?.();
}
