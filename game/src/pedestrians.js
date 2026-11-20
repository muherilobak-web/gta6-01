// Vice Point — pedestrians. They stroll the sidewalks, turn at corners,
// and flee from gunfire, crashes and stolen cars. A simple low-poly figure
// with a walk cycle, in a handful of shirt colours.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { chooseOne, inRange } from './rng.js';

const SHIRT_COLOURS = [0xe8e0d0, 0x3f6fb5, 0xd84a2f, 0x2e7d5b, 0xc9a227, 0x7a5a9a, 0x39d0c0];

export function buildPedFigure(random) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: chooseOne(random, [0xc98a5e, 0x8a5a3a, 0xe8b890]), roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: chooseOne(random, SHIRT_COLOURS), roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2a2a33, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.3), shirt);
  torso.position.y = 1.2;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.78;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.22), pants);
  legL.position.set(-0.15, 0.38, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.22), pants);
  legR.position.set(0.15, 0.38, 0);
  group.add(legR);
  return { group, legL, legR };
}

export function makePedestrians(scene, city, random, count = 24) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const figure = buildPedFigure(random);
    const streetX = chooseOne(random, WORLD.streetLines);
    const streetZ = chooseOne(random, WORLD.streetLines);
    const onVertical = random() < 0.5;
    const x = onVertical ? streetX + (random() < 0.5 ? -8.5 : 8.5) : inRange(random, -WORLD.halfWidth + 10, WORLD.halfWidth - 10);
    const z = onVertical ? inRange(random, -WORLD.halfWidth + 10, WORLD.halfWidth - 10) : streetZ + (random() < 0.5 ? -8.5 : 8.5);
    figure.group.position.set(x, 0, z);
    scene.add(figure.group);
    peds.push({
      mesh: figure,
      x,
      z,
      heading: random() * Math.PI * 2,
      speed: inRange(random, 1.2, 2.2),
      cycle: random() * 6,
      fleeing: 0,
      alive: true,
      update(dt) {
        if (!this.alive) return;
        if (this.fleeing > 0) this.fleeing -= dt;
        const pace = this.fleeing > 0 ? this.speed * 3.2 : this.speed;
        const stepX = Math.sin(this.heading) * pace * dt;
        const stepZ = Math.cos(this.heading) * pace * dt;
        const resolved = city.collideCircle(this.x + stepX, this.z + stepZ, 0.4);
        const blocked = resolved.x !== this.x + stepX || resolved.z !== this.z + stepZ;
        this.x = resolved.x;
        this.z = resolved.z;
        if (blocked || Math.random() < dt * 0.08) this.heading += (Math.random() - 0.5) * 1.8;
        if (Math.abs(this.x) > WORLD.halfWidth - 6 || Math.abs(this.z) > WORLD.halfWidth - 6) {
          this.heading += Math.PI;
        }
        this.cycle += dt * pace * 3;
        const swing = Math.sin(this.cycle) * 0.5;
        this.mesh.legL.rotation.x = swing;
        this.mesh.legR.rotation.x = -swing;
        this.mesh.group.position.set(this.x, 0, this.z);
        this.mesh.group.rotation.y = this.heading;
      },
    });
  }

  return {
    list: peds,
    update(dt) {
      for (const ped of peds) ped.update(dt);
    },
    scare(x, z, radius) {
      for (const ped of peds) {
        if (!ped.alive) continue;
        const d = Math.hypot(ped.x - x, ped.z - z);
        if (d < radius) {
          ped.fleeing = 3;
          ped.heading = Math.atan2(ped.x - x, ped.z - z);
        }
      }
    },
    // A car running over a pedestrian. Returns the victim, or null.
    hitByCar(x, z, radius) {
      for (const ped of peds) {
        if (!ped.alive) continue;
        if (Math.hypot(ped.x - x, ped.z - z) < radius) {
          ped.alive = false;
          ped.mesh.group.visible = false;
          return ped;
        }
      }
      return null;
    },
  };
}
