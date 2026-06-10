import * as THREE from "three";

//this function computes a random point inside a predifined circumference
export function randomPointInCircle(radius) {
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.sqrt(Math.random()) * radius;

  return {
    x: Math.cos(angle) * distance,
    z: Math.sin(angle) * distance
  };
}

