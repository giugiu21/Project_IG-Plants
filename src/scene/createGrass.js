import * as THREE from "three";
import { randomPointInCircle } from "../utils/randomPointInCircle.js";

const BLADE_SEGMENTS = 5;

function createBladeGeometry() {
  const vertices = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= BLADE_SEGMENTS; i++) {
    const t = i / BLADE_SEGMENTS;

    const halfWidth = (1.0 - t) * 0.5;

    vertices.push(-halfWidth, t, 0);
    vertices.push(halfWidth, t, 0);

    uvs.push(0, t);
    uvs.push(1, t);
  }

  for (let i = 0; i < BLADE_SEGMENTS; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;

    indices.push(a, c, b);
    indices.push(c, d, b);
  }

  const geometry = new THREE.InstancedBufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3)
  );

  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(uvs, 2)
  );

  geometry.setIndex(indices);

  return geometry;
}

export function createGrass({
  radius = 4.8,
  bladeCount = 12000
} = {}) {
  const geometry = createBladeGeometry();

  const offsets = new Float32Array(bladeCount * 3);
  const scales = new Float32Array(bladeCount * 2);
  const rotations = new Float32Array(bladeCount);
  const phases = new Float32Array(bladeCount);
  const colors = new Float32Array(bladeCount * 3);
  const bends = new Float32Array(bladeCount);

  const color = new THREE.Color();

  for (let i = 0; i < bladeCount; i++) {
    const point = randomPointInCircle(radius);

    const distanceFromCenter = Math.sqrt(point.x * point.x + point.z * point.z);
    const edgeFactor = distanceFromCenter / radius;

    const height =
      THREE.MathUtils.lerp(0.35, 0.65, Math.random()) *
      THREE.MathUtils.lerp(1.0, 0.55, edgeFactor);

    const width = THREE.MathUtils.lerp(0.045, 0.085, Math.random());

    offsets[i * 3 + 0] = point.x;
    offsets[i * 3 + 1] = 0.02;
    offsets[i * 3 + 2] = point.z;

    scales[i * 2 + 0] = width;
    scales[i * 2 + 1] = height;

    rotations[i] = Math.random() * Math.PI * 2;
    phases[i] = Math.random() * Math.PI * 2;
    bends[i] = 0.15 + Math.random() * 0.35;

    color.setHSL(
      0.25 + Math.random() * 0.10, //hue type of green
      0.25 + Math.random() * 0.30, //saturation
      0.25 + Math.random() * 0.20  //lightness
    );

    colors[i * 3 + 0] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute(
    "aOffset",
    new THREE.InstancedBufferAttribute(offsets, 3)
  );

  geometry.setAttribute(
    "aScale",
    new THREE.InstancedBufferAttribute(scales, 2)
  );

  geometry.setAttribute(
    "aRotation",
    new THREE.InstancedBufferAttribute(rotations, 1)
  );

  geometry.setAttribute(
    "aPhase",
    new THREE.InstancedBufferAttribute(phases, 1)
  );

  geometry.setAttribute(
    "aColor",
    new THREE.InstancedBufferAttribute(colors, 3)
  );

  geometry.setAttribute(
    "aBend",
    new THREE.InstancedBufferAttribute(bends, 1)
  );

  const material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: false,

    uniforms: {
      uTime: { value: 0 },
      uWindStrength: { value: 0.28 },

      // Cursor interaction
      uCursorPosition: { value: new THREE.Vector3(999, 999, 999) },
      uCursorRadius: { value: 1.2 },
      uCursorStrength: { value: 0.3 }
    },

    vertexShader: `
      uniform float uTime;
      uniform float uWindStrength;

      uniform vec3 uCursorPosition;
      uniform float uCursorRadius;
      uniform float uCursorStrength;

      attribute vec3 aOffset;
      attribute vec2 aScale;
      attribute float aRotation;
      attribute float aPhase;
      attribute vec3 aColor;
      attribute float aBend;

      varying vec3 vColor;
      varying float vHeight;

      void main() {
        vec3 pos = position;

        float heightFactor = uv.y;

        pos.x *= aScale.x;
        pos.y *= aScale.y;

        float wind =
          sin(uTime * 1.8 + aPhase + aOffset.x * 1.5 + aOffset.z * 1.2)
          * uWindStrength;

        float secondaryWind =
          sin(uTime * 0.7 + aOffset.x * 0.8)
          * 0.08;

        float bend =
          (wind + secondaryWind + aBend * 0.25)
          * heightFactor
          * heightFactor;

        float s = sin(aRotation);
        float c = cos(aRotation);

        vec3 rotated;

        rotated.x = pos.x * c;
        rotated.z = pos.x * s;
        rotated.y = pos.y;

        rotated.x += bend * s;
        rotated.z += bend * c;

        // Cursor interaction
        vec2 bladeXZ = aOffset.xz;
        vec2 cursorXZ = uCursorPosition.xz;

        float distToCursor = distance(bladeXZ, cursorXZ);

        if (distToCursor < uCursorRadius) {
          float influence = 1.0 - distToCursor / uCursorRadius;
          influence = smoothstep(0.0, 1.0, influence);

          vec2 pushDir = normalize(bladeXZ - cursorXZ + vec2(0.0001));

          float tipEffect = heightFactor * heightFactor;

          rotated.x += pushDir.x * influence * uCursorStrength * tipEffect;
          rotated.z += pushDir.y * influence * uCursorStrength * tipEffect;

          rotated.y -= influence * 0.12 * tipEffect;
        }

        rotated += aOffset;

        vColor = aColor;
        vHeight = heightFactor;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(rotated, 1.0);
      }
    `,

    fragmentShader: `
      varying vec3 vColor;
      varying float vHeight;

      void main() {
        vec3 finalColor = mix(vColor * 0.65, vColor * 1.25, vHeight);
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `
  });

  const grass = new THREE.Mesh(geometry, material);

  grass.frustumCulled = false;
  grass.castShadow = false;
  grass.receiveShadow = true;

  return grass;
}

export function animateGrass(grass, elapsedTime, cursorPosition = null) {
  grass.material.uniforms.uTime.value = elapsedTime;

  if (cursorPosition) {
    grass.material.uniforms.uCursorPosition.value.copy(cursorPosition);
  }
}