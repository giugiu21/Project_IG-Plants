import * as THREE from "three";

const TMP_DIRECTION = new THREE.Vector3();
const TMP_AVOIDANCE = new THREE.Vector3();
const TMP_OBSTACLE = new THREE.Vector3();
const TMP_AWAY = new THREE.Vector3();

function randomPointInAir(radius = 3.8) {
  const r = Math.sqrt(Math.random()) * radius;
  const a = Math.random() * Math.PI * 2;

  return new THREE.Vector3(
    Math.cos(a) * r,
    1.1 + Math.random() * 1.6,
    Math.sin(a) * r
  );
}

function applyWingUVs(geometry) {
  geometry.computeBoundingBox();

  const box = geometry.boundingBox;

  const sizeX = box.max.x - box.min.x;
  const sizeZ = box.max.z - box.min.z;

  const position = geometry.attributes.position;
  const uvs = [];

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);

    const u = sizeX > 0 ? (x - box.min.x) / sizeX : 0;
    const v = sizeZ > 0 ? (z - box.min.z) / sizeZ : 0;

    uvs.push(u, v);
  }

  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(uvs, 2)
  );
}

function createWingGeometry(side = 1) {
  const shape = new THREE.Shape();

  shape.moveTo(0, -0.22);

  shape.bezierCurveTo(
    side * 0.12,
    -0.46,
    side * 0.46,
    -0.66,
    side * 0.78,
    -0.42
  );

  shape.bezierCurveTo(
    side * 0.96,
    -0.27,
    side * 0.88,
    -0.02,
    side * 0.56,
    0.02
  );

  shape.bezierCurveTo(
    side * 0.66,
    0.10,
    side * 0.64,
    0.18,
    side * 0.50,
    0.20
  );

  shape.bezierCurveTo(
    side * 0.68,
    0.34,
    side * 0.50,
    0.55,
    side * 0.25,
    0.42
  );

  shape.bezierCurveTo(
    side * 0.08,
    0.34,
    side * 0.02,
    0.15,
    0,
    0.08
  );

  shape.lineTo(0, -0.22);

  const geometry = new THREE.ShapeGeometry(shape, 80);

  const position = geometry.attributes.position;

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getY(i);

    const distanceFromBody = Math.abs(x);

    const camber =
      Math.sin(
        THREE.MathUtils.clamp(distanceFromBody / 0.85, 0, 1) *
          Math.PI
      ) * 0.025;

    const organicCurve =
      Math.sin((z + 0.25) * Math.PI * 2.4) *
      distanceFromBody *
      0.01;

    position.setXYZ(
      i,
      x,
      camber + organicCurve,
      z
    );
  }

  applyWingUVs(geometry);
  geometry.computeVertexNormals();

  return geometry;
}

function createWingVeins(side = 1, material) {
  const group = new THREE.Group();

  const veinMaterial = material.clone();
  veinMaterial.transparent = true;
  veinMaterial.opacity = 0.38;
  veinMaterial.depthWrite = false;

  function addVein(points) {
    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map(([x, y, z]) => new THREE.Vector3(x, y, z))
    );

    const line = new THREE.Line(geometry, veinMaterial);
    group.add(line);
  }

  const y = 0.034;

  addVein([
    [0, y, -0.08],
    [side * 0.18, y, -0.18],
    [side * 0.40, y, -0.28],
    [side * 0.70, y, -0.40]
  ]);

  addVein([
    [side * 0.10, y, -0.12],
    [side * 0.30, y, -0.42],
    [side * 0.55, y, -0.55]
  ]);

  addVein([
    [side * 0.15, y, -0.05],
    [side * 0.45, y, -0.12],
    [side * 0.82, y, -0.20]
  ]);

  addVein([
    [side * 0.18, y, 0.02],
    [side * 0.42, y, 0.02],
    [side * 0.58, y, 0.02]
  ]);

  addVein([
    [side * 0.08, y, 0.08],
    [side * 0.26, y, 0.24],
    [side * 0.46, y, 0.38]
  ]);

  addVein([
    [side * 0.06, y, 0.10],
    [side * 0.18, y, 0.30],
    [side * 0.28, y, 0.43]
  ]);

  return group;
}

