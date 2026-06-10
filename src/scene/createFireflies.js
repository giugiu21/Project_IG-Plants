import * as THREE from "three";

/*Creating and animating the fireflies in the night mode*/

const fireflyWorldPosition = new THREE.Vector3();
const obstacleWorldPosition = new THREE.Vector3();
const obstacleWorldScale = new THREE.Vector3();
const pushDirection = new THREE.Vector3();

//creating the fireflies glow light
function createGlowTexture(size = 128) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");

  //radial gradient for the light glow
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );

  gradient.addColorStop(0.0, "rgba(255, 255, 220, 1)");
  gradient.addColorStop(0.2, "rgba(255, 245, 170, 0.9)");
  gradient.addColorStop(0.45, "rgba(255, 220, 100, 0.35)");
  gradient.addColorStop(1.0, "rgba(255, 200, 50, 0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}


//Creating the fireflies
function createSingleFirefly(glowTexture, trailLength = 12) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 10, 10),
    new THREE.MeshBasicMaterial({
      color: 0xfff7a8,
      transparent: true,
      opacity: 1
    })
  );

  group.add(body);

  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xfff1a8,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );

  glow.scale.set(0.35, 0.35, 0.35);
  group.add(glow);

  const light = new THREE.PointLight(0xffe680, 2.4, 3.0, 1.5);
  light.castShadow = false;
  group.add(light);

  const trailPositions = new Float32Array(trailLength * 3); //light trail

  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(trailPositions, 3)
  );

  const trailMaterial = new THREE.LineBasicMaterial({
    color: 0xffee99,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const trail = new THREE.Line(trailGeometry, trailMaterial);
  group.add(trail);

  const baseRadius = 1.2 + Math.random() * 3.1;
  const angle = Math.random() * Math.PI * 2;
  const baseHeight = 0.35 + Math.random() * 1.5;

  const x = Math.cos(angle) * baseRadius;
  const z = Math.sin(angle) * baseRadius;
  const y = baseHeight;

  group.position.set(x, y, z);

  for (let i = 0; i < trailLength; i++) {
    trailPositions[i * 3 + 0] = x;
    trailPositions[i * 3 + 1] = y;
    trailPositions[i * 3 + 2] = z;
  }

  group.userData = {
    body,
    glow,
    light,
    trail,
    trailPositions,
    trailLength,

    baseRadius,
    baseHeight,

    theta: Math.random() * Math.PI * 2,
    angularSpeed: 0.12 + Math.random() * 0.25,

    wobbleSpeedX: 0.7 + Math.random() * 1.0,
    wobbleSpeedY: 1.0 + Math.random() * 1.4,
    wobbleSpeedZ: 0.8 + Math.random() * 1.0,

    wobbleAmpX: 0.15 + Math.random() * 0.22,
    wobbleAmpY: 0.12 + Math.random() * 0.28,
    wobbleAmpZ: 0.15 + Math.random() * 0.22,

    pulsePhase: Math.random() * Math.PI * 2,
    pulseSpeed: 1.5 + Math.random() * 1.8,

    visibleStrength: 0
  };

  return group;
}

//to check visibility
function isObjectActuallyVisible(object) {
  let current = object;

  while (current) {
    if (!current.visible) {
      return false;
    }

    current = current.parent;
  }

  return true;
}


//Obstacle avoidance
function getObstacleAvoidanceRadius(mesh) {
  if (!mesh.geometry) return 0.25;

  if (!mesh.geometry.boundingSphere) {
    mesh.geometry.computeBoundingSphere();
  }

  const sphere = mesh.geometry.boundingSphere;

  mesh.getWorldScale(obstacleWorldScale);

  const maxScale = Math.max(
    obstacleWorldScale.x,
    obstacleWorldScale.y,
    obstacleWorldScale.z
  );

  return sphere.radius * maxScale + 0.18;
}

function avoidObstacles(position, obstacles = []) {
  if (!obstacles || obstacles.length === 0) return;

  for (const obstacle of obstacles) {
    if (!obstacle) continue;
    if (!isObjectActuallyVisible(obstacle)) continue;

    obstacle.getWorldPosition(obstacleWorldPosition);

    const avoidRadius = getObstacleAvoidanceRadius(obstacle);
    const distance = position.distanceTo(obstacleWorldPosition);

    if (distance < avoidRadius) {
      pushDirection.subVectors(position, obstacleWorldPosition);

      if (pushDirection.lengthSq() < 0.0001) {
        pushDirection.set(
          Math.random() - 0.5,
          Math.random() * 0.45,
          Math.random() - 0.5
        );
      }

      pushDirection.normalize();

      const penetration = avoidRadius - distance;

      position.addScaledVector(pushDirection, penetration * 0.78);
    }
  }
}

export function createFireflies({
  count = 10,
  trailLength = 12
} = {}) {
  const group = new THREE.Group();
  const glowTexture = createGlowTexture();

  const fireflies = [];
  const lights = [];

  for (let i = 0; i < count; i++) {
    const firefly = createSingleFirefly(glowTexture, trailLength);

    fireflies.push(firefly);
    lights.push(firefly.userData.light);

    group.add(firefly);
  }

  group.userData.fireflies = fireflies;
  group.userData.lights = lights;

  return {
    group,
    fireflies,
    lights,
    glowTexture
  };
}

export function animateFireflies(
  firefliesSystem,
  elapsedTime,
  isNight,
  obstacles = []
) {
  const { fireflies } = firefliesSystem;

  for (const firefly of fireflies) {
    const data = firefly.userData;

    data.visibleStrength = isNight ? 1 : 0;

    data.theta += data.angularSpeed * 0.01;

    const orbitX = Math.cos(data.theta) * data.baseRadius;
    const orbitZ = Math.sin(data.theta) * data.baseRadius;

    const wobbleX =
      Math.sin(elapsedTime * data.wobbleSpeedX + data.pulsePhase) *
      data.wobbleAmpX;

    const wobbleY =
      Math.sin(elapsedTime * data.wobbleSpeedY + data.pulsePhase * 1.3) *
      data.wobbleAmpY;

    const wobbleZ =
      Math.cos(elapsedTime * data.wobbleSpeedZ + data.pulsePhase * 0.8) *
      data.wobbleAmpZ;

    const x = orbitX + wobbleX;
    const y = Math.max(0.18, data.baseHeight + wobbleY);
    const z = orbitZ + wobbleZ;

    fireflyWorldPosition.set(x, y, z);

    if (isNight) {
      avoidObstacles(fireflyWorldPosition, obstacles);
    }

    firefly.position.copy(fireflyWorldPosition);

    const pulse =
      0.55 +
      0.45 * Math.sin(elapsedTime * data.pulseSpeed + data.pulsePhase);

    const brightness = data.visibleStrength * pulse;

    data.body.visible = brightness > 0.01;
    data.body.material.opacity = brightness;

    data.glow.material.opacity = brightness * 0.95;
    data.glow.scale.setScalar(0.18 + brightness * 0.32);

    data.light.intensity = brightness * 2.2;
    data.light.distance = 1.8 + brightness * 2.2;

    data.trail.material.opacity = data.visibleStrength * 0.16;

    const arr = data.trailPositions;

    for (let i = data.trailLength - 1; i > 0; i--) {
      arr[i * 3 + 0] = arr[(i - 1) * 3 + 0];
      arr[i * 3 + 1] = arr[(i - 1) * 3 + 1];
      arr[i * 3 + 2] = arr[(i - 1) * 3 + 2];
    }
    
    arr[0] = firefly.position.x;
    arr[1] = firefly.position.y;
    arr[2] = firefly.position.z;

    data.trail.geometry.attributes.position.needsUpdate = true;

    firefly.visible = data.visibleStrength > 0.01;
  }
}