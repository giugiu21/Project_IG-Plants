import * as THREE from "three";
import { darkenColor } from "../utils/darkenColor.js";

/*This file containes the logic behind each leaf with its geometry, animation and interaction
    3 main functions:
      - creating the custom geometry fro the leaf
      - creating a custom shader material written with a vertex shader and fragment shader
      - updates the leaf according to time
*/

//How many fireflies influence the leaf shader
const MAX_SHADER_FIREFLIES = 8;

function createOrchidLeafGeometry({
  length = 1.25, //max leaf length
  maxWidth = 0.34,
  lengthSegments = 42,
  widthSegments = 12
} = {}) {
  const vertices = [];
  //const uvs = [];
  const indices = [];
  const heightFactors = [];
  const sideFactors = [];

  //0 = base, 0.5 = center, 1 = top
  for (let yIndex = 0; yIndex <= lengthSegments; yIndex++) {
    const v = yIndex / lengthSegments;

    //allows for the base and top to be of less width of the center
    const widthProfile =
      Math.sin(v * Math.PI) *
      (0.82 + 0.18 * Math.sin(v * Math.PI));

    const halfWidth = maxWidth * widthProfile;

    for (let xIndex = 0; xIndex <= widthSegments; xIndex++) {
      const u = xIndex / widthSegments;
      const side = u * 2.0 - 1.0;

      const x = side * halfWidth;
      const y = v * length;

      //creating volume for the leaf
      const centerRidge = Math.sin(v * Math.PI) * 0.045;
      const edgeDrop = Math.abs(side) * 0.06;
      const tipDrop = Math.pow(v, 1.8) * 0.065;

      const z = centerRidge - edgeDrop - tipDrop;

      vertices.push(x, y, z);
      heightFactors.push(v);
      sideFactors.push(side);
    }
  }

  const rowSize = widthSegments + 1;

  for (let yIndex = 0; yIndex < lengthSegments; yIndex++) {
    for (let xIndex = 0; xIndex < widthSegments; xIndex++) {
      const a = yIndex * rowSize + xIndex;
      const b = a + 1;
      const c = a + rowSize;
      const d = c + 1;

      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();

  //Creating the custom shader attributes: each leaf has:

  //position (x,y,z) in space
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3)
  );

  //a height in space
  geometry.setAttribute(
    "aHeightFactor",
    new THREE.Float32BufferAttribute(heightFactors, 1)
  );

  // right side
  geometry.setAttribute(
    "aSideFactor",
    new THREE.Float32BufferAttribute(sideFactors, 1)
  );

  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}


