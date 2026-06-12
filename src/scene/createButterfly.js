import * as THREE from "three";
import wingsTextureUrl from "../assets/textures/wings-monarch.jpg";
/*Creating and animating the 3D butterfly object.
    Main functions:
    - building the butterfly model (body, head, wings, antennas, legs)
    - applying texture
    - modeling the movement in the environment
    - collision avoidance
    - removing the object in storm mode
*/

//3D vectors (x, y, z)
const TMP_DIRECTION = new THREE.Vector3(); //direction of butterfly's movement
const TMP_OBSTACLE = new THREE.Vector3(); //position of the obstacles in the environment
const TMP_AVOIDANCE = new THREE.Vector3(); //sum of the forces to move the butterfly away from the obstacles
const TMP_AWAY = new THREE.Vector3(); //new direction away from obstacles


//Day and Night colors
const DAY_BODY_COLOR = new THREE.Color(0x352517);
const NIGHT_BODY_COLOR = new THREE.Color(0x1b2132);

const DAY_EYE_COLOR = new THREE.Color(0x050403);
const NIGHT_EYE_COLOR = new THREE.Color(0x000000);

const DAY_WING_TINT = new THREE.Color(0xffffff);
const NIGHT_WING_TINT = new THREE.Color(0xcc9b5298);


//Generating a random point in the environment to choose:
// - the initial position of the butterfly
// - new direction
function randomPointInAir(radius = 3.8) {
  const r = Math.sqrt(Math.random()) * radius;
  const a = Math.random() * Math.PI * 2;

  return new THREE.Vector3(
    Math.cos(a) * r,
    1.1 + Math.random() * 1.8,
    Math.sin(a) * r
  );
}

//Applies UV coordinates to the wings --> to position the texture
function applyWingUVs(geometry) {
  geometry.computeBoundingBox();

  const box = geometry.boundingBox;

  const sizeX = box.max.x - box.min.x;
  const sizeZ = box.max.z - box.min.z;

  const position = geometry.attributes.position;
  const uvs = [];

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);

    const u = sizeX > 0 ? (x - box.min.x) / sizeX : 0;
    const v = sizeZ > 0 ? (z - box.min.z) / sizeZ : 0;

    uvs.push(u, v);
  }

  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(uvs, 2)
  );
}


//Creating the wing's shape (side = 1 right side, side = -1 left side)
function createWingGeometry(side = 1) {
  const shape = new THREE.Shape(); //new 2D shape

  shape.moveTo(0, -0.22); //initial point

  //Bezier Curves allow the modeling of curved shapes --> they recieve 3 points: control1, control2, final point
  shape.bezierCurveTo(
    side * 0.12,
    -0.46,
    side * 0.46,
    -0.66,
    side * 0.78,
    -0.42
  );

  shape.bezierCurveTo(
    side * 0.96,
    -0.27,
    side * 0.88,
    -0.02,
    side * 0.56,
    0.02
  );

  shape.bezierCurveTo(
    side * 0.66,
    0.10,
    side * 0.64,
    0.18,
    side * 0.50,
    0.20
  );

  shape.bezierCurveTo(
    side * 0.68,
    0.34,
    side * 0.50,
    0.55,
    side * 0.25,
    0.42
  );

  shape.bezierCurveTo(
    side * 0.08,
    0.34,
    side * 0.02,
    0.15,
    0,
    0.08
  );

  shape.lineTo(0, -0.22); //closing the shape

  //converting the drawing into a geometry that we can use with three.js
  const geometry = new THREE.ShapeGeometry(shape, 80); 
  const position = geometry.attributes.position;

  //modifying the vertices
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getY(i); //y-coordinate becomes z coordinate

    const distanceFromBody = Math.abs(x);

    const camber =
      Math.sin(
        THREE.MathUtils.clamp(distanceFromBody / 0.85, 0, 1) *
          Math.PI
      ) * 0.025;

    const organicCurve =
      Math.sin((z + 0.25) * Math.PI * 2.4) *
      distanceFromBody *
      0.01;

    position.setXYZ(
      i,
      x,
      camber + organicCurve,
      z
    );
  }

  applyWingUVs(geometry);
  geometry.computeVertexNormals();

  return geometry;
}



