# Tourbillon Interactive Experience

An immersive and high-performance 3D web experience built with React, Three.js (React Three Fiber), and GSAP. This project presents an interactive visualization of an architectural and mechanical "Tourbillon", combining realistic material rendering, advanced post-processing effects, and smooth transitions based on user scroll and direct interaction.

---

## 🚀 Core Technologies

- **React & Vite**: The foundation of the application and the bundler for fast and modern development.
- **Three.js & React Three Fiber (@react-three/fiber)**: 3D engine and its declarative layer for React. Allows structuring the 3D scene as a tree of components.
- **@react-three/drei**: A collection of useful helpers, abstractions, and utilities for R3F (Environment, Cameras, Loaders, HTML overlays).
- **GSAP (GreenSock Animation Platform)**: Animation engine used to orchestrate all complex transitions (camera movement, model explosions, interfaces).
- **Leva**: Graphical User Interface (GUI) panel used for real-time parameter tweaking (lighting, post-processing, debuggers).
- **Postprocessing (three/addons)**: Visual effects pipeline (Bloom, SSR, Depth of Field, Tone Mapping, etc.).

---

## 🏗️ Architecture and Main Components

The application is structured to decouple User Interface logic (DOM UI) from three-dimensional logic (WebGL).

### 1. Entry Point & Global Configuration
- **`App.jsx`**: Main entry point. Sets up the WebGL Canvas, adaptive resolution scaling (AdaptiveDpr for performance), HTML overlays (Navbar, Return button, Exploded View UI), and the initial loading screen (`Loader`).
- **`Experience.jsx`**: The core of the 3D scene. Orchestrates lighting, the environment (HDRI), the post-processing rendering pipeline, and mounts all 3D models and animation logic.

### 2. Rendering and Visual Effects
- **PostProcessing (`Experience.jsx`)**: Advanced pipeline featuring:
   - **Unreal Bloom**: Dynamic glow on bright elements.
  - **Bokeh / Depth of Field**: Realistic camera blur.
  - **Color Grading**: Brightness and contrast adjustments, ACES Filmic Tone Mapping.
  - **Chromatic Aberration & Vignette**: Custom radial optical effects via Shaders.
- **Glass Transmission (`GlassTransmission` / `CaseTransmission`)**: Utilizes `MeshPhysicalMaterial` to calculate real-time light transmission, refraction (IOR), and dispersion for the glass pieces of the dome.

### 3. Models and Mechanical System
- **`SceneModels.jsx`**: Efficiently loads and manages `.glb` files using a custom hook (`useAdvancedGLTF`). Handles base materials and contains the continuous gear animation logic ("GEARS"), driving cyclic rotations frame-by-frame to emulate the original mechanical behavior from Blender.

### 4. Navigation and Camera
- **`CameraRig.jsx`**: A scroll-driven camera rail system. Animates the camera across multiple predefined "Waypoints", smoothly interpolating position and rotation to tell the architectural story.

### 5. Complex Interactions (Exploded Views)
- **`TourbillonAnimations.jsx`**: The brain behind interactivity.
  - Detects hovers through a `Raycaster` using optimized invisible spherical meshes.
  - Upon clicking main zones (East, North, South, West), it physically separates the models, bringing them closer to the user ("Exploded View").
  - Each individual piece within the exploded model reacts to hover with descriptive tooltips, a slight movement (yoyo animation), and clicking them opens external links or informative modal windows.
  - **Advanced Effects Integration**: Combines spatial animation with procedural cloaking ("Grid Transition"), fading out parts of the model that do not belong to the focused zone.

### 6. Shaders and Procedural Effects (`/utils`)
- **`GridTransition.js`**: Temporarily replaces the models' material with a custom shader that "disintegrates" the geometry based on local and world coordinates.
- **`ChunkExplode.js`**: Dynamic shader that fragments specific polygons mimicking an assembly/disassembly tech effect (applied, for example, on the Apothecary rings).
- **`MagicShockwave.js`**: Shockwave or expansive energy effects used to emphasize visual events.

### 7. User Interface (UI) and Audio
- **`ExplodedUI.jsx`**: Renders HTML panels that float above the 3D Canvas, displaying titles and detailed content (modals) for explored sections.
- **`SpatialAudioController.jsx`**: Regulates the spatial position of the surround sound, adjusting volumes based on the camera's proximity to key points in the 3D scene.
- **`Loader.jsx`**: Controls loading progress and the initial reveal of the scene.

---

## 🚶‍♂️ User Flow and Experience (Step-by-Step)

1. **Initial Loading (`Loader` & `FadeIn`)**
   - The user sees a loading screen while assets (`.glb`, textures, `.hdr`) are downloaded. Once complete, an elegant fade reveals the main scene with the camera at its starting position (Waypoint 0).

2. **Scroll Exploration (`CameraRig`)**
   - As the user scrolls, the camera follows a 3D path traveling through tunnels and crystals until arriving in front of the Main Dome (Tourbillon).

3. **Interacting with the Tourbillon (`TourbillonAnimations`)**
   - Upon arriving at the Tourbillon, the user can aim their cursor at different sections (Cardinal points: North, South, East, West).
   - The *Raycasting* system detects the section, changes the cursor, pauses the machinery's time (`gsap.to(timeScale: 0)`), and displays the main title of the zone (e.g., "THEhotel", "THEapothecary").

4. **Exploded View**
   - Clicking a section triggers the explosion routine:
     - The *GridTransition* shader visually fades out all machinery and surroundings that don't belong to the selection.
     - The pieces of the selected zone are logically unparented to avoid inheriting incorrect transformations.
     - Using GSAP, groups of pieces are moved to specific positions close to the camera and rotated for easy reading.
   - During this state, scrolling is disabled and a "Back to Tourbillon" button alongside a main descriptive modal (DOM UI) appears.

5. **Detailed Interaction**
   - Inside the exploded view, the user can hover over individual pieces (e.g., "Alquimia Circle Outer").
   - The piece reacts (Y-axis Yoyo animation, Chunk Explode shader activates). A *Tooltip* is shown.
   - Upon clicking, the user might open external reservation links, redirect to Nootropics stores, or trigger an in-depth modal (e.g., The Science).

6. **Returning (Collapse)**
   - Clicking "Back to Tourbillon" reparents the meshes to their original groups (e.g., `AlquimiaTourbillonDome` returns to `PinEast`, which continues rotating).
   - GSAP reverses the local positions and rotations.
   - The *GridTransition* rematerializes the rest of the building.
   - Scrolling is re-enabled.

---

## 🛠️ Technical Notes and Optimizations
- The app relies on `useRef` to store non-reactive references to meshes and perform manual transformations inside the Game Loop (`useFrame`) or through GSAP animations, avoiding costly React re-renders.
- All collisions are evaluated using simplified bounding spheres or boxes (`__explodedCollider`), guaranteeing that raycast detection is extremely fast without processing complex geometry.
- AdaptiveDPR allows automatic resolution scaling based on GPU load, maintaining a consistent framerate.
