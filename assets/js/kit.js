// Shared scene helpers for the core and for packs. Packs import this module as 'cozy/kit.js' (import map).
// It holds generic helpers only. Place-specific code lives in the packs (stack ADR-001).
import * as THREE from 'three';

export const Y = new THREE.Vector3(0, 1, 0);

// ---- Deterministic random numbers (stack ADR-008). ----

export function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function rng(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(r, list) {
  return list[Math.floor(r() * list.length)];
}

// ---- Animation. The engine calls tickAll() once per frame. ----

const animated = [];

// entry: a shader uniform set with `time`, or an object with tick(seconds).
export function animate(entry) {
  animated.push(entry);
  return entry;
}

// A throw in one entry must not stop the frame: the engine runs the door check after tickAll().
// The entry that threw is logged one time and removed.
export function tickAll(seconds) {
  for (const a of animated.slice()) {
    try {
      if (a.time) a.time.value = seconds;
      if (a.tick) a.tick(seconds);
    } catch (e) {
      animated.splice(animated.indexOf(a), 1);
      console.error('[kit] animate tick: ' + (e && e.message ? e.message : e));
    }
  }
}

// ---- Materials and small structures. Each structure faces +Z. ----

export const MAT = {
  stone: new THREE.MeshStandardMaterial({ color: '#b3a796', roughness: 0.95, flatShading: true }),
  wood: new THREE.MeshStandardMaterial({ color: '#6b4528', roughness: 0.9 }),
  glow: new THREE.MeshStandardMaterial({ color: '#ffc27a', emissive: '#ffb55e', emissiveIntensity: 3 })
};

export function shadows(obj, cast, receive) {
  obj.traverse(function (m) {
    if (m.isMesh) {
      m.castShadow = cast;
      m.receiveShadow = receive;
    }
  });
}

export function lantern(parent, x, z) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.7, 0.12), MAT.wood);
  post.position.y = 0.85;
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.28), MAT.glow);
  lamp.position.y = 1.85;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.2, 4), MAT.wood);
  cap.position.y = 2.12;
  cap.rotation.y = Math.PI / 4;
  g.add(post, lamp, cap);
  shadows(g, true, true);
  lamp.castShadow = false;
  g.position.set(x, 0, z);
  parent.add(g);
  return g;
}

export function portalDisc(colorA, colorB) {
  const u = animate({
    time: { value: 0 },
    a: { value: new THREE.Color(colorA) },
    b: { value: new THREE.Color(colorB) }
  });
  return new THREE.ShaderMaterial({
    uniforms: u,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    vertexShader:
      'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform float time; uniform vec3 a; uniform vec3 b; varying vec2 vUv;',
      'void main(){',
      '  vec2 p = vUv - 0.5; float r = length(p) * 2.0; float ang = atan(p.y, p.x);',
      '  float sw = sin(ang * 3.0 + r * 9.0 - time * 1.6) * 0.5 + 0.5;',
      '  vec3 col = mix(a, b, sw) * (2.2 - r * 1.2);',
      '  gl_FragColor = vec4(col, smoothstep(1.0, 0.86, r) * 0.95);',
      '  #include <tonemapping_fragment>',
      '  #include <colorspace_fragment>',
      '}'
    ].join('\n')
  });
}

// The plain door frame: the default exterior and the default exit (BDR-010).
export const DOOR_FRAME = { door: 0.6, labelHeight: 3.2 };

export function doorFrame(parent) {
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.7, 0.2), MAT.wood);
  frame.position.y = 1.35;
  const light = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 2.4),
    new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ffcf8a', emissiveIntensity: 1.6 })
  );
  light.position.set(0, 1.2, 0.11);
  parent.add(frame, light);
  return { door: DOOR_FRAME.door, labelHeight: DOOR_FRAME.labelHeight };
}

// ---- Sky and ground for open places. ----

export function sky(root, mood) {
  const sunDir = new THREE.Vector3().fromArray(mood.sunDir).normalize();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(mood.top) },
      horizon: { value: new THREE.Color(mood.horizon) },
      bottom: { value: new THREE.Color(mood.bottom) },
      sunDir: { value: sunDir },
      sunColor: { value: new THREE.Color(mood.sun) }
    },
    vertexShader:
      'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: [
      'uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunColor; varying vec3 vDir;',
      'void main(){',
      '  vec3 d = normalize(vDir); float h = d.y;',
      '  vec3 c = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.7, h), 0.7)) : mix(horizon, bottom, smoothstep(0.0, -0.15, h));',
      '  float s = max(dot(d, sunDir), 0.0);',
      '  c += sunColor * (pow(s, 900.0) * 6.0 + pow(s, 12.0) * 0.45);',
      '  gl_FragColor = vec4(c, 1.0);',
      '  #include <tonemapping_fragment>',
      '  #include <colorspace_fragment>',
      '}'
    ].join('\n')
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat);
  dome.frustumCulled = false;
  root.add(dome);

  if (mood.stars) {
    const r = rng(7),
      pts = [];
    for (let i = 0; i < 700; i++) {
      const v = new THREE.Vector3(r() * 2 - 1, r() * 0.9 + 0.08, r() * 2 - 1).normalize().multiplyScalar(380);
      pts.push(v.x, v.y, v.z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    root.add(
      new THREE.Points(
        geo,
        new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, fog: false })
      )
    );
  }
  if (mood.planet) {
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(60, 32, 16),
      new THREE.MeshStandardMaterial({
        color: '#d98fb6',
        emissive: '#7a3d6a',
        emissiveIntensity: 0.6,
        roughness: 1,
        fog: false
      })
    );
    planet.position.set(-90, 150, -330);
    root.add(planet);
  }
}

