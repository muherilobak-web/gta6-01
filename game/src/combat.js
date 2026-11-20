// Vice Point — combat. Enemies (street gang, and officers at high wanted
// levels) who move toward the player and shoot back, pickups for health,
// armor and weapons, and the raycast shooting the player uses. Enemy fire
// is deliberately imperfect so a fair fight is winnable.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { buildPedFigure } from './pedestrians.js';
import { makeSeededRandom } from './rng.js';

export function makeEnemyFigure(kind) {
  const random = makeSeededRandom(kind === 'cop' ? 99 : 42);
  const figure = buildPedFigure(random);
  const coatColour = kind === 'cop' ? 0x1c1c22 : 0x5a1a2a;
  const torsoMat = new THREE.MeshStandardMaterial({ color: coatColour, roughness: 0.8 });
  figure.group.children[0].material = torsoMat;
  if (kind === 'cop') {
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.27, 0.1, 10),
      new THREE.MeshStandardMaterial({ color: 0x1c1c22 }),
    );
    cap.position.y = 1.98;
    figure.group.add(cap);
  }
  return figure;
}

export function makeCombat(scene, random) {
  const enemies = [];
  const pickups = [];
  const raycaster = new THREE.Raycaster();
  const pickupGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
  const pickupMats = {
    health: new THREE.MeshStandardMaterial({ color: 0x37d67a, emissive: 0x37d67a, emissiveIntensity: 0.6 }),
    armor: new THREE.MeshStandardMaterial({ color: 0x3f8cff, emissive: 0x3f8cff, emissiveIntensity: 0.6 }),
    smg: new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffd23f, emissiveIntensity: 0.6 }),
    pistol: new THREE.MeshStandardMaterial({ color: 0xff9a3d, emissive: 0xff9a3d, emissiveIntensity: 0.6 }),
  };

  function spawnEnemy(kind, x, z, health) {
    const figure = makeEnemyFigure(kind);
    figure.group.position.set(x, 0, z);
    scene.add(figure.group);
    const enemy = {
      kind,
      mesh: figure,
      x,
      z,
      heading: Math.atan2(0 - x, 0 - z),
      health,
      alive: true,
      shootTimer: 1 + random() * 1.5,
      walkCycle: random() * 6,
    };
    enemies.push(enemy);
    return enemy;
  }

  function spawnPickup(kind, x, z) {
    const mesh = new THREE.Mesh(pickupGeo, pickupMats[kind]);
    mesh.position.set(x, 0.9, z);
    scene.add(mesh);
    const pickup = { kind, mesh, x, z, taken: false };
    pickups.push(pickup);
    return pickup;
  }

  return {
    enemies,
    pickups,
    spawnEnemy,
    spawnPickup,
    clearEnemies() {
      for (const enemy of enemies) {
        enemy.alive = false;
        scene.remove(enemy.mesh.group);
      }
      enemies.length = 0;
    },
    takePickup(x, z, radius) {
      for (const pickup of pickups) {
        if (pickup.taken) continue;
        if (Math.hypot(pickup.x - x, pickup.z - z) < radius) {
          pickup.taken = true;
          pickup.mesh.visible = false;
          return pickup.kind;
        }
      }
      return null;
    },
    // Fire the player's weapon from the camera. Returns { enemy, killed }.
    shoot(camera, weaponId, origin, onHit) {
      const weapon = WORLD.weapons[weaponId];
      // The camera may have moved since the last render (it lerps every
      // frame), and a freshly spawned enemy has no world matrix yet, so
      // refresh both before casting the ray.
      camera.updateMatrixWorld();
      scene.updateMatrixWorld();
      raycaster.setFromCamera({ x: 0, y: 0 }, camera);
      raycaster.far = weapon.reach;
      const targets = enemies.filter((e) => e.alive).map((e) => e.mesh.group);
      const hits = raycaster.intersectObjects(targets, true);
      if (hits.length === 0) return { enemy: null, killed: false };
      const hitPoint = hits[0].point;
      let hitGroup = hits[0].object;
      while (hitGroup.parent && hitGroup.parent !== scene) hitGroup = hitGroup.parent;
      const enemy = enemies.find((e) => e.alive && e.mesh.group === hitGroup);
      if (!enemy) return { enemy: null, killed: false };
      enemy.health -= weapon.damage;
      if (onHit) onHit(enemy, hitPoint);
      if (enemy.health <= 0) {
        enemy.alive = false;
        enemy.mesh.group.visible = false;
        return { enemy, killed: true };
      }
      return { enemy, killed: false };
    },
    update(dt, playerPos, onEnemyShot, onPlayerHit) {
      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        const dx = playerPos.x - enemy.x;
        const dz = playerPos.z - enemy.z;
        const dist = Math.hypot(dx, dz);
        enemy.heading = Math.atan2(dx, dz);
        // Close in to a fighting distance, then hold and shoot.
        if (dist > 14) {
          const step = 4.5 * dt;
          enemy.x += Math.sin(enemy.heading) * step;
          enemy.z += Math.cos(enemy.heading) * step;
          enemy.walkCycle += dt * 8;
          const swing = Math.sin(enemy.walkCycle) * 0.5;
          enemy.mesh.legL.rotation.x = swing;
          enemy.mesh.legR.rotation.x = -swing;
        }
        enemy.mesh.group.position.set(enemy.x, 0, enemy.z);
        enemy.mesh.group.rotation.y = enemy.heading;
        enemy.shootTimer -= dt;
        if (enemy.shootTimer <= 0 && dist < 42) {
          enemy.shootTimer = 1.1 + random() * 0.9;
          if (onEnemyShot) onEnemyShot(enemy);
          // 55% hit chance, scaled down at long range.
          const hitChance = dist < 18 ? 0.55 : 0.3;
          if (Math.random() < hitChance && onPlayerHit) {
            onPlayerHit(enemy.kind === 'cop' ? 9 : 7);
          }
        }
      }
      for (const pickup of pickups) {
        if (pickup.taken) continue;
        pickup.mesh.rotation.y += dt * 1.5;
        pickup.mesh.position.y = 0.9 + Math.sin(performance.now() / 350 + pickup.x) * 0.15;
      }
    },
  };
}
