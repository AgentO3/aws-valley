// View switch and avatar (stack ADR-013, BDR-008).
// The camera stays the controlled body. In the third person view, the avatar walks DISTANCE metres
// in front of the camera, and the "body point" (the point that the walk limit and the door triggers
// use) is the avatar. In the first person view, the body point is the camera.
import * as THREE from 'three';

const KEY = 'cozy:view';
const VIEWS = ['first', 'third'];
export const DISTANCE = 2.5;

function readStored() {
  try {
    const v = window.localStorage.getItem(KEY);
    return VIEWS.includes(v) ? v : 'first';
  } catch {
    return 'first';
  }
}

function writeStored(view) {
  try {
    window.localStorage.setItem(KEY, view);
  } catch {
    // Blocked storage: the view goes back to first person at the next page load (ADR-013).
  }
}

function buildAvatar() {
  const g = new THREE.Group();
  const coat = new THREE.MeshStandardMaterial({ color: '#c8643c', roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: '#f0c9a0', roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 1.1, 12), coat);
  body.position.y = 0.55;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), skin);
  head.position.y = 1.35;
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), skin);
  nose.position.set(0, 1.35, -0.25);
  g.add(body, head, nose);
  g.traverse(function (m) {
    if (m.isMesh) m.castShadow = true;
  });
  g.visible = false;
  return g;
}

// setting: 'key' | 'key-and-button' | 'url'. onChange(view) runs after each change.
export function createView(setting, onChange) {
  let view = 'first';
  let inVR = false;
  const avatarEl = document.createElement('a-entity');
  avatarEl.id = 'avatar';
  document.getElementById('world').appendChild(avatarEl);
  const avatar = buildAvatar();
  avatarEl.object3D.add(avatar);
  const button = setting === 'key-and-button' ? document.getElementById('view-btn') : null;

  function render() {
    avatar.visible = view === 'third';
    if (button) {
      button.setAttribute('aria-pressed', String(view === 'third'));
      button.textContent = view === 'third' ? 'First person view' : 'Third person view';
    }
  }

  function set(next, store) {
    if (inVR || !VIEWS.includes(next) || next === view) return;
    const prev = view;
    view = next;
    if (store) writeStored(view);
    render();
    onChange(view, prev);
  }

  function toggle() {
    set(view === 'first' ? 'third' : 'first', true);
  }

  // The stored view applies on each page load. With 'url', ?view= sets and stores the view.
  let start = readStored();
  if (setting === 'url') {
    const q = new URLSearchParams(window.location.search).get('view');
    if (VIEWS.includes(q)) {
      start = q;
      writeStored(q);
    }
  }

  if (setting === 'key' || setting === 'key-and-button') {
    window.addEventListener('keydown', function (e) {
      if (e.code !== 'KeyV' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      toggle();
    });
  }
  if (button) button.addEventListener('click', toggle);

  // In VR the view is always first person, and the switch has no effect (BDR-008 AC-5).
  const scene = document.querySelector('a-scene');
  scene.addEventListener('enter-vr', function () {
    set('first', false);
    inVR = true;
  });
  scene.addEventListener('exit-vr', function () {
    inVR = false;
    set(readStored(), false);
  });

  render();
  return {
    avatar: avatar,
    get: function () {
      return view;
    },
    // Applies the start view. The engine calls this after the spawn.
    start: function () {
      set(start, false);
    }
  };
}
