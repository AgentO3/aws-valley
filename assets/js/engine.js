// Core engine (stack ADR-001). Builds the 3D scene for one place from window.PLACE, which
// _layouts/place.html writes from the data of _plugins/packs.rb.
//
// The core holds no place-specific code. It loads the optional pack modules exterior.js, interior.js
// and rules.js with import(), gives each module one ctx object, and runs each pack call in try/catch.
// A pack error logs "[pack <id>] <phase>: <message>". The doors, the exit and the fade still work.
import { hash, rng, tickAll, doorFrame, DOOR_FRAME, sky, shadows } from './kit.js';
import { createView, DISTANCE } from './view.js';

const P = window.PLACE;
const DEG = Math.PI / 180;
const TRIGGER_RADIUS = 1.3;
const SAY_MS = 4000;
const Y = new THREE.Vector3(0, 1, 0);

// Light and air for each mood. A pack picks one with `mood:` in its front matter, or sets an object.
const MOODS = {
  golden: {
    top: '#5f8fd0',
    horizon: '#ffb27a',
    bottom: '#d99a6a',
    sun: '#ffc27e',
    sunI: 3.2,
    sunDir: [-0.62, 0.28, -0.73],
    hemiSky: '#ffd9b0',
    hemiGround: '#4f6b32',
    hemiI: 0.9,
    fog: '#f2b98e',
    fogD: 0.0075,
    ground: ['#6f9a3c', '#4a7a30'],
    exposure: 0.9
  },
  moonlight: {
    top: '#0b0a26',
    horizon: '#4a3570',
    bottom: '#2a2148',
    sun: '#c9d2ff',
    sunI: 1.4,
    sunDir: [0.45, 0.5, -0.74],
    hemiSky: '#7c78c8',
    hemiGround: '#3a3550',
    hemiI: 0.9,
    fog: '#2c2550',
    fogD: 0.016,
    ground: ['#a7a2b8', '#8d879f'],
    exposure: 1.1,
    stars: true,
    planet: true
  },
  hearth: {
    hemiSky: '#ffe0b8',
    hemiGround: '#5a3b22',
    hemiI: 0.55,
    fog: null,
    exposure: 1.0,
    background: '#1a120c',
    ground: ['#6b4a30', '#5a3b22']
  },
  grotto: {
    hemiSky: '#6fd3e0',
    hemiGround: '#1a1420',
    hemiI: 0.35,
    fog: '#0b1820',
    fogD: 0.05,
    exposure: 1.1,
    background: '#05080a',
    ground: ['#4a3f37', '#3a312b']
  }
};

// A mood name gives that preset. A mood object sets its own values over `golden` (design D11).
function resolveMood(m) {
  if (m && typeof m === 'object') return Object.assign({}, MOODS.golden, m);
  if (m && !MOODS[m]) console.warn('[place] unknown mood "' + m + '", using "golden"');
  return MOODS[m] || MOODS.golden;
}

function num(v, fallback) {
  return typeof v === 'number' && isFinite(v) ? v : fallback;
}

// Child ring radius, walk limit and exit distance. The defaults are the values for an open world.
function resolveSize(size, children) {
  const s = size || {};
  const ring = num(s.ring, Math.max(14, children * 4));
  return { ring: ring, walk_limit: num(s.walk_limit, ring + 12), exit: num(s.exit, 9) };
}

function freeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(freeze);
  }
  return o;
}

function el(tag, attrs, kids) {
  const e = document.createElement(tag);
  for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
  (kids || []).forEach(function (c) {
    e.appendChild(c);
  });
  return e;
}

const mood = resolveMood(P.mood);
const size = resolveSize(P.size, P.children.length);

// ---- Pack errors (BDR-012). ----

const errors = [];

function report(id, phase, err) {
  const message = err && err.message ? err.message : String(err);
  errors.push({ id: id, phase: phase, message: message });
  console.error('[pack ' + id + '] ' + phase + ': ' + message);
}