function createAntenna(side = 1, material) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 0.022, 0.03, -0.13),
    new THREE.Vector3(side * 0.055, 0.08, -0.18),
    new THREE.Vector3(side * 0.075, 0.12, -0.23),
    new THREE.Vector3(side * 0.055, 0.145, -0.27)
  ]);

  const geometry = new THREE.TubeGeometry(
    curve,
    16,
    0.004,
    5,
    false
  );

  const antenna = new THREE.Mesh(geometry, material);

  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.009, 8, 6),
    material
  );

  tip.position.copy(curve.getPoint(1));
  antenna.add(tip);

  return antenna;
}

function createLeg(side = 1, z = 0, material) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 0.018, -0.012, z),
    new THREE.Vector3(side * 0.055, -0.035, z + 0.015),
    new THREE.Vector3(side * 0.095, -0.055, z + 0.04)
  ]);

  const geometry = new THREE.TubeGeometry(
    curve,
    8,
    0.003,
    4,
    false
  );

  return new THREE.Mesh(geometry, material);
}

function createButterflyMesh() {
  const butterfly = new THREE.Group();

  const textureLoader = new THREE.TextureLoader();

  /**
   * Usiamo la stessa immagine per entrambe le ali,
   * ma una delle due viene specchiata.
   *
   * Il file deve stare in:
   * public/textures/wings-monarch.jpg
   */
  const rightWingTexture = textureLoader.load("/textures/wings-monarch.jpg");
  rightWingTexture.colorSpace = THREE.SRGBColorSpace;

  const leftWingTexture = textureLoader.load("/textures/wings-monarch.jpg");
  leftWingTexture.colorSpace = THREE.SRGBColorSpace;

  /**
   * Specchio orizzontale per l'ala sinistra.
   */
  rightWingTexture.wrapS = THREE.RepeatWrapping;
  rightWingTexture.repeat.x = -1;
  rightWingTexture.offset.x = 1;

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x17100a,
    roughness: 0.8,
    metalness: 0
  });

  const eyeMaterial = new THREE.MeshStandardMaterial({
    color: 0x050403,
    roughness: 0.35,
    metalness: 0.05
  });

  const leftWingMaterial = new THREE.MeshStandardMaterial({
    map: leftWingTexture,
    roughness: 0.62,
    metalness: 0,
    side: THREE.DoubleSide
  });

  const rightWingMaterial = new THREE.MeshStandardMaterial({
    map: rightWingTexture,
    roughness: 0.62,
    metalness: 0,
    side: THREE.DoubleSide
  });

  const veinMaterial = new THREE.LineBasicMaterial({
    color: 0x0d0603,
    transparent: true,
    opacity: 0.50
  });

  const abdomen = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.028, 0.19, 8, 14),
    bodyMaterial
  );

  abdomen.rotation.x = Math.PI / 2;
  abdomen.position.set(0, -0.002, 0.07);
  abdomen.scale.set(0.82, 0.82, 1.22);
  butterfly.add(abdomen);

  const thorax = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 14, 10),
    bodyMaterial
  );

  thorax.position.set(0, 0.006, -0.055);
  thorax.scale.set(0.82, 1.05, 1.2);
  butterfly.add(thorax);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.038, 14, 10),
    bodyMaterial
  );

  head.position.set(0, 0.012, -0.125);
  head.scale.set(1, 0.92, 1.08);
  butterfly.add(head);

  const leftEye = new THREE.Mesh(
    new THREE.SphereGeometry(0.013, 8, 6),
    eyeMaterial
  );

  leftEye.position.set(-0.028, 0.02, -0.142);
  butterfly.add(leftEye);

  const rightEye = new THREE.Mesh(
    new THREE.SphereGeometry(0.013, 8, 6),
    eyeMaterial
  );

  rightEye.position.set(0.028, 0.02, -0.142);
  butterfly.add(rightEye);

  const leftWingPivot = new THREE.Group();
  const rightWingPivot = new THREE.Group();

  leftWingPivot.position.set(-0.018, 0.012, -0.035);
  rightWingPivot.position.set(0.018, 0.012, -0.035);

  butterfly.add(leftWingPivot);
  butterfly.add(rightWingPivot);

  const leftWingGroup = new THREE.Group();
  const rightWingGroup = new THREE.Group();

  const leftWing = new THREE.Mesh(
    createWingGeometry(-1),
    leftWingMaterial
  );

  const rightWing = new THREE.Mesh(
    createWingGeometry(1),
    rightWingMaterial
  );

  leftWingGroup.add(leftWing);
  rightWingGroup.add(rightWing);

  leftWingGroup.add(createWingVeins(-1, veinMaterial));
  rightWingGroup.add(createWingVeins(1, veinMaterial));

  leftWingGroup.rotation.z = THREE.MathUtils.degToRad(-4);
  rightWingGroup.rotation.z = THREE.MathUtils.degToRad(4);

  leftWingGroup.rotation.x = THREE.MathUtils.degToRad(2);
  rightWingGroup.rotation.x = THREE.MathUtils.degToRad(2);

  leftWingPivot.add(leftWingGroup);
  rightWingPivot.add(rightWingGroup);

  butterfly.add(createAntenna(-1, bodyMaterial));
  butterfly.add(createAntenna(1, bodyMaterial));

  butterfly.add(createLeg(-1, -0.085, bodyMaterial));
  butterfly.add(createLeg(1, -0.085, bodyMaterial));

  butterfly.add(createLeg(-1, -0.03, bodyMaterial));
  butterfly.add(createLeg(1, -0.03, bodyMaterial));

  butterfly.add(createLeg(-1, 0.035, bodyMaterial));
  butterfly.add(createLeg(1, 0.035, bodyMaterial));

  butterfly.userData.leftWingPivot = leftWingPivot;
  butterfly.userData.rightWingPivot = rightWingPivot;

  butterfly.scale.setScalar(0.50);

  butterfly.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return butterfly;
}

