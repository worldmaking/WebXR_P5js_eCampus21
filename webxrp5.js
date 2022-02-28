/* 
	See documentation at https://github.com/worldmaking/WebXR_P5js_eCampus21/blob/main/README.md

	WebXR_P5js is a template for embedding P5.js sketches inside a Three.js WebXR-ready scene for VR and desktop display.

	WebXR_P5js_eCampus21 by Haru Ji and Graham Wakefield and is licensed under the GNU General Public License v3.0, except where otherwise noted.

	This project is made possible with funding by the Government of Ontario and through eCampusOntario’s support of the Virtual Learning Strategy. 
	
	To learn more about the Virtual Learning Strategy visit: https://vls.ecampusontario.ca.
*/

import * as THREE from './build/three.module.js';
import { VRButton } from './jsm/webxr/VRButton.js';
import { OrbitControls } from './jsm/controls/OrbitControls.js';
import Stats from './jsm/libs/stats.module.js';

// and also import the P5.js module:
import p5 from 'https://cdn.skypack.dev/p5';

/*
  This is the function to turn an image file or a p5.js script into an object in Three.js

  It returns a THREE.Group object, which you can place in the world as desired. 
  The Group should normally be at Y=0 to have it align properly,
  but you can position it in X and Z components (group.position.set(x, 0, z))
  and rotate it (group.rotation.y = <radians>) to place in the world,
  finally calling scene.add(group)

  The argument to this function is a JavaScript object with one required field
  and a few optional ones:

  {
    // REQUIRED:
    code: <string of your p5.js code>, OR
    image: <URL to a public image>,

    // RECOMMENDED:
    width: <optional, in meters, defaults to 1m>,
    height: <optional, in meters, defaults to 3m>,
    label: <optional string: label for the artwork>,

    // OPTIONAL:
    depth: <optional, in meters, defaults to 0.01m>,
    resolution: <optional, pixels per meter, defaults to 250>
    update: <Javascript function, which can be used to animate the object>
  }

  Watch out to not make the resolution too high, as it will slow graphics performance

  The p5.js script should have a draw() function, 
  but **no setup()** function
  Also, it must not have a createCanvas() function

  Currently, mouse, keyboard, etc. events are not supported.

  Code by Haru Ji & Graham Wakefield, 2021
*/
function showArtwork(options) {
  let code = options.code;
  let image = options.image;
  let label = options.label;
  // random seed:
  let seed = options.seed;
  let width = options.width || 5;
  let height = options.height || 3;
  let depth = options.depth || 0.01;

  // pixels per meter
  // don't set it too high or it can make the rendering too slow
  let resolution = options.resolution || 250;
  let width_pixels = width * resolution;
  let height_pixels = height * resolution;

  let update = options.update;

  let renderer = options.renderer || 'p5.P2D';

  let artwork;

  if (code) {
    let p5instance = new p5(function (s) {
      let functionbody = `
          let sketch = p5.createGraphics(${width_pixels}, ${height_pixels}, ${renderer});
          with(sketch) {
            texture = new THREE.CanvasTexture(sketch.canvas);
            // setting the random seed here to make the sketches more deterministic between viewers / visits
            randomSeed(${seed});
            let frameCount = 0;
            ${code}
            draw();
            return {
              sketch,
              texture,
              draw() {
                draw();
                frameCount++;
                texture.needsUpdate = true;
              }
            }
          }
          `;
      let create = new Function('p5', 'THREE', functionbody);
      s.sketch = create(s, THREE);
    });
    // { sketch, texture, draw }
    artwork = p5instance.sketch;
  } else if (options.image) {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.crossOrigin = 'Anonymous';
    const myTexture = (artwork = {
      texture: textureLoader.load(options.image),
    });
  }

  // create a Group to hold this work:
  let group = new THREE.Group();

  if (!artwork) return group;

  // sketch.texture can be used in a THREE material map
  // sketch.draw() should be called on every frame for animations
  let canvasGeometry = new THREE.BoxGeometry(width, height, depth); //new THREE.PlaneGeometry(width, height);
  let canvasMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    map: artwork.texture,
  });
  // let nullMaterial = new THREE.MeshBasicMaterial({
  //   color: 0x666666,
  // });
  // let materials = [
  //   nullMaterial,
  //   nullMaterial,
  //   nullMaterial,
  //   nullMaterial,
  //   canvasMaterial,
  //   nullMaterial,
  // ];

  const object = new THREE.Mesh(canvasGeometry, canvasMaterial);
  // center plane on walls
  object.position.set(0, 2, 0);

  object.userData.isCanvas = true;
  object.userData.update = function () {
    if (update) update(object);
    if (artwork.draw) artwork.draw();
  };
  object.userData.sketch = artwork;
  group.add(object);

  if (label) {
    let canvas = document.createElement('canvas');
    canvas.width = 2000;
    canvas.height = 1000;
    let ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';

    label.split('\n').forEach(function (line, i) {
      if (i <= 2) {
        let fontsize = 80;
        ctx.font = 'bold ' + fontsize + 'px Verdana'; //Courier, Arial
        ctx.fillText(line, 10, fontsize * 1.1 * i);
      } else {
        let fontsize = 70;
        ctx.font = '' + fontsize + 'px Verdana'; //Courier, Arial
        ctx.fillText(line, 10, fontsize * 1.1 * i);
      }
    });

    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 1), // text panel size
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        map: new THREE.CanvasTexture(canvas),
        transparent: true,
        opacity: 0,
      })
    );
    panel.userData.isPanel = true;
    panel.position.set(0.5, 0.6, 2.0);
    panel.rotation.x = -Math.PI * 0.15;

    group.add(panel);
  }

  return group;
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
// enable XR option in the renderer
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

