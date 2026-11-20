// Pedestrians: walkers on the sidewalks who stroll between corners, chat in pairs,
// and flee from gunfire, crashes and the player's car. A walker hit by a car is
// knocked down and the wanted level rises.
import * as THREE from 'three';
import { CFG } from './config.js';
import { pick, range, clamp } from './rng.js';

const SHIRTS = [0xe85a5a, 0x4a90d9, 0x53b06a, 0xe8c84a, 0x9a6ad9, 0xdddddd, 0x2f2f38];
const PANTS = [0x2c3a4d, 0x4a4038, 0x3a3a3a, 0x5a4a6a];

export function buildPedMesh(rng) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: pick(rng, SHIRTS), roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: pick(rng, PANTS), roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: pick(rng, [0xc98d64, 0x8a5a3b, 0xe8b98a]), roughness: 0.8 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.28), shirt);
  torso.position.y = 1.05;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.32), skin);
  head.position.y = 1.56;
  head.castShadow = true;
  g.add(head);
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.68, 0.18), pants);
    leg.position.set(s * 0.13, 0.36, 0);
    g.add(leg);
    legs.push(leg);
  }
  return { group: g, legs };
}

export function createPedestrians(scene, city, rng, count = 24) {
  const peds = [];
  const streets = CFG.STREET_CENTERS;
  for (let i = 0; i < count; i++) {
    const mesh = buildPedMesh(rng);
    const x = pick(rng, streets) + (rng() < 0.5 ? -8.6 : 8.6);
    const z = range(rng, -CFG.HALF + 8, CFG.HALF - 8);
    mesh.group.position.set(x, 0, z);
    scene.add(mesh.group);
    peds.push({
      mesh, x, z,
      heading: rng() * Math.PI * 2,
      speed: range(rng, 1.0, 1.8),
      target: null,
      flee: 0,
      down: 0,
      phase: rng() * Math.PI * 2,
      alive: true,
    });
  }

  function pickTarget(ped) {
    // A new stroll target: the next corner along the sidewalk.
    const sx = streets.reduce((a, b) => (Math.abs(b - ped.x) < Math.abs(a - ped.x) ? b : a));
    const side = ped.x < sx ? -8.6 : 8.6;
    return {
      x: sx + side,
      z: clamp(ped.z + (Math.random() < 0.5 ? -1 : 1) * range(Math.random, 20, 70), -CFG.HALF + 8, CFG.HALF - 8),
    };
  }

  return {
    peds,
    /** Something scary happened at (x,z): peds nearby run away from it. */
    scare(x, z, radius = 22) {
      for (const p of peds) {
        if (!p.alive || p.down > 0) continue;
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < radius) {
          p.flee = 2.5 + Math.random();
          p.heading = Math.atan2(p.x - x, p.z - z);
        }
      }
    },
    update(dt) {
      for (const p of peds) {
        if (!p.alive) continue;
        if (p.down > 0) {
          p.down -= dt;
          p.mesh.group.rotation.x = p.down > 0 ? -Math.PI / 2 : 0;
          if (p.down <= 0) { p.mesh.group.rotation.x = 0; p.mesh.group.position.y = 0; }
          continue;
        }
        if (p.flee > 0) {
          p.flee -= dt;
          p.x += Math.sin(p.heading) * 3.4 * dt;
          p.z += Math.cos(p.heading) * 3.4 * dt;
        } else {
          if (!p.target) p.target = pickTarget(p);
          const dx = p.target.x - p.x, dz = p.target.z - p.z;
          const d = Math.hypot(dx, dz);
          if (d < 1.2) { p.target = null; continue; }
          p.heading = Math.atan2(dx, dz);
          p.x += Math.sin(p.heading) * p.speed * dt;
          p.z += Math.cos(p.heading) * p.speed * dt;
        }
        const hit = city.collideCircle(p.x, p.z, 0.4);
        p.x = hit.x; p.z = hit.z;
        p.mesh.group.position.set(p.x, 0, p.z);
        p.mesh.group.rotation.y = p.heading;
        p.phase += dt * (p.flee > 0 ? 11 : 6);
        const swing = Math.sin(p.phase) * 0.5;
        p.mesh.legs[0].rotation.x = swing;
        p.mesh.legs[1].rotation.x = -swing;
      }
    },
    /** A car ran one over: returns the ped, knocked down. */
    hitByCar(x, z, radius = 2) {
      for (const p of peds) {
        if (!p.alive || p.down > 0) continue;
        if (Math.hypot(p.x - x, p.z - z) < radius) {
          p.down = 4;
          p.mesh.group.position.y = 0.25;
          return p;
        }
      }
      return null;
    },
  };
}
