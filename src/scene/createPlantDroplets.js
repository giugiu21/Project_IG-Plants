import * as THREE from "three";
import { randomPointInCircle } from "../utils/randomPointInCircle.js";

/*Droplets fall from the sky above in the environment:
    Main objects: 
      - falling drops (more oblung in shape)
      - surface drops (they stick to leaves/petals and fall according to gravity)

    Main functions:
    - when colliding with leaves/petals they save their position the local space of the collided mesh and stay attached
    - they slowly drop following gravity, when they arrive at the edge of the leaf/petal they detach and falll off

*/

//Constants
const DOWN = new THREE.Vector3(0, -1, 0); //Downwards direction
const DEFAULT_NORMAL = new THREE.Vector3(0, 1, 0); //Upwards direction

//Vectors
const TMP_ORIGIN = new THREE.Vector3();
const TMP_DIR = new THREE.Vector3();
const TMP_WORLD_NORMAL = new THREE.Vector3();
const TMP_POS = new THREE.Vector3();

const TMP_LOCAL_GRAVITY = new THREE.Vector3();
const TMP_LOCAL_NORMAL = new THREE.Vector3();
const TMP_LOCAL_TANGENT = new THREE.Vector3();
const TMP_MATRIX = new THREE.Matrix4();


function createDropletMaterial() {
  //realistical mesh for the water droplets
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

//When the drops are falling they are more oblung in shape
function createFallingDropGeometry() {
  const geometry = new THREE.SphereGeometry(0.018, 12, 8);

  // Oblung shape
  geometry.scale(0.72, 1.9, 0.72);

  return geometry;
}

//When the drops attach themselves to a surface they become flatter
function createSurfaceDropGeometry() {
  const geometry = new THREE.SphereGeometry(0.026, 18, 12);

  //flatter shape
  geometry.scale(1.0, 0.32, 1.0);

  return geometry;
}

//Creating highlights for a more realistic water look
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


//Creating the actual droplets
export function createPlantDroplets({
  count = 90,
  groundRadius = 4.75,
  spawnHeight = 5.8,
  groundY = 0.02,
  windOffset = new THREE.Vector2(-0.7, 0.08)
} = {}) {
  const group = new THREE.Group();
  group.visible = false; //visibility only if in storm mode

  //Allows the detection of collisions with the surfaces
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

  //Creating the drops that only fall down
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

  //Creating the droplets that attach to surfaces
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
      attachedMesh: null,
      isAttached: false,
      isFallingAfterDetach: false,

      //Local coordinates to leaves and petals
      localPosition: new THREE.Vector3(),
      localNormal: new THREE.Vector3(0, 1, 0),
      localVelocity: new THREE.Vector3(),

      //velocity when the droplets detach
      worldVelocity: new THREE.Vector3(),

      //visual data
      normal: new THREE.Vector3(0, 1, 0),
      life: 0,
      maxLife: 1,
      highlight
    };

    return mesh;
  }

  /*Reset function for falling droplets
      Used: 
        - at the beginning
        - when the droplets touch the ground
        - when the droplets are outside the rain area
        - after hitting a leaf or petal
  */
