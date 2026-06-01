import * as THREE from "three";

function createBeamTexture(size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");

  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );

  gradient.addColorStop(0.0, "rgba(255, 245, 190, 0.45)");
  gradient.addColorStop(0.35, "rgba(255, 230, 150, 0.18)");
  gradient.addColorStop(1.0, "rgba(255, 220, 120, 0.0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

export function createLightBeam() {
  const group = new THREE.Group();

  const sunlight = new THREE.DirectionalLight(0xffe4a8, 1.7);
  sunlight.position.set(-3, 6, 3);
  sunlight.target.position.set(0, 0, 0);
  sunlight.castShadow = true;

  sunlight.shadow.mapSize.width = 2048;
  sunlight.shadow.mapSize.height = 2048;
  sunlight.shadow.camera.left = -8;
  sunlight.shadow.camera.right = 8;
  sunlight.shadow.camera.top = 8;
  sunlight.shadow.camera.bottom = -8;
  sunlight.shadow.camera.near = 0.5;
  sunlight.shadow.camera.far = 20;

  group.add(sunlight);
  group.add(sunlight.target);

  const beamTexture = createBeamTexture();

  const beamMaterial = new THREE.MeshBasicMaterial({
  map: beamTexture,
  transparent: true,
  opacity: 0.32,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide
});

const beamGeometry = new THREE.CylinderGeometry(
  1.6,  // top radius
  5.5,  // bottom radius
  7.5,  // height
  64,
  1,
  true
);

const beam = new THREE.Mesh(beamGeometry, beamMaterial);

beam.position.set(0, 3.6, 0);
beam.rotation.z = 0;
beam.rotation.x = 0;

group.add(beam);

  return {
    group,
    sunlight,
    beam
  };
}

export function updateLightBeam(lightBeam, isNight) {
  const { sunlight, beam } = lightBeam;

  if (isNight) {
    sunlight.color.set(0x8faaff);
    sunlight.intensity = 0.35;

    beam.material.opacity = 0.08;
    beam.material.color?.set?.(0x9bb8ff);
  } else {
    sunlight.color.set(0xffe4a8);
    sunlight.intensity = 1.7;

    beam.material.opacity = 0.38;
    beam.material.color?.set?.(0xffffff);
  }
}