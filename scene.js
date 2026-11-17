// Show one sleeve; the counter includes matching plates on both sides.
try {
  const THREE = await import("three");
  const { createPlateRig, applyStudioEnvironment, PLATE_SPECS } = await import("./src/ipf-plates.js");
  const container = document.getElementById("barbell-scene");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 50);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);

  applyStudioEnvironment(renderer, scene);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xa0a0a0, 1.4));
  const light = new THREE.DirectionalLight(0xffffff, 2.5);
  light.position.set(2, 3, 3);
  scene.add(light);

  // The existing config remains the source of truth for button and plate colors.
  for (const plate of window.PLATE_COUNTER_CONFIG.plates) {
    if (PLATE_SPECS[plate.weight]) {
      PLATE_SPECS[plate.weight].color = new THREE.Color(plate.color).getHex();
      PLATE_SPECS[plate.weight].textColor = plate.textColor;
    }
  }

  function draw() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }

  const rig = createPlateRig({ mirror: false, onChange: draw });
  scene.add(rig.group);
  camera.position.copy(rig.focus).add(new THREE.Vector3(0.6, 0.2, 0.65));
  camera.lookAt(rig.focus);

  window.addPlate = weight => rig.addPlate(weight, { animate: false });
  window.removePlate = () => rig.removePlate({ animate: false });
  window.clearPlates = () => rig.clear({ animate: false });
  (window.getLoadedPlates?.() || []).forEach(weight => rig.addPlate(weight, { animate: false }));
  window.addEventListener("resize", draw);
  draw();
} catch (error) {
  document.getElementById("scene-error").hidden = false;
  console.error("Unable to load the barbell scene:", error);
}

