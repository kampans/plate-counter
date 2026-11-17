// The scene shows one sleeve; each hook represents a pair on the actual bar.
try {
  const THREE = await import("https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js");
  const container = document.getElementById("barbell-scene");
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb0b0b0, 1.4));
  const light = new THREE.DirectionalLight(0xffffff, 2.5);
  light.position.set(5, 7, 6);
  scene.add(light);

  const metal = new THREE.MeshStandardMaterial({ color: 0xc7c9ca, metalness: 0.65, roughness: 0.3 });
  function cylinder(radius, length, x) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 96), metal);
    mesh.rotation.z = Math.PI / 2;
    mesh.position.x = x;
    scene.add(mesh);
    return mesh;
  }
  cylinder(0.065, 2.6, 0.9);
  const sleeve = cylinder(0.12, 1.8, 3.1);
  cylinder(0.19, 0.1, 2.15);
  cylinder(0.16, 0.06, 2.09);
  cylinder(0.135, 0.025, 2.22);
  const sleeveEnd = cylinder(0.125, 0.035, 4);

  const plates = [];
  const thickness = 0.085;
  const spacing = 0.098;
  const sleeveStart = 2.2;

  function createPlate(weight) {
    const definition = window.PLATE_COUNTER_CONFIG.plates.find(item => item.weight === weight);
    if (!definition) return null;
    const radius = weight >= 20 ? 0.95 : weight === 15 ? 0.87 : weight === 10 ? 0.79 : weight === 5 ? 0.68 : weight === 2.5 ? 0.56 : 0.45;
    const half = thickness / 2;
    const hole = 0.123; // Just clears the 0.12-radius sleeve.
    const bevel = 0.018;
    // Traverse the cross-section from the inner back edge, around the outside,
    // to the inner front edge. This winding makes the normals face outward.
    const profile = [
      new THREE.Vector2(hole, -half + 0.012),
      new THREE.Vector2(hole + 0.025, -half + 0.012),
      new THREE.Vector2(radius - 0.11, -half + 0.012),
      new THREE.Vector2(radius - 0.075, -half),
      new THREE.Vector2(radius - bevel, -half),
      new THREE.Vector2(radius - 0.01, -half + 0.01),
      new THREE.Vector2(radius, -half + bevel),
      new THREE.Vector2(radius, half - bevel),
      new THREE.Vector2(radius - 0.01, half - 0.01),
      new THREE.Vector2(radius - bevel, half),
      new THREE.Vector2(radius - 0.075, half),
      new THREE.Vector2(radius - 0.11, half - 0.012),
      new THREE.Vector2(hole + 0.025, half - 0.012),
      new THREE.Vector2(hole, half - 0.012),
      new THREE.Vector2(hole, -half + 0.012)
    ];
    const geometry = new THREE.LatheGeometry(profile, 128);
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ color: definition.color, metalness: 0.18, roughness: 0.42 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.z = -Math.PI / 2;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = definition.textColor;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(512, 512, 440, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(512, 512, 190, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = definition.textColor;
    ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 5;
    ctx.shadowBlur = 2;
    ctx.textAlign = "center";
    ctx.font = "900 112px sans-serif";
    ctx.fillText("ELEIKO", 512, 235);
    ctx.font = "bold 90px sans-serif";
    ctx.fillText(`${weight} KG`, 512, 805);
    ctx.font = "bold 34px sans-serif";
    ctx.fillText("SWEDEN", 512, 852);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(radius * 1.65, radius * 1.65),
      new THREE.MeshStandardMaterial({ map: texture, transparent: true, depthWrite: false, roughness: 0.55, side: THREE.DoubleSide })
    );
    decal.rotation.x = -Math.PI / 2;
    // Counter the plate's rotation onto the bar so the lettering stays upright.
    decal.rotateZ(Math.PI / 2);
    decal.position.y = half + 0.002;
    mesh.add(decal);
    return mesh;
  }

  function updateSleeve() {
    const length = Math.max(1.8, plates.length * spacing + 0.65);
    sleeve.scale.y = length / 1.8;
    sleeve.position.x = sleeveStart + length / 2;
    sleeveEnd.position.x = sleeveStart + length;
  }
  function addPlate(weight) {
    const mesh = createPlate(weight);
    if (!mesh) return;
    mesh.position.x = sleeveStart + thickness / 2 + plates.length * spacing;
    plates.push(mesh);
    scene.add(mesh);
    updateSleeve();
    draw();
  }
  function removePlate() {
    const mesh = plates.pop();
    if (!mesh) return;
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.children.forEach(child => {
      child.geometry.dispose();
      child.material.map.dispose();
      child.material.dispose();
    });
    mesh.material.dispose();
    updateSleeve();
    draw();
  }
  function draw() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const end = sleeveStart + Math.max(1.8, plates.length * spacing + 0.65);
    const center = (sleeveStart + end) / 2;
    const halfWidth = (end - sleeveStart) / 2 + 0.25;
    const halfHeight = 1.02;
    const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const distance = Math.max(halfHeight / tanHalfFov, halfWidth / (tanHalfFov * camera.aspect)) * 1.25;
    camera.position.set(center + distance * 0.72, distance * 0.16, distance * 0.69);
    camera.lookAt(center, 0, 0);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  window.addPlate = addPlate;
  window.removePlate = removePlate;
  (window.getLoadedPlates?.() || []).forEach(addPlate);
  window.addEventListener("resize", draw);
  updateSleeve();
  draw();
} catch (error) {
  document.getElementById("scene-error").hidden = false;
  console.error("Unable to load the barbell scene:", error);
}

