// Six story missions for Mara Reyes, one arc. Each mission is a small
// stage machine with a waypoint, an objective line and a pass/fail.
// The manager owns the packages side activity too.

import * as THREE from 'three';
import { MISSIONS, DOCKS, GARAGE, STASH_HOUSE, BANK, PACKAGE_COUNT } from './config.js';
import { makeRng, range } from './rng.js';

export class MissionManager {
  constructor(world) {
    this.world = world;
    this.index = 0;
    this.stage = 0;
    this.active = false;
    this.waypoint = null;
    this.objective = '';
    this.timer = 0;
    this.progress = 0;
    this.markedCars = [];
    this.courier = null;
    this.courierTimer = 0;
    this.courierLost = 0;
    this.wave = 0;
    this.waveSpawned = 0;
    this.delivered = 0;
    this.lootTimer = 0;
    this.onPass = null;
    this.onFail = null;
    this.onStage = null;
    this.rng = makeRng(99);
    this.packages = [];
    for (let i = 0; i < PACKAGE_COUNT; i++) {
      this.packages.push({
        pos: new THREE.Vector3(range(this.rng, -160, 160), 0.7, range(this.rng, -160, 160)),
        taken: false,
      });
    }
  }

  get title() {
    return MISSIONS[this.index] ? MISSIONS[this.index].title : '';
  }

  get reward() {
    return MISSIONS[this.index] ? MISSIONS[this.index].reward : 0;
  }

  start(index) {
    this.index = index;
    this.stage = 0;
    this.active = true;
    this.timer = 0;
    this.progress = 0;
    this.delivered = 0;
    this.lootTimer = 0;
    this.courierTimer = 0;
    this.courierLost = 0;
    this.wave = 0;
    this.waveSpawned = 0;
    this.clearMarked();
    if (this.courier) {
      this.world.removeMissionCar(this.courier);
      this.courier = null;
    }
    if (index === 0) {
      this.setWaypoint(DOCKS.x, DOCKS.z, 'Drive to the docks');
      this.objective = 'Drive to the docks';
    } else if (index === 1) {
      const car = this.world.spawnMissionCar('coupe', 90, -90, 0, true);
      this.markedCars.push(car);
      this.setWaypoint(90, -90, 'Steal the marked coupe');
      this.objective = 'Steal the marked coupe';
    } else if (index === 2) {
      this.courier = this.world.spawnMissionCar('sedan', -90, -30, Math.PI / 2, false);
      this.courier.route = this.world.makeCourierRoute();
      this.courierTimer = 0;
      this.setWaypoint(this.courier.pos.x, this.courier.pos.z, 'Tail the courier');
      this.objective = 'Tail the courier — stay close, stay unseen';
    } else if (index === 3) {
      this.setWaypoint(STASH_HOUSE.x, STASH_HOUSE.z, 'Get to the stash house');
      this.objective = 'Get to the stash house';
    } else if (index === 4) {
      const spots = [[-30, -90], [60, 30], [-90, 150]];
      for (const [x, z] of spots) {
        this.markedCars.push(this.world.spawnMissionCar('sedan', x, z, 0, true));
      }
      this.setWaypoint(-30, -90, 'Steal a getaway car');
      this.objective = 'Steal the getaway cars (0/3)';
    } else if (index === 5) {
      this.setWaypoint(BANK.x, BANK.z, 'Get to the bank');
      this.objective = 'Get to the bank';
    }
    if (this.onStage) this.onStage(this.index, this.stage);
  }

  setWaypoint(x, z, label) {
    this.waypoint = { x, z, label };
  }

  clearWaypoint() {
    this.waypoint = null;
  }

  clearMarked() {
    for (const car of this.markedCars) this.world.removeMissionCar(car);
    this.markedCars = [];
  }

  pass() {
    this.active = false;
    this.clearWaypoint();
    this.clearMarked();
    if (this.courier) {
      this.world.removeMissionCar(this.courier);
      this.courier = null;
    }
    if (this.onPass) this.onPass(this.index, this.reward);
  }

  fail(reason) {
    this.active = false;
    this.clearWaypoint();
    this.clearMarked();
    if (this.courier) {
      this.world.removeMissionCar(this.courier);
      this.courier = null;
    }
    if (this.onFail) this.onFail(this.index, reason);
  }

  near(x, z, r) {
    const p = this.world.playerPos();
    return Math.hypot(p.x - x, p.z - z) < r;
  }

