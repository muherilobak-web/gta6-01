// Mara Reyes on foot: a simple articulated low-poly figure (jacket, jeans, cap), with
// run, jump, punch and the third-person camera that follows her — or the car, when she
// is driving. The camera orbits with the mouse and pulls back at speed.
import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp, wrapAngle, angleLerp } from './rng.js';

export function buildPlayerMesh() {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98d64, roughness: 0.8 });
  const jacket = new THREE.MeshStandardMaterial({ color: 0x2f6fb5, roughness: 0.85 });
  const jeans = new THREE.MeshStandardMaterial({ color: 0x2c3a4d, roughness: 0.9 });
  const cap = new THREE.MeshStandardMaterial({ color: 0xd84a2f, roughness: 0.8 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), jacket);
  torso.position.y = 1.18;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), skin);
  head.position.y = 1.78;
  head.castShadow = true;
  g.add(head);
  const capMesh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.44), cap);
  capMesh.position.y = 2.0;
  g.add(capMesh);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.06, 0.22), cap);
  brim.position.set(0, 1.96, 0.3);
  g.add(brim);
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.66, 0.2), jacket);
    arm.position.set(s * 0.42, 1.18, 0);
    arm.castShadow = true;
    g.add(arm);
    arms.push(arm);
  }
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.78, 0.24), jeans);
    leg.position.set(s * 0.16, 0.42, 0);
    leg.castShadow = true;
    g.add(leg);
    legs.push(leg);
  }
  return { group: g, arms, legs };
}

export function createPlayer(scene, x, z) {
  const mesh = buildPlayerMesh();
  mesh.group.position.set(x, 0, z);
  scene.add(mesh.group);
  return {
    mesh,
    x, z, y: 0, vy: 0,
    heading: 0,          // facing
    camYaw: 0,           // camera orbit yaw
    camPitch: 0.32,
    onGround: true,
    health: CFG.PLAYER_HEALTH,
    armor: 0,
    punching: 0,
    walkPhase: 0,
    inCar: null,
    update(dt, axes, mouse, collide) {
      if (this.inCar) return;
      // Camera-relative movement: forward is where the camera looks.
      const speed = axes.run ? CFG.RUN_SPEED : CFG.WALK_SPEED;
      const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
      const rx = Math.cos(this.camYaw), rz = -Math.sin(this.camYaw);
      let mx = fx * axes.fwd + rx * axes.strafe;
      let mz = fz * axes.fwd + rz * axes.strafe;
      const len = Math.hypot(mx, mz);
      if (len > 0.01) {
        mx /= len; mz /= len;
        const targetHeading = Math.atan2(mx, mz);
        this.heading = angleLerp(this.heading, targetHeading, Math.min(1, dt * 12));
        const nx = this.x + mx * speed * dt;
        const nz = this.z + mz * speed * dt;
        const hit = collide(nx, nz, CFG.PLAYER_RADIUS);
        this.x = hit.x; this.z = hit.z;
        this.walkPhase += dt * speed * 1.6;
      }
      // Jump / gravity.
      if (this.onGround && axes.jump) {
        this.vy = CFG.JUMP_SPEED;
        this.onGround = false;
      }
      if (!this.onGround) {
        this.vy -= CFG.GRAVITY * dt;
        this.y += this.vy * dt;
        if (this.y <= 0) { this.y = 0; this.vy = 0; this.onGround = true; }
      }
      if (this.punching > 0) this.punching -= dt;
      // Camera orbit.
      this.camYaw -= mouse.dx * 0.0032;
      this.camPitch = clamp(this.camPitch + mouse.dy * 0.0024, -0.15, 1.1);
      mesh.group.position.set(this.x, this.y, this.z);
      mesh.group.rotation.y = this.heading;
      // Walk swing.
      const swing = len > 0.01 ? Math.sin(this.walkPhase) * 0.55 : 0;
      mesh.legs[0].rotation.x = swing;
      mesh.legs[1].rotation.x = -swing;
      mesh.arms[0].rotation.x = -swing * 0.8;
      mesh.arms[1].rotation.x = swing * 0.8;
      if (this.punching > 0) mesh.arms[0].rotation.x = -1.6;
    },
    punch() {
      if (this.punching <= 0) { this.punching = 0.35; return true; }
      return false;
    },
    // Third-person camera: behind and above the player, pulled back at speed.
    // With a gun out the camera flattens to an over-the-shoulder aim stance, so
    // the crosshair ray stays near torso height instead of hitting the ground
    // a few metres past the player.
    updateCamera(camera, dt, shake, aimMode = false) {
      const dist = aimMode ? 8.5 : 7.5;
      const h = aimMode ? 1.9 + this.camPitch * 0.8 : 3.2 + this.camPitch * 4;
      const tx = this.x - Math.sin(this.camYaw) * dist;
      const tz = this.z - Math.cos(this.camYaw) * dist;
      const ty = this.y + h;
      camera.position.x += (tx - camera.position.x) * Math.min(1, dt * 8);
      camera.position.y += (ty - camera.position.y) * Math.min(1, dt * 8);
      camera.position.z += (tz - camera.position.z) * Math.min(1, dt * 8);
      camera.position.x += shake.x;
      camera.position.y += shake.y;
      camera.lookAt(this.x, this.y + (aimMode ? 1.7 : 1.5), this.z);
    },
    // Chase camera for a driven car: behind the car, further back at speed.
    updateCarCamera(camera, car, dt, shake) {
      const speed01 = clamp(Math.abs(car.speed) / 40, 0, 1);
      const dist = 8.5 + speed01 * 4.5;
      const back = car.heading + Math.PI;
      const tx = car.x + Math.sin(back) * dist;
      const tz = car.z + Math.cos(back) * dist;
      const ty = 3.4 + speed01 * 1.2;
      camera.position.x += (tx - camera.position.x) * Math.min(1, dt * 5);
      camera.position.y += (ty - camera.position.y) * Math.min(1, dt * 5);
      camera.position.z += (tz - camera.position.z) * Math.min(1, dt * 5);
      camera.position.x += shake.x;
      camera.position.y += shake.y;
      camera.lookAt(car.x + Math.sin(car.heading) * 6, 1.4, car.z + Math.cos(car.heading) * 6);
    },
  };
}
