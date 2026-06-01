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
import { updateRainCollisions } from "./scene/rainCollision.js";
import { createLightning } from "./scene/createLightning.js";

const canvas = document.querySelector("#webgl");

const { scene, ambientLight } = createScene();

const { groundGroup, topSurface } = createGround(5);
scene.add(groundGroup);

const wetGround = createWetGround({
  radius: 5,
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

const lightning = createLightning();
scene.add(lightning.group);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const cursorPosition = new THREE.Vector3(999, 999, 999);
const leafCursorPosition = new THREE.Vector3(999, 999, 999);

const floatingSeedPlane = new THREE.Plane(
  new THREE.Vector3(0, 1, 0),
  -1.6
);

const floatingSeedPosition = new THREE.Vector3();

const grass = createGrass({
  radius: 4.75,
  bladeCount: 16000
});

scene.add(grass);

const seedPlacement = createSeedPlacement();

scene.add(seedPlacement.group);
scene.add(seedPlacement.plantedSeeds);

const plantsGroup = new THREE.Group();
scene.add(plantsGroup);

const plants = [];
const interactiveLeafMeshes = [];

const lightBeam = createLightBeam();
scene.add(lightBeam.group);

const airParticles = createAirParticles({ count: 420 });
scene.add(airParticles);

const firefliesSystem = createFireflies({
  count: 25,
  trailLength: 14
});

scene.add(firefliesSystem.group);

const MAX_SHADER_FIREFLIES = 8;

const fireflyShaderPositions = Array.from(
  { length: MAX_SHADER_FIREFLIES },
  () => new THREE.Vector3(999, 999, 999)
);

const plantWorldPosition = new THREE.Vector3();
const fireflyWorldPosition = new THREE.Vector3();

let isNight = false;

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

/**
 * UI: day/night toggle.
 */
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

/**
 * UI: seed button.
 */
const seedButton = document.querySelector("#seedButton");

if (seedButton) {
  seedButton.addEventListener("click", () => {
    seedPlacement.startPlacement();
    seedButton.classList.add("active");
  });
}

/**
 * UI: storm/rain button.
 * Puoi continuare a usare id="waterButton".
 */
const waterButton = document.querySelector("#waterButton");

if (waterButton) {
  waterButton.addEventListener("click", () => {
    storm.toggle();
    rain.setActive(storm.state.enabled);

    waterButton.classList.toggle("active", storm.state.enabled);

    waterButton.textContent = storm.state.enabled
      ? "Stop Storm"
      : "Start Storm";
  });
}

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

/**
 * Click per piantare il seme.
 */
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
  if (!seedPlacement.state.isPlacing) return;

  if (event.key === "Escape") {
    seedPlacement.cancelPlacement();

    if (seedButton) {
      seedButton.classList.remove("active");
    }
  }

  if (event.key === "Enter" || event.key === " ") {
    const plantedSeed = seedPlacement.dropSeed();

    if (plantedSeed && seedButton) {
      seedButton.classList.remove("active");
    }
  }
});

const growthControls = document.querySelector("#growthControls");
const growthSpeedSlider = document.querySelector("#growthSpeedSlider");
const growthSpeedValue = document.querySelector("#growthSpeedValue");

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

const clock = new THREE.Clock();

function animate() {
  const deltaTime = clock.getDelta();
  const elapsedTime = clock.getElapsedTime();

  storm.update(deltaTime, elapsedTime);

  /**
   * Atmosfera più scura quando piove.
   * Non sovrascrive il night mode, ma lo combina.
   */
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
    );
  }

  raycaster.setFromCamera(mouse, camera);

  /**
   * Raycast foglie/petali.
   */
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

  /**
   * Preview seme sospeso.
   */
  if (seedPlacement.state.isPlacing) {
    raycaster.ray.intersectPlane(
      floatingSeedPlane,
      floatingSeedPosition
    );

    seedPlacement.updatePreviewFloating(
      floatingSeedPosition
    );
  }

  /**
   * Raycast sul ground.
   */
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

  /**
   * Pioggia + collisioni + terreno bagnato.
   */
  rain.update(deltaTime, elapsedTime, storm.state);

  updateRainCollisions({
    rainSystem: rain,
    wetGround,
    interactiveMeshes: interactiveLeafMeshes,
    groundRadius: 4.75,
    rainIntensity: storm.state.rainIntensity
  });

  wetGround.update(deltaTime, storm.state.rainIntensity);

  

  animateGrass(grass, elapsedTime, cursorPosition);
  animateAirParticles(airParticles, elapsedTime, isNight);

  animateFireflies(
    firefliesSystem,
    elapsedTime,
    isNight,
    interactiveLeafMeshes
  );

  const settledSeeds =
    seedPlacement.updateFallingSeeds(deltaTime);

  for (const settled of settledSeeds) {
    const plant = createPlant(settled.position);

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
const isRaining = storm.state.enabled && storm.state.rainIntensity > 0.05;

const lightningIntensity = lightning.update(
  deltaTime,
  isRaining
);

let hasGrowingPlant = false;

for (const plant of plants) {
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
    lightningIntensity
  );

  if (isStillGrowing) {
    hasGrowingPlant = true;
  }
}

if (growthControls) {
  if (hasGrowingPlant) {
    growthControls.classList.remove("hidden");
  } else {
    growthControls.classList.add("hidden");
  }
}



  controls.update();
  renderer.render(scene, camera);

  requestAnimationFrame(animate);
}

animate();