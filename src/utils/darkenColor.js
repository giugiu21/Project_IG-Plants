import * as THREE from "three";

//This function allows the darkening of a color, used in night mode
export function darkenColor(color) {
  const c = new THREE.Color(color);

  c.offsetHSL(
    0,   // hue verso toni più freddi
    -0.05,  // meno saturazione
    -0.25   // più scuro
  );

  return c;
}