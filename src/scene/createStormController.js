import * as THREE from "three";

/*This file controles the storm mode and intensity*/

/*creates an object that has:
    -state of the storm
    - on/off function
    - toggle function
    - update for each frame
*/
export function createStormController() {
  const state = {
    enabled: false,

    //Smoother transition from on/off
    rainIntensity: 0,
    windStrength: 0.15,
    targetWindStrength: 0.15,

    // Direction on the XY plane
    windDirection: new THREE.Vector2(0.55, 0.18).normalize(),

    lightningFlash: 0,
    skyDarkness: 0
  };

  function setEnabled(value) {
    state.enabled = value;
    state.targetWindStrength = value ? 0.75 : 0.15;
  }

  function toggle() {
    setEnabled(!state.enabled);
  }

  //updating the animation
  function update(deltaTime, elapsedTime) {
    const targetRain = state.enabled ? 1 : 0;

    //smooth transition between no rain and rain
    state.rainIntensity = THREE.MathUtils.lerp(
      state.rainIntensity,
      targetRain,
      deltaTime * 1.6
    );

    //smooth transition of the sky's color in day mode when raining
    state.skyDarkness = THREE.MathUtils.lerp(
      state.skyDarkness,
      state.enabled ? 1 : 0,
      deltaTime * 0.9
    );

    //periodic variation of the wind
    const gust =
      Math.sin(elapsedTime * 0.65) * 0.16 +
      Math.sin(elapsedTime * 1.7) * 0.06;

    //deciding the strength of the wind in storm mode
    state.windStrength = THREE.MathUtils.lerp(
      state.windStrength,
      state.targetWindStrength + gust * state.rainIntensity,
      deltaTime * 1.2
    );

    //decides how fast the lightining flash is
    state.lightningFlash = THREE.MathUtils.lerp(
      state.lightningFlash,
      0,
      deltaTime * 7.0
    );
  }

  return {
    state,
    setEnabled,
    toggle,
    update
  };
}