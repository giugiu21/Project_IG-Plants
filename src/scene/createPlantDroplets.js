import * as THREE from "three";

/*Le droplets cadono dall’alto in world space.
Quando colpiscono foglie/petali, si salvano la posizione in local space della mesh colpita, quindi restano attaccate anche se la pianta si muove col vento.
Scivolano seguendo la gravità proiettata sulla superficie e poi, quando arrivano al bordo, si staccano e cadono.*/


const DOWN = new THREE.Vector3(0, -1, 0);
const DEFAULT_NORMAL = new THREE.Vector3(0, 1, 0);

const TMP_ORIGIN = new THREE.Vector3();
const TMP_DIR = new THREE.Vector3();
const TMP_WORLD_NORMAL = new THREE.Vector3();
const TMP_POS = new THREE.Vector3();

const TMP_LOCAL_GRAVITY = new THREE.Vector3();
const TMP_LOCAL_NORMAL = new THREE.Vector3();
const TMP_LOCAL_TANGENT = new THREE.Vector3();
const TMP_MATRIX = new THREE.Matrix4();

function randomPointInDisk(radius) {
  const r = Math.sqrt(Math.random()) * radius;
  const a = Math.random() * Math.PI * 2;

  return {
    x: Math.cos(a) * r,
    z: Math.sin(a) * r
  };
}