function resetFallingDrop(drop, forceTop = false) {
    const p = randomPointInCircle(groundRadius);

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

  //used when a droplet hits a petal or leaf
function activateSurfaceDrop(hit, sourceVelocity, rainIntensity = 1) {
    // we find a visible surface drop already present in the scene , we don't create a new one
    const surfaceDrop = surfaceDrops.find((drop) => !drop.visible);
    if (!surfaceDrop) return;

    //attaching the droplet to the mesh
    const data = surfaceDrop.userData;
    const hitObject = hit.object;

    surfaceDrop.visible = true;

    //if the surface moves the droplet also moves with it
    data.attachedMesh = hitObject;
    data.isAttached = true;
    data.isFallingAfterDetach = false;

    //Saving the impact point in the local space of the object
    data.localPosition.copy(hit.point);
    hitObject.worldToLocal(data.localPosition);

    //finding the normal direction in the local space of the object
    data.localNormal
      .copy(hit.face?.normal || DEFAULT_NORMAL)
      .normalize();

    //converting the local normal in world normal
    TMP_WORLD_NORMAL
      .copy(data.localNormal)
      .transformDirection(hitObject.matrixWorld)
      .normalize();

    data.normal.copy(TMP_WORLD_NORMAL);

    //initial world position
    surfaceDrop.position.copy(data.localPosition);
    hitObject.localToWorld(surfaceDrop.position);
    surfaceDrop.position.addScaledVector(TMP_WORLD_NORMAL, 0.014);

    //Rotating the droplet so that its vertical axis is aligned with the surface normal direction
    surfaceDrop.quaternion.setFromUnitVectors(
      DEFAULT_NORMAL,
      TMP_WORLD_NORMAL
    );

    //irregular droplet shape
    const size = 0.65 + Math.random() * 0.85;

    surfaceDrop.scale.set(
      size * (0.85 + Math.random() * 0.35),
      size,
      size * (0.85 + Math.random() * 0.35)
    );

    //At first the droplet is very slow and then later the velocity increases based on gravity
    data.localVelocity.set(
      0,
      -0.025 - Math.random() * 0.035,
      0
    );

    //how long the droplet lives in the surface
    data.life =
      THREE.MathUtils.lerp(1.1, 2.8, rainIntensity) +
      Math.random() * 1.4;

    data.maxLife = data.life;
  }

  //creating the droplets
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


function updateAttachedSurfaceDrop({
    drop,
    deltaTime,
    rainIntensity,
    lightningIntensity
  }) {
    const data = drop.userData;
    const mesh = data.attachedMesh;

    if (!mesh) {
      data.isAttached = false;
      return;
    }

    //converting the world gravity to the local mesh space
    TMP_LOCAL_GRAVITY.set(0, -1, 0);

    TMP_MATRIX.copy(mesh.matrixWorld).invert();
    TMP_LOCAL_GRAVITY.transformDirection(TMP_MATRIX).normalize();

    TMP_LOCAL_NORMAL.copy(data.localNormal).normalize();

    //Projection of the gravity in the tangent plane --- this allows the slow sliding of the droplets
    TMP_LOCAL_TANGENT
      .copy(TMP_LOCAL_GRAVITY)
      .addScaledVector(
        TMP_LOCAL_NORMAL,
        -TMP_LOCAL_GRAVITY.dot(TMP_LOCAL_NORMAL)
      );

    if (TMP_LOCAL_TANGENT.lengthSq() > 0.0001) {
      TMP_LOCAL_TANGENT.normalize();

      const slideAcceleration =
        THREE.MathUtils.lerp(0.025, 0.12, rainIntensity);

      data.localVelocity.addScaledVector(
        TMP_LOCAL_TANGENT,
        slideAcceleration * deltaTime
      );
    }

    //Adding friction (close to 1 means a longer sliding)
    data.localVelocity.multiplyScalar(0.985);

    //updating the local position
    data.localPosition.addScaledVector(
      data.localVelocity,
      deltaTime
    );

    //Conversion of local to world position for rendering
    drop.position.copy(data.localPosition);
    mesh.localToWorld(drop.position);

    TMP_WORLD_NORMAL
      .copy(data.localNormal)
      .transformDirection(mesh.matrixWorld)
      .normalize();

    drop.position.addScaledVector(TMP_WORLD_NORMAL, 0.014);

    drop.quaternion.setFromUnitVectors(
      DEFAULT_NORMAL,
      TMP_WORLD_NORMAL
    );

    //Limits to define when the droplet detaches from the leaves/petals
    const detach =
      data.localPosition.y < -0.06 ||
      data.localPosition.y > 1.5 ||
      Math.abs(data.localPosition.x) > 0.5;

    if (detach || data.life <= 0.15) {
      detachSurfaceDrop(drop);
    }

    //if the droplet is attached then we change the wetness of the mesh
    if (data.isAttached && mesh.userData) {
      mesh.userData.wetness = Math.min(
        1,
        (mesh.userData.wetness || 0) + rainIntensity * deltaTime * 0.08
      );
    }

    updateDropMaterial({
      drop,
      rainIntensity,
      lightningIntensity
    });
  }

//Detaches the droplet
function detachSurfaceDrop(drop) {
    const data = drop.userData;

    data.isAttached = false;
    data.attachedMesh = null;
    data.isFallingAfterDetach = true;

    //when it detaches is in world space
    data.worldVelocity.set(
      data.localVelocity.x * 0.45,
      -0.55 - Math.random() * 0.45,
      data.localVelocity.z * 0.45
    );
  }

//updates the falling of the detached droplet
function updateDetachedSurfaceDrop({
    drop,
    deltaTime,
    rainIntensity,
    lightningIntensity
  }) {
    const data = drop.userData;

    data.worldVelocity.y -= 1.8 * deltaTime; //applying gravity

    drop.position.addScaledVector(
      data.worldVelocity,
      deltaTime
    );

    updateDropMaterial({
      drop,
      rainIntensity,
      lightningIntensity
    });

    //when it reaches the ground it disappears
    if (drop.position.y <= groundY) {
      hideSurfaceDrop(drop);
    }
  }

//updates the droplets material based on the lightning strikes and the life left
function updateDropMaterial({
    drop,
    rainIntensity,
    lightningIntensity
  }) {
    const data = drop.userData;

    const t =
      1.0 - data.life / data.maxLife;

    const fade = THREE.MathUtils.clamp(1.0 - t, 0.0, 1.0);

    drop.material.opacity =
      fade *
      THREE.MathUtils.lerp(0.38, 0.82, rainIntensity);

    drop.material.emissiveIntensity =
      0.035 + lightningIntensity * 0.7;

    drop.material.envMapIntensity =
      1.5 + rainIntensity * 1.4 + lightningIntensity * 2.6;

    if (data.highlight) {
      data.highlight.material.opacity =
        fade *
        (0.22 + rainIntensity * 0.3 + lightningIntensity * 0.85);
    }

    //shrinks slowly with time 
    const shrink = THREE.MathUtils.lerp(1.0, 0.55, t);

    drop.scale.x = THREE.MathUtils.lerp(drop.scale.x, shrink, 0.015);
    drop.scale.z = THREE.MathUtils.lerp(drop.scale.z, shrink, 0.015);
  }

  //hiding the droplets -- used when they fall to the ground
function hideSurfaceDrop(drop) {
    const data = drop.userData;

    drop.visible = false;

    data.attachedMesh = null;
    data.isAttached = false;
    data.isFallingAfterDetach = false;
    data.life = 0;

    data.localVelocity.set(0, 0, 0);
    data.worldVelocity.set(0, 0, 0);

    if (data.highlight) {
      data.highlight.material.opacity = 0;
    }
  }

//updating the whole system
function update({
    deltaTime,
    stormState,
    collisionMeshes = [],
    lightningIntensity = 0
  }) {
    const rainIntensity = stormState?.rainIntensity ?? 0;
    const windStrength = stormState?.windStrength ?? 0;

    group.visible = rainIntensity > 0.02;

    //if there's no rain don't do anything
    if (rainIntensity <= 0.02) {
      return;
    }

    //computing the wind settings
    const windDirection = stormState?.windDirection || new THREE.Vector2(-0.75, 0.1);

    const windX = windDirection.x * windStrength * 0.55;
    const windZ = windDirection.y * windStrength * 0.55;

    //drops are falling constantly
    for (const drop of fallingDrops) {
      const velocity = drop.userData.velocity;

      TMP_POS.copy(drop.position);

      velocity.x += windX * deltaTime;
      velocity.z += windZ * deltaTime;

      drop.position.addScaledVector(
        velocity,
        deltaTime * THREE.MathUtils.lerp(0.45, 1.0, rainIntensity)
      );

      TMP_DIR.copy(velocity); //oriented in velocity's direction

      if (TMP_DIR.lengthSq() > 0.0001) {
        TMP_DIR.normalize();
        drop.quaternion.setFromUnitVectors(DOWN, TMP_DIR);
      }

      //Raycast settings
      TMP_ORIGIN.copy(TMP_POS);
      TMP_DIR.subVectors(drop.position, TMP_POS);

      const travelDistance = TMP_DIR.length();

      //raycast from old position to new position
      if (travelDistance > 0.0001 && collisionMeshes.length > 0) {
        TMP_DIR.normalize();

        raycaster.set(TMP_ORIGIN, TMP_DIR);
        raycaster.far = travelDistance + 0.04;

        const hits = raycaster.intersectObjects(
          collisionMeshes,
          false
        );

        //if we find a collision
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

      //if it has fallen on to the ground
      if (drop.position.y <= groundY) {
        resetFallingDrop(drop, true);
      }

      //reset if outside of the area 
      const d2 =
        drop.position.x * drop.position.x +
        drop.position.z * drop.position.z;

      if (d2 > groundRadius * groundRadius) {
        resetFallingDrop(drop, true);
      }

      //changing the refraction of light based on the lighting
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

    //Surface drops settings
    for (const drop of surfaceDrops) {
      if (!drop.visible) continue;

      const data = drop.userData;

      data.life -= deltaTime;

      //updates when attached
      if (data.isAttached) {
        updateAttachedSurfaceDrop({
          drop,
          deltaTime,
          rainIntensity,
          lightningIntensity
        });
        //update the falling if detached
      } else if (data.isFallingAfterDetach) {
        updateDetachedSurfaceDrop({
          drop,
          deltaTime,
          rainIntensity,
          lightningIntensity
        });
      }
      //if it is dead hide it
      if (data.life <= 0) {
        hideSurfaceDrop(drop);
      }
    }
  }

//set active/inactive
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