# Interactive Plant Growth Simulation

This project is an interactive 3D scene developed with **Three.js** and **WebGL**.  
It represents a small natural environment where the user can plant seeds, grow flowers, observe animated grass and plants, switch between day and night, and activate a storm mode with rain and lightning.

The project was developed as part of an Interactive Graphics course and focuses on procedural modeling, animation, shaders, and real-time interaction.

---

## Live Demo

[Open the interactive demo](https://giugiu21.github.io/Project_IG-Plants/)

## Features

- Interactive 3D natural environment
- Seed placement and plant growth
- Procedural flowers, leaves and grass
- Day and night mode
- Fireflies during night mode
- Storm mode with rain, wind and lightning
- Wet ground and puddle effects
- Animated water droplets on plants
- Butterfly animation and butterfly camera
- User interaction with plants and environment

---

## Technologies Used

- JavaScript
- Three.js
- WebGL
- GLSL shaders
- Vite
- HTML
- CSS

---

## Project Description

The scene allows the user to interact with a small virtual ecosystem.  
Seeds can be placed on the ground, and each seed grows into a plant through a gradual animation.  
The plant is composed of a stem, leaves and an orchid-like flower.

The environment changes according to the selected mode.  
During the day, the scene is brighter and warmer.  
At night, the lighting becomes darker and fireflies appear.  
During storm mode, rain starts falling, the wind becomes stronger, the ground becomes wet, puddles appear, and lightning temporarily illuminates the scene.

Most objects in the project are generated procedurally instead of being imported as external 3D models.  
This allows the scene to be lightweight and fully controlled through code.

---

## Main Interactions

The user can:

- plant seeds on the ground;
- watch plants grow over time;
- switch between day and night;
- activate and deactivate storm mode;
- interact with grass and leaves using the cursor;
- observe fireflies at night;
- follow the butterfly using a dedicated camera.

---

## Installation

Clone the repository:

```bash
git clone <repository-url>
cd <repository-name>