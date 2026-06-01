import * as THREE from "three";

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function loadSoilTexture() {
  const textureLoader = new THREE.TextureLoader();

  const texture = textureLoader.load(
    "/textures/GroundDirtWeedsPatchy004_COL_2K.jpg"
  );

  texture.colorSpace = THREE.SRGBColorSpace;

  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;

  // Aumenta o diminuisci questi valori per cambiare la scala della texture
  texture.repeat.set(2.5, 2.5);

  return texture;
}

function createTopSurface(radius, soilTexture) {
  const geometry = new THREE.CircleGeometry(radius * 0.985, 180);

  const position = geometry.attributes.position;
  const vertex = new THREE.Vector3();

  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);

    const dist = Math.sqrt(vertex.x * vertex.x + vertex.y * vertex.y);
    const normalized = dist / (radius * 0.985);

    // Superficie leggermente bombata e irregolare
    const dome = (1.0 - normalized) * 0.045;
    const roughness = rand(-0.012, 0.012);

    vertex.z = dome + roughness;

    position.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    map: soilTexture,
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0.0
  });

  const top = new THREE.Mesh(geometry, material);

  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.012;
  top.receiveShadow = true;
  top.castShadow = false;

  return top;
}

function createIslandBody(radius, soilTexture) {
  const geometry = new THREE.CylinderGeometry(
    radius,
    radius * 0.88,
    0.62,
    180,
    3,
    false
  );

  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    map: soilTexture,
    color: 0xffffff,
    roughness: 1.0,
    metalness: 0.0
  });

  const island = new THREE.Mesh(geometry, material);

  island.position.y = -0.31;
  island.castShadow = true;
  island.receiveShadow = true;

  return island;
}

function createDarkEdge(radius) {
  const geometry = new THREE.RingGeometry(radius * 0.88, radius * 1.0, 180);

  const material = new THREE.MeshStandardMaterial({
    color: 0x2f2117,
    roughness: 1.0,
    metalness: 0.0,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.45
  });

  const edge = new THREE.Mesh(geometry, material);

  edge.rotation.x = -Math.PI / 2;
  edge.position.y = 0.035;
  edge.receiveShadow = true;

  return edge;
}

export function createGround(radius = 5) {
  const groundGroup = new THREE.Group();

  const soilTexture = loadSoilTexture();

  const island = createIslandBody(radius, soilTexture);
  const topSurface = createTopSurface(radius, soilTexture);
  const darkEdge = createDarkEdge(radius);

  groundGroup.add(island);
  groundGroup.add(topSurface);
  groundGroup.add(darkEdge);

  return {
    groundGroup,
    topSurface
  };
}