// The story: six missions for Mara Reyes, one arc, plus side work (taxi fares,
// vigilante targets, 20 packages, stunt ramps). Each mission is a small stage
// machine: an objective, a waypoint beacon, a pass condition and a fail condition.
// The module owns its mission entities (marked cars, the courier, the beacon) and
// talks to the rest of the game through the shared world object G.
import * as THREE from 'three';
import { CFG, MISSIONS, CAR_MODELS } from './config.js';
import { createCar } from './vehicles.js';
import { clamp } from './rng.js';

export function createMissions(scene, city) {
  const beacon = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 14, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 7;
  beacon.add(pillar);
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 2.2, 4),
    new THREE.MeshBasicMaterial({ color: 0xffd23f }),
  );
  arrow.rotation.x = Math.PI;
  arrow.position.y = 5;
  beacon.add(arrow);
  beacon.visible = false;
  scene.add(beacon);

  const state = {
    index: -1,       // -1 = no mission active
    stage: 0,
    timer: 0,
    tailTime: 0,
    spotted: 0,
    lost: 0,
    delivered: 0,
    wave: 0,
    waveLeft: 0,
    completed: [false, false, false, false, false, false],
    objective: '',
    objectivePos: null,
    entities: [],    // meshes/cars this mission owns
    pendingNext: -1, // game time at which the next mission auto-starts
  };

  // Side work state.
  const side = {
    packages: [],    // {mesh,x,z,taken}
    taxiFare: null,  // {x,z,dx,dz,passenger}
    vigilante: null, // {car, hp}
    ramps: [],
    taxiTimer: 8,
    vigTimer: 20,
  };

  function setObjective(text, pos) {
    state.objective = text;
    state.objectivePos = pos || null;
    beacon.visible = !!pos;
    if (pos) beacon.position.set(pos.x, 0, pos.z);
  }

  function clearEntities() {
    for (const e of state.entities) {
      if (e.mesh) scene.remove(e.mesh.group || e.mesh);
      if (e.group) scene.remove(e.group);
    }
    state.entities = [];
  }

  function markedCar(modelId, x, z, heading) {
    const model = CAR_MODELS.find((m) => m.id === modelId);
    const car = createCar(scene, model, x, z, heading, { driver: 'parked' });
    const marker = new THREE.Mesh(
      new THREE.ConeGeometry(0.8, 1.8, 4),
      new THREE.MeshBasicMaterial({ color: 0xff5a7a }),
    );
    marker.rotation.x = Math.PI;
    marker.position.set(x, 4.2, z);
    scene.add(marker);
    state.entities.push({ mesh: marker });
    car.marker = marker;
    return car;
  }

  function nextMission() {
    for (let i = 0; i < MISSIONS.length; i++) if (!state.completed[i]) return i;
    return -1;
  }

  function start(index, G) {
    clearEntities();
    state.index = index;
    state.stage = 0;
    state.timer = 0;
    state.tailTime = 0;
    state.spotted = 0;
    state.lost = 0;
    state.delivered = 0;
    state.wave = 0;
    const L = city.LOCATIONS;
    const m = MISSIONS[index];
    G.hud.showCard(m.name, m.intro);
    G.audio.missionPass();
    if (index === 0) {
      setObjective('Drive to the docks', L.docks);
    } else if (index === 1) {
      const car = markedCar('coupe', L.lot.x, L.lot.z, 0.4);
      state.entities.push({ car, role: 'repoCar' });
      setObjective('Steal the marked coupe', L.lot);
    } else if (index === 2) {
      const van = createCar(scene, CAR_MODELS[2], -116, -116, 0, { driver: 'courier' });
      van.loop = city.loops[3];
      van.wp = 0;
      van.cruise = 9;
      state.entities.push({ car: van, role: 'courier' });
      setObjective('Find the courier van', { x: van.x, z: van.z });
    } else if (index === 3) {
      setObjective('Get to the stash house', L.stashHouse);
    } else if (index === 4) {
      const a = markedCar('coupe', L.lot.x + 6, L.lot.z, 0.2);
      const b = markedCar('sedan', -58, 116, -0.5);
      state.entities.push({ car: a, role: 'fleetA' }, { car: b, role: 'fleetB' });
      setObjective('Steal the first marked car', { x: a.x, z: a.z });
    } else if (index === 5) {
      setObjective('Get to Sunrise Tower and grab the cash', L.tower);
    }
  }

  function pass(G) {
    const idx = state.index;
    const reward = CFG.MISSION_REWARDS[idx];
    state.completed[idx] = true;
    state.index = -1;
    state.stage = 0;
    setObjective('', null);
    clearEntities();
    G.combat.clearEnemies();
    G.addCash(reward);
    G.hud.showCard('Mission passed', `+ $${reward} — ${MISSIONS[idx].name} complete.`);
    G.audio.missionPass();
    G.saveGame();
    // Chain the story: the next mission starts by itself a few seconds later,
    // so the player never has to hunt for how to continue.
    const next = nextMission();
    if (next >= 0) {
      state.pendingNext = G.time + 6;
      G.hud.toast('Next mission starts in a moment…');
    }
    if (G.onMissionPass) G.onMissionPass(idx, reward);
  }

  function fail(G, reason) {
    const idx = state.index;
    state.index = -1;
    state.stage = 0;
    state.pendingNext = -1;
    setObjective('', null);
    clearEntities();
    G.combat.clearEnemies();
    G.hud.showCard('Mission failed', reason);
    G.audio.missionFail();
    if (G.onMissionFail) G.onMissionFail(idx, reason);
  }

  function distTo(x, z, p) { return Math.hypot(x - p.x, z - p.z); }

  function update(dt, G) {
    // Beacon bob.
    if (beacon.visible) {
      arrow.position.y = 5 + Math.sin(performance.now() / 300) * 0.5;
      arrow.rotation.y += dt * 2;
    }
    // ---- side work: packages bob ----
    for (const p of side.packages) {
      if (p.taken) continue;
      p.mesh.rotation.y += dt * 1.5;
      p.mesh.position.y = 0.9 + Math.sin(performance.now() / 350 + p.x) * 0.15;
    }
    // ---- active mission ----
    if (state.index < 0) {
      // Auto-chain: start the next mission a few seconds after a pass.
      if (state.pendingNext > 0 && G.time >= state.pendingNext) {
        state.pendingNext = -1;
        const next = nextMission();
        if (next >= 0) start(next, G);
      }
      updateSide(dt, G);
      return;
    }
    const L = city.LOCATIONS;
    const player = G.player;
    const car = G.playerCar;
    const px = car ? car.x : player.x;
    const pz = car ? car.z : player.z;
    const idx = state.index;

    if (idx === 0) {
      if (state.stage === 0) {
        if (distTo(px, pz, L.docks) < 8) {
          state.stage = 1;
          state.timer = 30;
          G.police.wanted = 1;
          G.police.raise(0, 'tail');
          setObjective('Lose the tail — get out of sight', null);
          G.hud.toast('A patrol car is on your tail. Break line of sight!');
        }
      } else {
        state.timer -= dt;
        if (G.police.wanted === 0) pass(G);
        else if (state.timer <= 0) {
          G.police.clear();
          pass(G);
        }
      }
    } else if (idx === 1) {
      const ent = state.entities.find((e) => e.role === 'repoCar');
      const repoCar = ent && ent.car;
      if (!repoCar) { fail(G, 'The coupe was destroyed.'); return; }
      if (repoCar.damage >= 1) { fail(G, 'The coupe was wrecked.'); return; }
      if (state.stage === 0) {
        if (car === repoCar) {
          state.stage = 1;
          setObjective('Deliver the coupe to the garage', L.garage);
          G.hud.toast('Nice. Now get it to the garage on Canal Row.');
        }
      } else if (distTo(px, pz, L.garage) < 9 && car === repoCar) pass(G);
    } else if (idx === 2) {
      const ent = state.entities.find((e) => e.role === 'courier');
      const van = ent && ent.car;
      if (!van) { fail(G, 'The courier is gone.'); return; }
      // Van drives its loop.
      const target = van.loop[van.wp];
      const dx = target.x - van.x, dz = target.z - van.z;
      const d = Math.hypot(dx, dz);
      if (d < 3.5) van.wp = (van.wp + 1) % van.loop.length;
      else {
        const want = Math.atan2(dx, dz);
        const turn = clamp(((want - van.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1, 1);
        van.update(dt, van.speed < van.cruise ? 0.5 : 0, turn, false, (x, z, r) => city.collideCircle(x, z, r));
      }
      setObjective('Tail the courier van', { x: van.x, z: van.z });
      const vd = Math.hypot(van.x - px, van.z - pz);
      if (vd < 6) {
        state.spotted += dt;
        if (state.spotted > 3) { fail(G, 'Spotted! The courier made you.'); return; }
      } else state.spotted = 0;
      if (vd > 48) {
        state.lost += dt;
        if (state.lost > 5) { fail(G, 'Lost the courier.'); return; }
      } else state.lost = 0;
      if (vd >= 6 && vd <= 48) state.tailTime += dt;
      if (state.tailTime > 20) pass(G);
    } else if (idx === 3) {
      if (state.stage === 0) {
        if (distTo(px, pz, L.stashHouse) < 9) {
          state.stage = 1;
          state.wave = 1;
          spawnWave(G, 3);
          setObjective('Defend the stash house — wave 1 of 3', L.stashHouse);
        }
      } else {
        const alive = G.combat.enemies.filter((e) => e.alive).length;
        if (alive === 0) {
          state.wave += 1;
          if (state.wave > 3) pass(G);
          else {
            spawnWave(G, 2 + state.wave);
            setObjective(`Defend the stash house — wave ${state.wave} of 3`, L.stashHouse);
          }
        }
      }
    } else if (idx === 4) {
      const a = state.entities.find((e) => e.role === 'fleetA');
      const b = state.entities.find((e) => e.role === 'fleetB');
      if (!a || !b) return;
      if (a.car.damage >= 1 || b.car.damage >= 1) { fail(G, 'A getaway car was wrecked.'); return; }
      if (state.stage === 0) {
        if (car === a.car) {
          state.stage = 1;
          setObjective('Deliver the coupe to the marina', L.marina);
        } else setObjective('Steal the first marked car', { x: a.car.x, z: a.car.z });
      } else if (state.stage === 1) {
        if (distTo(px, pz, L.marina) < 10 && car === a.car) {
          state.delivered = 1;
          state.stage = 2;
          a.car.driver = 'parked';
          setObjective('Steal the second marked car', { x: b.car.x, z: b.car.z });
          G.hud.toast('One down. Now the sedan on the south avenue.');
        }
      } else if (state.stage === 2) {
        if (car === b.car) {
          state.stage = 3;
          setObjective('Deliver the sedan to the marina', L.marina);
        }
      } else if (distTo(px, pz, L.marina) < 10 && car === b.car) pass(G);
    } else if (idx === 5) {
      if (state.stage === 0) {
        if (distTo(px, pz, L.tower) < 8) {
          state.stage = 1;
          state.timer = 0;
          G.addCash(0);
          G.police.wanted = 4;
          setObjective('Run! Get to the marina boat', L.marina);
          G.hud.toast('Cash grabbed. Four stars — run for the boat!');
          G.audio.siren(true, 0);
        }
      } else if (distTo(px, pz, L.marina) < 10) {
        pass(G);
      }
    }
    updateSide(dt, G);
  }

  function spawnWave(G, n) {
    const L = city.LOCATIONS;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 18 + Math.random() * 10;
      G.combat.spawnEnemy('gang', L.stashHouse.x + Math.sin(a) * r, L.stashHouse.z + Math.cos(a) * r, 50);
    }
  }

  function updateSide(dt, G) {
    const player = G.player;
    const car = G.playerCar;
    const px = car ? car.x : player.x;
    const pz = car ? car.z : player.z;
    // Side work only spawns in true free-roam — not while a mission runs, and
    // not in the few seconds between a pass and the next mission auto-starting.
    const freeRoam = state.index < 0 && state.pendingNext < 0;
    // Packages: walk or drive through to collect.
    for (const p of side.packages) {
      if (p.taken) continue;
      if (Math.hypot(p.x - px, p.z - pz) < 2.2) {
        p.taken = true;
        p.mesh.visible = false;
        G.packagesCollected = (G.packagesCollected || 0) + 1;
        G.addCash(25);
        G.audio.pickup();
        G.hud.toast(`Package ${G.packagesCollected}/${CFG.PACKAGES} — +$25`);
        G.effects.burst(p.x, 1, p.z, 12, 0xffd23f, 5, 0.6);
      }
    }
    // Taxi fares: only while driving a taxi in free-roam.
    if (car && car.model.id === 'taxi' && freeRoam) {
      side.taxiTimer -= dt;
      if (!side.taxiFare && side.taxiTimer <= 0) {
        const L = city.LOCATIONS;
        const dest = pick([L.docks, L.marina, L.tower, L.garage]);
        side.taxiFare = { x: px + 30, z: pz - 20, dx: dest.x, dz: dest.z, passenger: false };
        setObjective('Pick up the fare', { x: side.taxiFare.x, z: side.taxiFare.z });
        G.hud.toast('Fare waiting — pick them up.');
      }
      if (side.taxiFare) {
        const f = side.taxiFare;
        if (!f.passenger) {
          setObjective('Pick up the fare', { x: f.x, z: f.z });
          if (Math.hypot(f.x - px, f.z - pz) < 6) {
            f.passenger = true;
            setObjective('Drop the fare off', { x: f.dx, z: f.dz });
            G.hud.toast('Passenger in. Drive!');
          }
        } else {
          setObjective('Drop the fare off', { x: f.dx, z: f.dz });
          if (Math.hypot(f.dx - px, f.dz - pz) < 8) {
            G.addCash(CFG.TAXI_FARE);
            G.hud.toast(`Fare complete — +$${CFG.TAXI_FARE}`);
            G.audio.pickup();
            side.taxiFare = null;
            side.taxiTimer = 12;
            if (state.index < 0) setObjective('', null);
          }
        }
      }
    }
    // Vigilante: a marked target car appears while driving with no wanted level.
    if (car && G.police.wanted === 0 && freeRoam) {
      side.vigTimer -= dt;
      if (!side.vigilante && side.vigTimer <= 0) {
        const model = CAR_MODELS[0];
        const target = createCar(scene, model, px + 45, pz + 20, 0, { driver: 'vigilante' });
        target.hp = 60;
        side.vigilante = { car: target };
        setObjective('Vigilante: stop the marked car', { x: target.x, z: target.z });
        G.hud.toast('Vigilante job: run the marked car off the road.');
      }
      if (side.vigilante) {
        const t = side.vigilante.car;
        // It flees from the player.
        const dx = t.x - px, dz = t.z - pz;
        const d = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz);
        const turn = clamp(((want - t.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1, 1);
        t.update(dt, t.speed < 26 ? 0.9 : 0.3, turn, false, (x, z, r) => city.collideCircle(x, z, r));
        setObjective('Vigilante: stop the marked car', { x: t.x, z: t.z });
        if (t.damage >= 0.9 || t.speed < 1 && d < 4) {
          G.addCash(CFG.VIGILANTE_REWARD);
          G.hud.toast(`Target stopped — +$${CFG.VIGILANTE_REWARD}`);
          G.audio.missionPass();
          scene.remove(t.mesh.group);
          side.vigilante = null;
          side.vigTimer = 25;
          if (state.index < 0) setObjective('', null);
        }
      }
    }
    // Stunt ramps: drive over one fast and it pays out.
    for (const r of side.ramps) {
      if (!r.used && car && Math.abs(car.speed) > 24 && Math.hypot(r.x - px, r.z - pz) < 4) {
        r.used = true;
        G.addCash(100);
        G.hud.toast('Stunt jump! +$100');
        G.effects.burst(px, 1.5, pz, 20, 0xff9a3d, 8, 0.8);
        G.audio.pickup();
      }
    }
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  return {
    state, side,
    start, update, pass, fail,
    setObjective,
    /** Scatter the 20 packages and 3 stunt ramps around the district. */
    seedSideWork(rng) {
      const geo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
      for (let i = 0; i < CFG.PACKAGES; i++) {
        const x = Math.round((rng() * 2 - 1) * (CFG.HALF - 12));
        const z = Math.round((rng() * 2 - 1) * (CFG.HALF - 12));
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
          color: 0xffd23f, emissive: 0xffd23f, emissiveIntensity: 0.7, roughness: 0.4,
        }));
        mesh.position.set(x, 0.9, z);
        scene.add(mesh);
        side.packages.push({ mesh, x, z, taken: false });
      }
      // Ramps on three avenues.
      for (const [x, z] of [[0, -116], [-58, 0], [116, 58]]) {
        const ramp = new THREE.Mesh(
          new THREE.BoxGeometry(6, 1.4, 8),
          new THREE.MeshStandardMaterial({ color: 0xff5a7a, roughness: 0.7 }),
        );
        ramp.position.set(x, 0.7, z);
        ramp.rotation.x = -0.28;
        ramp.castShadow = true;
        scene.add(ramp);
        side.ramps.push({ x, z, used: false });
      }
    },
    /** Next uncompleted mission index, or -1 when the arc is done. */
    nextMission,
    abort() {
      state.index = -1;
      state.stage = 0;
      state.pendingNext = -1;
      setObjective('', null);
      clearEntities();
    },
  };
}
