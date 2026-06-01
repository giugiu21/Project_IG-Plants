import * as THREE from "three";

export function createScene() {
  const scene = new THREE.Scene();

  scene.background = new THREE.Color(0x87ceeb);
  //scene.background = new THREE.Color(0x87ceeb); //celeste

  const ambientLight = new THREE.AmbientLight(0xddeeff, 0.45);
  scene.add(ambientLight);

  return {
    scene,
    ambientLight
  };
}