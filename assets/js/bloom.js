// Desktop bloom for lanterns, portals and crystals. VR sessions skip it, because a post-process costs too much there.
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const sceneEl = document.querySelector('a-scene');

function setup() {
  const renderer = sceneEl.renderer;
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  const pass = new RenderPass(sceneEl.object3D, sceneEl.camera);
  const bloom = new UnrealBloomPass(size, 0.5, 0.55, 1.0);
  composer.addPass(pass);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // A-Frame calls renderer.render() once per frame. Send that call through the composer.
  const render = renderer.render.bind(renderer);
  let inside = false;
  renderer.render = function (scene, camera) {
    if (inside || renderer.xr.isPresenting) return render(scene, camera);
    inside = true;
    pass.camera = camera;
    try {
      composer.render();
    } finally {
      inside = false;
    }
  };
  window.addEventListener('resize', function () {
    const s = renderer.getSize(new THREE.Vector2());
    composer.setSize(s.x, s.y);
  });
  window.__bloom = bloom;
  window.__bloomComposer = composer;
}

if (sceneEl.hasLoaded) setup();
else sceneEl.addEventListener('loaded', setup);