// Runs one pack call. A throw or a rejected promise is reported, and the call gives `fallback`.
function guard(id, phase, fn, fallback) {
  try {
    const out = fn();
    if (out && typeof out.then === 'function') {
      out.then(null, function (e) {
        report(id, phase, e);
      });
      return fallback;
    }
    return out;
  } catch (e) {
    report(id, phase, e);
    return fallback;
  }
}

// Imports one pack module. A failed import is reported and gives null.
function importPack(id, base, file) {
  return import(base + file).then(
    function (m) {
      return m.default === undefined ? null : m.default;
    },
    function (e) {
      report(id, file, e);
      return null;
    }
  );
}

// ---- Models: load each GLB once, then clone it or draw it as instances (stack ADR-009). ----

const loader = new THREE.GLTFLoader();
if (window.MeshoptDecoder) loader.setMeshoptDecoder(window.MeshoptDecoder);
const cache = {};
let pending = 0;

function load(url) {
  if (!cache[url]) {
    pending++;
    cache[url] = new Promise(function (resolve, reject) {
      loader.load(
        url,
        function (g) {
          pending--;
          resolve(g.scene);
        },
        undefined,
        function (e) {
          pending--;
          reject(e);
        }
      );
    });
  }
  return cache[url];
}

function placeCopy(scene, o) {
  const obj = scene.clone(true);
  obj.position.set(o.x || 0, o.y || 0, o.z || 0);
  obj.rotation.y = o.r || 0;
  obj.scale.setScalar(o.s || 1);
  if (o.sy) obj.scale.y *= o.sy;
  shadows(obj, o.cast !== false, o.receive !== false);
  return obj;
}

// Many copies of one model in a single draw call per mesh. Use for plants, rocks and path stones.
function instances(scene, items, o) {
  const g = new THREE.Group();
  if (!items.length) return g;
  scene.updateMatrixWorld(true);
  const base = new THREE.Matrix4(),
    out = new THREE.Matrix4(),
    q = new THREE.Quaternion();
  scene.traverse(function (m) {
    if (!m.isMesh) return;
    const im = new THREE.InstancedMesh(m.geometry, m.material, items.length);
    items.forEach(function (t, i) {
      q.setFromAxisAngle(Y, t.r || 0);
      const s = t.s || 1;
      base.compose(new THREE.Vector3(t.x || 0, t.y || 0, t.z || 0), q, new THREE.Vector3(s, s * (t.sy || 1), s));
      im.setMatrixAt(i, out.multiplyMatrices(base, m.matrixWorld));
    });
    im.castShadow = !!o.cast;
    im.receiveShadow = o.receive !== false;
    im.computeBoundingSphere();
    g.add(im);
  });
  return g;
}

// ctx.model(path, options): `path` is relative to the pack folder. The object is added to ctx.root.
function modelLoader(id, base, root) {
  return function (path, options) {
    const o = options || {};
    // A model path stays inside the pack folder (ADR-002).
    if (typeof path !== 'string' || /^([a-z][a-z0-9+.-]*:|\/|\\)/i.test(path) || path.split(/[\\/]/).includes('..')) {
      report(id, 'model ' + path, new Error('the model path leaves the pack folder'));
      return Promise.resolve(new THREE.Group());
    }
    if (Array.isArray(o.instances) && !o.instances.length) return Promise.resolve(new THREE.Group());
    return load(base + path).then(
      function (scene) {
        const obj = o.instances ? instances(scene, o.instances, o) : placeCopy(scene, o);
        root.add(obj);
        return obj;
      },
      function (e) {
        report(id, 'model ' + path, e);
        return new THREE.Group();
      }
    );
  };
}

// ---- ctx.store: storage for one pack. Keys are "cozy:pack:<id>:<key>", values are JSON. ----

