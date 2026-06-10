import * as THREE from "three";

/*This file creates the seed:
    It handles:
      - seed 3D geometry model
      - preview visualization
      - seed placement
      - throwing seed animation
*/

//visual dashed circle surrounding the seed 
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

//Seed 3D geometry
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

//Creates the placement system for the seed
export function createSeedPlacement() {
  const previewGroup = new THREE.Group(); //preview for user, to know where we are throwing the seed

  const previewSeed = createSeedMesh();
  previewSeed.position.y = 0;

  const dashedCircle = createDashedCircle(0.34);
  dashedCircle.rotation.x = -Math.PI / 2;
  dashedCircle.position.y = -0.1;

  previewGroup.add(previewSeed);
  previewGroup.add(dashedCircle);

  previewGroup.visible = false;

  //actual seeds that were planted
  const plantedSeeds = new THREE.Group();

  const fallingSeeds = [];

  const state = {
    isPlacing: false,
    canPlace: false,

    // suspended position for the preview -- it follows the cursor
    previewPosition: new THREE.Vector3(),

    //real ground position after throwing
    groundPosition: new THREE.Vector3()
  };

//when we click on plant
  function startPlacement() {
    state.isPlacing = true;
    state.canPlace = false;

    previewGroup.visible = true;
    dashedCircle.visible = false; 
  }

  //if we cancel the planting
  function cancelPlacement() {
    state.isPlacing = false;
    state.canPlace = false;

    previewGroup.visible = false;
    dashedCircle.visible = false;
  }

  //Keeping the preview visible even if cursor is not on the ground (suitable planting position)
  function updatePreviewFloating(floatingPosition) {
    if (!state.isPlacing) return;

    state.previewPosition.copy(floatingPosition);
    previewGroup.position.copy(floatingPosition);
    previewGroup.visible = true;
  }

  //if we are on a suitable planting position
  function updateGroundTarget(groundPosition) {
    if (!state.isPlacing) return;

    state.canPlace = true;
    state.groundPosition.copy(groundPosition);

    //dashed cirle appears
    dashedCircle.visible = true;
    dashedCircle.position.set(
      groundPosition.x - previewGroup.position.x,
      groundPosition.y - previewGroup.position.y + 0.025,
      groundPosition.z - previewGroup.position.z
    );
  }

  //if cursor is not in a valid ground position
  function clearGroundTarget() {
    if (!state.isPlacing) return;

    state.canPlace = false;
    dashedCircle.visible = false;
  }

  //Planting function
  function dropSeed() {
    if (!state.isPlacing || !state.canPlace) return null;

    const seed = createSeedMesh();

    seed.position.copy(state.previewPosition);

    //random rotation to change the appearance of the seeds
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

  //updates in real time the array of seeds that were planted -- used to then animate the plant growth
  function updateFallingSeeds(deltaTime) {
    const newlySettledSeeds = [];

    for (const item of fallingSeeds) {
      if (item.settled) continue;

      const seed = item.mesh;

      //updates velocity based on gravity
      item.velocity.y += item.gravity * deltaTime;
      seed.position.y += item.velocity.y * deltaTime;

      //moving towards the target -- this + gravity creates a parabolic throw
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

      //while falling the seed rotates
      seed.rotation.x += deltaTime * 2.5;
      seed.rotation.z += deltaTime * 1.6;

      //ground collision
      const groundY = item.target.y + 0.08;

      if (seed.position.y <= groundY) {
        seed.position.y = groundY;

        //if the velocity is strong enough the seed bounces
        if (Math.abs(item.velocity.y) > 1.2) {
          item.velocity.y *= -item.bounce;
        } else { 
          //the seed is planted
          item.velocity.set(0, 0, 0);
          item.settled = true;

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