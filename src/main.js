import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { createScene } from "./scene/createScene.js";
import { createGround } from "./scene/createGround.js";
import { createGrass, animateGrass } from "./scene/createGrass.js";
import { createLightBeam, updateLightBeam } from "./scene/createLightBeam.js";
import { createAirParticles, animateAirParticles } from "./scene/createAirParticles.js";
import { createFireflies, animateFireflies } from "./scene/createFireflies.js";
import { createSeedPlacement } from "./scene/createSeedPlacement.js";
import { createPlant, animatePlant } from "./scene/createPlant.js";

import { createStormController } from "./scene/createStormController.js";
import { createRain } from "./scene/createRain.js";
import { createWetGround } from "./scene/createWetGround.js";
import { createLightning } from "./scene/createLightning.js";
import { createPlantDroplets } from "./scene/createPlantDroplets.js";

import { createButterfly, animateButterfly } from "./scene/createButterfly.js";


const canvas = document.querySelector("#webgl");

//Creating the Scene
const { scene, ambientLight } = createScene();

//adding the ground
const { groundGroup, topSurface } = createGround(5);
scene.add(groundGroup);

//Grass Creation
const grass = createGrass({
  radius: 4.75,
  bladeCount: 16000
});
scene.add(grass);

//adding the light beam
const lightBeam = createLightBeam();
scene.add(lightBeam.group);

//adding the air particles
const airParticles = createAirParticles({ count: 420 });
scene.add(airParticles);

//-------Settings for Storm mode----------
const wetGround = createWetGround({
  radius: 4.75,
  y: 0.024
});
scene.add(wetGround.mesh);
const storm = createStormController();

const rain = createRain({
  count: 1200,
  radius: 4.75,
  height: 7.0
});
scene.add(rain.group);

const plantDroplets = createPlantDroplets({
  count: 200,
  groundRadius: 4.75,
  spawnHeight: 6.2,
  groundY: 0.03,
  windOffset: new THREE.Vector2(-0.75, 0.08)
});
scene.add(plantDroplets.group);

const lightning = createLightning();
scene.add(lightning.group);

// Cold lighting for droplets reflection
const rainReflectionLight = new THREE.DirectionalLight(
  0xbfdfff,
  0.15
);

rainReflectionLight.position.set(-3.0, 5.5, 2.0);
scene.add(rainReflectionLight);

const lightningFillLight = new THREE.PointLight(
  0xddeeff,
  0,
  12,
  1.6
);

lightningFillLight.position.set(-2.8, 4.8, 1.6);
scene.add(lightningFillLight);

//Adding a raycaster and mouse/cursor for interaction/movement in the environment
const raycaster = new THREE.Raycaster(); //allows the collision of objects
const mouse = new THREE.Vector2();

const cursorPosition = new THREE.Vector3(999, 999, 999);
const leafCursorPosition = new THREE.Vector3(999, 999, 999);

//Seed Settings for Planting mode
const floatingSeedPlane = new THREE.Plane(
  new THREE.Vector3(0, 1, 0),
  -1.6
);
const floatingSeedPosition = new THREE.Vector3();

const seedPlacement = createSeedPlacement();

scene.add(seedPlacement.group);
scene.add(seedPlacement.plantedSeeds);

//Plant
const plantsGroup = new THREE.Group();
scene.add(plantsGroup);

const plants = [];
const interactiveLeafMeshes = [];

//Butterfly
const butterflySystem = createButterfly({
  radius: 4.0
});
scene.add(butterflySystem.group);

//Fireflies for night mode
const firefliesSystem = createFireflies({
  count: 25,
  trailLength: 14
});
scene.add(firefliesSystem.group);

const MAX_SHADER_FIREFLIES = 8; //this is used for the interactive custom glow on leaves and flowers

const fireflyShaderPositions = Array.from(
  { length: MAX_SHADER_FIREFLIES },
  () => new THREE.Vector3(999, 999, 999)
);

//Settings for lighting at night when fireflies are close
const plantWorldPosition = new THREE.Vector3();
const fireflyWorldPosition = new THREE.Vector3();

let isNight = false;

//Returns the positions of the 8 closest fireflies to the plants
function updateFireflyShaderPositionsForPlant(plant) {
  if (!isNight) {
    return [];
  }

  const lights =
    firefliesSystem.lights ||
    firefliesSystem.group.userData.lights ||
    [];

  if (lights.length === 0) {
    return [];
  }

  plant.getWorldPosition(plantWorldPosition);
  plantWorldPosition.y += 1.0;

  const sortedLights = lights
    .map((light) => {
      light.getWorldPosition(fireflyWorldPosition);

      return {
        light,
        distance: fireflyWorldPosition.distanceToSquared(
          plantWorldPosition
        )
      };
    })
    .sort((a, b) => a.distance - b.distance);

  for (let i = 0; i < MAX_SHADER_FIREFLIES; i++) {
    if (sortedLights[i]) {
      sortedLights[i].light.getWorldPosition(
        fireflyShaderPositions[i]
      );
    } else {
      fireflyShaderPositions[i].set(999, 999, 999);
    }
  }

  return fireflyShaderPositions;
}

