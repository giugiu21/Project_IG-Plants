import * as THREE from "three";
import { createLeaf, updateLeaf } from "./createLeaf.js";
import {
  createFlower,
  updateFlower,
  updateFlowerGrowth
} from "./createFlower.js";

function smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function createStem(height = 2.0) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.04, height * 0.28, 0.02),
    new THREE.Vector3(-0.035, height * 0.62, -0.015),
    new THREE.Vector3(0.02, height, 0)
  ]);

  const geometry = new THREE.TubeGeometry(
    curve,
    32,
    0.035,
    12,
    false
  );

  const material = new THREE.MeshStandardMaterial({
    color: 0x3e8a35,
    roughness: 0.85,
    metalness: 0.0
  });

  const stem = new THREE.Mesh(geometry, material);
  stem.castShadow = true;
  stem.receiveShadow = true;

  return stem;
}

export function createPlant(position) {
  const group = new THREE.Group();

  group.position.copy(position);
  group.position.y += 0.08;

  /**
   * Scala generale della pianta.
   * Aumenta questo valore se la vuoi ancora più grande.
   */
  group.scale.setScalar(1.35);

  const stem = createStem(1.5);
  stem.scale.set(1, 0.01, 1);
  group.add(stem);

  const leafLeft = createLeaf({
    color: 0x3f8f3f,
    length: 1.25,
    maxWidth: 0.34,
    windStrength: 0.07,
    windSpeed: 0.9,
    interactionRadius: 0.4,
    interactionStrength: 0.3
  });
  leafLeft.position.set(0, 0.05, 0);
  leafLeft.rotation.set(1.6, -1, 1.2);
  group.add(leafLeft);

  const leafRight = createLeaf({
    color: 0x4b9a46,
    length: 1.18,
    maxWidth: 0.32,
    windStrength: 0.07,
    windSpeed: 0.9,
    interactionRadius: 0.4,
    interactionStrength: 0.3
  });
  leafRight.position.set(0.07, 0.1, 0.01);
  leafRight.rotation.set(1.5, 0.8, -1.2);
  group.add(leafRight);

  const leafFront = createLeaf({
    color: 0x4f9f4a,
    length: 1.05,
    maxWidth: 0.29,
    windStrength: 0.07,
    windSpeed: 0.9,
    interactionRadius: 0.4,
    interactionStrength: 0.3
  });
  leafFront.position.set(0, 0.40, 0);
  leafFront.rotation.set(0.7, -0.2, 0.5);
  group.add(leafFront);

  const leafBack = createLeaf({
    color: 0x5fa852,
    length: 0.95,
    maxWidth: 0.26,
    windStrength: 0.07,
    windSpeed: 0.9,
    interactionRadius: 0.4,
    interactionStrength: 0.3
  });
  leafBack.position.set(0, 0.25, 0);
  leafBack.rotation.set(-0.5, -3, 3);
  group.add(leafBack);

  const flower = createFlower({
    petalColor: 0xf2a0c4,
    throatColor: 0xffd35a
  });

  flower.position.set(0.03, 1.5, 0.02);
  flower.rotation.set(-0.18, 0.15, 0.05);
  group.add(flower);

  group.userData = {
    growth: 0,
    stem,
    leaves: [leafLeft, leafRight, leafFront, leafBack],
    flower,

    baseLeafScales: [
      new THREE.Vector3(1.2, 1.2, 1.2),
      new THREE.Vector3(1.12, 1.12, 1.12),
      new THREE.Vector3(0.95, 0.95, 0.95),
      new THREE.Vector3(0.85, 0.85, 0.85)
    ],

    baseLeafRotations: [
      leafLeft.rotation.clone(),
      leafRight.rotation.clone(),
      leafFront.rotation.clone(),
      leafBack.rotation.clone()
    ]
  };

  updatePlantGrowth(group, 0);

  return group;
}

export function updatePlantGrowth(plant, growth) {
  const data = plant.userData;

  data.growth = THREE.MathUtils.clamp(growth, 0, 1);

  const g = data.growth;

  /**
   * 1. Stelo.
   */
  const stemGrowth = smoothstep(0.0, 0.55, g);
  data.stem.scale.y = Math.max(0.01, stemGrowth);

  data.stem.rotation.z = Math.sin(g * Math.PI) * 0.025;

  /**
   * 2. Foglie.
   */
  const leafGrowths = [
    smoothstep(0.20, 0.50, g),
    smoothstep(0.32, 0.65, g),
    smoothstep(0.48, 0.80, g),
    smoothstep(0.62, 0.90, g)
  ];

  data.leaves.forEach((leaf, index) => {
    const lg = leafGrowths[index];

    leaf.visible = lg > 0.02;

    const baseScale = data.baseLeafScales[index];

    leaf.scale.set(
      baseScale.x * Math.max(0.01, lg),
      baseScale.y * Math.max(0.01, lg),
      baseScale.z * Math.max(0.01, lg)
    );

    /**
     * Movimento di apertura:
     * all’inizio le foglie sono più chiuse,
     * poi si aprono verso la posizione finale.
     */
    const finalRot = data.baseLeafRotations[index];

    leaf.rotation.x = finalRot.x + (1.0 - lg) * 0.45;
    leaf.rotation.y = finalRot.y;
    leaf.rotation.z = finalRot.z * lg;
  });

  /**
   * 3. Fiore finale.
   */
  const flowerGrowth = smoothstep(0.68, 1.0, g);

  data.flower.visible = flowerGrowth > 0.01;

  if (flowerGrowth > 0.01) {
    data.flower.scale.setScalar(
      THREE.MathUtils.lerp(0.4, 1.0, flowerGrowth)
    );

    updateFlowerGrowth(data.flower, flowerGrowth);
  } else {
    data.flower.scale.setScalar(0.01);
    updateFlowerGrowth(data.flower, 0);
  }
}

export function animatePlant(
  plant,
  deltaTime,
  elapsedTime,
  growthSpeed,
  cursorPosition,
  fireflyPositions = [],
  rainAmount = 0,
  lightningIntensity = 0
) {
  const currentGrowth = plant.userData.growth;

  if (currentGrowth < 1) {
    const nextGrowth =
      currentGrowth + deltaTime * 0.08 * growthSpeed;

    updatePlantGrowth(plant, nextGrowth);
  }

  for (const leaf of plant.userData.leaves) {
    updateLeaf(
      leaf,
      elapsedTime,
      cursorPosition,
      fireflyPositions,
      rainAmount,
      lightningIntensity
    );
  }

  updateFlower(
    plant.userData.flower,
    elapsedTime,
    cursorPosition,
    fireflyPositions,
    lightningIntensity
  );

  return plant.userData.growth < 1;
}