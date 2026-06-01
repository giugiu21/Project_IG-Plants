import * as THREE from "three";

function createDashedCircle(radius = 0.32) {
  const points = [];
  const segments = 48;

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;

    points.push(
      new THREE.Vector3(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius
      )
    );
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);

  const material = new THREE.LineDashedMaterial({
    color: 0xfff2a8,
    dashSize: 0.08,
    gapSize: 0.045,
    transparent: true,
    opacity: 0.95,
    depthWrite: false
  });

  const circle = new THREE.Line(geometry, material);
  circle.computeLineDistances();

  return circle;
}

function createSeedMesh() {
  const seed = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 18, 18),
    new THREE.MeshStandardMaterial({
      color: 0x997457,
      roughness: 0.85,
      metalness: 0.0
    })
  );

  seed.scale.set(0.8, 0.55, 1.05);
  seed.castShadow = true;
  seed.receiveShadow = true;

  return seed;
}

export function createSeedPlacement() {
  const previewGroup = new THREE.Group();

  const previewSeed = createSeedMesh();
  previewSeed.position.y = 0;

  const dashedCircle = createDashedCircle(0.34);
  dashedCircle.rotation.x = -Math.PI / 2;
  dashedCircle.position.y = -0.1;

  previewGroup.add(previewSeed);
  previewGroup.add(dashedCircle);

  previewGroup.visible = false;

  const plantedSeeds = new THREE.Group();

  const fallingSeeds = [];

  const state = {
    isPlacing: false,
    canPlace: false,

    // posizione sospesa del seme preview
    previewPosition: new THREE.Vector3(),

    // punto reale sul terreno dove il seme cadrà
    groundPosition: new THREE.Vector3()
  };

  function startPlacement() {
    state.isPlacing = true;
    state.canPlace = false;

    previewGroup.visible = true;
    dashedCircle.visible = false;
  }

  function cancelPlacement() {
    state.isPlacing = false;
    state.canPlace = false;

    previewGroup.visible = false;
    dashedCircle.visible = false;
  }

  /**
   * Questa funzione aggiorna il preview anche quando non sei sopra il ground.
   */
  function updatePreviewFloating(floatingPosition) {
    if (!state.isPlacing) return;

    state.previewPosition.copy(floatingPosition);
    previewGroup.position.copy(floatingPosition);
    previewGroup.visible = true;
  }

  /**
   * Questa funzione viene chiamata solo quando il mouse è sopra il ground.
   */
  function updateGroundTarget(groundPosition) {
    if (!state.isPlacing) return;

    state.canPlace = true;
    state.groundPosition.copy(groundPosition);

    dashedCircle.visible = true;

    // Il cerchio tratteggiato deve stare sul terreno,
    // quindi lo posizioniamo relativo al previewGroup.
    dashedCircle.position.set(
      groundPosition.x - previewGroup.position.x,
      groundPosition.y - previewGroup.position.y + 0.025,
      groundPosition.z - previewGroup.position.z
    );
  }

  function clearGroundTarget() {
    if (!state.isPlacing) return;

    state.canPlace = false;
    dashedCircle.visible = false;
  }

  /**
   * Il seme viene creato in aria e cade verso il punto sul ground.
   */
  function dropSeed() {
    if (!state.isPlacing || !state.canPlace) return null;

    const seed = createSeedMesh();

    seed.position.copy(state.previewPosition);

    seed.rotation.set(
      Math.random() * 0.4,
      Math.random() * Math.PI * 2,
      Math.random() * 0.4
    );

    plantedSeeds.add(seed);

    fallingSeeds.push({
      mesh: seed,
      velocity: new THREE.Vector3(0, 0, 0),
      target: state.groundPosition.clone(),
      gravity: -7.5,
      bounce: 0.18,
      settled: false
    });

    cancelPlacement();

    return seed;
  }

function updateFallingSeeds(deltaTime) {
  const newlySettledSeeds = [];

  for (const item of fallingSeeds) {
    if (item.settled) continue;

    const seed = item.mesh;

    item.velocity.y += item.gravity * deltaTime;
    seed.position.y += item.velocity.y * deltaTime;

    seed.position.x = THREE.MathUtils.lerp(
      seed.position.x,
      item.target.x,
      0.12
    );

    seed.position.z = THREE.MathUtils.lerp(
      seed.position.z,
      item.target.z,
      0.12
    );

    seed.rotation.x += deltaTime * 2.5;
    seed.rotation.z += deltaTime * 1.6;

    const groundY = item.target.y + 0.08;

    if (seed.position.y <= groundY) {
      seed.position.y = groundY;

      if (Math.abs(item.velocity.y) > 1.2) {
        item.velocity.y *= -item.bounce;
      } else {
        item.velocity.set(0, 0, 0);
        item.settled = true;

        seed.rotation.x = Math.random() * 0.25;
        seed.rotation.z = Math.random() * 0.25;

        newlySettledSeeds.push({
          seed,
          position: item.target.clone()
        });
      }
    }
  }

  return newlySettledSeeds;
}

  return {
    group: previewGroup,
    plantedSeeds,
    state,

    startPlacement,
    cancelPlacement,

    updatePreviewFloating,
    updateGroundTarget,
    clearGroundTarget,

    dropSeed,
    updateFallingSeeds
  };
}