function createAntenna(side = 1, material) {
  //curved lines
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 0.022, 0.03, -0.13),
    new THREE.Vector3(side * 0.055, 0.08, -0.18),
    new THREE.Vector3(side * 0.075, 0.12, -0.23),
    new THREE.Vector3(side * 0.055, 0.145, -0.27)
  ]);

  const geometry = new THREE.TubeGeometry(
    curve,
    16,
    0.004,
    5,
    false
  );

  const antenna = new THREE.Mesh(geometry, material);

  //tip of the antenna
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.009, 8, 6),
    material
  );

  tip.position.copy(curve.getPoint(1));
  antenna.add(tip);

  return antenna;
}


function createLeg(side = 1, z = 0, material) {
  //curved lines
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 0.018, -0.012, z),
    new THREE.Vector3(side * 0.055, -0.035, z + 0.015),
    new THREE.Vector3(side * 0.095, -0.055, z + 0.04)
  ]);

  const geometry = new THREE.TubeGeometry(
    curve,
    8,
    0.003,
    4,
    false
  );

  return new THREE.Mesh(geometry, material);
}


function createButterflyMesh() {
  const butterfly = new THREE.Group();

  const textureLoader = new THREE.TextureLoader();

  const rightWingTexture = textureLoader.load(wingsTextureUrl);

  const leftWingTexture = textureLoader.load(wingsTextureUrl);

  //const rightWingTexture = textureLoader.load("/textures/wings-monarch.jpg");
  rightWingTexture.colorSpace = THREE.SRGBColorSpace;

  //const leftWingTexture = textureLoader.load("/textures/wings-monarch.jpg");
  leftWingTexture.colorSpace = THREE.SRGBColorSpace;

  leftWingTexture.wrapS = THREE.RepeatWrapping;
  leftWingTexture.repeat.x = -1;
  //leftWingTexture.offset.x = 1;

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: DAY_BODY_COLOR,
    roughness: 0.8,
    metalness: 0
  });

  const eyeMaterial = new THREE.MeshStandardMaterial({
    color: DAY_EYE_COLOR,
    roughness: 0.35,
    metalness: 0.05
  });

  const leftWingMaterial = new THREE.MeshStandardMaterial({
    map: leftWingTexture,
    color: DAY_WING_TINT,
    roughness: 0.62,
    metalness: 0,
    side: THREE.DoubleSide
  });

  const rightWingMaterial = new THREE.MeshStandardMaterial({
    map: rightWingTexture,
    color: DAY_WING_TINT,
    roughness: 0.62,
    metalness: 0,
    side: THREE.DoubleSide
  });


  butterfly.userData.materials = {
    bodyMaterial,
    eyeMaterial,
    leftWingMaterial,
    rightWingMaterial,
    nightMix: 0
  };

  //Butterfly composed of: body, head, left/right wings with their pivot groups, 2 antennas, 6 legs
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.028, 0.19, 8, 14),
    bodyMaterial
  );

  body.rotation.x = Math.PI / 2;
  body.position.set(0, -0.002, 0.07);
  body.scale.set(0.82, 1.5, 1.22);
  butterfly.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.038, 14, 10),
    bodyMaterial
  );

  head.position.set(0, 0.012, -0.125);
  head.scale.set(1, 0.92, 1.08);
  butterfly.add(head);

  const leftWingPivot = new THREE.Group();
  const rightWingPivot = new THREE.Group();

  leftWingPivot.position.set(-0.018, 0.012, -0.035);
  rightWingPivot.position.set(0.018, 0.012, -0.035);

  butterfly.add(leftWingPivot);
  butterfly.add(rightWingPivot);

  const leftWingGroup = new THREE.Group();
  const rightWingGroup = new THREE.Group();

  const leftWing = new THREE.Mesh(
    createWingGeometry(-1),
    leftWingMaterial
  );

  const rightWing = new THREE.Mesh(
    createWingGeometry(1),
    rightWingMaterial
  );

  leftWingGroup.add(leftWing);
  rightWingGroup.add(rightWing);

  leftWingGroup.rotation.z = THREE.MathUtils.degToRad(-4);
  rightWingGroup.rotation.z = THREE.MathUtils.degToRad(4);

  leftWingGroup.rotation.x = THREE.MathUtils.degToRad(2);
  rightWingGroup.rotation.x = THREE.MathUtils.degToRad(2);

  leftWingPivot.add(leftWingGroup);
  rightWingPivot.add(rightWingGroup);

  butterfly.add(createAntenna(-1, bodyMaterial));
  butterfly.add(createAntenna(1, bodyMaterial));

  butterfly.add(createLeg(-1, -0.085, bodyMaterial));
  butterfly.add(createLeg(1, -0.085, bodyMaterial));

  butterfly.add(createLeg(-1, -0.03, bodyMaterial));
  butterfly.add(createLeg(1, -0.03, bodyMaterial));

  butterfly.add(createLeg(-1, 0.035, bodyMaterial));
  butterfly.add(createLeg(1, 0.035, bodyMaterial));

  butterfly.userData.leftWingPivot = leftWingPivot;
  butterfly.userData.rightWingPivot = rightWingPivot;

  butterfly.scale.setScalar(0.50);

  //adding the shadow
  butterfly.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return butterfly;
}