//------------------ UI modelling-------------
//Day and night toggle
const nightToggle = document.querySelector("#nightToggle");

if (nightToggle) {
  nightToggle.addEventListener("change", () => {
    isNight = nightToggle.checked;

    updateLightBeam(lightBeam, isNight);

    scene.background = new THREE.Color(
      isNight ? 0x07111f : 0x87ceeb
    );
  });
}

// Plant seed button
const seedButton = document.querySelector("#seedButton");
const flowerColorPicker = document.querySelector("#flowerColorPicker");
const resetFlowerColorButton = document.querySelector("#resetFlowerColorButton");
const confirmFlowerColorButton = document.querySelector("#confirmFlowerColorButton");
const cancelFlowerColorButton = document.querySelector("#cancelFlowerColorButton");
const flowerColorMenu = document.querySelector("#flowerColorMenu");
const DEFAULT_FLOWER_COLOR_HEX = "#f2a0c4";

let selectedFlowerColor = 0xf2a0c4;

if (seedButton) {
  seedButton.addEventListener("click", () => {
    if (flowerColorMenu) {
      flowerColorMenu.classList.remove("hidden");
    }
    if (flowerColorPicker) {
      flowerColorPicker.value = DEFAULT_FLOWER_COLOR_HEX;
    }

    selectedFlowerColor = 0xf2a0c4;

    seedButton.classList.add("active");
  });
}

if (resetFlowerColorButton) {
  resetFlowerColorButton.addEventListener("click", () => {
    if (flowerColorPicker) {
      flowerColorPicker.value = DEFAULT_FLOWER_COLOR_HEX;
    }

    selectedFlowerColor = 0xf2a0c4;
  });
}

if (confirmFlowerColorButton) {
  confirmFlowerColorButton.addEventListener("click", () => {
    selectedFlowerColor = flowerColorPicker
      ? Number(flowerColorPicker.value.replace("#", "0x"))
      : 0xf2a0c4;

    if (flowerColorMenu) {
      flowerColorMenu.classList.add("hidden");
    }

    seedPlacement.startPlacement();
  });
}

if (cancelFlowerColorButton) {
  cancelFlowerColorButton.addEventListener("click", () => {
    if (flowerColorMenu) {
      flowerColorMenu.classList.add("hidden");
    }

    if (flowerColorPicker) {
      flowerColorPicker.value = DEFAULT_FLOWER_COLOR_HEX;
    }

    selectedFlowerColor = DEFAULT_FLOWER_COLOR;

    if (seedButton) {
      seedButton.classList.remove("active");
    }

    if (seedPlacement.state.isPlacing) {
      seedPlacement.clearGroundTarget();
      seedPlacement.state.isPlacing = false;
    }
  });
}

// Storm mode button
const stormButton = document.querySelector("#stormButton");

if (stormButton) {
  stormButton.addEventListener("click", () => {
    storm.toggle();

    rain.setActive(storm.state.enabled);
    plantDroplets.setActive(storm.state.enabled);

    stormButton.classList.toggle(
      "active",
      storm.state.enabled
    );

    stormButton.textContent = storm.state.enabled
      ? "Stop Storm"
      : "Start Storm";
  });
}

//----------Camera settings-------
//normal view
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight
};

const camera = new THREE.PerspectiveCamera(
  45,
  sizes.width / sizes.height,
  0.1,
  100
);

camera.position.set(0, 5.5, 8);
scene.add(camera);

//Butterfly view
let isButterflyView = false;

const normalCameraPosition = new THREE.Vector3();
const normalControlsTarget = new THREE.Vector3();

const butterflyCameraOffset = new THREE.Vector3(0, 0, -0.16);
const butterflyLookOffset = new THREE.Vector3(0, -0.5, -0.9);

const butterflyCameraWorldPosition = new THREE.Vector3();
const butterflyLookWorldPosition = new THREE.Vector3();

//----------Renderer definition--------
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true
});

renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(
  Math.min(window.devicePixelRatio, 2)
);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

//-----------Controls------------
const controls = new OrbitControls(camera, canvas);

controls.enableDamping = true;
controls.dampingFactor = 0.06;

