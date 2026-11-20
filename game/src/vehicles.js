// Cars: five low-poly models with distinct stats, built from boxes and cylinders,
// and arcade driving physics (accel, brake, steering that bites with speed, handbrake
// drift, damage smoke). A car is a group plus a small state record the other systems
// (traffic, police, missions) drive through the same update function.
import * as THREE from 'three';
import { CFG, CAR_MODELS } from './config.js';
import { clamp, wrapAngle } from './rng.js';

const GLASS = new THREE.MeshStandardMaterial({ color: 0x1c2836, roughness: 0.15, metalness: 0.6 });
const TIRE = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 });
const TRIM = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.35, metalness: 0.7 });

export function buildCarMesh(model, opts = {}) {
  const color = opts.color ?? model.color;
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.35 });
  const g = new THREE.Group();
  const len = model.len, wid = model.wid;
  const bodyH = model.id === 'suv' || model.id === 'pickup' ? 0.85 : 0.62;
  const body = new THREE.Mesh(new THREE.BoxGeometry(len, bodyH, wid), bodyMat);
  body.position.y = 0.55 + bodyH / 2 - 0.31;
  body.castShadow = true;
  g.add(body);
  // Cabin (not on the pickup — it gets a bed instead).
  if (model.id === 'pickup') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(len * 0.42, 0.35, wid * 0.86), TRIM);
    bed.position.set(-len * 0.24, 0.95, 0);
    g.add(bed);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(len * 0.32, 0.62, wid * 0.92), GLASS);
    cab.position.set(len * 0.24, 1.05, 0);
    cab.castShadow = true;
    g.add(cab);
  } else {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(len * 0.5, 0.55, wid * 0.88), GLASS);
    cab.position.set(-len * 0.04, body.position.y + bodyH / 2 + 0.22, 0);
    cab.castShadow = true;
    g.add(cab);
  }
  // Headlights, taillights, grille.
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.34), lightMat);
    hl.position.set(len / 2, 0.62, s * (wid / 2 - 0.32));
    g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.34), tailMat);
    tl.position.set(-len / 2, 0.62, s * (wid / 2 - 0.32));
    g.add(tl);
  }
  // Taxi sign.
  if (model.id === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.28, 0.5), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
    sign.position.set(0, 1.62, 0);
    g.add(sign);
  }
  // Police light bar.
  if (opts.police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 1.1), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    bar.position.set(-0.1, 1.55, 0);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.1, 1.7, -0.3);
    red.name = 'sirenRed';
    g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.5), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.set(-0.1, 1.7, 0.3);
    blue.name = 'sirenBlue';
    g.add(blue);
  }
  // Wheels.
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  wheelGeo.rotateX(Math.PI / 2);
  for (const [wx, wz] of [[len * 0.32, wid / 2 - 0.05], [len * 0.32, -wid / 2 + 0.05], [-len * 0.32, wid / 2 - 0.05], [-len * 0.32, -wid / 2 + 0.05]]) {
    const w = new THREE.Mesh(wheelGeo, TIRE);
    w.position.set(wx, 0.36, wz);
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }
  return { group: g, wheels, model };
}

export function createCar(scene, model, x, z, heading, opts = {}) {
  const mesh = buildCarMesh(model, opts);
  mesh.group.position.set(x, 0, z);
  mesh.group.rotation.y = heading;
  scene.add(mesh.group);
  return {
    mesh, model,
    x, z, heading,
    speed: 0,
    steer: 0,
    damage: 0,          // 0..1; smoke past 0.55, slower past 0.8
    alarm: false,
    driver: opts.driver ?? null, // 'traffic' | 'police' | 'parked' | null
    radius: Math.max(model.len, model.wid) / 2,
    // Arcade update: throttle -1..1, steer -1..1 (left positive), handbrake bool.
    update(dt, throttle, steerTarget, handbrake, collide) {
      const top = CFG.CAR_MAX_SPEED * model.top * (this.damage > 0.8 ? 0.6 : 1);
      const accel = CFG.CAR_ACCEL * model.accel;
      if (throttle > 0) this.speed += accel * throttle * dt;
      else if (throttle < 0) {
        this.speed += (this.speed > 0.5 ? -CFG.CAR_BRAKE : -accel * 0.6) * dt;
        if (this.speed < -9) this.speed = -9;
      } else {
        this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 8 * dt);
      }
      if (this.speed > top) this.speed = top;
      if (this.speed < -9) this.speed = -9;
      // Steering bites with speed; handbrake loosens the rear.
      const speedFactor = clamp(Math.abs(this.speed) / 14, 0, 1);
      this.steer += (steerTarget - this.steer) * Math.min(1, dt * 8);
      const grip = handbrake ? 0.45 : model.grip;
      this.heading += this.steer * CFG.CAR_STEER * speedFactor * grip * dt * Math.sign(this.speed || 1);
      const nx = this.x + Math.sin(this.heading) * this.speed * dt;
      const nz = this.z + Math.cos(this.heading) * this.speed * dt;
      const hit = collide ? collide(nx, nz, this.radius * 0.8) : { x: nx, z: nz };
      const collided = (hit.x !== nx || hit.z !== nz);
      if (collided) {
        // A glancing hit: kill some speed, keep sliding along the wall.
        this.speed *= 0.55;
        if (Math.abs(this.speed) > 6) this.damage = Math.min(1, this.damage + 0.04);
      }
      this.x = hit.x; this.z = hit.z;
      mesh.group.position.set(this.x, 0, this.z);
      mesh.group.rotation.y = this.heading;
      // Body roll and wheel spin for feel.
      mesh.group.rotation.z = -this.steer * speedFactor * 0.05;
      for (const w of mesh.wheels) w.rotation.y += (this.speed * dt) / 0.36;
      return collided;
    },
    addDamage(amount) {
      this.damage = Math.min(1, this.damage + amount);
      return this.damage;
    },
  };
}