export function createLeaf(options = {}) {
  if (typeof options === "number") {
    options = { color: options };
  }

  const {
    color = 0x3f8f3f,
    length = 1.25,
    maxWidth = 0.34,

    windStrength = 0.045,
    windSpeed = 0.9,

    interactionRadius = 0.42,
    interactionStrength = 0.28
  } = options;

  const group = new THREE.Group();

  const geometry = createOrchidLeafGeometry({
    length,
    maxWidth
  });

  const leafColor = new THREE.Color(color);

  //each leaf has a small random variation in color
  leafColor.offsetHSL(
    (Math.random() - 0.5) * 0.025,
    (Math.random() - 0.5) * 0.08,
    (Math.random() - 0.5) * 0.07
  );

  const leafNightColor = darkenColor(leafColor);

  //custom shader material
  //allows control over shape, color, rain, wetness, lights...
  const material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: false,

    uniforms: {
      uTime: { value: 0 },

      //color settings
      uBaseColor: { value: leafColor },
      uNightColor: { value: leafNightColor },
      uNightAmount: { value: 0 },

      //wind settings
      uWindStrength: { value: windStrength },
      uWindSpeed: { value: windSpeed },
      uWindPhase: { value: Math.random() * Math.PI * 2 },

      //Cursor values, this allows deformations when cursor passes on top of the leaf
      uCursorLocalPosition: {
        value: new THREE.Vector3(999, 999, 999)
      },
      uCursorInfluence: {
        value: 0
      },

      uInteractionRadius: {
        value: interactionRadius
      },
      uInteractionStrength: {
        value: interactionStrength
      },

      //Fireflies settings
      uFireflyPositions: {
        value: Array.from(
          { length: MAX_SHADER_FIREFLIES },
          () => new THREE.Vector3(999, 999, 999)
        )
      },
      uFireflyCount: {value: 0},
      uFireflyStrength: {value: 0.3},
      uFireflyRadius: {value: 1.05},
      uFireflyColor: {value: new THREE.Color(0xffd36a)},

      //Wetness settings when raining
      uRainAmount: {value: 0},
      uWetness: {value: 0},
      uRainTime: {value: 0},
      uRainLightDir: {value: new THREE.Vector3(0.35, 1.0, 0.25).normalize()},

      //Lightning settings (0 = no lighting, 1 = lightining)
      uLightningIntensity: {value: 0}
    },

    /*Vertex shader: modifies the position of the object
    Handles interaction (wind/cursor interaction)
        here it is necessary for: wind deformation and cursor deformation */
    vertexShader: `
      uniform float uTime;

      uniform float uWindStrength;
      uniform float uWindSpeed;
      uniform float uWindPhase;

      uniform vec3 uCursorLocalPosition;
      uniform float uCursorInfluence;

      uniform float uInteractionRadius;
      uniform float uInteractionStrength;

      attribute float aHeightFactor;
      attribute float aSideFactor;

      varying float vHeightFactor;
      varying float vSideFactor;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      void main() {
        vec3 pos = position;

        float h = aHeightFactor;
        float side = aSideFactor;

        float baseMask = smoothstep(0.35, 1.0, h);
        float tipMask = smoothstep(0.55, 1.0, h);
        float veryTipMask = smoothstep(0.75, 1.0, h);

        float tipSway =
          sin(uTime * uWindSpeed + uWindPhase)
          * uWindStrength;

        float sideSway =
          sin(uTime * uWindSpeed * 0.72 + uWindPhase * 1.4)
          * uWindStrength;

        float flutter =
          sin(uTime * uWindSpeed * 1.8 + h * 3.0 + uWindPhase)
          * uWindStrength
          * 0.18;

        pos.z += tipSway * tipMask * 0.9;
        pos.x += sideSway * veryTipMask * 0.45;
        pos.z += flutter * abs(side) * baseMask;
        pos.z += side * sideSway * veryTipMask * 0.18;

        float distToCursor = distance(pos.xy, uCursorLocalPosition.xy);

        if (uCursorInfluence > 0.001 && distToCursor < uInteractionRadius) {
          float contact = 1.0 - distToCursor / uInteractionRadius;
          contact = smoothstep(0.0, 1.0, contact);

          float stiffnessMask = smoothstep(0.18, 1.0, h);
          stiffnessMask *= stiffnessMask;

          float afterTouch = smoothstep(
            uCursorLocalPosition.y - 0.08,
            uCursorLocalPosition.y + 0.42,
            pos.y
          );

          float bend =
            contact *
            stiffnessMask *
            uCursorInfluence *
            uInteractionStrength;

          pos.z -= bend * 0.28;
          pos.z -= bend * afterTouch * 0.42;

          float sidePull = clamp(uCursorLocalPosition.x, -0.35, 0.35);
          pos.x += sidePull * bend * afterTouch * 0.45;

          pos.z += side * bend * afterTouch * 0.08;
        }

        vHeightFactor = h;
        vSideFactor = side;

        vec4 worldPosition = modelMatrix * vec4(pos, 1.0);

        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);

        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,

    /*Fragment Shader: handles color changes in the pixels
    Here (changes from day to night, light changes)
        Base color:
          -day/night
          -vertical nuance
          -center highlight
          -veins on both sides of the leaf (fading near tip and base)
          - edges darkening

        Lightning effects:
          - firefly glow for the closest 8
          - lightning flash effect
    */
    fragmentShader: `
      uniform vec3 uBaseColor;
      uniform vec3 uNightColor;
      uniform float uNightAmount;

      uniform vec3 uFireflyPositions[8];
      uniform int uFireflyCount;
      uniform float uFireflyStrength;
      uniform float uFireflyRadius;
      uniform vec3 uFireflyColor;

      uniform float uRainAmount;
      uniform float uWetness;
      uniform float uRainTime;
      uniform vec3 uRainLightDir;

      uniform float uLightningIntensity;

      varying float vHeightFactor;
      varying float vSideFactor;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      void main() {
        float h = vHeightFactor;
        float side = vSideFactor;

        vec3 baseColor = mix(
          uBaseColor,
          uNightColor,
          uNightAmount
        );

        vec3 color = mix(
          baseColor * 0.62,
          baseColor * 1.18,
          h
        );

        float mainVein =
          1.0 - smoothstep(0.0, 0.055, abs(side));

        float veinFade =
          smoothstep(0.05, 0.25, h) *
          (1.0 - smoothstep(0.85, 1.0, h));

        color += mainVein * veinFade * vec3(0.08, 0.11, 0.045);

        float sideVeins = 0.0;

        for (float i = 1.0; i <= 4.0; i += 1.0) {
          float target = i * 0.18;

          float rightVein =
            1.0 - smoothstep(0.0, 0.028, abs(side - target));

          float leftVein =
            1.0 - smoothstep(0.0, 0.028, abs(side + target));

          sideVeins += rightVein + leftVein;
        }

        sideVeins = clamp(sideVeins, 0.0, 1.0);

        float sideVeinFade =
          smoothstep(0.12, 0.35, h) *
          (1.0 - smoothstep(0.72, 0.98, h));

        color += sideVeins * sideVeinFade * vec3(0.035, 0.06, 0.025);

        float edge =
          smoothstep(0.55, 1.0, abs(side));

        color *= mix(1.0, 0.72, edge);

        float gloss =
          pow(1.0 - abs(side), 2.0) * 0.065;

        color += vec3(gloss);

        // -----------------------------
        // EFFETTO BAGNATO / PIOGGIA
        // -----------------------------

        float wetAmount = clamp(
          max(uWetness, uRainAmount * 0.28),
          0.0,
          1.0
        );

        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPosition);
        vec3 L = normalize(uRainLightDir);
        vec3 H = normalize(L + V);

        float wetNoise =
          hash(vWorldPosition.xz * 10.0 + vec2(uRainTime * 0.035));

        float longStreak =
          sin(
            vWorldPosition.x * 22.0 +
            vWorldPosition.y * 4.5 +
            uRainTime * 0.7
          );

        longStreak = smoothstep(0.68, 1.0, longStreak);

        float smallDroplets =
          hash(vWorldPosition.xy * 38.0 + vec2(uRainTime * 0.02));

        smallDroplets = smoothstep(0.965, 1.0, smallDroplets);

        float wetMask = wetAmount;
        wetMask *= mix(0.78, 1.0, wetNoise);
        wetMask = clamp(wetMask, 0.0, 1.0);

        vec3 wetColor = color * 0.58 + vec3(0.018, 0.035, 0.04);

        color = mix(color, wetColor, wetMask * 0.82);

        float spec =
          pow(max(dot(N, H), 0.0), 120.0) *
          wetMask;

        float fresnel =
          pow(1.0 - max(dot(N, V), 0.0), 3.0) *
          wetMask;

        float streakMask =
          longStreak *
          smoothstep(0.12, 0.95, h) *
          (1.0 - smoothstep(0.92, 1.0, h));

        float dropletMask =
          smallDroplets *
          wetMask *
          smoothstep(0.18, 0.95, h);

        color += vec3(1.0, 1.0, 0.95) * spec * 1.15;
        color += vec3(0.55, 0.72, 0.9) * fresnel * 0.22;
        color += vec3(0.55, 0.75, 0.85) * streakMask * wetMask * 0.11;
        color += vec3(0.85, 0.95, 1.0) * dropletMask * 0.28;

        // -----------------------------
        // FULMINE
        // -----------------------------

        float lightning = clamp(uLightningIntensity, 0.0, 1.0);

        if (lightning > 0.001) {
          vec3 lightningColor = vec3(0.72, 0.86, 1.0);

          float wetBoost = 0.35 + wetAmount * 1.65;

          float lightningSpec =
            pow(max(dot(N, H), 0.0), 70.0) *
            wetBoost *
            lightning;

          float lightningFresnel =
            pow(1.0 - max(dot(N, V), 0.0), 2.2) *
            wetBoost *
            lightning;

          color += lightningColor * lightning * 0.36;
          color += vec3(1.0) * lightningSpec * 1.65;
          color += lightningColor * lightningFresnel * 0.55;
        }

        // -----------------------------
        // GLOW LUCCIOLE
        // -----------------------------

        float fireflyGlow = 0.0;

        for (int i = 0; i < 8; i++) {
          if (i >= uFireflyCount) {
            break;
          }

          float d = distance(vWorldPosition, uFireflyPositions[i]);

          float influence =
            1.0 - smoothstep(0.0, uFireflyRadius, d);

          fireflyGlow += influence;
        }

        fireflyGlow = clamp(fireflyGlow, 0.0, 1.0);

        color += uFireflyColor * fireflyGlow * uFireflyStrength;

        gl_FragColor = vec4(color, 1.0);
      }
    `
  });

  const leafMesh = new THREE.Mesh(geometry, material);

  leafMesh.castShadow = true;
  leafMesh.receiveShadow = true;

  leafMesh.userData.wetness = 0;

  leafMesh.rotation.x = -Math.PI / 2;

  group.add(leafMesh);

  group.scale.setScalar(0.01);

  group.userData = {
    leafMesh,
    material,
    smoothedLocalCursor: new THREE.Vector3(999, 999, 999),
    targetLocalCursor: new THREE.Vector3(999, 999, 999),
    cursorInfluence: 0
  };

  return group;
}

export function updateLeaf(
  leafGroup,
  elapsedTime,
  cursorPosition,
  fireflyPositions = [],
  rainAmount = 0,
  lightningIntensity = 0, 
  stormWind = 0, 
  isNight = false
) {
  const {
    material,
    leafMesh,
    smoothedLocalCursor,
    targetLocalCursor
  } = leafGroup.userData;

  material.uniforms.uTime.value = elapsedTime;
  material.uniforms.uRainTime.value = elapsedTime;
  material.uniforms.uRainAmount.value = rainAmount;
  material.uniforms.uLightningIntensity.value = lightningIntensity;

  //sending to the shader the right color depending on day/night mode
  if (material.uniforms.uNightAmount) {
      material.uniforms.uNightAmount.value = THREE.MathUtils.lerp(
        material.uniforms.uNightAmount.value,
        isNight ? 1 : 0,
        0.04
      );
  }

  const currentWetness = leafMesh.userData.wetness || 0;

  const rainWetnessTarget = rainAmount > 0.05
    ? Math.max(currentWetness, rainAmount * 0.45)
    : 0;

  //sending to the shader
  leafMesh.userData.wetness = THREE.MathUtils.lerp(
    currentWetness,
    rainWetnessTarget,
    rainAmount > 0.05 ? 0.025 : 0.006
  );

  material.uniforms.uWetness.value =
    leafMesh.userData.wetness || 0;

  const cursorIsValid =
    cursorPosition &&
    cursorPosition.x < 900 &&
    cursorPosition.y < 900 &&
    cursorPosition.z < 900;

  //If we have a cursor interaction we send it to the shader
  if (cursorIsValid) {
    targetLocalCursor.copy(cursorPosition);

    leafMesh.worldToLocal(targetLocalCursor);

    smoothedLocalCursor.lerp(targetLocalCursor, 0.18);

    leafGroup.userData.cursorInfluence = THREE.MathUtils.lerp(
      leafGroup.userData.cursorInfluence,
      1,
      0.16
    );
  } else {
    leafGroup.userData.cursorInfluence = THREE.MathUtils.lerp(
      leafGroup.userData.cursorInfluence,
      0,
      0.12
    );
  }

  material.uniforms.uCursorLocalPosition.value.copy(smoothedLocalCursor);
  material.uniforms.uCursorInfluence.value =
    leafGroup.userData.cursorInfluence;

  //sending to the shader also the 8 closest fireflies
  for (let i = 0; i < MAX_SHADER_FIREFLIES; i++) {
    if (fireflyPositions[i]) {
      material.uniforms.uFireflyPositions.value[i].copy(
        fireflyPositions[i]
      );
    } else {
      material.uniforms.uFireflyPositions.value[i].set(999, 999, 999);
    }
  }

  material.uniforms.uFireflyCount.value = Math.min(
    fireflyPositions.length,
    MAX_SHADER_FIREFLIES
  );
}