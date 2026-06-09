import * as THREE from "three";
import { darkenColor } from "../utils/darkenColor.js";

const MAX_SHADER_FIREFLIES = 8;

function smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function createPetalGeometry({
  length = 0.42,
  maxWidth = 0.16,
  lengthSegments = 32,
  widthSegments = 12,
  type = "petal"
} = {}) {
  const vertices = [];
  const uvs = [];
  const indices = [];
  const heightFactors = [];
  const sideFactors = [];

  for (let yIndex = 0; yIndex <= lengthSegments; yIndex++) {
    const v = yIndex / lengthSegments;

    let widthProfile;

    if (type === "sepal") {
      widthProfile =
        Math.sin(v * Math.PI) *
        (0.62 + 0.18 * Math.sin(v * Math.PI));
    } else if (type === "labellum") {
      widthProfile =
        Math.sin(v * Math.PI) * 0.72 +
        Math.sin(v * Math.PI * 0.72) * 0.42;
    } else {
      widthProfile =
        Math.sin(v * Math.PI) *
        (0.78 + 0.32 * Math.sin(v * Math.PI));
    }

    const halfWidth = maxWidth * Math.max(0.0, widthProfile);

    for (let xIndex = 0; xIndex <= widthSegments; xIndex++) {
      const u = xIndex / widthSegments;
      const side = u * 2.0 - 1.0;

      const x = side * halfWidth;
      const y = v * length;

      let z;

      if (type === "labellum") {
        const centerLift = Math.sin(v * Math.PI) * 0.03;
        const cup = -Math.abs(side) * 0.045;
        const forwardCurl = Math.pow(v, 1.65) * 0.07;
        const lipCurl = Math.sin(v * Math.PI) * Math.abs(side) * 0.025;

        z = centerLift + forwardCurl + cup + lipCurl;
      } else {
        const centerLift = Math.sin(v * Math.PI) * 0.026;
        const edgeCurl = Math.abs(side) * 0.028;
        const tipDrop = Math.pow(v, 2.0) * 0.03;

        z = centerLift - edgeCurl - tipDrop;
      }

      vertices.push(x, y, z);
      uvs.push(u, v);
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

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3)
  );

  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(uvs, 2)
  );

  geometry.setAttribute(
    "aHeightFactor",
    new THREE.Float32BufferAttribute(heightFactors, 1)
  );

  geometry.setAttribute(
    "aSideFactor",
    new THREE.Float32BufferAttribute(sideFactors, 1)
  );

  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

