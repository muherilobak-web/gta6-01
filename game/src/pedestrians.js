// Pedestrians: walkers on the sidewalks who stroll between corners and
// run from gunfire and crashes.

import * as THREE from 'three';
import { PED_COUNT, PED_SPEED, ROAD_POSITIONS } from './config.js';
import { makeRng, pick, range } from './rng.js';

const SHIRT_COLORS = [0xc25a4a, 0x4a7ac2, 0x53a05a, 0xc2a24a, 0x8a5ac2, 0xd8d8d8, 0x3a3a3a];
const PANTS_COLORS = [0x2a2a33, 0x3a3a4a, 0x5a4a3a, 0x24303c];

export class Pedestrians {
  constructor(scene, resolveCircle) {
    this.scene = scene;
    this.resolveCircle = resolveCircle;
    this.rng = makeRng(33);
    this.peds = [];
    for (let i = 0; i < PED_COUNT; i++) {
      this.peds.push(this.makePed());
    }
  }

  sidewalkPoint() {
    const road = pick(this.rng, ROAD_POSITIONS);
    const along = range(this.rng, -165, 165);
    const side = this.rng() < 0.5 ? -1 : 1;
    const off = (14 / 2 + 2.5) * side;
    if (this.rng() < 0.5) return { x: road + off, z: along };
    return { x: along, z: road + off };
  }

  makePed() {
    const p = this.sidewalkPoint();
    const g = new THREE.Group();
    const shirt = new THREE.MeshStandardMaterial({ color: pick(this.rng, SHIRT_COLORS), roughness: 0.9 });
    const pants = new THREE.MeshStandardMaterial({ color: pick(this.rng, PANTS_COLORS), roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc98a5e, roughness: 0.85 });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), pants);
    legL.position.set(-0.13, 0.4, 0);
    const legR = legL.clone();
    legR.position.x = 0.13;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.72, 0.3), shirt);
    torso.position.y = 1.16;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.28), skin);
    head.position.y = 1.72;
    g.add(legL, legR, torso, head);
    g.position.set(p.x, 0, p.z);
    this.scene.add(g);
    const target = this.sidewalkPoint();
    return {
      group: g, legL, legR,
      pos: new THREE.Vector3(p.x, 0, p.z),
      target: new THREE.Vector3(target.x, 0, target.z),
      speed: PED_SPEED * range(this.rng, 0.8, 1.25),
      phase: Math.random() * 6,
      fleeing: 0,
      fleeFrom: new THREE.Vector3(),
    };
  }

  scare(pos, radius) {
    for (const ped of this.peds) {
      if (ped.pos.distanceTo(pos) < radius) {
        ped.fleeing = 3 + Math.random() * 2;
        ped.fleeFrom.copy(pos);
      }
    }
  }

  update(dt) {
    for (const ped of this.peds) {
      let tx = ped.target.x;
      let tz = ped.target.z;
      let speed = ped.speed;
      if (ped.fleeing > 0) {
        ped.fleeing -= dt;
        const dx = ped.pos.x - ped.fleeFrom.x;
        const dz = ped.pos.z - ped.fleeFrom.z;
        const d = Math.hypot(dx, dz) || 1;
        tx = ped.pos.x + (dx / d) * 30;
        tz = ped.pos.z + (dz / d) * 30;
        speed = PED_SPEED * 3.2;
      }
      const dx = tx - ped.pos.x;
      const dz = tz - ped.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 2) {
        const nt = this.sidewalkPoint();
        ped.target.set(nt.x, 0, nt.z);
        continue;
      }
      const vx = (dx / dist) * speed * dt;
      const vz = (dz / dist) * speed * dt;
      ped.pos.x += vx;
      ped.pos.z += vz;
      this.resolveCircle(ped.pos, 0.5);
      ped.phase += dt * speed * 2.2;
      const s = Math.sin(ped.phase) * 0.5;
      ped.legL.rotation.x = s;
      ped.legR.rotation.x = -s;
      ped.group.position.copy(ped.pos);
      ped.group.rotation.y = Math.atan2(dx, dz);
    }
  }
}
