// Particles, screen shake, skid marks and damage smoke. Everything is a
// small pool of reusable meshes so the effect budget stays flat.

import * as THREE from 'three';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    this.shake = 0;
    this.skids = [];
    this.skidGeo = new THREE.PlaneGeometry(0.35, 1.6);
    this.skidMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.55 });
    this.smoke = [];
    this.smokeGeo = new THREE.SphereGeometry(0.5, 6, 5);
    this.smokeMat = new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.35 });
  }

  burst(pos, color, count, speed, life, up) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
      const m = new THREE.Mesh(this.geo, mat);
      m.position.copy(pos);
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI - Math.PI / 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      m.userData.vel = new THREE.Vector3(
        Math.cos(a) * Math.cos(b) * s,
        Math.abs(Math.sin(b)) * s + (up || 0),
        Math.sin(a) * Math.cos(b) * s,
      );
      m.userData.life = life * (0.6 + Math.random() * 0.7);
      m.userData.maxLife = m.userData.life;
      this.scene.add(m);
      this.particles.push(m);
    }
  }

  muzzle(pos, dir) {
    const p = pos.clone().addScaledVector(dir, 0.9);
    this.burst(p, 0xffc861, 5, 7, 0.12, 1);
  }

  impact(pos) {
    this.burst(pos, 0xd8d8d8, 6, 4, 0.3, 2);
  }

  // A bright line from muzzle to target that lives barely a tenth of a second.
  tracer(from, to, color) {
    if (!this.tracers) this.tracers = [];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      from.x, from.y, from.z, to.x, to.y, to.z,
    ]), 3));
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geo, mat);
    line.userData.life = 0.09;
    this.scene.add(line);
    this.tracers.push(line);
  }

  // Red spray at chest height where a bullet lands; a kill sprays more.
  blood(pos, big) {
    const p = pos.clone();
    p.y = 1.1;
    this.burst(p, 0x8a0f0f, big ? 18 : 9, 3.5, 0.5, 1.5);
  }

  // Smoke plus a skid mark while a car slides sideways.
  driftSmoke(pos, heading) {
    this.skid(pos, heading);
    this.puffSmoke(pos);
  }

  explosion(pos) {
    this.burst(pos, 0xff7a2a, 26, 12, 0.7, 5);
    this.burst(pos, 0x3a3a3a, 14, 6, 1.1, 4);
    this.addShake(0.9);
  }

  addShake(amount) {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  shakeOffset(dt) {
    if (this.shake <= 0) return { x: 0, y: 0 };
    this.shake = Math.max(0, this.shake - dt * 1.6);
    const s = this.shake * 0.35;
    return { x: (Math.random() * 2 - 1) * s, y: (Math.random() * 2 - 1) * s };
  }

  skid(pos, heading) {
    if (this.skids.length > 220) {
      const old = this.skids.shift();
      this.scene.remove(old);
    }
    const m = new THREE.Mesh(this.skidGeo, this.skidMat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -heading;
    m.position.set(pos.x, 0.06, pos.z);
    this.scene.add(m);
    this.skids.push(m);
  }

  puffSmoke(pos) {
    if (this.smoke.length > 40) {
      const old = this.smoke.shift();
      this.scene.remove(old);
    }
    const m = new THREE.Mesh(this.smokeGeo, this.smokeMat.clone());
    m.position.copy(pos);
    m.position.y += 0.8;
    m.userData.life = 1.4;
    this.scene.add(m);
    this.smoke.push(m);
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.userData.life -= dt;
      if (p.userData.life <= 0) {
        this.scene.remove(p);
        this.particles.splice(i, 1);
        continue;
      }
      p.userData.vel.y -= 9 * dt;
      p.position.addScaledVector(p.userData.vel, dt);
      p.material.opacity = p.userData.life / p.userData.maxLife;
      p.rotation.x += dt * 6;
      p.rotation.y += dt * 5;
    }
    for (let i = this.smoke.length - 1; i >= 0; i--) {
      const s = this.smoke[i];
      s.userData.life -= dt;
      if (s.userData.life <= 0) {
        this.scene.remove(s);
        this.smoke.splice(i, 1);
        continue;
      }
      s.position.y += dt * 1.6;
      const k = 1 + (1.4 - s.userData.life) * 0.9;
      s.scale.setScalar(k);
      s.material.opacity = 0.35 * (s.userData.life / 1.4);
    }
    if (this.tracers) {
      for (let i = this.tracers.length - 1; i >= 0; i--) {
        const t = this.tracers[i];
        t.userData.life -= dt;
        if (t.userData.life <= 0) {
          this.scene.remove(t);
          t.geometry.dispose();
          t.material.dispose();
          this.tracers.splice(i, 1);
          continue;
        }
        t.material.opacity = (t.userData.life / 0.09) * 0.9;
      }
    }
  }
}
