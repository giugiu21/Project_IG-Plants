import * as THREE from "three";

export function createStormController() {
  const state = {
    enabled: false,

    // Valori morbidi, non on/off secco
    rainIntensity: 0,
    windStrength: 0.15,
    targetWindStrength: 0.15,

    // Direzione vento sul piano XZ
    windDirection: new THREE.Vector2(0.55, 0.18).normalize(),

    // Per futuro lightning
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

  function update(deltaTime, elapsedTime) {
    const targetRain = state.enabled ? 1 : 0;

    state.rainIntensity = THREE.MathUtils.lerp(
      state.rainIntensity,
      targetRain,
      deltaTime * 1.6
    );

    state.skyDarkness = THREE.MathUtils.lerp(
      state.skyDarkness,
      state.enabled ? 1 : 0,
      deltaTime * 0.9
    );

    const gust =
      Math.sin(elapsedTime * 0.65) * 0.16 +
      Math.sin(elapsedTime * 1.7) * 0.06;

    state.windStrength = THREE.MathUtils.lerp(
      state.windStrength,
      state.targetWindStrength + gust * state.rainIntensity,
      deltaTime * 1.2
    );

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