// arguments: vertical field of view (degrees), aspect ratio, near clip, far clip:
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.05,
  100
);
// Z axis point out of the screen toward you; units are meters
camera.position.y = 1.5;
camera.position.z = 1.5;

const raycaster = new THREE.Raycaster();

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.y = 1.5;

// ensure the renderer fills the page, and the camera aspect ratio matches:
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
// do this now and whenever the window is resized()
resize();
window.addEventListener('resize', resize, false);

// build a scene graph:
const scene = new THREE.Scene();

// a room
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(8.05, 4, 8.05), // gallery size (meters)
  new THREE.MeshStandardMaterial({
    side: THREE.DoubleSide,
    color: 0x666666,
  })
);
cube.position.y = 2;
scene.add(cube);

const pointlight1 = new THREE.SpotLight(0xffffff, 1, 10, Math.PI);
pointlight1.position.set(0, 4, 0);
pointlight1.castShadow = true;
pointlight1.shadow.camera.near = 1;
pointlight1.shadow.camera.far = 8;
//pointlight1.shadow.bias = -0.000222;
pointlight1.shadow.mapSize.width = 1920 / 2;
pointlight1.shadow.mapSize.height = 1200 / 2;
pointlight1.target.position.set(0, 0, 0);
pointlight1.target.updateMatrixWorld();
pointlight1.penumbra = 0.5;
pointlight1.decay = 1;
pointlight1.shadow.focus = 1;
scene.add(pointlight1);

// currently running sketch:
let currentSketch;

// add a stats view to monitor performance:
const stats = new Stats();
document.body.appendChild(stats.dom);

let t = performance.now();
// the function called at frame-rate to animate & render the scene:
function animate() {
  // monitor our FPS:
  stats.begin();

  scene.traverse(function (o) {
    if (o.userData.isPanel) {
      o.material.opacity = Math.max(0.0, o.material.opacity * 0.9);
    }
  });

  // calculate objects intersecting the picking ray
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const intersects = raycaster.intersectObject(scene, true);
  if (intersects.length) {
    const target = intersects[0].object;

    if (target.userData.isCanvas) {
      currentSketch = target;
    } else if (target.userData.isPanel) {
      target.material.opacity = Math.min(1, target.material.opacity + 0.1);
    }
  }

  // run the p5.js sketches
  if (currentSketch && currentSketch.userData.update) {
    currentSketch.userData.update();
  }

  controls.update();

  // draw the scene:
  renderer.render(scene, camera);
  // monitor our FPS:
  stats.end();
}
// start!
renderer.setAnimationLoop(animate);

export { showArtwork, scene, renderer };
