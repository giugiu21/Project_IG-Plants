import * as THREE from "three";

/*
  This file creates a transparent wet-ground overlay used during storm mode.

  Placed slightly above the normal ground and uses a custom shader to simulate:
    - darker wet soil
    - puddle areas
    - subtle animated ripples
    - reflected light on wet surfaces
*/

export function createWetGround({
  radius = 6,
  y = 0.018
} = {}) {
  const geometry = new THREE.CircleGeometry(radius * 0.985, 160);

  //custom shader
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,

    uniforms: {
      uTime: { value: 0 },
      uWetness: { value: 0 }, //0 = dry ground, 1 = wet ground
      uPuddleAmount: { value: 0 } // 0 = no puddles, 1 = puddles visible
    },

    /* Vertex shader: modifies the position of the object 
    Handles interaction (puddles generated based on uv positions)
    */
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vPosition;

      void main() {
        vUv = uv;
        vPosition = position;

        gl_Position =
          projectionMatrix *
          modelViewMatrix *
          vec4(position, 1.0);
      }
    `,

    /* Fragment Shader: handles color changes in the pixels
        It creates:
          - puddle masks
          - animated ripples
          - darker wet color
          - reflected light
          - transparency
    */
    fragmentShader: `
      uniform float uTime;
      uniform float uWetness;
      uniform float uPuddleAmount;

      varying vec2 vUv;
      varying vec3 vPosition;

      float circleMask(vec2 uv, vec2 center, float radius, float softness) {
        float d = distance(uv, center);
        return 1.0 - smoothstep(radius, radius + softness, d);
      }

      void main() {
        vec2 uv = vUv;

        float puddle1 = circleMask(uv, vec2(0.35, 0.42), 0.22, 0.11);
        float puddle2 = circleMask(uv, vec2(0.64, 0.55), 0.18, 0.10);
        float puddle3 = circleMask(uv, vec2(0.50, 0.28), 0.14, 0.10);

        float puddleMask = clamp(puddle1 + puddle2 + puddle3, 0.0, 1.0);
        puddleMask *= uPuddleAmount;

        float ripple =
          sin(distance(uv, vec2(0.5, 0.5)) * 70.0 - uTime * 7.0) *
          0.5 + 0.5;

        ripple *= puddleMask * 0.22;

        float alpha =
          uWetness * 0.20 +
          puddleMask * 0.38 +
          ripple * 0.20;

        vec3 wetColor = vec3(0.05, 0.075, 0.08);
        vec3 reflectedLight = vec3(0.45, 0.60, 0.68) * puddleMask * 0.25;

        vec3 color = wetColor + reflectedLight + ripple * vec3(0.12, 0.18, 0.22);

        gl_FragColor = vec4(color, alpha);
      }
    `
  });

  //creating the final mesh
  const mesh = new THREE.Mesh(geometry, material);

  mesh.rotation.x = -Math.PI / 2; //since the ground is on the XY plane
  mesh.position.y = y;
  mesh.renderOrder = 3;

  const state = {
    wetness: 0,
    puddleAmount: 0
  };

  //updating the ground in real time
  function update(deltaTime, rainIntensity) {

    //depends on the intensity of the rain
    const targetWetness = rainIntensity > 0.05 ? 1 : 0;
    const targetPuddles = rainIntensity > 0.45 ? 1 : 0;

    //smooth transition from dry to wet ground
    state.wetness = THREE.MathUtils.lerp(
      state.wetness,
      targetWetness,
      deltaTime * (rainIntensity > 0.05 ? 0.9 : 0.16)
    );

    //smooth transition from no puddles to many puddles
    state.puddleAmount = THREE.MathUtils.lerp(
      state.puddleAmount,
      targetPuddles,
      deltaTime * (rainIntensity > 0.45 ? 0.35 : 0.07)
    );

    //updating the uniforms
    material.uniforms.uTime.value += deltaTime;
    material.uniforms.uWetness.value = state.wetness;
    material.uniforms.uPuddleAmount.value = state.puddleAmount;
  }

  //increases wetness and the puddle amount
  function addImpact() {
    state.wetness = Math.min(1, state.wetness + 0.015);
    state.puddleAmount = Math.min(1, state.puddleAmount + 0.004);
  }

  return {
    mesh,
    material,
    state,
    update,
    addImpact
  };
}