//Plant avoidance for the butterfly
function applyPlantAvoidance({
  position,
  direction,
  plants
}) {
  TMP_AVOIDANCE.set(0, 0, 0); //avoidance vector reset

  //for each plant in the scene
  for (const plant of plants) {
    plant.getWorldPosition(TMP_OBSTACLE);
    TMP_OBSTACLE.y += 0.8;

    const plantAvoidRadius = 0.45;
    const plantDistance = position.distanceTo(TMP_OBSTACLE);

    if (plantDistance < plantAvoidRadius) {
      TMP_AWAY.subVectors(position, TMP_OBSTACLE);//computing the new direction away from the obstacle

      if (TMP_AWAY.lengthSq() > 0.0001) { //check that butterfly and flower are in different positions
        TMP_AWAY.normalize();

        const strength = 1.0 - plantDistance / plantAvoidRadius;

        //computing how strong the avoidance has to be
        TMP_AVOIDANCE.addScaledVector(
          TMP_AWAY,
          strength * strength * 0.9
        );
      }
    }
  }

  if (TMP_AVOIDANCE.lengthSq() > 0.0001) {
    direction.add(TMP_AVOIDANCE).normalize();
  }
}

function chooseSafeRandomTarget({
  radius,
  plants
}) {
  for (let i = 0; i < 18; i++) {
    const target = randomPointInAir(radius);

    let safe = true;

    //choose a point that is far away from the plants
    for (const plant of plants) {
      plant.getWorldPosition(TMP_OBSTACLE);
      TMP_OBSTACLE.y += 0.85;
      if (target.distanceTo(TMP_OBSTACLE) < 0.75) {
        safe = false;
        break;
      }
      else{
        return target;
      }
    } 
  }
  //fall back if after 18 tries doen't find anything
  return randomPointInAir(radius);
}

export function createButterfly({
  radius = 3.8
} = {}) {
  const group = new THREE.Group();

  const butterfly = createButterflyMesh();
  group.add(butterfly);

  butterfly.position.copy(randomPointInAir(radius)); //initial position

  const state = {
    radius, //max radius in which the butterfly flies within

    target: randomPointInAir(radius), //next destination

    speed: 0.55,
    turnSpeed: 4.5,

    flapPhase: Math.random() * Math.PI * 2, //random phase for butterfly's wing flap
    flapSpeed: 12.0,

    hoverPhase: Math.random() * Math.PI * 2, //random phase for butterfly's wing hovering

    visibleStrength: 1 //used to make the butterfly disappear in storm mode
  };

  group.userData = {
    butterfly,
    state
  };

  return {
    group,
    butterfly,
    state
  };
}

