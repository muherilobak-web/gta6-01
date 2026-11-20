// Combat: fists, pistol and SMG, tracers, muzzle flashes, and the
// gang members who shoot back. Enemies are simple: they close in and
// fire on a timer, and they drop when their health is gone.

import * as THREE from 'three';
import { WEAPONS, ENEMY_HEALTH, ENEMY_DAMAGE, ENEMY_SHOOT_INTERVAL } from './config.js';
import { makeRng, range } from './rng.js';

export class Combat {
  constructor(scene, effects, audio, scarePeds) {
    this.scene = scene;
    this.effects = effects;
    this.audio = audio;
    this.scarePeds = scarePeds;
    this.weapon = 'fists';
    this.ammo = { pistol: 24, smg: 90 };
    this.hasWeapon = { fists: true, pistol: false, smg: false };
    this.cooldown = 0;
    this.enemies = [];
    this.rng = makeRng(71);
    this.tracerGeo = new THREE.BufferGeometry();
    this.tracerGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  }

  giveWeapon(name, ammo) {
    this.hasWeapon[name] = true;
    this.weapon = name;
    if (ammo) this.ammo[name] = (this.ammo[name] || 0) + ammo;
  }

  selectWeapon(name) {
    if (this.hasWeapon[name]) this.weapon = name;
  }

  makeEnemy(x, z) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshStandardMaterial({ color: 0x8a2a2a, roughness: 0.9 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xa87848, roughness: 0.85 });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.82, 0.24), pants);
    legL.position.set(-0.14, 0.41, 0);
    const legR = legL.clone();
    legR.position.x = 0.14;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.76, 0.32), shirt);
    torso.position.y = 1.2;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.3), skin);
    head.position.y = 1.78;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    gun.position.set(0.3, 1.35, 0.3);
    g.add(legL, legR, torso, head, gun);
    g.position.set(x, 0, z);
    this.scene.add(g);
    const enemy = {
      group: g, legL, legR,
      pos: new THREE.Vector3(x, 0, z),
      health: ENEMY_HEALTH,
      shootTimer: range(this.rng, 1, 2),
      phase: Math.random() * 6,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  enemiesAlive() {
    return this.enemies.length;
  }

  shoot(origin, dir, isPlayer) {
    const def = WEAPONS[this.weapon];
    if (this.cooldown > 0) return false;
    if (isPlayer) {
      if (this.weapon !== 'fists') {
        if ((this.ammo[this.weapon] || 0) <= 0) {
          this.audio.click();
          this.cooldown = 0.25;
          return false;
        }
        this.ammo[this.weapon]--;
      }
      this.cooldown = 1 / def.rate;
    }
    const from = origin.clone();
    from.y += 1.4;
    const to = from.clone().addScaledVector(dir, def.range);
    this.effects.tracer(from, to, this.weapon === 'smg' ? 0xffe9a8 : 0xffd27a);
    this.effects.muzzle(from, dir);
    if (this.weapon === 'fists') this.audio.hit();
    else this.audio.gunshot(this.weapon);
    if (this.scarePeds) this.scarePeds(origin, 30);
    // Hit test against enemies (player) or the player (enemies).
    if (isPlayer) {
      for (const e of this.enemies) {
        const toE = e.pos.clone().setY(1.2).sub(from);
        const along = toE.dot(dir);
        if (along < 0 || along > def.range) continue;
        const closest = from.clone().addScaledVector(dir, along);
        if (closest.distanceTo(e.pos.clone().setY(1.2)) < 1.1) {
          e.health -= def.damage;
          this.effects.blood(e.pos);
          if (e.health <= 0) this.removeEnemy(e);
          return true;
        }
      }
    }
    return true;
  }

  removeEnemy(e) {
    const idx = this.enemies.indexOf(e);
    if (idx >= 0) this.enemies.splice(idx, 1);
    this.effects.blood(e.pos, true);
    this.scene.remove(e.group);
  }

  update(dt, playerPos, onPlayerHit) {
    if (this.cooldown > 0) this.cooldown -= dt;
    for (const e of [...this.enemies]) {
      const dx = playerPos.x - e.pos.x;
      const dz = playerPos.z - e.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 2.2) {
        const speed = 3.4;
        e.pos.x += (dx / dist) * speed * dt;
        e.pos.z += (dz / dist) * speed * dt;
      }
      e.phase += dt * 7;
      const s = Math.sin(e.phase) * 0.5;
      e.legL.rotation.x = s;
      e.legR.rotation.x = -s;
      e.group.position.copy(e.pos);
      e.group.rotation.y = Math.atan2(dx, dz);
      e.shootTimer -= dt;
      if (dist < 26 && e.shootTimer <= 0) {
        e.shootTimer = ENEMY_SHOOT_INTERVAL * range(this.rng, 0.8, 1.4);
        const from = e.pos.clone();
        from.y += 1.4;
        const dir = new THREE.Vector3(dx, 0, dz).normalize();
        const to = playerPos.clone().setY(1.4);
        this.effects.tracer(from, to, 0xffb060);
        this.audio.gunshot('pistol');
        // Enemies are bad shots: half their rounds connect.
        if (this.rng() < 0.5) {
          const died = onPlayerHit(ENEMY_DAMAGE);
          if (died) return;
        }
      }
    }
  }

  clearEnemies() {
    for (const e of [...this.enemies]) this.removeEnemy(e);
  }
}
