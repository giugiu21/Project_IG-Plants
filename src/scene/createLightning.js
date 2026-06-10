import * as THREE from "three";
import { smoothstep } from "../utils/smoothStep.js";

/*This file handle the lightining strike during the storm mode
    It creates:
      - zig-zag geometry fot the strike
      - intense directional lightning 
      - point lightning to create the flash effect
      - update() function to decide when to strike the next lighting
      - triggerStrike() function to force the new strike

*/

function createLightningBoltGeometry() {
  const points = [];

  //choosing the starting point
  const start = new THREE.Vector3(
    THREE.MathUtils.randFloatSpread(5),
    7,
    THREE.MathUtils.randFloatSpread(3) - 1
  );

  //choosing the end point
  const end = new THREE.Vector3(
    start.x + THREE.MathUtils.randFloatSpread(1.6),
    2.2,
    start.z + THREE.MathUtils.randFloatSpread(1.2)
  );

  //dividing the strike in 9 segments to better compute the movement from start to end
  const segments = 9;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;

    const point = new THREE.Vector3().lerpVectors(start, end, t);

    //to add irregularity depends on t
    const chaos = 0.28 * (1.0 - Math.abs(t - 0.5));
    point.x += THREE.MathUtils.randFloatSpread(chaos);
    point.z += THREE.MathUtils.randFloatSpread(chaos);

    points.push(point);
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);

  return geometry;
}

export function createLightning() {
  const group = new THREE.Group();

  //new directional light of the flash
  const flashLight = new THREE.DirectionalLight(0xcfe6ff, 0);
  flashLight.position.set(-3, 7, 4);
  flashLight.target.position.set(0, 0, 0);

  group.add(flashLight);
  group.add(flashLight.target);

  //to add a more blurred lighting in between
  const ambientFlash = new THREE.PointLight(0xbfdcff, 0, 12, 1.4);
  ambientFlash.position.set(0, 4.5, 2);
  group.add(ambientFlash);

  const boltMaterial = new THREE.LineBasicMaterial({
    color: 0xeaf4ff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const bolt = new THREE.Line(
    createLightningBoltGeometry(),
    boltMaterial
  );

  //visibility state
  bolt.visible = false;
  group.add(bolt);

  const state = {
    intensity: 0,
    targetIntensity: 0,

    timer: 0,
    nextStrike: THREE.MathUtils.randFloat(4, 9),

    strikeDuration: 0,
    maxStrikeDuration: 0.16,

    isStriking: false
  };


  //manually triggering the next lighting strike
  function triggerStrike() {
    bolt.geometry.dispose();
    bolt.geometry = createLightningBoltGeometry();

    bolt.visible = true;

    state.isStriking = true;
    state.strikeDuration = 0;

    state.targetIntensity = 1;

    flashLight.position.set(
      THREE.MathUtils.randFloat(-4, 4),
      7,
      THREE.MathUtils.randFloat(2, 5)
    );

    ambientFlash.position.copy(flashLight.position);
  }


  function update(deltaTime, isStormActive = false) {
    //if we don't have a storm we don't animate
    if (!isStormActive) {
      state.timer = 0;
      state.intensity = THREE.MathUtils.lerp(state.intensity, 0, 0.18);
      state.targetIntensity = 0;

      flashLight.intensity = state.intensity * 0;
      ambientFlash.intensity = state.intensity * 0;
      bolt.material.opacity = 0;
      bolt.visible = false;

      return state.intensity;
    }

    state.timer += deltaTime;

    if (!state.isStriking && state.timer > state.nextStrike) {
      triggerStrike();

      state.timer = 0;
      state.nextStrike = THREE.MathUtils.randFloat(3.5, 8.5);
    }

    if (state.isStriking) {
      state.strikeDuration += deltaTime;

      const t = state.strikeDuration / state.maxStrikeDuration;

      let flash;

      if (t < 0.25) {
        flash = 1.0;
      } else if (t < 0.48) {
        flash = 0.15;
      } else if (t < 0.65) {
        flash = 0.8;
      } else {
        flash = 1.0 - smoothstep(0.65, 1.0, t);
      }

      state.intensity = flash;

      if (t >= 1.0) {
        state.isStriking = false;
        state.targetIntensity = 0;
        bolt.visible = false;
      }
    } else {
      state.intensity = THREE.MathUtils.lerp(state.intensity, 0, 0.12);
    }

    flashLight.intensity = state.intensity * 7.5;
    ambientFlash.intensity = state.intensity * 5.0;

    bolt.material.opacity = state.intensity;
    bolt.visible = state.intensity > 0.03;

    return state.intensity;
  }

  return {
    group,
    flashLight,
    ambientFlash,
    bolt,
    state,
    update,
    triggerStrike
  };
}



