import * as THREE from "three";

const raycaster = new THREE.Raycaster();

const segmentDirection = new THREE.Vector3();
const segmentStart = new THREE.Vector3();
const segmentEnd = new THREE.Vector3();

export function updateRainCollisions({
  rainSystem,
  wetGround,
  interactiveMeshes = [],
  groundRadius = 4.75,
  rainIntensity = 0
}) {
  if (!rainSystem || rainIntensity <= 0.02) return;

  const drops = rainSystem.drops;

  for (let i = 0; i < drops.length; i++) {
    const drop = drops[i];

    segmentStart.copy(drop.previous);
    segmentEnd.copy(drop.position);

    const segmentLength = segmentStart.distanceTo(segmentEnd);
    if (segmentLength <= 0.001) continue;

    segmentDirection
      .subVectors(segmentEnd, segmentStart)
      .normalize();

    raycaster.set(segmentStart, segmentDirection);
    raycaster.far = segmentLength;

    /**
     * Prima controlliamo se colpisce foglie/petali.
     * Usiamo solo una parte delle gocce per non appesantire troppo.
     */
    if (interactiveMeshes.length > 0 && i % 3 === 0) {
      const hits = raycaster.intersectObjects(interactiveMeshes, false);

      if (hits.length > 0) {
        const hit = hits[0];

        if (hit.object.userData) {
          hit.object.userData.wetness = Math.min(
            1,
            (hit.object.userData.wetness || 0) + 0.16
          );
        }

        rainSystem.addSurfaceDrop(
          hit.point,
          hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0)
        );

        rainSystem.addSplash(hit.point, 0.5);
        rainSystem.resetDrop(i);

        continue;
      }
    }

    /**
     * Collisione col terreno.
     */
    if (drop.position.y <= 0.04) {
      const x = drop.position.x;
      const z = drop.position.z;
      const distance = Math.sqrt(x * x + z * z);

      if (distance <= groundRadius) {
        const impactPoint = new THREE.Vector3(x, 0.025, z);

        rainSystem.addSplash(impactPoint, rainIntensity);

        if (wetGround) {
          wetGround.addImpact(impactPoint);
        }
      }

      rainSystem.resetDrop(i);
    }
  }
}