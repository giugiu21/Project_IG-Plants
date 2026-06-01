import * as THREE from "three";

const DOWN = new THREE.Vector3(0, -1, 0);

const TMP_ORIGIN = new THREE.Vector3();
const TMP_DIR = new THREE.Vector3();
const TMP_WORLD_NORMAL = new THREE.Vector3();
const TMP_TANGENT = new THREE.Vector3();
const TMP_POS = new THREE.Vector3();

const DEFAULT_NORMAL = new THREE.Vector3(0, 1, 0);

function randomPointInDisk(radius) {
  const r = Math.sqrt(Math.random()) * radius;
  const a = Math.random() * Math.PI * 2;

  return {
    x: Math.cos(a) * r,
    z: Math.sin(a) * r
  };
}

function createDropletMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xdff6ff,

    transparent: true,
    opacity: 0.72,

    roughness: 0.015,
    metalness: 0.0,

    transmission: 0.75,
    thickness: 0.12,
    ior: 1.333,

    clearcoat: 1.0,
    clearcoatRoughness: 0.01,

    reflectivity: 1.0,

    envMapIntensity: 1.7,

    emissive: new THREE.Color(0xbfdfff),
    emissiveIntensity: 0.03,

    depthWrite: false,
    depthTest: true
  });
}

function createFallingDropGeometry() {
  const geometry = new THREE.SphereGeometry(0.018, 12, 8);

  /**
   * Goccia allungata.
   * Non è una linea: è una piccola mesh fisica.
   */
  geometry.scale(0.72, 1.9, 0.72);

  return geometry;
}

function createSurfaceDropGeometry() {
  const geometry = new THREE.SphereGeometry(0.026, 18, 12);

  /**
   * Goccia schiacciata sulla superficie.
   */
  geometry.scale(1.0, 0.32, 1.0);

  return geometry;
}

