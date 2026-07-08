# TOURBILLON
### The Digital Embassy of Hotel Herrera Panamá

## 🕰️ The Concept: Engineering and Precision
In the world of high horology, the *Tourbillon* is a masterpiece of mechanical engineering. Its purpose is to counteract the effects of gravity, housing the escapement and the balance wheel in a rotating cage that guarantees maximum precision and efficacy in timekeeping.

For **Hotel Herrera Panamá**, the *Tourbillon* transcends physical mechanics to become its **Digital Embassy**. It is the interactive ecosystem where artistic beauty, mathematics, and software engineering converge in perfect synchrony. Just like the gears of a perfectly calibrated watch, this system fluidly and precisely guides users through the different facets, services, and pages that make up the Hotel Herrera experience.

## 🌌 The User Experience
The journey begins with a guided descent. As the user scrolls, the camera moves rhythmically through the structure until it reveals the Main Dome: the Tourbillon.

The heart of the system invites exploration. By hovering over the different cardinal points or mechanisms of the structure, the machinery's time comes to an elegant halt. With a single click, the mechanism opens into a fascinating **Exploded View**:
- The surrounding reality smoothly disintegrates through an organic *Grid Transition* visual effect.
- The selected gears and pieces levitate towards the user, harmoniously separating from the central machinery to be appreciated in detail.
- Each element becomes an interactive component, responding with subtle animations and serving as navigational gears or portals (like the *HH_LOGO*) that lead the visitor to experience Hotel Herrera.

## ⚙️ Technical Architecture and Digital Mastery
Bringing this digital embassy to life requires top-tier technical orchestration, executed through a modern and high-performance ecosystem:

- **3D Engine and Composition:** Built upon the solidity of **React** and the graphical power of **Three.js** (*React Three Fiber*), the project masterfully separates the DOM logic (interfaces and modals) from the mathematics of the 3D environment (WebGL).
- **Cinematic Orchestration (GSAP):** Instead of simple states, the *GreenSock* Animation Platform (GSAP) is used to choreograph complex camera rail movements (*CameraRig*), the physical explosion of the pieces, and the smooth interpolation of each spatial transformation.
- **Rendering and Advanced Optics (Post-processing):** The immersive atmosphere is sculpted through an advanced optical pipeline:
  - **Unreal Bloom:** Dynamic and controlled glows on emissive elements.
  - **Depth of Field (Bokeh):** Simulating a real camera lens to give a genuine sense of macro scale and focus.
  - **Tone Mapping (ACES Filmic) and Radial Chromatic Aberration:** For a hyper-realistic and cinematic visual finish.
  - Materials with *Glass Transmission* that calculate light refraction and dispersion through the glass domes in real-time.
- **High-Frequency Interactions:** Spatial detection (*Raycasting*) is highly optimized. Instead of calculating impacts against the complex geometry of the watch, the code injects invisible collision projectiles (low-polygon count spheres), guaranteeing instantaneous interactivity without sacrificing framerate.
- **Procedural Illusionism (Shaders):** At the GPU level (GLSL), mathematical algorithms like `GridTransition` or `ChunkExplode` cause the architecture to dissolve into grids or fragment mid-air, showcasing a blend between the classical and the cybernetic.

In conclusion, the Hotel Herrera *Tourbillon* is not merely a landing page; it is a virtual artifact of millimeter precision where programming assumes the role of the watchmaker to guide the visitor to the heart of Panama.
