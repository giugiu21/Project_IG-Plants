import * as THREE from "three";
import { randomPointInCircle } from "../utils/randomPointInCircle.js";

/*This file contains the logic behind each grass blade geometry
    3 main functions:
      - creating the custom geometry for the single grass blade
      - creating a custom shader material written with a vertex shader and fragment shader
      - updates the grass blade according to time
*/

const BLADE_SEGMENTS = 5; //each blade has 5 segments, this allows smoother bending

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

  //connects the blade rows into triangles
  //each segment is a rectangle of 4 vertices BUT the GPU only renders triangles so each one is split into 2 triangles
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

  //For each blade:
  const offsets = new Float32Array(bladeCount * 3); //position (x,y,z)
  const scales = new Float32Array(bladeCount * 2); //size (width and height)
  const rotations = new Float32Array(bladeCount); // 1 random rotation angle
  const phases = new Float32Array(bladeCount); // 1 random wind phase
  const colors = new Float32Array(bladeCount * 3); //color RGB
  const bends = new Float32Array(bladeCount); // 1 bend variation

  const color = new THREE.Color();

  for (let i = 0; i < bladeCount; i++) {
    const point = randomPointInCircle(radius); //random point in the environment

    const distanceFromCenter = Math.sqrt(point.x * point.x + point.z * point.z); //used to make blades shorter near the edge
    const edgeFactor = distanceFromCenter / radius;

    const height = THREE.MathUtils.lerp(0.35, 0.65, Math.random()) *THREE.MathUtils.lerp(1.0, 0.55, edgeFactor); //if closer to edge they are shorter

    const width = THREE.MathUtils.lerp(0.045, 0.085, Math.random());

    offsets[i * 3 + 0] = point.x;
    offsets[i * 3 + 1] = 0.02; // all blades start at the same y-value so they dont float or sink into the ground
    offsets[i * 3 + 2] = point.z;

    scales[i * 2 + 0] = width;
    scales[i * 2 + 1] = height;

    //allows to have different random movements for each blade
    rotations[i] = Math.random() * Math.PI * 2;
    phases[i] = Math.random() * Math.PI * 2;
    bends[i] = 0.15 + Math.random() * 0.35;

    //Randomized coloring in a set interval to ensure different shades of green for each blade
    color.setHSL(
      0.25 + Math.random() * 0.10, //hue type of green
      0.25 + Math.random() * 0.30, //saturation
      0.25 + Math.random() * 0.20  //lightness
    );

    colors[i * 3 + 0] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  //offset (x,y,z)
  geometry.setAttribute(
    "aOffset",
    new THREE.InstancedBufferAttribute(offsets, 3)
  );

  //scale (width, height)
  geometry.setAttribute(
    "aScale",
    new THREE.InstancedBufferAttribute(scales, 2)
  );

  //each blade gets a rotation
  geometry.setAttribute(
    "aRotation",
    new THREE.InstancedBufferAttribute(rotations, 1)
  );

  //each blade gets a wind phase
  geometry.setAttribute(
    "aPhase",
    new THREE.InstancedBufferAttribute(phases, 1)
  );

  //each blade gets a personal RGB color
  geometry.setAttribute(
    "aColor",
    new THREE.InstancedBufferAttribute(colors, 3)
  );

  //each blade gets a personal blend value
  geometry.setAttribute(
    "aBend",
    new THREE.InstancedBufferAttribute(bends, 1)
  );

  //Creating the material
  const material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: false,

    uniforms: {
      uTime: { value: 0 },
      //wind interaction
      uWindStrength: { value: 0.28 },

      // Cursor interaction
      uCursorPosition: { value: new THREE.Vector3(999, 999, 999) },
      uCursorRadius: { value: 1.2 },
      uCursorStrength: { value: 0.3 }
    },

     /*Vertex shader: modifies the position of the object
    Handles interaction (wind/cursor interaction)
        here animates on the GPU each blade*/
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

        //Controlling the wind motion effect
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

        //applying the wind
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

          //Applying the cursor deformation
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

    /*Fragment Shader: handles color changes in the pixels
    Here:
        Base color:
          -mixed with random changes
    */
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

//Function to animate the grass blades
export function animateGrass(grass, elapsedTime, cursorPosition = null) {
  grass.material.uniforms.uTime.value = elapsedTime; //sends the current time to the shader

  if (cursorPosition) {
    grass.material.uniforms.uCursorPosition.value.copy(cursorPosition); //if we have a cursor position we send it to the shader
  }
}