function createDropletMaterial() {
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

function createFallingDropGeometry() {
  const geometry = new THREE.SphereGeometry(0.018, 12, 8);

  /**
   * Goccia allungata durante la caduta.
   */
  geometry.scale(0.72, 1.9, 0.72);

  return geometry;
}

function createSurfaceDropGeometry() {
  const geometry = new THREE.SphereGeometry(0.026, 18, 12);

  /**
   * Goccia schiacciata quando si appoggia sulla foglia/petalo.
   */
  geometry.scale(1.0, 0.32, 1.0);

  return geometry;
}

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

export function createPlantDroplets({
  count = 90,
  groundRadius = 4.75,
  spawnHeight = 5.8,
  groundY = 0.02,
  windOffset = new THREE.Vector2(-0.7, 0.08)
} = {}) {
  const group = new THREE.Group();
  group.visible = false;

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
      /**
       * Dati di attacco alla superficie.
       */
      attachedMesh: null,
      isAttached: false,
      isFallingAfterDetach: false,

      /**
       * Coordinate locali sulla foglia/petalo.
       */
      localPosition: new THREE.Vector3(),
      localNormal: new THREE.Vector3(0, 1, 0),
      localVelocity: new THREE.Vector3(),

      /**
       * Dati world quando la goccia si stacca.
       */
      worldVelocity: new THREE.Vector3(),

      /**
       * Dati visivi / vita.
       */
      normal: new THREE.Vector3(0, 1, 0),
      life: 0,
      maxLife: 1,
      highlight
    };

    return mesh;
  }

  function resetFallingDrop(drop, forceTop = false) {
    const p = randomPointInDisk(groundRadius);

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

  function activateSurfaceDrop(hit, sourceVelocity, rainIntensity = 1) {
    const surfaceDrop = surfaceDrops.find((drop) => !drop.visible);
    if (!surfaceDrop) return;

    const data = surfaceDrop.userData;
    const hitObject = hit.object;

    surfaceDrop.visible = true;

    /**
     * Da ora questa goccia è attaccata alla mesh colpita.
     * Questo è il punto fondamentale: se la foglia si muove,
     * la goccia seguirà la sua trasformazione.
     */
    data.attachedMesh = hitObject;
    data.isAttached = true;
    data.isFallingAfterDetach = false;

    /**
     * Salviamo il punto di impatto in local space della foglia/petalo.
     */
    data.localPosition.copy(hit.point);
    hitObject.worldToLocal(data.localPosition);

    /**
     * hit.face.normal è in local space della geometria.
     */
    data.localNormal
      .copy(hit.face?.normal || DEFAULT_NORMAL)
      .normalize();

    /**
     * Normale world per orientare visivamente la goccia.
     */
    TMP_WORLD_NORMAL
      .copy(data.localNormal)
      .transformDirection(hitObject.matrixWorld)
      .normalize();

    data.normal.copy(TMP_WORLD_NORMAL);

    /**
     * Posizione world iniziale.
     */
    surfaceDrop.position.copy(data.localPosition);
    hitObject.localToWorld(surfaceDrop.position);
    surfaceDrop.position.addScaledVector(TMP_WORLD_NORMAL, 0.014);

    surfaceDrop.quaternion.setFromUnitVectors(
      DEFAULT_NORMAL,
      TMP_WORLD_NORMAL
    );

    /**
     * Forma leggermente irregolare.
     */
    const size = 0.65 + Math.random() * 0.85;

    surfaceDrop.scale.set(
      size * (0.85 + Math.random() * 0.35),
      size,
      size * (0.85 + Math.random() * 0.35)
    );

    /**
     * Velocità locale iniziale.
     * Parte quasi ferma, poi viene accelerata dalla gravità proiettata.
     */
    data.localVelocity.set(
      0,
      -0.025 - Math.random() * 0.035,
      0
    );

    /**
     * Vita della goccia sulla superficie.
     */
    data.life =
      THREE.MathUtils.lerp(1.1, 2.8, rainIntensity) +
      Math.random() * 1.4;

    data.maxLife = data.life;

    /**
     * Bagna la mesh colpita.
     * Il tuo createLeaf.js legge questa proprietà come uWetness.
     */
    hitObject.userData.wetness = Math.min(
      1,
      (hitObject.userData.wetness || 0) + 0.22
    );
  }

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

    /**
     * Convertiamo la gravità world nello spazio locale della mesh.
     * Così la goccia scivola correttamente anche se foglia/petalo
     * ruotano o oscillano col vento.
     */
    TMP_LOCAL_GRAVITY.set(0, -1, 0);

    TMP_MATRIX.copy(mesh.matrixWorld).invert();
    TMP_LOCAL_GRAVITY.transformDirection(TMP_MATRIX).normalize();

    TMP_LOCAL_NORMAL.copy(data.localNormal).normalize();

    /**
     * Proiezione della gravità sul piano tangente.
     * Questa è la parte che fa scorrere la goccia sulla superficie,
     * invece di farla attraversare.
     */
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

    /**
     * Attrito superficiale.
     * Più vicino a 1 = scivola più a lungo.
     */
    data.localVelocity.multiplyScalar(0.985);

    /**
     * Aggiorna posizione locale.
     */
    data.localPosition.addScaledVector(
      data.localVelocity,
      deltaTime
    );

    /**
     * Converti local -> world per renderizzare.
     */
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

    /**
     * Limiti semplificati.
     * Per le foglie local y è circa 0..length.
     * Per petali/labello sono valori simili ma più piccoli.
     *
     * Quando la goccia supera questi limiti,
     * si stacca e ricomincia a cadere in world space.
     */
    const detach =
      data.localPosition.y < -0.06 ||
      data.localPosition.y > 1.5 ||
      Math.abs(data.localPosition.x) > 0.5;

    if (detach || data.life <= 0.15) {
      detachSurfaceDrop(drop);
    }

    /**
     * Se resta attaccata, continua a bagnare un po' la mesh.
     */
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

  function detachSurfaceDrop(drop) {
    const data = drop.userData;

    data.isAttached = false;
    data.attachedMesh = null;
    data.isFallingAfterDetach = true;

    /**
     * Quando si stacca, riparte in world space.
     * Usiamo un po' della velocità locale, ma soprattutto gravità.
     */
    data.worldVelocity.set(
      data.localVelocity.x * 0.45,
      -0.55 - Math.random() * 0.45,
      data.localVelocity.z * 0.45
    );
  }

  function updateDetachedSurfaceDrop({
    drop,
    deltaTime,
    rainIntensity,
    lightningIntensity
  }) {
    const data = drop.userData;

    data.worldVelocity.y -= 1.8 * deltaTime;

    drop.position.addScaledVector(
      data.worldVelocity,
      deltaTime
    );

    updateDropMaterial({
      drop,
      rainIntensity,
      lightningIntensity
    });

    if (drop.position.y <= groundY) {
      hideSurfaceDrop(drop);
    }
  }

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

    /**
     * Leggera riduzione nel tempo.
     * Non usiamo multiplyScalar aggressivo per evitare che la scala
     * collassi troppo velocemente frame dopo frame.
     */
    const shrink = THREE.MathUtils.lerp(1.0, 0.55, t);

    drop.scale.x = THREE.MathUtils.lerp(drop.scale.x, shrink, 0.015);
    drop.scale.z = THREE.MathUtils.lerp(drop.scale.z, shrink, 0.015);
  }

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

  function update({
    deltaTime,
    stormState,
    collisionMeshes = [],
    lightningIntensity = 0
  }) {
    const rainIntensity = stormState?.rainIntensity ?? 0;
    const windStrength = stormState?.windStrength ?? 0;

    group.visible = rainIntensity > 0.02;

    if (rainIntensity <= 0.02) {
      return;
    }

    const windDirection =
      stormState?.windDirection || new THREE.Vector2(-0.75, 0.1);

    const windX = windDirection.x * windStrength * 0.55;
    const windZ = windDirection.y * windStrength * 0.55;

    /**
     * Gocce che cadono dall'alto in world space.
     */
    for (const drop of fallingDrops) {
      const velocity = drop.userData.velocity;

      TMP_POS.copy(drop.position);

      velocity.x += windX * deltaTime;
      velocity.z += windZ * deltaTime;

      drop.position.addScaledVector(
        velocity,
        deltaTime * THREE.MathUtils.lerp(0.45, 1.0, rainIntensity)
      );

      /**
       * Orienta la goccia nella direzione della velocità.
       */
      TMP_DIR.copy(velocity);

      if (TMP_DIR.lengthSq() > 0.0001) {
        TMP_DIR.normalize();
        drop.quaternion.setFromUnitVectors(DOWN, TMP_DIR);
      }

      /**
       * Raycast dal punto precedente a quello attuale.
       * Serve per rilevare collisioni anche se la goccia è veloce.
       */
      TMP_ORIGIN.copy(TMP_POS);
      TMP_DIR.subVectors(drop.position, TMP_POS);

      const travelDistance = TMP_DIR.length();

      if (travelDistance > 0.0001 && collisionMeshes.length > 0) {
        TMP_DIR.normalize();

        raycaster.set(TMP_ORIGIN, TMP_DIR);
        raycaster.far = travelDistance + 0.04;

        const hits = raycaster.intersectObjects(
          collisionMeshes,
          false
        );

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

      if (drop.position.y <= groundY) {
        resetFallingDrop(drop, true);
      }

      const d2 =
        drop.position.x * drop.position.x +
        drop.position.z * drop.position.z;

      if (d2 > groundRadius * groundRadius) {
        resetFallingDrop(drop, true);
      }

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

    /**
     * Gocce attaccate a foglie/petali o staccate che cadono via.
     */
    for (const drop of surfaceDrops) {
      if (!drop.visible) continue;

      const data = drop.userData;

      data.life -= deltaTime;

      if (data.isAttached) {
        updateAttachedSurfaceDrop({
          drop,
          deltaTime,
          rainIntensity,
          lightningIntensity
        });
      } else if (data.isFallingAfterDetach) {
        updateDetachedSurfaceDrop({
          drop,
          deltaTime,
          rainIntensity,
          lightningIntensity
        });
      }

      if (data.life <= 0) {
        hideSurfaceDrop(drop);
      }
    }
  }

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