function applyPlantAvoidance({
  position,
  direction,
  plants
}) {
  TMP_AVOIDANCE.set(0, 0, 0);

  for (const plant of plants) {
    if (plant.userData?.flower) {
      plant.userData.flower.getWorldPosition(TMP_OBSTACLE);

      const flowerAvoidRadius = 0.7;
      const distance = position.distanceTo(TMP_OBSTACLE);

      if (distance < flowerAvoidRadius) {
        TMP_AWAY.subVectors(position, TMP_OBSTACLE);

        if (TMP_AWAY.lengthSq() > 0.0001) {
          TMP_AWAY.normalize();

          const strength = 1.0 - distance / flowerAvoidRadius;

          TMP_AVOIDANCE.addScaledVector(
            TMP_AWAY,
            strength * strength * 1.35
          );
        }
      }
    }

    const leaves = plant.userData?.leaves || [];

    for (const leaf of leaves) {
      const leafMesh = leaf.userData?.leafMesh;

      if (!leafMesh) continue;

      leafMesh.getWorldPosition(TMP_OBSTACLE);

      const leafAvoidRadius = 0.42;
      const distance = position.distanceTo(TMP_OBSTACLE);

      if (distance < leafAvoidRadius) {
        TMP_AWAY.subVectors(position, TMP_OBSTACLE);

        if (TMP_AWAY.lengthSq() > 0.0001) {
          TMP_AWAY.normalize();

          const strength = 1.0 - distance / leafAvoidRadius;

          TMP_AVOIDANCE.addScaledVector(
            TMP_AWAY,
            strength * strength * 1.1
          );
        }
      }
    }

    plant.getWorldPosition(TMP_OBSTACLE);
    TMP_OBSTACLE.y += 0.8;

    const plantAvoidRadius = 0.55;
    const plantDistance = position.distanceTo(TMP_OBSTACLE);

    if (plantDistance < plantAvoidRadius) {
      TMP_AWAY.subVectors(position, TMP_OBSTACLE);

      if (TMP_AWAY.lengthSq() > 0.0001) {
        TMP_AWAY.normalize();

        const strength = 1.0 - plantDistance / plantAvoidRadius;

        TMP_AVOIDANCE.addScaledVector(
          TMP_AWAY,
          strength * strength * 0.9
        );
      }
    }
  }

  if (TMP_AVOIDANCE.lengthSq() > 0.0001) {
    direction.add(TMP_AVOIDANCE).normalize();
  }
}

