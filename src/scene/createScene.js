import * as THREE from "three";

/*This file creates the main scene in the environment */

export function createScene() {
  const scene = new THREE.Scene();

  scene.background = new THREE.Color(0x87ceeb); //background solid color

  const ambientLight = new THREE.AmbientLight(0xddeeff, 0.45); //ambient lighting
  scene.add(ambientLight);

  return {
    scene,
    ambientLight
  };
}