controls.target.set(0, 0.3, 0);

controls.maxPolarAngle = Math.PI * 0.48;

controls.enableZoom = true;
controls.minDistance = 2.2;
controls.maxDistance = 14;
controls.zoomSpeed = 0.8;

window.addEventListener("resize", () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
  );
});

window.addEventListener("mousemove", (event) => {
  mouse.x =
    (event.clientX / window.innerWidth) * 2 - 1;

  mouse.y =
    -(event.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener("click", (event) => {
  if (!seedPlacement.state.isPlacing) return;

  const clickedOnUI = event.target.closest("#ui");

  if (clickedOnUI) return;

  const plantedSeed = seedPlacement.dropSeed();

  if (plantedSeed && seedButton) {
    seedButton.classList.remove("active");
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() !== "s") return;

  isButterflyView = !isButterflyView;

  if (isButterflyView) {
    normalCameraPosition.copy(camera.position);
    normalControlsTarget.copy(controls.target);

    camera.fov = 45;
    camera.updateProjectionMatrix();

    controls.enabled = false;
  } else {
    camera.position.copy(normalCameraPosition);
    controls.target.copy(normalControlsTarget);

    camera.fov = 45;
    camera.updateProjectionMatrix();

    controls.enabled = true;
    controls.update();
  }
  updateSwitchModeHint(
    storm.state.enabled && storm.state.rainIntensity > 0.05
  );
});

const growthControls = document.querySelector("#growthControls");
const growthSpeedSlider = document.querySelector("#growthSpeedSlider");
const growthSpeedValue = document.querySelector("#growthSpeedValue");
const switchModeHint = document.querySelector("#switchModeHint");

let growthSpeed = 1;

if (growthSpeedSlider) {
  growthSpeedSlider.addEventListener("input", (event) => {
    growthSpeed = Number(event.target.value);

    if (growthSpeedValue) {
      growthSpeedValue.textContent =
        `${growthSpeed.toFixed(1)}x`;
    }
  });
}

function updateSwitchModeHint(isRaining) {
  if (!switchModeHint) return;

  switchModeHint.classList.toggle("hidden", isRaining);

  const text = switchModeHint.querySelector("h4");

  if (text) {
    text.textContent = isButterflyView
      ? "Press S to exit butterfly view"
      : "Press S to enter butterfly view";
  }
}

function updateButterflyCamera(deltaTime) {
  if (!isButterflyView) return;

  const butterfly = butterflySystem?.butterfly;

  const isRaining =
    storm.state.enabled &&
    storm.state.rainIntensity > 0.05;

  if (isRaining) {
    isButterflyView = false;

    camera.position.copy(normalCameraPosition);
    controls.target.copy(normalControlsTarget);

    camera.fov = 45;
    camera.updateProjectionMatrix();

    controls.enabled = true;
    controls.update();

    updateSwitchModeHint(isRaining);

    return;
  }

  if (!butterfly || !butterfly.visible) {
    return;
  }

  //Camera's positions in butterfly reference frame
  butterflyCameraWorldPosition.copy(butterflyCameraOffset).applyQuaternion(butterfly.quaternion).add(butterfly.position);

  //look out point
  butterflyLookWorldPosition.copy(butterflyLookOffset).applyQuaternion(butterfly.quaternion).add(butterfly.position);

  camera.position.lerp(
    butterflyCameraWorldPosition,
    1.0 - Math.exp(-deltaTime * 8.0)
  );

  camera.lookAt(butterflyLookWorldPosition);
}

//---------------Animations Settings-----------
const clock = new THREE.Clock();

function animate() {
  const deltaTime = clock.getDelta();
  const elapsedTime = clock.getElapsedTime();

  storm.update(deltaTime, elapsedTime);
  const baseGrassWind = 0.28;
  const stormGrassWind = 0.45;

  grass.material.uniforms.uWindStrength.value = THREE.MathUtils.lerp(
    baseGrassWind,
    stormGrassWind,
    storm.state.rainIntensity
  );


  const isRaining =
    storm.state.enabled &&
    storm.state.rainIntensity > 0.05;

  updateSwitchModeHint(isRaining);

  const lightningIntensity = lightning.update(
    deltaTime,
    isRaining
  );

  //Darker mode if it is raining during the day
  if (!isNight) {
    const dayColor = new THREE.Color(0x87ceeb);
    const stormColor = new THREE.Color(0x5f7482);

    scene.background = dayColor.lerp(
      stormColor,
      storm.state.skyDarkness * 0.75
    );
  }

  if (ambientLight) {
    ambientLight.intensity = THREE.MathUtils.lerp(
      1.0,
      0.45,
      storm.state.skyDarkness
    ) + lightningIntensity * 0.65;
  }

  //Droplets reflections 
  rainReflectionLight.intensity =
    THREE.MathUtils.lerp(
      0.15,
      0.65,
      storm.state.rainIntensity
    ) + lightningIntensity * 1.2;

  lightningFillLight.intensity = lightningIntensity * 4.5;

  raycaster.setFromCamera(mouse, camera);

  // Raycast leaf petals.
  leafCursorPosition.set(999, 999, 999);

  if (interactiveLeafMeshes.length > 0) {
    const leafIntersects = raycaster.intersectObjects(
      interactiveLeafMeshes,
      false
    );

    if (leafIntersects.length > 0) {
      leafCursorPosition.copy(leafIntersects[0].point);
    }
  }

  //Suspended seed preview before planting
  if (seedPlacement.state.isPlacing) {
    raycaster.ray.intersectPlane(
      floatingSeedPlane,
      floatingSeedPosition
    );

    seedPlacement.updatePreviewFloating(
      floatingSeedPosition
    );
  }

  //Ground Raycast
  const intersects = raycaster.intersectObject(topSurface);

  if (intersects.length > 0) {
    cursorPosition.copy(intersects[0].point);

    if (seedPlacement.state.isPlacing) {
      seedPlacement.updateGroundTarget(cursorPosition);
    }
  } else {
    cursorPosition.set(999, 999, 999);

    if (seedPlacement.state.isPlacing) {
      seedPlacement.clearGroundTarget();
    }
  }

  //Rain settings
  rain.update(deltaTime, elapsedTime, storm.state);

  //Physical droplets hitting the leafs/petals

  plantDroplets.update({
    deltaTime,
    stormState: storm.state,
    collisionMeshes: interactiveLeafMeshes,
    lightningIntensity
  });

//Updating the wet ground
  wetGround.update(
    deltaTime,
    storm.state.rainIntensity
  );

  //Animations of the elements
  animateGrass(grass, elapsedTime, cursorPosition);
  animateAirParticles(airParticles, elapsedTime, isNight);

  animateFireflies(
    firefliesSystem,
    elapsedTime,
    isNight,
    interactiveLeafMeshes
  );

  //Creating the plant when the seed drops
  const settledSeeds =
    seedPlacement.updateFallingSeeds(deltaTime);

  for (const settled of settledSeeds) {
    const plant = createPlant(settled.position, {
      flowerColor: selectedFlowerColor
    });

    plants.push(plant);
    plantsGroup.add(plant);

    for (const leaf of plant.userData.leaves) {
      if (leaf.userData.leafMesh) {
        interactiveLeafMeshes.push(leaf.userData.leafMesh);
      }
    }

    if (
      plant.userData.flower &&
      plant.userData.flower.userData &&
      plant.userData.flower.userData.petals
    ) {
      for (const petal of plant.userData.flower.userData.petals) {
        interactiveLeafMeshes.push(petal);
      }
    }
  }

  let hasGrowingPlant = false;

  const stormWind = storm.state.enabled ? 1 : 0;

  const baseLeafWind = 0.045;
  const stormLeafWind = 0.25;

  //Animation of the plant growth
  for (const plant of plants) {

    const leafWind = THREE.MathUtils.lerp(
      baseLeafWind,
      stormLeafWind,
      storm.state.rainIntensity
    );

    for (const leaf of plant.userData.leaves) {
      if (leaf.userData?.material?.uniforms?.uWindStrength) {
        leaf.userData.material.uniforms.uWindStrength.value = leafWind;
      }
    }

    const currentFireflyPositions =
      updateFireflyShaderPositionsForPlant(plant);

    const isStillGrowing = animatePlant(
      plant,
      deltaTime,
      elapsedTime,
      growthSpeed,
      leafCursorPosition,
      currentFireflyPositions,
      storm.state.rainIntensity,
      lightningIntensity, 
      stormWind,
      isNight
    );

    if (isStillGrowing) {
      hasGrowingPlant = true;
    }
  }

  animateButterfly(
    butterflySystem,
    deltaTime,
    elapsedTime,
    {
      isNight,
      plants, 
      isRaining
    }
  );


  //UI control of the speed of growth slider
  if (growthControls) {
    if (hasGrowingPlant) {
      growthControls.classList.remove("hidden");
    } else {
      growthControls.classList.add("hidden");
    }
  }

  if (isButterflyView) {
    updateButterflyCamera(deltaTime);
  } else {
    controls.update();
  }

  renderer.render(scene, camera);

  requestAnimationFrame(animate);
}

animate();