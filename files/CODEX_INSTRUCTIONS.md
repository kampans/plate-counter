# Task: replace the barbell scene with `ipf-plates.js`

`ipf-plates.js` (same folder as this file) is a finished Three.js module that builds
Eleiko-style IPF calibrated powerlifting plates and a competition bar procedurally.
No 3D model files are needed. Read the header comment of that file first.

## Goal
Swap the current barbell and plate meshes for the module's rig. **Do not change the
UI, the total-weight maths, the undo/clear logic or the button styling.** Only the 3D
scene changes.

## Setup
1. Copy `ipf-plates.js` to `src/ipf-plates.js`. Do not rewrite or "simplify" it.
2. Requires `three` r152 or newer. Check `package.json` and upgrade if older.
3. It imports `three/examples/jsm/utils/BufferGeometryUtils.js` and
   `three/examples/jsm/environments/RoomEnvironment.js`, which ship with `three`.

## Wiring
```js
import { createPlateRig, applyStudioEnvironment } from './ipf-plates.js';

applyStudioEnvironment(renderer, scene);               // once, after creating renderer/scene
const rig = createPlateRig({ onChange: requestRender }); // onChange only if rendering on demand
scene.add(rig.group);

// Existing UI hooks stay the same, just point them at the rig:
export const addPlate = (weight) => rig.addPlate(weight);
export const removePlate = () => rig.removePlate();     // last in, first out
export const clearPlates = () => rig.clear();
```

- `rig.addPlate(kg)` / `rig.removePlate()` / `rig.clear()` return Promises that resolve
  when the animation ends. The UI can ignore them.
- Rapid taps are safe: tweens are independent and the collar retargets.
- Plates appear on **both** sleeves. Keep the existing "bar + plates x 2" total.
- Remove the old barbell/plate code, its GSAP tweens for plates, and unused configs.
  The module has its own tween engine, so GSAP is not needed for plates.
- Valid weights: 25, 20, 15, 10, 5, 2.5, 1.25. Colours and diameters live in
  `PLATE_SPECS`. If `config.js` already holds plate colours, make the UI buttons and
  `PLATE_SPECS` agree (edit `PLATE_SPECS`, or pass nothing and edit the buttons).

## Scale and camera (important)
The module is in real units: the rig group is scaled by `unitScale` (default `0.001`,
so 1 scene unit = 1 metre; a 25 kg plate is 0.45 units across, the bar is 2.2 long).
- If the existing scene uses other units, set `createPlateRig({ unitScale: ... })`
  rather than editing the module.
- Set `camera.near = 0.01` and `camera.far = 50` (or similar) so nothing is clipped.
- Aim `OrbitControls.target` at `rig.focus` (centre of the right sleeve's loadable area).
- Keep the existing angled, sleeve-first view. Place the camera roughly
  `rig.focus + (0.9, 0.35, 0.9)` for the first attempt, then adjust so the sleeve and
  six or so plates fill most of the canvas. Set `minDistance`/`maxDistance` sensibly
  (about 0.5 to 3).
- The bar sits on the X axis. The right sleeve is +X.

## Lighting (this fixes the "black plate faces" problem)
- `applyStudioEnvironment` gives the metal something to reflect. Keep it.
- Keep one `DirectionalLight` (about intensity 2 to 3) from the upper front side plus a
  soft `HemisphereLight`. Enable shadows only if performance allows.
- `renderer.toneMapping = THREE.ACESFilmicToneMapping`,
  `renderer.outputColorSpace = THREE.SRGBColorSpace`.
- Use a background noticeably lighter or different from the page background.

## Tweaking (in `PLATE_CONFIG` / `PLATE_SPECS`, not in the builders)
- `diameterMode: 'stylized'` (default) makes 25 and 20 kg 450 mm, 15 kg 400 mm, 10 kg
  350 mm. `'ipf'` makes all four 450 mm like real competition plates.
- `thickness` can be set per plate in `PLATE_SPECS`; otherwise it is derived from weight.
- Animation: `addMs`, `removeMs`, `slideDistance`, `overshoot`.
- `mirror: false` shows plates on the right sleeve only.
- `textureSize`: 512 default; use 1024 only for close-ups.

## Notes and limits
- Plate dimensions other than the 450 mm / 50 mm sleeve / 2200 mm bar are estimates.
- Plates stack in the order they are added; the module does not re-sort by weight.
- Geometry and materials are cached per weight and shared by every plate of that
  weight. Do not `dispose()` a plate's geometry on removal. Call `rig.dispose()` only
  when tearing the whole scene down.
- It uses `<canvas>` for textures, so it is browser-only.
- The module was syntax-checked but not rendered when it was written. If anything looks
  wrong visually, fix it in the module's config values first, and report what you changed.

## Acceptance checklist
- [ ] 25 kg red plates look thin and calibrated: raised lip, recessed face, hub, steel bore.
- [ ] Weight numbers are readable on the outer face of the last plate.
- [ ] 25 and 20 kg are the same diameter; 15 and 10 kg are visibly smaller.
- [ ] Adding and removing animates smoothly and the collar follows.
- [ ] Undo removes the last plate; Clear removes all.
- [ ] Total weight in the UI is unchanged: bar 20 kg + (plates x 2).
- [ ] No console errors; smooth on a phone-sized viewport.