function createTinyHighlight() {
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 48;

  const ctx = canvas.getContext("2d");

  const gradient = ctx.createRadialGradient(
    24,
    24,
    0,
    24,
    24,
    24
  );

  gradient.addColorStop(0.0, "rgba(255,255,255,1.0)");
  gradient.addColorStop(0.25, "rgba(220,245,255,0.75)");
  gradient.addColorStop(1.0, "rgba(220,245,255,0.0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 48, 48);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

export function createPlantDroplets({
  count = 90,
  groundRadius = 4.75,
  spawnHeight = 5.8,
  groundY = 0.02,
  windOffset = new THREE.Vector2(-0.7, 0.08)
} = {}) {
  const group = new THREE.Group();
  group.visible = false;

  const raycaster = new THREE.Raycaster();
  raycaster.far = spawnHeight + 1.0;

  const fallingGeometry = createFallingDropGeometry();
  const surfaceGeometry = createSurfaceDropGeometry();

  const highlightTexture = createTinyHighlight();

  const fallingDrops = [];
  const surfaceDrops = [];

  const fallingGroup = new THREE.Group();
  const surfaceGroup = new THREE.Group();

  group.add(fallingGroup);
  group.add(surfaceGroup);

  function createFallingDrop() {
    const material = createDropletMaterial();

    material.opacity = 0.48;
    material.emissiveIntensity = 0.025;

    const mesh = new THREE.Mesh(fallingGeometry, material);

    mesh.castShadow = false;
    mesh.receiveShadow = false;

    const highlight = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: highlightTexture,
        color: 0xffffff,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    highlight.scale.setScalar(0.035);
    highlight.position.set(0.006, 0.012, 0.006);

    mesh.add(highlight);

    mesh.userData = {
      velocity: new THREE.Vector3(),
      life: 1,
      highlight
    };

    return mesh;
  }

  function createSurfaceDrop() {
    const material = createDropletMaterial();

    material.opacity = 0.0;
    material.emissiveIntensity = 0.035;

    const mesh = new THREE.Mesh(surfaceGeometry, material);

    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.visible = false;

    const highlight = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: highlightTexture,
        color: 0xffffff,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    highlight.scale.setScalar(0.045);
    highlight.position.set(0.012, 0.012, 0.012);

    mesh.add(highlight);

    mesh.userData = {
      normal: new THREE.Vector3(0, 1, 0),
      slideVelocity: new THREE.Vector3(),
      life: 0,
      maxLife: 1,
      highlight
    };

    return mesh;
  }

  function resetFallingDrop(drop, forceTop = false) {
    const p = randomPointInDisk(groundRadius);

    drop.position.set(
      p.x,
      forceTop
        ? spawnHeight + Math.random() * 1.5
        : Math.random() * spawnHeight,
      p.z
    );

    drop.userData.velocity.set(
      windOffset.x * (0.35 + Math.random() * 0.45),
      -(3.8 + Math.random() * 2.5),
      windOffset.y * (0.35 + Math.random() * 0.45)
    );

    drop.userData.life = 1.0;
    drop.visible = true;
  }

  function activateSurfaceDrop(hit, sourceVelocity, rainIntensity = 1) {
    const surfaceDrop = surfaceDrops.find((drop) => !drop.visible);
    if (!surfaceDrop) return;

    surfaceDrop.visible = true;

    surfaceDrop.position.copy(hit.point);

    TMP_WORLD_NORMAL.copy(hit.face?.normal || DEFAULT_NORMAL);
    TMP_WORLD_NORMAL
      .transformDirection(hit.object.matrixWorld)
      .normalize();

    surfaceDrop.position.addScaledVector(TMP_WORLD_NORMAL, 0.014);

    surfaceDrop.quaternion.setFromUnitVectors(
      DEFAULT_NORMAL,
      TMP_WORLD_NORMAL
    );

    const size = 0.65 + Math.random() * 0.85;

    surfaceDrop.scale.set(
      size * (0.85 + Math.random() * 0.35),
      size,
      size * (0.85 + Math.random() * 0.35)
    );

    surfaceDrop.userData.normal.copy(TMP_WORLD_NORMAL);

    surfaceDrop.userData.life =
      THREE.MathUtils.lerp(0.8, 2.2, rainIntensity) +
      Math.random() * 1.2;

    surfaceDrop.userData.maxLife = surfaceDrop.userData.life;

    /**
     * Direzione di scivolamento:
     * proiettiamo la gravità sul piano tangente della foglia.
     */
    TMP_TANGENT.copy(DOWN).addScaledVector(
      TMP_WORLD_NORMAL,
      -DOWN.dot(TMP_WORLD_NORMAL)
    );

    if (TMP_TANGENT.lengthSq() < 0.0001) {
      TMP_TANGENT.set(
        sourceVelocity.x,
        0,
        sourceVelocity.z
      );
    }

    TMP_TANGENT.normalize();

    const slideSpeed = THREE.MathUtils.lerp(
      0.06,
      0.24,
      rainIntensity
    );

    surfaceDrop.userData.slideVelocity
      .copy(TMP_TANGENT)
      .multiplyScalar(slideSpeed + Math.random() * 0.08);

    /**
     * Bagna la mesh colpita.
     * Funziona con foglie e petali se lo shader legge userData.wetness.
     */
    hit.object.userData.wetness = Math.min(
      1,
      (hit.object.userData.wetness || 0) + 0.2
    );
  }

  for (let i = 0; i < count; i++) {
    const fallingDrop = createFallingDrop();

    resetFallingDrop(fallingDrop);

    fallingGroup.add(fallingDrop);
    fallingDrops.push(fallingDrop);
  }

  for (let i = 0; i < Math.floor(count * 0.8); i++) {
    const surfaceDrop = createSurfaceDrop();

    surfaceGroup.add(surfaceDrop);
    surfaceDrops.push(surfaceDrop);
  }

  function update({
    deltaTime,
    stormState,
    collisionMeshes = [],
    lightningIntensity = 0
  }) {
    const rainIntensity = stormState?.rainIntensity ?? 0;
    const windStrength = stormState?.windStrength ?? 0;

    group.visible = rainIntensity > 0.02;

    if (rainIntensity <= 0.02) {
      return;
    }

    const windDirection =
      stormState?.windDirection || new THREE.Vector2(-0.75, 0.1);

    const windX = windDirection.x * windStrength * 0.55;
    const windZ = windDirection.y * windStrength * 0.55;

    for (const drop of fallingDrops) {
      const velocity = drop.userData.velocity;

      TMP_POS.copy(drop.position);

      velocity.x += windX * deltaTime;
      velocity.z += windZ * deltaTime;

      drop.position.addScaledVector(
        velocity,
        deltaTime * THREE.MathUtils.lerp(0.45, 1.0, rainIntensity)
      );

      /**
       * Orienta la goccia nella direzione della velocità.
       */
      TMP_DIR.copy(velocity).normalize();

      if (TMP_DIR.lengthSq() > 0.0001) {
        drop.quaternion.setFromUnitVectors(DOWN, TMP_DIR);
      }

      /**
       * Collisione precisa lungo il segmento di movimento.
       */
      TMP_ORIGIN.copy(TMP_POS);
      TMP_DIR.subVectors(drop.position, TMP_POS);

      const travelDistance = TMP_DIR.length();

      if (travelDistance > 0.0001 && collisionMeshes.length > 0) {
        TMP_DIR.normalize();

        raycaster.set(TMP_ORIGIN, TMP_DIR);
        raycaster.far = travelDistance + 0.04;

        const hits = raycaster.intersectObjects(
          collisionMeshes,
          false
        );

        if (hits.length > 0) {
          activateSurfaceDrop(
            hits[0],
            velocity,
            rainIntensity
          );

          resetFallingDrop(drop, true);
          continue;
        }
      }

      if (drop.position.y <= groundY) {
        resetFallingDrop(drop, true);
      }

      const d2 =
        drop.position.x * drop.position.x +
        drop.position.z * drop.position.z;

      if (d2 > groundRadius * groundRadius) {
        resetFallingDrop(drop, true);
      }

      const flashBoost = lightningIntensity * 0.75;

      drop.material.opacity =
        THREE.MathUtils.lerp(0.26, 0.62, rainIntensity) +
        flashBoost * 0.25;

      drop.material.emissiveIntensity =
        0.025 + lightningIntensity * 0.55;

      drop.material.envMapIntensity =
        1.3 + rainIntensity * 1.2 + lightningIntensity * 2.2;

      if (drop.userData.highlight) {
        drop.userData.highlight.material.opacity =
          0.18 +
          rainIntensity * 0.26 +
          lightningIntensity * 0.7;
      }
    }

    for (const drop of surfaceDrops) {
      if (!drop.visible) continue;

      drop.userData.life -= deltaTime;

      const t =
        1.0 - drop.userData.life / drop.userData.maxLife;

      drop.position.addScaledVector(
        drop.userData.slideVelocity,
        deltaTime
      );

      /**
       * La goccia si appiattisce e scompare lentamente.
       */
      const fade = 1.0 - t;

      drop.material.opacity =
        fade *
        THREE.MathUtils.lerp(0.38, 0.82, rainIntensity);

      drop.material.emissiveIntensity =
        0.035 + lightningIntensity * 0.7;

      drop.material.envMapIntensity =
        1.5 + rainIntensity * 1.4 + lightningIntensity * 2.6;

      if (drop.userData.highlight) {
        drop.userData.highlight.material.opacity =
          fade *
          (0.22 + rainIntensity * 0.3 + lightningIntensity * 0.85);
      }

      const shrink = THREE.MathUtils.lerp(1.0, 0.45, t);

      drop.scale.multiplyScalar(
        THREE.MathUtils.lerp(1.0, shrink, deltaTime * 1.8)
      );

      if (drop.userData.life <= 0) {
        drop.visible = false;

        if (drop.userData.highlight) {
          drop.userData.highlight.material.opacity = 0;
        }
      }
    }
  }

  function setActive(active) {
    group.visible = active;
  }

  return {
    group,
    fallingDrops,
    surfaceDrops,
    update,
    setActive
  };
}