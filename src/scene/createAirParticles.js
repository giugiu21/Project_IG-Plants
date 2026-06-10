import * as THREE from "three";

/*Creates and animates small particles in the air, the particles are modeled as simple squares of different sizes */

export function createAirParticles({ count = 350 } = {}) {
  const geometry = new THREE.BufferGeometry(); //creates a simple square shape

  const positions = new Float32Array(count * 3); //creating all the particles possible positions 

  for (let i = 0; i < count; i++) {
    const r = Math.sqrt(Math.random()) * 4.8; //random distance from center in a max ray of 4.8
    const a = Math.random() * Math.PI * 2; //random angle

    //saving the particle coordinates (x, y, z)
    positions[i * 3 + 0] = Math.cos(a) * r;
    positions[i * 3 + 1] = 0.35 + Math.random() * 3.2;
    positions[i * 3 + 2] = Math.sin(a) * r;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xefe5c1,
    size: 0.025,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const particles = new THREE.Points(geometry, material);

  particles.userData.initialPositions = positions.slice();

  return particles;
}

export function animateAirParticles(particles, elapsedTime, isNight) {
  const positions = particles.geometry.attributes.position.array;
  const initial = particles.userData.initialPositions;

  for (let i = 0; i < positions.length / 3; i++) {
    const ix = i * 3;

    //adding the movement (spostamento) for each particle as a function of passed time
    positions[ix + 0] =
      initial[ix + 0] + Math.sin(elapsedTime * 0.35 + i * 0.17) * 0.035; 

    positions[ix + 1] =
      initial[ix + 1] + Math.sin(elapsedTime * 0.55 + i * 0.31) * 0.045;

    positions[ix + 2] =
      initial[ix + 2] + Math.cos(elapsedTime * 0.28 + i * 0.13) * 0.035;
  }

  particles.geometry.attributes.position.needsUpdate = true; //updates the new position

  particles.material.opacity = isNight ? 0.12 : 0.45; //different color fo night and day 
}