function makeStore(id) {
  const prefix = 'cozy:pack:' + id + ':';
  const memory = new Map();
  // Keys that localStorage refused (for example, a full quota). The memory value is newer than the stored one.
  const unsaved = new Set();
  function local() {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }
  const store = {
    get: function (key) {
      if (unsaved.has(key)) return memory.get(key);
      try {
        const v = local().getItem(prefix + key);
        return v === null ? null : JSON.parse(v);
      } catch {
        return memory.has(key) ? memory.get(key) : null;
      }
    },
    set: function (key, value) {
      // JSON cannot hold undefined. Saving it would store the text "undefined", which no read can parse.
      if (value === undefined) return store.remove(key);
      memory.set(key, value);
      try {
        local().setItem(prefix + key, JSON.stringify(value));
        unsaved.delete(key);
      } catch {
        // Blocked storage: keep the value in memory for this page (NFR-4).
        unsaved.add(key);
      }
    },
    remove: function (key) {
      memory.delete(key);
      unsaved.delete(key);
      try {
        local().removeItem(prefix + key);
      } catch {
        // Blocked storage: nothing to remove.
      }
    }
  };
  return Object.freeze(store);
}

function storeCopy(id) {
  const prefix = 'cozy:pack:' + id + ':';
  const out = {};
  try {
    const ls = window.localStorage;
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (!k.startsWith(prefix)) continue;
      try {
        out[k.slice(prefix.length)] = JSON.parse(ls.getItem(k));
      } catch {
        // One value that is not JSON must not hide the other keys.
      }
    }
  } catch {
    // Blocked storage: no stored keys.
  }
  return out;
}

// ---- ctx.say: a short message to the visitor. ----

const messages = [];
let sayTimer = 0;

function say(text) {
  const s = String(text);
  messages.push(s);
  const box = document.getElementById('say');
  box.textContent = s;
  clearTimeout(sayTimer);
  sayTimer = setTimeout(function () {
    box.textContent = '';
  }, SAY_MS);
}

function makeCtx(id, base, root, place) {
  return Object.freeze({
    root: root,
    model: modelLoader(id, base, root),
    rng: rng(hash(id)),
    store: makeStore(id),
    say: say,
    place: place
  });
}

// ---- Lights. ----

