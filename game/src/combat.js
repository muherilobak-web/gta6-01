// Combat: fists, pistol and SMG for the player, mouse-aimed by a centre-screen
// raycast, plus enemy shooters (street gang, then cops in the finale) that move,
// take cover poorly and shoot back. Pickups for weapons, ammo, health and armor.
import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp, range } from './rng.js';

export function buildEnemyMesh(kind) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: kind === 'cop' ? 0x1c2a44 : 0x7a2a2a, roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98d64, roughness: 0.8 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.7, 0.32), shirt);
  torso.position.y = 1.12;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.36), skin);
  head.position.y = 1.7;
  head.castShadow = true;
  g.add(head);
  if (kind === 'cop') {
    const hat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.4), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    hat.position.y = 1.92;
    g.add(hat);
  } else {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.38), new THREE.MeshStandardMaterial({ color: 0xd84a2f }));
    band.position.y = 1.86;
    g.add(band);
  }
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.2), pants);
    leg.position.set(s * 0.15, 0.38, 0);
    g.add(leg);
    legs.push(leg);
  }
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.6), new THREE.MeshStandardMaterial({ color: 0x181818 }));
  gun.position.set(0.3, 1.25, 0.35);
  g.add(gun);
  return { group: g, legs };
}

export function createCombat(scene, rng) {
  const enemies = [];
  const pickups = [];
  const raycaster = new THREE.Raycaster();
  const pickupGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);

  function spawnEnemy(kind, x, z, health = 50) {
    const mesh = buildEnemyMesh(kind);
    mesh.group.position.set(x, 0, z);
    scene.add(mesh.group);
    const e = { mesh, kind, x, z, health, maxHealth: health, cooldown: range(rng, 0.5, 1.5), phase: rng() * 6, alive: true, heading: 0 };
    enemies.push(e);
    return e;
  }

  function spawnPickup(kind, x, z) {
    const color = kind === 'health' ? 0x33cc66 : kind === 'armor' ? 0x3388ff : kind === 'smg' ? 0xffaa22 : 0xffd23f;
    const m = new THREE.Mesh(pickupGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.4, emissive: color, emissiveIntensity: 0.35 }));
    m.position.set(x, 0.8, z);
    scene.add(m);
    const p = { mesh: m, kind, x, z, taken: false };
    pickups.push(p);
    return p;
  }

  return {
    enemies,
    pickups,
    spawnEnemy,
    spawnPickup,
    clearEnemies() {
      for (const e of enemies) scene.remove(e.mesh.group);
      enemies.length = 0;
    },
    clearPickups() {
      for (const p of pickups) scene.remove(p.mesh);
      pickups.length = 0;
    },
    /** Player fires from the camera through the crosshair. Returns what was hit. */
    shoot(camera, weaponId, playerPos, onHit) {
      const w = CFG.WEAPONS[weaponId];
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      raycaster.far = w.range;
      const targets = enemies.filter((e) => e.alive).map((e) => e.mesh.group);
      const hits = raycaster.intersectObjects(targets, true);
      if (hits.length > 0) {
        let obj = hits[0].object;
        while (obj.parent && obj.parent !== obj) {
          const found = enemies.find((e) => e.mesh.group === obj);
          if (found) {
            found.health -= w.damage;
            if (found.health <= 0) { found.alive = false; found.mesh.group.visible = false; }
            if (onHit) onHit(found, hits[0].point);
            return { enemy: found, point: hits[0].point, killed: !found.alive };
          }
          obj = obj.parent;
        }
      }
      return { enemy: null, point: raycaster.ray.at(w.range, new THREE.Vector3()), killed: false };
    },
    /** Enemies advance on the player and shoot with inaccuracy. */
    update(dt, playerPos, onEnemyShot, onPlayerHit) {
      for (const e of enemies) {
        if (!e.alive) continue;
        const dx = playerPos.x - e.x, dz = playerPos.z - e.z;
        const dist = Math.hypot(dx, dz);
        e.heading = Math.atan2(dx, dz);
        e.mesh.group.rotation.y = e.heading;
        // Close in to a firing range, then stand and shoot.
        if (dist > 14) {
          e.x += Math.sin(e.heading) * 3.2 * dt;
          e.z += Math.cos(e.heading) * 3.2 * dt;
        } else if (dist < 6) {
          e.x -= Math.sin(e.heading) * 1.5 * dt;
          e.z -= Math.cos(e.heading) * 1.5 * dt;
        }
        e.phase += dt * 7;
        const swing = Math.sin(e.phase) * 0.4;
        e.mesh.legs[0].rotation.x = swing;
        e.mesh.legs[1].rotation.x = -swing;
        e.mesh.group.position.set(e.x, 0, e.z);
        e.cooldown -= dt;
        if (e.cooldown <= 0 && dist < 42) {
          e.cooldown = range(rng, 0.9, 1.8);
          // Inaccuracy grows with distance.
          const hitChance = clamp(0.55 - dist * 0.008, 0.12, 0.55);
          if (onEnemyShot) onEnemyShot(e);
          if (Math.random() < hitChance && onPlayerHit) onPlayerHit(7 + Math.random() * 6);
        }
      }
      // Pickups bob and spin; they are collected by proximity in main.js via takePickup.
      for (const p of pickups) {
        if (p.taken) continue;
        p.mesh.rotation.y += dt * 2;
        p.mesh.position.y = 0.8 + Math.sin(performance.now() / 300 + p.x) * 0.12;
      }
    },
    takePickup(x, z, radius = 1.6) {
      for (const p of pickups) {
        if (p.taken) continue;
        if (Math.hypot(p.x - x, p.z - z) < radius) {
          p.taken = true;
          p.mesh.visible = false;
          return p.kind;
        }
      }
      return null;
    },
  };
}
