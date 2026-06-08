import * as THREE from "three";
import { createLeaf, updateLeaf } from "./createLeaf.js";
import {
  createFlower,
  updateFlower,
  updateFlowerGrowth
} from "./createFlower.js";

//function for smooth transition for plant growth
function smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}


function createStem(height = 2.0) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    //modelling the curves
    new THREE.Vector3(0.04, height * 0.28, 0.02),
    new THREE.Vector3(-0.035, height * 0.62, -0.015),
    new THREE.Vector3(0.02, height, 0)
  ]);

  const geometry = new THREE.TubeGeometry(
    curve,
    32,
    0.035, //number of segments in the curve
    12, //ray
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

export function createPlant(position, options = {}) {
  const {
    flowerColor = 0xf2a0c4
  } = options;
  const group = new THREE.Group();

  group.position.copy(position);
  group.position.y += 0.08;

  //Scaling the plant by 135%
  group.scale.setScalar(1.35);

  //------------Wind movement settings----------------
  //The whole plant moves with the wind as a whole
  //This happens in storm mode
  const windMovement = new THREE.Group();
  group.add(windMovement);

  const stem = createStem(1.5);
  stem.scale.set(1, 0.01, 1);
  windMovement.add(stem);

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
  windMovement.add(leafLeft);

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
  windMovement.add(leafRight);

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
  windMovement.add(leafFront);

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
  windMovement.add(leafBack);

  const flower = createFlower({
    //petalColor: 0xf2a0c4,
    petalColor: flowerColor,
    sepalColor: flowerColor,
    throatColor: 0xffd35a
  });

  flower.position.set(0.03, 1.5, 0.02);
  flower.rotation.set(-0.18, 0.15, 0.05);
  windMovement.add(flower);


  group.userData = {
    growth: 0, //growth starts at 0

    //Global wind of the plant
    windMovement,
    baseWindRotation: windMovement.rotation.clone(),
    windPhase: Math.random() * Math.PI * 2, //Casual phase for the wind -- to not have same oscillations

    stem,
    leaves: [leafLeft, leafRight, leafFront, leafBack],
    flower,

    //For plant growth 
    baseStemRotation: stem.rotation.clone(),

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

  updatePlantGrowth(group, 0); //initial state of the plant

  return group;
}

export function updatePlantGrowth(plant, growth) {
  const data = plant.userData;

  data.growth = THREE.MathUtils.clamp(growth, 0, 1);

  const g = data.growth;

  //Stem --- grows from 0 to 0.55 in the growth scale
  const stemGrowth = smoothstep(0.0, 0.55, g);
  data.stem.scale.y = Math.max(0.01, stemGrowth);

  //Applying the height growth to the stem
  data.stem.rotation.z =
    data.baseStemRotation.z +
    Math.sin(g * Math.PI) * 0.025;

  data.stem.rotation.x = data.baseStemRotation.x;

  //Leafs --- growth steps for each leaf
  const leafGrowths = [
    smoothstep(0.20, 0.50, g),
    smoothstep(0.32, 0.65, g),
    smoothstep(0.48, 0.80, g),
    smoothstep(0.62, 0.90, g)
  ];

  data.leaves.forEach((leaf, index) => {
    const lg = leafGrowths[index];

    //leaf becomes visible only when its growth has started
    leaf.visible = lg > 0.02;

    const baseScale = data.baseLeafScales[index];

    leaf.scale.set(
      baseScale.x * Math.max(0.01, lg),
      baseScale.y * Math.max(0.01, lg),
      baseScale.z * Math.max(0.01, lg)
    ); //Scales the leaf from small to big (simulating growth)

    //At first the leaf is a bit closer and then it opes up
    const finalRot = data.baseLeafRotations[index];

    leaf.rotation.x = finalRot.x + (1.0 - lg) * 0.45;
    leaf.rotation.y = finalRot.y;
    leaf.rotation.z = finalRot.z * lg; //z-rotation happens gradually
  });

  //Flower --- in the final growth step
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
  lightningIntensity = 0,
  stormWind = 0,
  isNight = false
) {
  const currentGrowth = plant.userData.growth;

  if (currentGrowth < 1) {
    const nextGrowth =
      currentGrowth + deltaTime * 0.08 * growthSpeed;

    updatePlantGrowth(plant, nextGrowth);
  }

  const data = plant.userData;

  //----- Global wind -----
 //stormWind:  0 = vento normale  1 = tempesta

  const windAmount = stormWind > 0 ? 0.07 : 0.008; // if we have the storm the wind is strong
  const windSpeed = stormWind > 0 ? 2.4 : 0.8; //if we have the storm the wind is faster

  //if the plant has not grown it is less affected by wind
  const growthMask = data.growth;

  //Main oscillations on z-axis
  const swayZ =
    Math.sin(elapsedTime * windSpeed + data.windPhase) *
    windAmount *
    growthMask;

  //Second oscillation x-axis
  const swayX =
    Math.sin(
      elapsedTime * windSpeed * 0.72 +
      data.windPhase * 1.4
    ) *
    windAmount *
    0.45 *
    growthMask; //slower

  data.windMovement.rotation.z =
    data.baseWindRotation.z + swayZ;

  data.windMovement.rotation.x =
    data.baseWindRotation.x + swayX;


  for (const leaf of data.leaves) {
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
    data.flower,
    elapsedTime,
    cursorPosition,
    fireflyPositions,
    lightningIntensity
  );

  return data.growth < 1;
}