function buildLights(scene3D) {
  scene3D.add(new THREE.HemisphereLight(mood.hemiSky, mood.hemiGround, mood.hemiI));
  if (mood.sun) {
    const sun = new THREE.DirectionalLight(mood.sun, mood.sunI);
    sun.position.fromArray(mood.sunDir).normalize().multiplyScalar(60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera,
      e = size.ring + 18;
    c.left = -e;
    c.right = e;
    c.top = e;
    c.bottom = -e;
    c.near = 1;
    c.far = 160;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    scene3D.add(sun, sun.target);
  }
  if (mood.fog) scene3D.fog = new THREE.FogExp2(mood.fog, mood.fogD);
}

// The default interior (BDR-010): a floor disc and a ring of low walls at the walk limit.
function emptyRoom(root) {
  const r = size.walk_limit;
  if (mood.top) sky(root, mood);
  const colors = mood.ground || ['#7a6a55', '#6b5c48'];
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(r + 1, 48),
    new THREE.MeshStandardMaterial({ color: colors[0], roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(r + 0.6, r + 0.6, 1, 48, 1, true),
    new THREE.MeshStandardMaterial({ color: colors[1], roughness: 1, side: THREE.DoubleSide })
  );
  wall.position.y = 0.5;
  wall.receiveShadow = true;
  root.add(floor, wall);
}

function clear(group) {
  while (group.children.length) group.remove(group.children[0]);
}

// Builds a structure (exterior or exit) in `group`. A bad result gives the plain-frame numbers.
function structure(id, phase, fn, group, ctx) {
  if (typeof fn !== 'function') {
    if (fn !== null && fn !== undefined) report(id, phase, new Error('the default export is not a function'));
    return doorFrame(group);
  }
  let failed = false;
  const out = guard(
    id,
    phase,
    function () {
      try {
        return fn(ctx);
      } catch (e) {
        failed = true;
        throw e;
      }
    },
    null
  );
  if (failed) {
    clear(group);
    return doorFrame(group);
  }
  return {
    door: num(out && out.door, DOOR_FRAME.door),
    labelHeight: num(out && out.labelHeight, DOOR_FRAME.labelHeight)
  };
}

function label(root, text, x, y, z, yaw, id) {
  root.appendChild(
    el('a-text', {
      value: text,
      align: 'center',
      width: 16,
      color: '#f2e2c8',
      side: 'double',
      position: x.toFixed(2) + ' ' + y + ' ' + z.toFixed(2),
      rotation: '0 ' + (yaw / DEG).toFixed(1) + ' 0',
      'data-place': id
    })
  );
}

function vec(v, fallback) {
  if (Array.isArray(v)) return v.join(' ');
  return typeof v === 'string' ? v : fallback;
}

// ---- The player: body point, walk limit, door triggers and page transitions. ----

const player = {
  view: null,
  armed: false,
  active: true,
  triggers: [],
  latched: new Set(),
  locked: [],
  rules: null,
  rulesCtx: null,
  ruleLatched: new Set(),
  tickOn: true,
  exited: false,
  fwd: new THREE.Vector3(0, 0, -1)
};

let leaving = false;

function runExit() {
  if (player.exited) return;
  player.exited = true;
  if (player.rules && typeof player.rules.onExit === 'function') {
    guard(P.id, 'onExit', function () {
      return player.rules.onExit(player.rulesCtx);
    });
  }
}

function go(url) {
  if (leaving) return;
  leaving = true;
  player.active = false;
  runExit();
  document.getElementById('fade').classList.remove('clear');
  setTimeout(function () {
    window.location.href = url;
  }, 400);
}

window.addEventListener('pagehide', runExit);

const camEl = () => document.getElementById('cam');
const rigEl = () => document.getElementById('rig');
const tmp = new THREE.Vector3();

// The direction of the camera on the ground plane.
function forward() {
  camEl().object3D.getWorldDirection(tmp);
  const x = -tmp.x,
    z = -tmp.z,
    L = Math.hypot(x, z);
  if (L > 1e-3) player.fwd.set(x / L, 0, z / L);
  return player.fwd;
}

function camWorld() {
  return camEl().object3D.getWorldPosition(new THREE.Vector3());
}

function setCamWorld(x, z) {
  const cam = camEl().object3D;
  const rig = rigEl().object3D;
  rig.updateMatrixWorld(true);
  const local = rig.worldToLocal(new THREE.Vector3(x, 0, z));
  cam.position.x = local.x;
  cam.position.z = local.z;
}

function thirdPerson() {
  return player.view !== null && player.view.get() === 'third';
}

// The body point is the position that the walk limit and the door triggers use (design 6.6).
function body() {
  const c = camWorld();
  if (!thirdPerson()) return { x: c.x, z: c.z };
  const f = forward();
  return { x: c.x + f.x * DISTANCE, z: c.z + f.z * DISTANCE };
}

function setBody(x, z) {
  if (thirdPerson()) {
    const f = forward();
    setCamWorld(x - f.x * DISTANCE, z - f.z * DISTANCE);
  } else {
    setCamWorld(x, z);
  }
}

// The avatar stands at the body point and looks along the camera direction.
function placeAvatar(b) {
  if (!player.view) return;
  const avatar = player.view.avatar;
  const f = forward();
  avatar.position.set(b.x, 0, b.z);
  avatar.rotation.y = Math.atan2(-f.x, -f.z);
}

// A view change keeps the body point where it is, and disarms the doors (design D15).
function onViewChange(view) {
  const c = camWorld(),
    f = forward();
  if (view === 'third') setCamWorld(c.x - f.x * DISTANCE, c.z - f.z * DISTANCE);
  else setCamWorld(c.x + f.x * DISTANCE, c.z + f.z * DISTANCE);
  player.armed = false;
  placeAvatar(body());
}

function tryDoor(tr) {
  const rules = player.rules;
  if (rules && typeof rules.canEnter === 'function') {
    const said = messages.length;
    const door = { id: tr.id, title: tr.title, url: tr.url, kind: tr.kind };
    // A throw opens the door, so the visitor is never trapped (design D12).
    const ok = guard(
      P.id,
      'canEnter',
      function () {
        return rules.canEnter(player.rulesCtx, door);
      },
      true
    );
    if (ok === false) {
      player.latched.add(tr);
      if (!player.locked.includes(tr.id)) player.locked.push(tr.id);
      if (messages.length === said) say('The door is locked');
      return;
    }
  }
  go(tr.url);
}

function callAction(name) {
  const rules = player.rules;
  const fn = rules && rules.actions && rules.actions[name];
  if (typeof fn !== 'function' || !player.active) return;
  guard(P.id, 'action ' + name, function () {
    return fn(player.rulesCtx);
  });
}

function rulesTick(b, dt) {
  const rules = player.rules;
  if (!rules) return;
  if (Array.isArray(rules.triggers)) {
    rules.triggers.forEach(function (t, i) {
      const pos = (t && t.position) || [0, 0, 0];
      const inside = Math.hypot(b.x - pos[0], b.z - pos[2]) < num(t && t.radius, 1);
      if (inside && !player.ruleLatched.has(i)) {
        player.ruleLatched.add(i);
        callAction(t.action);
      } else if (!inside) player.ruleLatched.delete(i);
    });
  }
  if (player.tickOn && typeof rules.onTick === 'function') {
    try {
      const out = rules.onTick(player.rulesCtx, dt);
      if (out && typeof out.then === 'function') {
        out.then(null, function (e) {
          if (!player.tickOn) return;
          player.tickOn = false;
          report(P.id, 'onTick', e);
        });
      }
    } catch (e) {
      // Log one time, then turn onTick off for this page (edge case E8).
      player.tickOn = false;
      report(P.id, 'onTick', e);
    }
  }
}

AFRAME.registerComponent('place-player', {
  tick: function (t, dtMs) {
    tickAll(t / 1000);
    if (!player.active) return;
    let b = body();
    const r = Math.hypot(b.x, b.z);
    if (r > size.walk_limit) {
      b = { x: (b.x * size.walk_limit) / r, z: (b.z * size.walk_limit) / r };
      setBody(b.x, b.z);
    }
    placeAvatar(b);
    let near = false;
    for (const tr of player.triggers) {
      if (Math.hypot(b.x - tr.x, b.z - tr.z) < TRIGGER_RADIUS) {
        near = true;
        if (player.armed && !player.latched.has(tr)) tryDoor(tr);
      } else {
        player.latched.delete(tr);
      }
    }
    // Do not fire a door until the body point is clear of all doors one time.
    if (!near) player.armed = true;
    if (player.active) rulesTick(b, (dtMs || 0) / 1000);
  }
});

function spawn(placed) {
  const from = new URLSearchParams(window.location.search).get('from');
  const back =
    from &&
    placed.find(function (s) {
      return s.id === from;
    });
  let x = 0,
    z = 0,
    yaw = 0;
  if (back) {
    // Stand 3 m in front of the door that the visitor came out of, and look at it.
    x = back.door.x + Math.sin(back.yaw) * 3;
    z = back.door.z + Math.cos(back.yaw) * 3;
    yaw = back.yaw;
  }
  rigEl().object3D.rotation.y = yaw;
  const local = new THREE.Vector3(x, 0, z).applyAxisAngle(Y, -yaw);
  camEl().object3D.position.set(local.x, 1.6, local.z);
}

// ---- Build: the load sequence of design 6.4. ----

async function build() {
  const scene = document.querySelector('a-scene');
  const renderer = scene.renderer;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMappingExposure = mood.exposure;
  if (mood.background) scene.setAttribute('background', 'color: ' + mood.background);
  buildLights(scene.object3D);

  const root = document.getElementById('world');
  const g = root.object3D;

  // Import only the module files that exist (BDR-010 AC-4).
  const has = function (file) {
    return P.files.includes(file);
  };
  const loaded = await Promise.allSettled(
    P.children
      .map(function (c) {
        return c.files.includes('exterior.js') ? importPack(c.id, c.base, 'exterior.js') : null;
      })
      .concat([
        has('interior.js') ? importPack(P.id, P.base, 'interior.js') : null,
        has('rules.js') ? importPack(P.id, P.base, 'rules.js') : null
      ])
  );
  const mods = loaded.map(function (r) {
    return r.status === 'fulfilled' ? r.value : null;
  });
  const exteriors = mods.slice(0, P.children.length);
  const interior = mods[P.children.length];
  const rules = mods[P.children.length + 1];

  // Lay out the children on an arc in front of the spawn point, or at their `position`.
  const n = P.children.length;
  const spread = Math.min(300, 60 * (n - 1));
  const placed = P.children.map(function (c, i) {
    let x, z;
    if (Array.isArray(c.position)) {
      x = +c.position[0];
      z = +c.position[2];
    } else {
      const t = (n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1)) * DEG;
      x = size.ring * Math.sin(t);
      z = -size.ring * Math.cos(t);
    }
    const yaw = Math.atan2(-x, -z);
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = yaw;
    g.add(group);
    const place = freeze(Object.assign({}, c, { mood: resolveMood(c.mood) }));
    const out = structure(c.id, 'exterior', exteriors[i], group, makeCtx(c.id, c.base, group, place));
    label(root, c.title, x, out.labelHeight, z, yaw, c.id);
    return {
      id: c.id,
      title: c.title,
      url: c.url,
      x: x,
      z: z,
      yaw: yaw,
      door: { x: x + Math.sin(yaw) * out.door, z: z + Math.cos(yaw) * out.door }
    };
  });

  const exitAt = P.parent ? { x: 0, z: size.exit, yaw: Math.atan2(-0, -size.exit) } : null;
  const own = freeze(
    Object.assign({}, P, {
      mood: mood,
      size: size,
      parent: P.parent ? Object.assign({}, P.parent, { mood: resolveMood(P.parent.mood) }) : null,
      children: P.children.map(function (c) {
        return Object.assign({}, c, { mood: resolveMood(c.mood) });
      }),
      layout: {
        doors: placed.map(function (s) {
          return { id: s.id, x: s.x, z: s.z, yaw: s.yaw, door: { x: s.door.x, z: s.door.z } };
        }),
        exit: exitAt
      }
    })
  );

  // The interior. A throw, or no interior.js, gives the empty room.
  const inside = new THREE.Group();
  g.add(inside);
  let result = null;
  if (typeof interior === 'function') {
    let failed = false;
    result = guard(
      P.id,
      'interior',
      function () {
        try {
          return interior(makeCtx(P.id, P.base, inside, own));
        } catch (e) {
          failed = true;
          throw e;
        }
      },
      null
    );
    if (failed) {
      clear(inside);
      emptyRoom(inside);
    }
  } else {
    if (interior !== null) report(P.id, 'interior.js', new Error('the default export is not a function'));
    emptyRoom(inside);
  }
  result = result && typeof result === 'object' ? result : {};

  const triggers = placed.map(function (s) {
    return { id: s.id, title: s.title, url: s.url, kind: 'child', x: s.door.x, z: s.door.z };
  });

  // The exit to the parent (BDR-003). The interior can give its own exit structure (design D10).
  if (exitAt) {
    const group = new THREE.Group();
    group.position.set(exitAt.x, 0, exitAt.z);
    group.rotation.y = exitAt.yaw;
    g.add(group);
    const out = structure(P.id, 'exit', result.exit || null, group, makeCtx(P.id, P.base, group, own));
    label(root, 'Back to ' + P.parent.title, exitAt.x, out.labelHeight, exitAt.z, exitAt.yaw, P.parent.id);
    const sep = P.parent.url.indexOf('?') < 0 ? '?' : '&';
    triggers.push({
      id: P.parent.id,
      title: P.parent.title,
      url: P.parent.url + sep + 'from=' + encodeURIComponent(P.id),
      kind: 'exit',
      x: exitAt.x + Math.sin(exitAt.yaw) * out.door,
      z: exitAt.z + Math.cos(exitAt.yaw) * out.door
    });
  }

  if (P.text) {
    const sign = result.sign || {};
    root.appendChild(
      el(
        'a-entity',
        { position: vec(sign.position, '-4.2 1.5 -1.2'), rotation: vec(sign.rotation, '0 60 0'), id: 'sign' },
        [
          el('a-box', { width: 2.3, height: 1.15, depth: 0.08, color: '#5a3b22' }),
          el('a-text', {
            value: P.text,
            width: 2.1,
            'wrap-count': 32,
            color: '#eedcc0',
            align: 'center',
            position: '0 0 0.05'
          })
        ]
      )
    );
  }

  // Spawn, triggers and the view.
  spawn(placed);
  player.triggers = triggers;
  player.view = createView(P.viewSwitch, onViewChange);
  player.view.start();
  camEl().setAttribute('place-player', '');

  // The rules of this place (BDR-011). The doors and the exit exist first, so a rules error
  // cannot remove them (BDR-012).
  const actionNames = [];
  if (rules && typeof rules === 'object') {
    player.rules = rules;
    player.rulesCtx = makeCtx(P.id, P.base, inside, own);
    const box = document.getElementById('actions');
    Object.keys(rules.actions || {}).forEach(function (name) {
      if (typeof rules.actions[name] !== 'function') return;
      actionNames.push(name);
      const b = el('button', { type: 'button', 'data-action': name });
      b.textContent = name;
      b.addEventListener('click', function () {
        callAction(name);
      });
      box.appendChild(b);
    });
    if (typeof rules.onEnter === 'function') {
      guard(P.id, 'onEnter', function () {
        return rules.onEnter(player.rulesCtx);
      });
    }
  } else if (rules !== null) {
    report(P.id, 'rules.js', new Error('the default export is not an object'));
  }

  // Debug hook for the smoke tests (stack ADR-011). Production code does not read it.
  window.__placeDebug = {
    placed: placed,
    triggers: triggers,
    go: go,
    pending: function () {
      return pending;
    },
    files: P.files,
    view: function () {
      return player.view.get();
    },
    avatar: function () {
      const a = player.view.avatar;
      const head = a.localToWorld(new THREE.Vector3(0, 1.35, 0));
      const cam = scene.camera;
      cam.updateMatrixWorld(true);
      const ndc = head.clone().project(cam);
      const inView = a.visible && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z < 1;
      return { x: a.position.x, z: a.position.z, visible: a.visible, inView: inView };
    },
    camera: function () {
      const c = camWorld();
      return { x: c.x, z: c.z };
    },
    body: body,
    teleport: setBody,
    locked: player.locked,
    actions: actionNames,
    act: callAction,
    messages: messages,
    errors: errors,
    store: function () {
      return storeCopy(P.id);
    }
  };
  requestAnimationFrame(function () {
    document.getElementById('fade').classList.add('clear');
  });
}

function start() {
  build().catch(function (e) {
    console.error('[place] build failed: ' + (e && e.message ? e.message : e));
  });
}

const sceneEl = document.querySelector('a-scene');
if (sceneEl.hasLoaded) start();
else sceneEl.addEventListener('loaded', start);