export function animateButterfly(
  butterflySystem,
  deltaTime,
  elapsedTime,
  {
    isNight = false,
    plants = [],
    isRaining = false
  } = {}
) {
  const { butterfly, state } = butterflySystem;

  const materials = butterfly.userData.materials;

  //night-day color transformation
  if (materials) {
    const nightMix = THREE.MathUtils.lerp(
      materials.nightMix || 0,
      isNight ? 1 : 0,
      deltaTime * 3.0
    );

    materials.nightMix = nightMix;

    materials.bodyMaterial.color.lerpColors(
      DAY_BODY_COLOR,
      NIGHT_BODY_COLOR,
      nightMix
    );


    materials.leftWingMaterial.color.lerpColors(
      DAY_WING_TINT,
      NIGHT_WING_TINT,
      nightMix
    );

    materials.rightWingMaterial.color.lerpColors(
      DAY_WING_TINT,
      NIGHT_WING_TINT,
      nightMix
    );

    materials.leftWingMaterial.emissive.set(0x0a1028);
    materials.rightWingMaterial.emissive.set(0x0a1028);

    materials.leftWingMaterial.emissiveIntensity = 0.06 * nightMix;
    materials.rightWingMaterial.emissiveIntensity = 0.06 * nightMix;
  }

  const targetVisible = isRaining ? 0 : 1; //changing visibility when raining

  //gradually disappearing/appearing
  state.visibleStrength = THREE.MathUtils.lerp(
    state.visibleStrength,
    targetVisible,
    deltaTime * 4.0
  );

  butterfly.visible = state.visibleStrength > 0.03;

  if (!butterfly.visible) {
    return;
  }

  butterfly.scale.setScalar(0.65 * state.visibleStrength); //butterfly reduces in size when disappearing/reappearing

  const flap = Math.sin(elapsedTime * state.flapSpeed + state.flapPhase) * 0.75; //wing flap with amplitude of 0.75

  const leftWingPivot = butterfly.userData.leftWingPivot;
  const rightWingPivot = butterfly.userData.rightWingPivot;

  //rotation of the wings
  if (leftWingPivot && rightWingPivot) {
    leftWingPivot.rotation.z =
      THREE.MathUtils.degToRad(-6) - flap;

    rightWingPivot.rotation.z =
      THREE.MathUtils.degToRad(6) + flap;
  }

  const distanceToTarget = butterfly.position.distanceTo(state.target); //movement direction to target

  //when close to target we choose a new one
  if (distanceToTarget < 0.22) {
    state.target.copy(
      chooseSafeRandomTarget({
        radius: state.radius,
        plants
      })
    );
  }

  TMP_DIRECTION.subVectors(state.target, butterfly.position); //direction vector

  const distance = TMP_DIRECTION.length();

  //if we have a long enough distance we travel there
  if (distance > 0.001) {
    TMP_DIRECTION.normalize();

    applyPlantAvoidance({
      position: butterfly.position,
      direction: TMP_DIRECTION,
      plants
    });

    const naturalSpeed =
      state.speed * (0.82 + 0.18 * Math.sin(elapsedTime * 2.3 + state.hoverPhase)); //variable velocity, oscillating in time

    //moving the butterfly
    butterfly.position.addScaledVector(
      TMP_DIRECTION,
      naturalSpeed * deltaTime
    );

    //oscillating in y-axis
    butterfly.position.y +=
      Math.sin(elapsedTime * 4.0 + state.hoverPhase) *
      0.006;

    //limiting the height of flight
    butterfly.position.y = THREE.MathUtils.clamp(
      butterfly.position.y,
      0.7,
      3.5
    );

    //staying in the enviroment
    const distanceFromCenter = Math.sqrt(
      butterfly.position.x * butterfly.position.x +
      butterfly.position.z * butterfly.position.z
    );

    //if the butterfly goes away from the scene we change direction
    if (distanceFromCenter > state.radius * 1.05) {
      state.target.copy(
        chooseSafeRandomTarget({
          radius: state.radius * 0.75,
          plants
        })
      );
    }

    //horiziontal rotation to change path
    const targetYaw = Math.atan2(
      -TMP_DIRECTION.x,
      -TMP_DIRECTION.z
    );

    let angleDiff = targetYaw - butterfly.rotation.y;

    angleDiff = Math.atan2(
      Math.sin(angleDiff),
      Math.cos(angleDiff)
    );

    butterfly.rotation.y +=
      angleDiff *
      Math.min(1, deltaTime * state.turnSpeed);

    butterfly.rotation.z = -angleDiff * 0.45;
  }
}