function createPetal({
  color = 0xf2a0c4,
  throatColor = 0xffd35a,
  spotColor = 0x9a315f,
  length = 0.42,
  maxWidth = 0.16,
  type = "petal",
  windStrength = 0.01,
  windSpeed = 0.75,
  interactionRadius = 0.22,
  interactionStrength = 0.13
} = {}) {
  const geometry = createPetalGeometry({
    length,
    maxWidth,
    type
  });

  const baseColor = new THREE.Color(color);

  baseColor.offsetHSL(
    (Math.random() - 0.5) * 0.018,
    (Math.random() - 0.5) * 0.06,
    (Math.random() - 0.5) * 0.06
  );

  const baseNightColor = darkenColor(baseColor);

  const material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: false,

    uniforms: {
      uTime: { value: 0 },

      uBaseColor: { value: baseColor },
      uNightColor: { value: baseNightColor },
      uNightAmount: { value: 0 },
      uThroatColor: { value: new THREE.Color(throatColor) },
      uSpotColor: { value: new THREE.Color(spotColor) },
      uIsLabellum: { value: type === "labellum" ? 1 : 0 },

      uWindStrength: { value: windStrength },
      uWindSpeed: { value: windSpeed },
      uWindPhase: { value: Math.random() * Math.PI * 2 },

      uCursorLocalPosition: {
        value: new THREE.Vector3(999, 999, 999)
      },
      uCursorInfluence: { value: 0 },
      uInteractionRadius: { value: interactionRadius },
      uInteractionStrength: { value: interactionStrength },

      uFireflyPositions: {
        value: Array.from(
          { length: MAX_SHADER_FIREFLIES },
          () => new THREE.Vector3(999, 999, 999)
        )
      },
      uFireflyCount: {
        value: 0
      },
      uFireflyStrength: { value: 0.8 },
      uFireflyRadius: { value: 1.1 },
      uFireflyColor: { value: new THREE.Color(0xffd36a) },

      /**
       * Fulmini.
       */
      uLightningIntensity: {
        value: 0
      },
      uLightningLightDir: {
        value: new THREE.Vector3(0.25, 1.0, 0.35).normalize()
      }
    },

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

        float tipMask = smoothstep(0.45, 1.0, h);
        float veryTipMask = smoothstep(0.74, 1.0, h);
        float edgeMask = smoothstep(0.45, 1.0, abs(side));

        float sway =
          sin(uTime * uWindSpeed + uWindPhase) *
          uWindStrength;

        float sideSway =
          sin(uTime * uWindSpeed * 0.68 + uWindPhase * 1.3) *
          uWindStrength;

        float flutter =
          sin(uTime * uWindSpeed * 1.7 + h * 3.0 + side * 1.7 + uWindPhase) *
          uWindStrength *
          0.35;

        pos.z += sway * tipMask * 0.75;
        pos.x += sideSway * veryTipMask * 0.2;
        pos.z += flutter * edgeMask * tipMask;

        float distToCursor = distance(pos.xy, uCursorLocalPosition.xy);

        if (uCursorInfluence > 0.001 && distToCursor < uInteractionRadius) {
          float contact = 1.0 - distToCursor / uInteractionRadius;
          contact = smoothstep(0.0, 1.0, contact);

          float stiffnessMask = smoothstep(0.16, 1.0, h);
          stiffnessMask *= stiffnessMask;

          float afterTouch = smoothstep(
            uCursorLocalPosition.y - 0.04,
            uCursorLocalPosition.y + 0.22,
            pos.y
          );

          float bend =
            contact *
            stiffnessMask *
            uCursorInfluence *
            uInteractionStrength;

          pos.z -= bend * 0.18;
          pos.z -= bend * afterTouch * 0.24;
          pos.z += side * bend * afterTouch * 0.08;
        }

        vec4 worldPosition = modelMatrix * vec4(pos, 1.0);

        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);

        vHeightFactor = h;
        vSideFactor = side;

        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,

    fragmentShader: `
      uniform vec3 uBaseColor;
      uniform vec3 uNightColor;
      uniform float uNightAmount;
      uniform vec3 uThroatColor;
      uniform vec3 uSpotColor;
      uniform float uIsLabellum;

      uniform vec3 uFireflyPositions[8];
      uniform int uFireflyCount;
      uniform float uFireflyStrength;
      uniform float uFireflyRadius;
      uniform vec3 uFireflyColor;

      uniform float uLightningIntensity;
      uniform vec3 uLightningLightDir;

      varying float vHeightFactor;
      varying float vSideFactor;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      void main() {
        float h = vHeightFactor;
        float side = vSideFactor;

        vec3 baseColor = mix(
          uBaseColor,
          uNightColor,
          uNightAmount
        );

        vec3 color = mix(
          baseColor * 0.82,
          baseColor * 1.18,
          h
        );

        float center =
          1.0 - smoothstep(0.0, 0.50, abs(side));

        color += center * vec3(0.035, 0.025, 0.035);

        float veins = 0.0;

        for (float i = 1.0; i <= 4.0; i += 1.0) {
          float target = i * 0.18;

          float rightVein =
            1.0 - smoothstep(0.0, 0.026, abs(side - target));

          float leftVein =
            1.0 - smoothstep(0.0, 0.026, abs(side + target));

          veins += rightVein + leftVein;
        }

        veins = clamp(veins, 0.0, 1.0);

        float veinFade =
          smoothstep(0.10, 0.30, h) *
          (1.0 - smoothstep(0.84, 1.0, h));

        color -= veins * veinFade * vec3(0.055, 0.025, 0.035);

        if (uIsLabellum > 0.5) {
          float throat =
            (1.0 - smoothstep(0.0, 0.58, abs(side))) *
            (1.0 - smoothstep(0.04, 0.70, h));

          color = mix(color, uThroatColor, throat * 0.88);

          float stripeNoise =
            sin(side * 34.0 + h * 7.0) *
            sin(h * 38.0 + side * 5.0);

          float stripes =
            smoothstep(0.42, 0.95, stripeNoise);

          float stripeMask =
            stripes *
            throat *
            smoothstep(0.10, 0.55, h);

          color = mix(color, uSpotColor, stripeMask * 0.42);

          float centralDark =
            (1.0 - smoothstep(0.0, 0.18, abs(side))) *
            smoothstep(0.12, 0.40, h) *
            (1.0 - smoothstep(0.55, 0.80, h));

          color = mix(color, uSpotColor, centralDark * 0.28);
        }

        float edge =
          smoothstep(0.62, 1.0, abs(side));

        color *= mix(1.0, 0.82, edge);

        // -----------------------------
        // FULMINE SUI PETALI
        // -----------------------------

        float lightning = clamp(uLightningIntensity, 0.0, 1.0);

        if (lightning > 0.001) {
          vec3 N = normalize(vWorldNormal);
          vec3 V = normalize(cameraPosition - vWorldPosition);
          vec3 L = normalize(uLightningLightDir);
          vec3 H = normalize(L + V);

          vec3 lightningColor = vec3(0.75, 0.88, 1.0);

          float facing =
            max(dot(N, L), 0.0);

          float petalSpec =
            pow(max(dot(N, H), 0.0), 48.0) *
            lightning;

          float petalFresnel =
            pow(1.0 - max(dot(N, V), 0.0), 2.4) *
            lightning;

          color += lightningColor * lightning * (0.25 + facing * 0.35);
          color += vec3(1.0) * petalSpec * 0.75;
          color += lightningColor * petalFresnel * 0.25;
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

  const petal = new THREE.Mesh(geometry, material);

  petal.castShadow = true;
  petal.receiveShadow = true;

  petal.userData = {
    material,
    smoothedLocalCursor: new THREE.Vector3(999, 999, 999),
    targetLocalCursor: new THREE.Vector3(999, 999, 999),
    cursorInfluence: 0
  };

  return petal;
}

function createBud(petalColor) {
  const bud = new THREE.Group();

  const budCoreMaterial = new THREE.MeshStandardMaterial({
    color: petalColor,
    roughness: 0.75,
    metalness: 0.0
  });

  const budTipMaterial = new THREE.MeshStandardMaterial({
    color: petalColor,
    roughness: 0.78,
    metalness: 0.0
  });

  const budCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 24, 18),
    budCoreMaterial
  );

  budCore.scale.set(0.8, 1.2, 0.75);
  budCore.castShadow = true;
  budCore.receiveShadow = true;

  bud.add(budCore);

  const budTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.18, 18),
    budTipMaterial
  );

  budTip.position.y = 0.14;
  budTip.castShadow = true;
  budTip.receiveShadow = true;

  bud.add(budTip);

  bud.position.set(0, 0.02, 0.03);
  bud.visible = true;

  bud.userData = {
    budCore,
    budTip,
    budCoreMaterial,
    budTipMaterial,

    startCoreColor: new THREE.Color(petalColor),
    startTipColor: new THREE.Color(petalColor),

    finalCoreColor: new THREE.Color(petalColor),
    finalTipColor: new THREE.Color(petalColor)
  };

  return bud;
}

function updatePetal(
  petal,
  elapsedTime,
  cursorPosition,
  fireflyPositions = [],
  lightningIntensity = 0,
  isNight = false
) {
  const {
    material,
    smoothedLocalCursor,
    targetLocalCursor
  } = petal.userData;

  material.uniforms.uTime.value = elapsedTime;

  if (material.uniforms.uNightAmount) {
    material.uniforms.uNightAmount.value = THREE.MathUtils.lerp(
      material.uniforms.uNightAmount.value,
      isNight ? 1 : 0,
      0.04
    );
  }

  if (material.uniforms.uLightningIntensity) {
    material.uniforms.uLightningIntensity.value = lightningIntensity;
  }

  const cursorIsValid =
    cursorPosition &&
    cursorPosition.x < 900 &&
    cursorPosition.y < 900 &&
    cursorPosition.z < 900;

  if (cursorIsValid) {
    targetLocalCursor.copy(cursorPosition);
    petal.worldToLocal(targetLocalCursor);

    smoothedLocalCursor.lerp(targetLocalCursor, 0.16);

    petal.userData.cursorInfluence = THREE.MathUtils.lerp(
      petal.userData.cursorInfluence,
      1,
      0.14
    );
  } else {
    petal.userData.cursorInfluence = THREE.MathUtils.lerp(
      petal.userData.cursorInfluence,
      0,
      0.12
    );
  }

  material.uniforms.uCursorLocalPosition.value.copy(smoothedLocalCursor);
  material.uniforms.uCursorInfluence.value =
    petal.userData.cursorInfluence;

  if (material.uniforms.uFireflyPositions) {
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
}

export function createFlower({
  petalColor = 0xf2a0c4,
  sepalColor = 0xe98fb8,
  throatColor = 0xffd35a,
  spotColor = 0x9a315f
} = {}) {
  const flower = new THREE.Group();

  const bud = createBud(petalColor);
  flower.add(bud);

  const dorsalSepal = createPetal({
    color: sepalColor,
    length: 0.5,
    maxWidth: 0.115,
    type: "sepal",
    windStrength: 0.006,
    windSpeed: 0.65
  });

  dorsalSepal.position.set(0, -0.01, 0);
  dorsalSepal.rotation.set(
    THREE.MathUtils.degToRad(-8),
    0,
    0
  );

  flower.add(dorsalSepal);

  const leftSepal = createPetal({
    color: sepalColor,
    length: 0.45,
    maxWidth: 0.105,
    type: "sepal",
    windStrength: 0.007,
    windSpeed: 0.7
  });

  leftSepal.position.set(0, 0.015, 0);
  leftSepal.rotation.set(
    THREE.MathUtils.degToRad(-8),
    THREE.MathUtils.degToRad(-10),
    THREE.MathUtils.degToRad(128)
  );

  flower.add(leftSepal);

  const rightSepal = createPetal({
    color: sepalColor,
    length: 0.45,
    maxWidth: 0.105,
    type: "sepal",
    windStrength: 0.007,
    windSpeed: 0.7
  });

  rightSepal.position.set(0, 0.015, 0);
  rightSepal.rotation.set(
    THREE.MathUtils.degToRad(-8),
    THREE.MathUtils.degToRad(10),
    THREE.MathUtils.degToRad(-128)
  );

  flower.add(rightSepal);

  const leftPetal = createPetal({
    color: petalColor,
    length: 0.42,
    maxWidth: 0.17,
    type: "petal",
    windStrength: 0.008,
    windSpeed: 0.75
  });

  leftPetal.position.set(0, 0, 0);
  leftPetal.rotation.set(
    THREE.MathUtils.degToRad(-18),
    THREE.MathUtils.degToRad(18),
    THREE.MathUtils.degToRad(62)
  );

  flower.add(leftPetal);

  const rightPetal = createPetal({
    color: petalColor,
    length: 0.42,
    maxWidth: 0.17,
    type: "petal",
    windStrength: 0.008,
    windSpeed: 0.75
  });

  rightPetal.position.set(0, 0, 0);
  rightPetal.rotation.set(
    THREE.MathUtils.degToRad(-18),
    THREE.MathUtils.degToRad(-18),
    THREE.MathUtils.degToRad(-62)
  );

  flower.add(rightPetal);

  const labellum = createPetal({
    color: petalColor,
    throatColor,
    spotColor,
    length: 0.36,
    maxWidth: 0.22,
    type: "labellum",
    windStrength: 0.009,
    windSpeed: 0.8,
    interactionRadius: 0.24,
    interactionStrength: 0.12
  });

  labellum.position.set(0, 0, 0.03);
  labellum.rotation.set(
    THREE.MathUtils.degToRad(-20),
    0,
    Math.PI
  );

  flower.add(labellum);

  flower.scale.setScalar(0.01);
  flower.visible = false;

  flower.userData = {
    petals: [
      dorsalSepal,
      leftSepal,
      rightSepal,
      leftPetal,
      rightPetal,
      labellum
    ],
    bud,

    basePetalTransforms: [
      {
        position: dorsalSepal.position.clone(),
        rotation: dorsalSepal.rotation.clone(),
        scale: dorsalSepal.scale.clone()
      },
      {
        position: leftSepal.position.clone(),
        rotation: leftSepal.rotation.clone(),
        scale: leftSepal.scale.clone()
      },
      {
        position: rightSepal.position.clone(),
        rotation: rightSepal.rotation.clone(),
        scale: rightSepal.scale.clone()
      },
      {
        position: leftPetal.position.clone(),
        rotation: leftPetal.rotation.clone(),
        scale: leftPetal.scale.clone()
      },
      {
        position: rightPetal.position.clone(),
        rotation: rightPetal.rotation.clone(),
        scale: rightPetal.scale.clone()
      },
      {
        position: labellum.position.clone(),
        rotation: labellum.rotation.clone(),
        scale: labellum.scale.clone()
      }
    ]
  };

  updateFlowerGrowth(flower, 0);

  return flower;
}

export function updateFlower(
  flower,
  elapsedTime,
  cursorPosition,
  fireflyPositions = [],
  lightningIntensity = 0, 
  isNight = false
) {
  if (!flower || !flower.userData.petals) return;

  for (const petal of flower.userData.petals) {
    updatePetal(
      petal,
      elapsedTime,
      cursorPosition,
      fireflyPositions,
      lightningIntensity, 
      isNight
    );
  }
}

export function updateFlowerGrowth(flower, growth) {
  if (!flower) return;

  const data = flower.userData;
  const g = THREE.MathUtils.clamp(growth, 0, 1);

  if (data.bud) {
    const bud = data.bud;
    const budData = bud.userData;

    const budGrowth = smoothstep(0.0, 0.28, g);
    const columnMorph = smoothstep(0.68, 1.0, g);

    bud.visible = true;

    const budScaleX =
      budGrowth *
      THREE.MathUtils.lerp(0.78, 0.34, columnMorph);

    const budScaleY =
      budGrowth *
      THREE.MathUtils.lerp(1.18, 0.42, columnMorph);

    const budScaleZ =
      budGrowth *
      THREE.MathUtils.lerp(0.78, 0.34, columnMorph);

    bud.scale.set(
      Math.max(0.01, budScaleX),
      Math.max(0.01, budScaleY),
      Math.max(0.01, budScaleZ)
    );

    bud.position.set(
      0,
      THREE.MathUtils.lerp(0.02, -0.055, columnMorph),
      THREE.MathUtils.lerp(0.03, 0.115, columnMorph)
    );

    bud.rotation.z =
      Math.sin(g * Math.PI) * 0.06 * (1.0 - columnMorph);

    bud.rotation.x =
      THREE.MathUtils.lerp(0.0, Math.PI / 2, columnMorph);

    if (budData?.budCoreMaterial) {
      budData.budCoreMaterial.color.copy(
        budData.startCoreColor.clone().lerp(
          budData.finalCoreColor,
          columnMorph
        )
      );
    }

    if (budData?.budTipMaterial) {
      budData.budTipMaterial.color.copy(
        budData.startTipColor.clone().lerp(
          budData.finalTipColor,
          columnMorph
        )
      );
    }

    if (budData?.budCore) {
      budData.budCore.scale.set(
        THREE.MathUtils.lerp(0.8, 0.95, columnMorph),
        THREE.MathUtils.lerp(1.2, 0.65, columnMorph),
        THREE.MathUtils.lerp(0.75, 0.85, columnMorph)
      );
    }

    if (budData?.budTip) {
      budData.budTip.position.y =
        THREE.MathUtils.lerp(0.14, -0.045, columnMorph);

      budData.budTip.scale.set(
        THREE.MathUtils.lerp(1.0, 0.45, columnMorph),
        THREE.MathUtils.lerp(1.0, 0.35, columnMorph),
        THREE.MathUtils.lerp(1.0, 0.45, columnMorph)
      );
    }
  }

  const petals = data.petals || [];
  const baseTransforms = data.basePetalTransforms || [];

  const petalOpenStarts = [
    0.40,
    0.48,
    0.52,
    0.60,
    0.64,
    0.74
  ];

  const petalOpenEnds = [
    0.66,
    0.74,
    0.78,
    0.86,
    0.90,
    1.0
  ];

  petals.forEach((petal, index) => {
    const base = baseTransforms[index];
    if (!base) return;

    const p = smoothstep(
      petalOpenStarts[index],
      petalOpenEnds[index],
      g
    );

    petal.visible = p > 0.01;

    const openEase = p * p * (3.0 - 2.0 * p);

    const lengthGrow = smoothstep(0.0, 0.65, p);
    const widthGrow = smoothstep(0.28, 1.0, p);

    petal.scale.set(
      base.scale.x * THREE.MathUtils.lerp(0.18, 1.0, widthGrow),
      base.scale.y * THREE.MathUtils.lerp(0.35, 1.0, lengthGrow),
      base.scale.z * THREE.MathUtils.lerp(0.18, 1.0, widthGrow)
    );

    const emerge = smoothstep(0.0, 0.55, p);
    const settle = smoothstep(0.55, 1.0, p);

    const closedPosition = new THREE.Vector3(0, 0.015, 0.025);
    const semiOpenPosition = base.position.clone().multiplyScalar(0.65);

    petal.position.lerpVectors(
      closedPosition,
      semiOpenPosition,
      emerge
    );

    petal.position.lerp(base.position, settle);

    const closedRotation = base.rotation.clone();

    closedRotation.x += index === 5 ? 0.35 : 0.85;
    closedRotation.y *= 0.15;
    closedRotation.z *= 0.12;

    const overshoot = Math.sin(p * Math.PI) * 0.12;

    petal.rotation.x =
      THREE.MathUtils.lerp(
        closedRotation.x,
        base.rotation.x,
        openEase
      ) +
      overshoot * (index === 5 ? -1.1 : 0.28);

    petal.rotation.y = THREE.MathUtils.lerp(
      closedRotation.y,
      base.rotation.y,
      openEase
    );

    petal.rotation.z = THREE.MathUtils.lerp(
      closedRotation.z,
      base.rotation.z,
      openEase
    );

    const finalSettle = smoothstep(0.82, 1.0, p);

    petal.rotation.x +=
      Math.sin(g * Math.PI * 4.0 + index) *
      0.01 *
      finalSettle;
  });
}