// Particles, screen shake, skid marks and explosions. One pooled particle system
// (a THREE.Points cloud with per-particle velocity and life) so the frame never
// allocates while playing; skid marks are a capped pool of dark quads on the road.
import * as THREE from 'three';

const MAX_PARTICLES = 600;
const MAX_SKIDS = 240;

export function createEffects(scene) {
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const colors = new Float32Array(MAX_PARTICLES * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.35, vertexColors: true, transparent: true, opacity: 0.95,
    depthWrite: false, sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 5;
  scene.add(points);

  const parts = [];
  for (let i = 0; i < MAX_PARTICLES; i++) {
    parts.push({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, grav: 0, r: 1, g: 1, b: 1 });
    positions[i * 3 + 1] = -100; // parked below the world until used
  }
  let cursor = 0;

  // Skid marks: flat dark quads laid on the road, oldest recycled first.
  const skidGeo = new THREE.PlaneGeometry(0.35, 1.4);
  const skidMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.55, depthWrite: false });
  const skids = [];
  for (let i = 0; i < MAX_SKIDS; i++) {
    const m = new THREE.Mesh(skidGeo, skidMat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.02;
    m.visible = false;
    scene.add(m);
    skids.push(m);
  }
  let skidCursor = 0;
  let shakeAmp = 0;

  function spawn(x, y, z, vx, vy, vz, life, r, g, b, grav) {
    const p = parts[cursor];
    const i = cursor;
    cursor = (cursor + 1) % MAX_PARTICLES;
    p.life = life; p.max = life;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.r = r; p.g = g; p.b = b; p.grav = grav;
    positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
    colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
  }

  return {
    burst(x, y, z, n, color, speed, life, up = 0.5, grav = 6) {
      const c = new THREE.Color(color);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.4 + Math.random() * 0.8);
        spawn(x, y, z, Math.cos(a) * s, up + Math.random() * speed * 0.6, Math.sin(a) * s,
          life * (0.6 + Math.random() * 0.7), c.r, c.g, c.b, grav);
      }
    },
    muzzle(x, y, z, dirX, dirZ) {
      this.burst(x, y, z, 6, 0xffd27a, 6, 0.12, 0.1, 0);
      spawn(x + dirX * 0.4, y, z + dirZ * 0.4, dirX * 14, 0.4, dirZ * 14, 0.1, 1, 0.85, 0.4, 0);
    },
    smoke(x, y, z, n = 3) {
      for (let i = 0; i < n; i++) {
        spawn(x + (Math.random() - 0.5) * 0.5, y + Math.random() * 0.4, z + (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.6, 1.2 + Math.random(), (Math.random() - 0.5) * 0.6,
          1.1 + Math.random() * 0.6, 0.45, 0.45, 0.45, -1.5);
      }
    },
    explosion(x, y, z) {
      this.burst(x, y + 0.6, z, 42, 0xff7a2a, 11, 0.9, 0.8, 8);
      this.burst(x, y + 0.6, z, 26, 0xffd27a, 7, 0.6, 0.9, 4);
      this.burst(x, y + 0.6, z, 18, 0x333333, 3, 1.6, 1.4, -1);
      shakeAmp = Math.min(1.2, shakeAmp + 0.7);
    },
    blood(x, y, z) { this.burst(x, y, z, 10, 0xa01818, 4, 0.5, 0.6, 9); },
    addShake(amount) { shakeAmp = Math.min(1.2, shakeAmp + amount); },
    skid(x, z, heading) {
      const m = skids[skidCursor];
      skidCursor = (skidCursor + 1) % MAX_SKIDS;
      m.position.set(x, 0.02, z);
      m.rotation.z = -heading;
      m.visible = true;
    },
    /** Shake offset for the camera this frame; call once per frame. */
    shakeOffset(dt) {
      if (shakeAmp < 0.01) return { x: 0, y: 0 };
      shakeAmp = Math.max(0, shakeAmp - dt * 1.8);
      return { x: (Math.random() - 0.5) * shakeAmp * 0.5, y: (Math.random() - 0.5) * shakeAmp * 0.35 };
    },
    update(dt) {
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = parts[i];
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) { positions[i * 3 + 1] = -100; continue; }
        p.vy -= p.grav * dt;
        positions[i * 3] += p.vx * dt;
        positions[i * 3 + 1] += p.vy * dt;
        positions[i * 3 + 2] += p.vz * dt;
        if (positions[i * 3 + 1] < 0.03 && p.grav > 0) { positions[i * 3 + 1] = 0.03; p.vy = 0; p.vx *= 0.9; p.vz *= 0.9; }
        const fade = p.life / p.max;
        colors[i * 3] = p.r * fade + 0.05;
        colors[i * 3 + 1] = p.g * fade + 0.05;
        colors[i * 3 + 2] = p.b * fade + 0.05;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}
