import * as THREE from "three";

function randomInDisk(radius) {
  const r = Math.sqrt(Math.random()) * radius;
  const a = Math.random() * Math.PI * 2;

  return {
    x: Math.cos(a) * r,
    z: Math.sin(a) * r
  };
}

function createRainMaterial() {
  return new THREE.LineBasicMaterial({
    color: 0xbfdcff,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
}

function createSplashMaterial() {
  return new THREE.MeshBasicMaterial({
    color: 0xcfeeff,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
}

export function createRain({
  count = 1200,
  radius = 4.75,
  height = 7.0,
  groundY = 0,
  splashCount = 90
} = {}) {
  const group = new THREE.Group();

  const state = {
    active: false,
    intensity: 0,
    targetIntensity: 0
  };

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 6);

  const drops = [];

  for (let i = 0; i < count; i++) {
    const p = randomInDisk(radius);

    const position = new THREE.Vector3(
      p.x,
      Math.random() * height,
      p.z
    );

    const previous = position.clone();

    const drop = {
      position,
      previous,
      speed: 5.5 + Math.random() * 4.5,
      length: 0.12 + Math.random() * 0.16,
      drift: new THREE.Vector2(
        (Math.random() - 0.5) * 0.12,
        (Math.random() - 0.5) * 0.12
      )
    };

    drops.push(drop);

    const ix = i * 6;

    positions[ix + 0] = position.x;
    positions[ix + 1] = position.y;
    positions[ix + 2] = position.z;

    positions[ix + 3] = position.x;
    positions[ix + 4] = position.y + drop.length;
    positions[ix + 5] = position.z;
  }

  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3)
  );

  const material = createRainMaterial();

  const rainLines = new THREE.LineSegments(geometry, material);
  rainLines.visible = false;
  group.add(rainLines);

  const splashPool = [];
  const splashMaterial = createSplashMaterial();

  for (let i = 0; i < splashCount; i++) {
    const splash = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 1.0, 24),
      splashMaterial.clone()
    );

    splash.rotation.x = -Math.PI / 2;
    splash.visible = false;

    splash.userData.life = 0;
    splash.userData.maxLife = 0.28 + Math.random() * 0.16;

    splashPool.push(splash);
    group.add(splash);
  }

  group.visible = false;

  function setActive(value) {
    state.active = value;
    state.targetIntensity = value ? 1 : 0;

    if (value) {
      group.visible = true;
    }
  }

  function resetDrop(index) {
    const drop = drops[index];
    const p = randomInDisk(radius);

    drop.position.set(
      p.x,
      height + Math.random() * 2.5,
      p.z
    );

    drop.previous.copy(drop.position);
  }

  function addSplash(position, strength = 1) {
    const distFromCenter = Math.sqrt(
      position.x * position.x +
      position.z * position.z
    );

    if (distFromCenter > radius) return;

    const splash = splashPool.find((s) => !s.visible);
    if (!splash) return;

    splash.visible = true;

    splash.position.set(
      position.x,
      groundY + 0.018,
      position.z
    );

    const size = THREE.MathUtils.lerp(0.04, 0.13, strength);
    splash.scale.setScalar(size);

    splash.material.opacity = 0.38 * strength * state.intensity;
    splash.userData.life = splash.userData.maxLife;
  }

  function update(deltaTime, elapsedTime, stormState = {}) {
    state.intensity = THREE.MathUtils.lerp(
      state.intensity,
      state.targetIntensity,
      deltaTime * 2.8
    );

    if (state.intensity < 0.01) {
      rainLines.visible = false;

      if (!state.active) {
        group.visible = false;
      }

      return;
    }

    rainLines.visible = true;
    group.visible = true;

    material.opacity = 0.72 * state.intensity;

    const windDirection =
      stormState.windDirection || new THREE.Vector2(0.45, 0.12);

    const windStrength = stormState.windStrength || 0;

    const windX = windDirection.x * windStrength;
    const windZ = windDirection.y * windStrength;

    for (let i = 0; i < drops.length; i++) {
      const drop = drops[i];

      drop.previous.copy(drop.position);

      drop.position.x +=
        (windX + drop.drift.x) * deltaTime * 1.8;

      drop.position.z +=
        (windZ + drop.drift.y) * deltaTime * 1.8;

      /**
       * Spostamento extra verso sinistra.
       * Se non lo vuoi, metti 0.0.
       */
      drop.position.x -= deltaTime * 1.2 * state.intensity;

      drop.position.y -=
        drop.speed *
        deltaTime *
        THREE.MathUtils.lerp(0.4, 1.0, state.intensity);

      const ix = i * 6;

      positions[ix + 0] = drop.position.x;
      positions[ix + 1] = drop.position.y;
      positions[ix + 2] = drop.position.z;

      positions[ix + 3] =
        drop.position.x - windX * drop.length * 0.45;

      positions[ix + 4] =
        drop.position.y + drop.length;

      positions[ix + 5] =
        drop.position.z - windZ * drop.length * 0.45;

      if (drop.position.y <= groundY) {
        addSplash(drop.position, state.intensity);
        resetDrop(i);
      }

      const distanceFromCenterSq =
        drop.position.x * drop.position.x +
        drop.position.z * drop.position.z;

      if (distanceFromCenterSq > radius * radius * 1.35) {
        resetDrop(i);
      }
    }

    geometry.attributes.position.needsUpdate = true;

    for (const splash of splashPool) {
      if (!splash.visible) continue;

      splash.userData.life -= deltaTime;

      const t =
        1.0 - splash.userData.life / splash.userData.maxLife;

      splash.scale.multiplyScalar(1.0 + deltaTime * 3.8);

      splash.material.opacity =
        (1.0 - t) * 0.36 * state.intensity;

      if (splash.userData.life <= 0) {
        splash.visible = false;
      }
    }
  }

  return {
    group,
    rainLines,
    geometry,
    material,
    positions,
    drops,
    splashPool,
    state,
    radius,
    height,
    groundY,
    setActive,
    update,
    resetDrop,
    addSplash
  };
}