  update(dt) {
    const w = this.world;
    // Packages: touch one, bank fifty dollars.
    for (const pkg of this.packages) {
      if (pkg.taken) continue;
      const p = w.playerPos();
      if (Math.hypot(p.x - pkg.pos.x, p.z - pkg.pos.z) < 2.2) {
        pkg.taken = true;
        w.onPackage(pkg);
      }
    }
    if (!this.active) return;
    this.timer += dt;
    const p = w.playerPos();

    if (this.index === 0) {
      if (this.stage === 0) {
        if (this.near(DOCKS.x, DOCKS.z, 10)) {
          this.stage = 1;
          w.police.setWanted(1);
          this.setWaypoint(DOCKS.x, DOCKS.z, 'Lose the tail');
          this.objective = 'Lose the tail — get out of sight';
          if (this.onStage) this.onStage(this.index, this.stage);
        }
      } else if (w.police.wanted === 0) {
        this.pass();
      }
    } else if (this.index === 1) {
      if (this.stage === 0) {
        if (w.playerCar() && this.markedCars.includes(w.playerCar())) {
          this.stage = 1;
          this.setWaypoint(GARAGE.x, GARAGE.z, 'Deliver the coupe to the garage');
          this.objective = 'Deliver the coupe to the garage';
          if (this.onStage) this.onStage(this.index, this.stage);
        }
      } else if (this.near(GARAGE.x, GARAGE.z, 9) && w.playerCar() && this.markedCars.includes(w.playerCar())) {
        this.pass();
      }
    } else if (this.index === 2) {
      if (this.courier) {
        this.courier.route = this.courier.route || w.makeCourierRoute();
        w.driveCourier(this.courier, dt);
        this.setWaypoint(this.courier.pos.x, this.courier.pos.z, 'Tail the courier');
        const d = Math.hypot(p.x - this.courier.pos.x, p.z - this.courier.pos.z);
        if (d < 10) {
          this.fail('Spotted by the courier');
          return;
        }
        if (d > 70) {
          this.courierLost += dt;
          if (this.courierLost > 5) {
            this.fail('Lost the courier');
            return;
          }
        } else {
          this.courierLost = 0;
          this.courierTimer += dt;
          this.progress = Math.min(1, this.courierTimer / 45);
        }
        if (this.courierTimer >= 45) this.pass();
      }
    } else if (this.index === 3) {
      if (this.stage === 0) {
        if (this.near(STASH_HOUSE.x, STASH_HOUSE.z, 9)) {
          this.stage = 1;
          this.wave = 1;
          this.waveSpawned = 0;
          this.objective = 'Defend the stash house — wave 1 of 3';
          this.setWaypoint(STASH_HOUSE.x, STASH_HOUSE.z, 'Defend the stash house');
          if (this.onStage) this.onStage(this.index, this.stage);
        }
      } else {
        const want = 2 + this.wave;
        while (this.waveSpawned < want) {
          const a = this.rng() * Math.PI * 2;
          const r = 22 + this.rng() * 10;
          w.spawnEnemy(STASH_HOUSE.x + Math.cos(a) * r, STASH_HOUSE.z + Math.sin(a) * r);
          this.waveSpawned++;
        }
        if (w.enemiesAlive() === 0 && this.waveSpawned >= want) {
          if (this.wave >= 3) {
            this.pass();
          } else {
            this.wave++;
            this.waveSpawned = 0;
            this.objective = `Defend the stash house — wave ${this.wave} of 3`;
            if (this.onStage) this.onStage(this.index, this.stage);
          }
        }
      }
    } else if (this.index === 4) {
      const car = w.playerCar();
      if (car && this.markedCars.includes(car)) {
        this.setWaypoint(GARAGE.x, GARAGE.z, `Deliver the getaway car (${this.delivered}/3)`);
        this.objective = `Deliver the getaway car to the garage (${this.delivered}/3)`;
        if (this.near(GARAGE.x, GARAGE.z, 9)) {
          this.delivered++;
          const idx = this.markedCars.indexOf(car);
          this.markedCars.splice(idx, 1);
          w.deliverCar(car);
          if (this.delivered >= 3) {
            this.pass();
          } else {
            const next = this.markedCars[0];
            if (next) this.setWaypoint(next.pos.x, next.pos.z, 'Steal the next getaway car');
            this.objective = `Steal the getaway cars (${this.delivered}/3)`;
          }
        }
      } else if (this.markedCars.length > 0) {
        const next = this.markedCars[0];
        this.setWaypoint(next.pos.x, next.pos.z, 'Steal a getaway car');
      }
    } else if (this.index === 5) {
      if (this.stage === 0) {
        if (this.near(BANK.x, BANK.z, 9)) {
          this.stage = 1;
          this.lootTimer = 0;
          this.objective = 'Grab the loot — hold position';
          this.setWaypoint(BANK.x, BANK.z, 'Grab the loot');
          if (this.onStage) this.onStage(this.index, this.stage);
        }
      } else if (this.stage === 1) {
        if (!this.near(BANK.x, BANK.z, 10)) {
          this.lootTimer = 0;
          this.objective = 'Get back to the bank vault';
        } else {
          this.lootTimer += dt;
          this.progress = Math.min(1, this.lootTimer / 5);
          if (this.lootTimer >= 5) {
            this.stage = 2;
            w.police.setWanted(4);
            this.setWaypoint(DOCKS.x, DOCKS.z, 'Escape to the marina');
            this.objective = 'Escape to the marina — lose the 4-star chase';
            if (this.onStage) this.onStage(this.index, this.stage);
          }
        }
      } else if (this.near(DOCKS.x, DOCKS.z, 10)) {
        w.police.clear();
        this.pass();
      }
    }
  }
}