export function noise(x, z) {
  return (
    Math.sin(x * 0.11) * Math.cos(z * 0.13) + 0.5 * Math.sin(x * 0.27 + z * 0.21) + 0.25 * Math.cos(x * 0.61 - z * 0.47)
  );
}

// Height of the ground: flat to the radius `flat`, then low-poly hills.
export function heightAt(x, z, flat) {
  const d = Math.hypot(x, z),
    n = noise(x, z);
  const rise = THREE.MathUtils.smoothstep(d, flat, flat + 60);
  return rise * (14 + n * 9) + (d > flat ? n * 0.3 : 0);
}

export function ground(root, colors, flat) {
  const geo = new THREE.PlaneGeometry(360, 360, 120, 120);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position,
    col = [];
  const a = new THREE.Color(colors[0]),
    b = new THREE.Color(colors[1]),
    c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      z = pos.getZ(i);
    pos.setY(i, heightAt(x, z, flat));
    c.copy(a).lerp(b, THREE.MathUtils.clamp(noise(x * 0.5, z * 0.5) * 0.5 + 0.5, 0, 1));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })
  );
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}

// ---- Scatter: random rings of items that keep off the paths and away from structures. ----

function segDist(px, pz, s) {
  const dx = s.bx - s.ax,
    dz = s.bz - s.az,
    L = dx * dx + dz * dz || 1;
  const t = THREE.MathUtils.clamp(((px - s.ax) * dx + (pz - s.az) * dz) / L, 0, 1);
  return Math.hypot(px - (s.ax + t * dx), pz - (s.az + t * dz));
}

// structures: [{ x, z, door: { x, z } }]. Each one gets a straight path from the center to its door.
export function scatterRing(r, structures, flat) {
  const paths = structures.map(function (s) {
    return { ax: 0, az: 0, bx: s.door.x, bz: s.door.z };
  });
  function clear(x, z, pathGap, structGap) {
    for (const s of paths) if (segDist(x, z, s) < pathGap) return false;
    for (const s of structures) if (Math.hypot(x - s.x, z - s.z) < structGap) return false;
    return true;
  }
  return {
    // n items between the radii rMin and rMax. make() gives the scale of each item.
    ring: function (n, rMin, rMax, pathGap, structGap, make) {
      const out = [];
      for (let tries = 0; out.length < n && tries < n * 30; tries++) {
        const a = r() * Math.PI * 2,
          d = rMin + Math.sqrt(r()) * (rMax - rMin);
        const x = Math.sin(a) * d,
          z = Math.cos(a) * d;
        if (clear(x, z, pathGap, structGap))
          out.push(Object.assign({ x, y: heightAt(x, z, flat) - 0.05, z, r: r() * 6.28 }, make()));
      }
      return out;
    },
    // Splits a list into groups, one group for each model.
    split: function (list, models) {
      const groups = {};
      for (const t of list) {
        const m = pick(r, models);
        (groups[m] = groups[m] || []).push(t);
      }
      return groups;
    },
    // Path stones along each path.
    stones: function () {
      const out = [];
      for (const s of paths) {
        const L = Math.hypot(s.bx - s.ax, s.bz - s.az);
        for (let d = 1.2; d < L; d += 1.25) {
          const t = d / L;
          out.push({
            x: s.ax + (s.bx - s.ax) * t + (r() - 0.5) * 0.3,
            z: s.az + (s.bz - s.az) * t + (r() - 0.5) * 0.3,
            y: 0.02,
            r: r() * 6.28,
            s: 0.55 + r() * 0.15
          });
        }
      }
      return out;
    }
  };
}

export function fireflies(root, r) {
  const n = 90,
    pts = [],
    seeds = [];
  for (let i = 0; i < n; i++) {
    const a = r() * 6.28,
      d = 3 + r() * 30;
    pts.push(Math.sin(a) * d, 0.5 + r() * 2.5, Math.cos(a) * d);
    seeds.push(r() * 6.28);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const base = pts.slice();
  const dot = document.createElement('canvas');
  dot.width = dot.height = 32;
  const c2d = dot.getContext('2d'),
    grad = c2d.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,240,190,0.8)');
  grad.addColorStop(1, 'rgba(255,220,150,0)');
  c2d.fillStyle = grad;
  c2d.fillRect(0, 0, 32, 32);
  const mat = new THREE.PointsMaterial({
    color: '#ffe7a8',
    size: 0.22,
    map: new THREE.CanvasTexture(dot),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  root.add(new THREE.Points(geo, mat));
  animate({
    tick: function (t) {
      const p = geo.attributes.position;
      for (let i = 0; i < n; i++) {
        p.setXYZ(
          i,
          base[i * 3] + Math.sin(t * 0.4 + seeds[i]) * 0.6,
          base[i * 3 + 1] + Math.sin(t * 0.9 + seeds[i] * 2) * 0.3,
          base[i * 3 + 2] + Math.cos(t * 0.35 + seeds[i]) * 0.6
        );
      }
      p.needsUpdate = true;
    }
  });
}

// A canvas texture of wood planks for floors.
export function plankTexture(r) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const x = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    const v = 120 + Math.floor(r() * 30);
    x.fillStyle = 'rgb(' + (v + 40) + ',' + (v - 10) + ',' + (v - 55) + ')';
    x.fillRect(0, i * 32, 256, 32);
    x.fillStyle = 'rgba(60,35,20,0.6)';
    x.fillRect(0, i * 32, 256, 2);
    x.fillRect(Math.floor(r() * 256), i * 32, 2, 32);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  return t;
}