function chooseSafeRandomTarget({
  radius,
  plants
}) {
  for (let i = 0; i < 18; i++) {
    const target = randomPointInAir(radius);

    let safe = true;

    for (const plant of plants) {
      plant.getWorldPosition(TMP_OBSTACLE);
      TMP_OBSTACLE.y += 0.85;

      if (target.distanceTo(TMP_OBSTACLE) < 0.75) {
        safe = false;
        break;
      }

      if (plant.userData?.flower) {
        plant.userData.flower.getWorldPosition(TMP_OBSTACLE);

        if (target.distanceTo(TMP_OBSTACLE) < 0.65) {
          safe = false;
          break;
        }
      }

      const leaves = plant.userData?.leaves || [];

      for (const leaf of leaves) {
        const leafMesh = leaf.userData?.leafMesh;
        if (!leafMesh) continue;

        leafMesh.getWorldPosition(TMP_OBSTACLE);

        if (target.distanceTo(TMP_OBSTACLE) < 0.45) {
          safe = false;
          break;
        }
      }

      if (!safe) break;
    }

    if (safe) {
      return target;
    }
  }

  return randomPointInAir(radius);
}

export function createButterfly({
  radius = 3.8
} = {}) {
  const group = new THREE.Group();

  const butterfly = createButterflyMesh();
  group.add(butterfly);

  butterfly.position.copy(randomPointInAir(radius));

  const state = {
    radius,

    target: randomPointInAir(radius),

    speed: 0.55,
    turnSpeed: 4.5,

    flapPhase: Math.random() * Math.PI * 2,
    flapSpeed: 12.0,

    hoverPhase: Math.random() * Math.PI * 2,

    visibleStrength: 1
  };

  group.userData = {
    butterfly,
    state
  };

  return {
    group,
    butterfly,
    state
  };
}

export function animateButterfly(
  butterflySystem,
  deltaTime,
  elapsedTime,
  {
    isNight = false,
    plants = [],
    isRaining = false
  } = {}
) {
  const { butterfly, state } = butterflySystem;

  const targetVisible = isNight || isRaining ? 0 : 1;

  state.visibleStrength = THREE.MathUtils.lerp(
    state.visibleStrength,
    targetVisible,
    deltaTime * 4.0
  );

  butterfly.visible = state.visibleStrength > 0.03;

  if (!butterfly.visible) {
    return;
  }

  butterfly.scale.setScalar(0.65 * state.visibleStrength);

  const flap =
    Math.sin(elapsedTime * state.flapSpeed + state.flapPhase) *
    0.85;

  const leftWingPivot = butterfly.userData.leftWingPivot;
  const rightWingPivot = butterfly.userData.rightWingPivot;

  if (leftWingPivot && rightWingPivot) {
    leftWingPivot.rotation.z =
      THREE.MathUtils.degToRad(-6) - flap;

    rightWingPivot.rotation.z =
      THREE.MathUtils.degToRad(6) + flap;
  }

  const distanceToTarget =
    butterfly.position.distanceTo(state.target);

  if (distanceToTarget < 0.22) {
    state.target.copy(
      chooseSafeRandomTarget({
        radius: state.radius,
        plants
      })
    );
  }

  TMP_DIRECTION.subVectors(state.target, butterfly.position);

  const distance = TMP_DIRECTION.length();

  if (distance > 0.001) {
    TMP_DIRECTION.normalize();

    applyPlantAvoidance({
      position: butterfly.position,
      direction: TMP_DIRECTION,
      plants
    });

    const naturalSpeed =
      state.speed *
      (0.82 + 0.18 * Math.sin(elapsedTime * 2.3 + state.hoverPhase));

    butterfly.position.addScaledVector(
      TMP_DIRECTION,
      naturalSpeed * deltaTime
    );

    butterfly.position.y +=
      Math.sin(elapsedTime * 4.0 + state.hoverPhase) *
      0.006;

    butterfly.position.y = THREE.MathUtils.clamp(
      butterfly.position.y,
      0.9,
      3.0
    );

    const distanceFromCenter = Math.sqrt(
      butterfly.position.x * butterfly.position.x +
      butterfly.position.z * butterfly.position.z
    );

    if (distanceFromCenter > state.radius * 1.05) {
      state.target.copy(
        chooseSafeRandomTarget({
          radius: state.radius * 0.75,
          plants
        })
      );
    }

    const targetYaw = Math.atan2(
      TMP_DIRECTION.x,
      TMP_DIRECTION.z
    );

    let angleDiff = targetYaw - butterfly.rotation.y;

    angleDiff = Math.atan2(
      Math.sin(angleDiff),
      Math.cos(angleDiff)
    );

    butterfly.rotation.y +=
      angleDiff *
      Math.min(1, deltaTime * state.turnSpeed);

    butterfly.rotation.z = -angleDiff * 0.45;
  }
}