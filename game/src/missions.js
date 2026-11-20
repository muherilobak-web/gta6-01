// Vice Point — the story. Six missions for Mara Reyes, one arc, plus side
// work: taxi fares, vigilante targets, 20 collectible packages and stunt
// ramps. Each mission is a small stage machine with an objective, a waypoint
// beacon, a pass condition and a fail condition. Passing a mission chains
// the next one a few seconds later, so the player never hunts for how to
// continue. This module owns its mission entities (marked cars, the courier,
// the beacon) and talks to the rest of the game through the shared world G.
import * as THREE from 'three';
import { WORLD, STORY, VEHICLE_TYPES } from './config.js';
import { makeCar } from './vehicles.js';
import { clampNumber } from './rng.js';

export function makeMissions(scene, city) {
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
    index: -1,
    stage: 0,
    timer: 0,
    tailTime: 0,
    spottedFor: 0,
    lostFor: 0,
    delivered: 0,
    wave: 0,
    completed: [false, false, false, false, false, false],
    objective: '',
    objectivePos: null,
    entities: [],
    pendingNext: -1,
  };
  const side = {
    packages: [],
    taxiFare: null,
    vigilante: null,
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

  function dropEntities() {
    for (const entry of state.entities) {
      if (entry.mesh) scene.remove(entry.mesh.group || entry.mesh);
      if (entry.group) scene.remove(entry.group);
    }
    state.entities = [];
  }

  // Mission cars must live in G.allCars: that is the list E searches, the
  // list car-vs-car collision runs over, and the list the minimap draws.
  // A marked car that is not registered there can never be entered, which
  // would stall the mission that owns it.
  function registerCar(G, car) {
    if (!G.allCars.includes(car)) G.allCars.push(car);
  }

  function markedCar(G, typeId, x, z, heading) {
    const type = VEHICLE_TYPES.find((t) => t.id === typeId);
    const car = makeCar(scene, type, x, z, heading, { driver: 'parked' });
    registerCar(G, car);
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

  function nextUnfinished() {
    for (let i = 0; i < STORY.length; i += 1) if (!state.completed[i]) return i;
    return -1;
  }

  function start(index, G) {
    dropEntities();
    state.index = index;
    state.stage = 0;
    state.timer = 0;
    state.tailTime = 0;
    state.spottedFor = 0;
    state.lostFor = 0;
    state.delivered = 0;
    state.wave = 0;
    const L = city.LOCATIONS;
    const mission = STORY[index];
    G.hud.showCard(mission.title, mission.intro);
    G.audio.missionPass();
    if (index === 0) {
      setObjective('Drive to the docks', L.docks);
    } else if (index === 1) {
      const car = markedCar(G, 'coupe', L.lot.x, L.lot.z, 0.4);
      state.entities.push({ car, role: 'repoCar' });
      setObjective('Steal the marked coupe', L.lot);
    } else if (index === 2) {
      const van = makeCar(scene, VEHICLE_TYPES[2], -116, -116, 0, { driver: 'courier' });
      registerCar(G, van);
      van.loop = city.loops[3];
      van.wp = 0;
      van.cruise = 9;
      state.entities.push({ car: van, role: 'courier' });
      setObjective('Find the courier van', { x: van.x, z: van.z });
    } else if (index === 3) {
      setObjective('Get to the stash house', L.stashHouse);
    } else if (index === 4) {
      const first = markedCar(G, 'coupe', L.lot.x + 6, L.lot.z, 0.2);
      const second = markedCar(G, 'sedan', -58, 116, -0.5);
      state.entities.push({ car: first, role: 'fleetA' }, { car: second, role: 'fleetB' });
      setObjective('Steal the first marked car', { x: first.x, z: first.z });
    } else if (index === 5) {
      setObjective('Get to Sunrise Tower and grab the cash', L.tower);
    }
  }

  function passMission(G) {
    const idx = state.index;
    const reward = WORLD.missionPayouts[idx];
    state.completed[idx] = true;
    state.index = -1;
    state.stage = 0;
    setObjective('', null);
    dropEntities();
    G.combat.clearEnemies();
    G.addCash(reward);
    G.hud.showCard('Mission passed', `+ $${reward} — ${STORY[idx].title} complete.`);
    G.audio.missionPass();
    G.saveGame();
    const next = nextUnfinished();
    if (next >= 0) {
      state.pendingNext = G.time + 6;
      G.hud.toast('Next mission starts in a moment…');
    }
    if (G.onMissionPass) G.onMissionPass(idx, reward);
  }

  function failMission(G, reason) {
    const idx = state.index;
    state.index = -1;
    state.stage = 0;
    state.pendingNext = -1;
    setObjective('', null);
    dropEntities();
    G.combat.clearEnemies();
    G.hud.showCard('Mission failed', reason);
    G.audio.missionFail();
    if (G.onMissionFail) G.onMissionFail(idx, reason);
  }

  function spawnWave(G, count) {
    const L = city.LOCATIONS;
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 18 + Math.random() * 10;
      G.combat.spawnEnemy('gang', L.stashHouse.x + Math.sin(angle) * radius, L.stashHouse.z + Math.cos(angle) * radius, 50);
    }
  }

  function playerPos(G) {
    const car = G.playerCar;
    return car ? { x: car.x, z: car.z } : { x: G.player.x, z: G.player.z };
  }

  function distanceTo(x, z, point) {
    return Math.hypot(x - point.x, z - point.z);
  }

  function updateSideWork(dt, G) {
    const pos = playerPos(G);
    const car = G.playerCar;
    const freeRoam = state.index < 0 && state.pendingNext < 0;
    for (const pkg of side.packages) {
      if (pkg.taken) continue;
      if (Math.hypot(pkg.x - pos.x, pkg.z - pos.z) < 2.2) {
        pkg.taken = true;
        pkg.mesh.visible = false;
        G.packagesCollected = (G.packagesCollected || 0) + 1;
        G.addCash(WORLD.packageValue);
        G.audio.pickup();
        G.hud.toast(`Package ${G.packagesCollected}/${WORLD.packageCount} — +$${WORLD.packageValue}`);
        G.effects.burst(pkg.x, 1, pkg.z, 12, 0xffd23f, 5, 0.6);
      }
    }
    if (car && car.model.id === 'taxi' && freeRoam) {
      side.taxiTimer -= dt;
      if (!side.taxiFare && side.taxiTimer <= 0) {
        const L = city.LOCATIONS;
        const dest = [L.docks, L.marina, L.tower, L.garage][Math.floor(Math.random() * 4)];
        side.taxiFare = { x: pos.x + 30, z: pos.z - 20, dx: dest.x, dz: dest.z, passenger: false };
        setObjective('Pick up the fare', { x: side.taxiFare.x, z: side.taxiFare.z });
        G.hud.toast('Fare waiting — pick them up.');
      }
      const fare = side.taxiFare;
      if (fare && !fare.passenger) {
        setObjective('Pick up the fare', { x: fare.x, z: fare.z });
        if (Math.hypot(fare.x - pos.x, fare.z - pos.z) < 6) {
          fare.passenger = true;
          setObjective('Drop the fare off', { x: fare.dx, z: fare.dz });
          G.hud.toast('Passenger in. Drive!');
        }
      } else if (fare) {
        setObjective('Drop the fare off', { x: fare.dx, z: fare.dz });
        if (Math.hypot(fare.dx - pos.x, fare.dz - pos.z) < 8) {
          G.addCash(WORLD.taxiFare);
          G.hud.toast(`Fare complete — +$${WORLD.taxiFare}`);
          G.audio.pickup();
          side.taxiFare = null;
          side.taxiTimer = 12;
          if (state.index < 0) setObjective('', null);
        }
      }
    }
    if (car && G.police.wanted === 0 && freeRoam) {
      side.vigTimer -= dt;
      if (!side.vigilante && side.vigTimer <= 0) {
        const target = makeCar(scene, VEHICLE_TYPES[0], pos.x + 45, pos.z + 20, 0, { driver: 'vigilante' });
        registerCar(G, target);
        target.hp = 60;
        side.vigilante = { car: target };
        setObjective('Vigilante: stop the marked car', { x: target.x, z: target.z });
        G.hud.toast('Vigilante job: run the marked car off the road.');
      }
      if (side.vigilante) {
        const target = side.vigilante.car;
        const dx = target.x - pos.x;
        const dz = target.z - pos.z;
        const d = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz);
        const turn = clampNumber(((want - target.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1, 1);
        target.update(dt, target.speed < 26 ? 0.9 : 0.3, turn, false, (x, z, r) => city.collideCircle(x, z, r));
        setObjective('Vigilante: stop the marked car', { x: target.x, z: target.z });
        if (target.damage >= 0.9 || (target.speed < 1 && d < 4)) {
          G.addCash(WORLD.vigilantePayout);
          G.hud.toast(`Target stopped — +$${WORLD.vigilantePayout}`);
          G.audio.missionPass();
          scene.remove(target.mesh.group);
          side.vigilante = null;
          side.vigTimer = 25;
          if (state.index < 0) setObjective('', null);
        }
      }
    }
    for (const ramp of side.ramps) {
      if (!ramp.used && car && Math.abs(car.speed) > 24 && Math.hypot(ramp.x - pos.x, ramp.z - pos.z) < 4) {
        ramp.used = true;
        G.addCash(WORLD.stuntPayout);
        G.hud.toast(`Stunt jump! +$${WORLD.stuntPayout}`);
        G.effects.burst(pos.x, 1.5, pos.z, 20, 0xff9a3d, 8, 0.8);
        G.audio.pickup();
      }
    }
  }

  function update(dt, G) {
    if (beacon.visible) {
      arrow.position.y = 5 + Math.sin(performance.now() / 300) * 0.5;
      arrow.rotation.y += dt * 2;
    }
    for (const pkg of side.packages) {
      if (pkg.taken) continue;
      pkg.mesh.rotation.y += dt * 1.5;
      pkg.mesh.position.y = 0.9 + Math.sin(performance.now() / 350 + pkg.x) * 0.15;
    }
    if (state.index < 0) {
      if (state.pendingNext > 0 && G.time >= state.pendingNext) {
        state.pendingNext = -1;
        const next = nextUnfinished();
        if (next >= 0) start(next, G);
      }
      updateSideWork(dt, G);
      return;
    }
    const L = city.LOCATIONS;
    const car = G.playerCar;
    const pos = playerPos(G);
    const idx = state.index;

    if (idx === 0) {
      if (state.stage === 0) {
        if (distanceTo(pos.x, pos.z, L.docks) < 8) {
          state.stage = 1;
          state.timer = 30;
          G.police.wanted = 1;
          G.police.raise(0);
          setObjective('Lose the tail — get out of sight', null);
          G.hud.toast('A patrol car is on your tail. Break line of sight!');
        }
      } else {
        state.timer -= dt;
        if (G.police.wanted === 0) passMission(G);
        else if (state.timer <= 0) {
          G.police.clear();
          passMission(G);
        }
      }
    } else if (idx === 1) {
      const entry = state.entities.find((e) => e.role === 'repoCar');
      const repoCar = entry && entry.car;
      if (!repoCar) { failMission(G, 'The coupe was destroyed.'); return; }
      if (repoCar.damage >= 1) { failMission(G, 'The coupe was wrecked.'); return; }
      if (state.stage === 0) {
        if (car === repoCar) {
          state.stage = 1;
          setObjective('Deliver the coupe to the garage', L.garage);
          G.hud.toast('Nice. Now get it to the garage on Canal Row.');
        }
      } else if (distanceTo(pos.x, pos.z, L.garage) < 9 && car === repoCar) passMission(G);
    } else if (idx === 2) {
      const entry = state.entities.find((e) => e.role === 'courier');
      const van = entry && entry.car;
      if (!van) { failMission(G, 'The courier is gone.'); return; }
      const target = van.loop[van.wp];
      const dx = target.x - van.x;
      const dz = target.z - van.z;
      const d = Math.hypot(dx, dz);
      if (d < 3.5) van.wp = (van.wp + 1) % van.loop.length;
      else {
        const want = Math.atan2(dx, dz);
        const turn = clampNumber(((want - van.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1, 1);
        van.update(dt, van.speed < van.cruise ? 0.5 : 0, turn, false, (x, z, r) => city.collideCircle(x, z, r));
      }
      setObjective('Tail the courier van', { x: van.x, z: van.z });
      const vd = Math.hypot(van.x - pos.x, van.z - pos.z);
      if (vd < 6) {
        state.spottedFor += dt;
        if (state.spottedFor > 3) { failMission(G, 'Spotted! The courier made you.'); return; }
      } else state.spottedFor = 0;
      if (vd > 48) {
        state.lostFor += dt;
        if (state.lostFor > 5) { failMission(G, 'Lost the courier.'); return; }
      } else state.lostFor = 0;
      if (vd >= 6 && vd <= 48) state.tailTime += dt;
      if (state.tailTime > 20) passMission(G);
    } else if (idx === 3) {
      if (state.stage === 0) {
        if (distanceTo(pos.x, pos.z, L.stashHouse) < 9) {
          state.stage = 1;
          state.wave = 1;
          spawnWave(G, 3);
          setObjective('Defend the stash house — wave 1 of 3', L.stashHouse);
        }
      } else {
        const alive = G.combat.enemies.filter((e) => e.alive).length;
        if (alive === 0) {
          state.wave += 1;
          if (state.wave > 3) passMission(G);
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
      if (a.car.damage >= 1 || b.car.damage >= 1) { failMission(G, 'A getaway car was wrecked.'); return; }
      if (state.stage === 0) {
        if (car === a.car) {
          state.stage = 1;
          setObjective('Deliver the coupe to the marina', L.marina);
        } else setObjective('Steal the first marked car', { x: a.car.x, z: a.car.z });
      } else if (state.stage === 1) {
        if (distanceTo(pos.x, pos.z, L.marina) < 10 && car === a.car) {
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
      } else if (distanceTo(pos.x, pos.z, L.marina) < 10 && car === b.car) passMission(G);
    } else if (idx === 5) {
      if (state.stage === 0) {
        if (distanceTo(pos.x, pos.z, L.tower) < 8) {
          state.stage = 1;
          state.timer = 0;
          G.police.wanted = 4;
          setObjective('Run! Get to the marina boat', L.marina);
          G.hud.toast('Cash grabbed. Four stars — run for the boat!');
          G.audio.siren(true, 0);
        }
      } else if (distanceTo(pos.x, pos.z, L.marina) < 10) {
        passMission(G);
      }
    }
    updateSideWork(dt, G);
  }

  return {
    state,
    side,
    start,
    update,
    pass: passMission,
    fail: failMission,
    setObjective,
    seedSideWork(random) {
      const geo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
      for (let i = 0; i < WORLD.packageCount; i += 1) {
        const x = Math.round((random() * 2 - 1) * (WORLD.halfWidth - 12));
        const z = Math.round((random() * 2 - 1) * (WORLD.halfWidth - 12));
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
          color: 0xffd23f, emissive: 0xffd23f, emissiveIntensity: 0.7, roughness: 0.4,
        }));
        mesh.position.set(x, 0.9, z);
        scene.add(mesh);
        side.packages.push({ mesh, x, z, taken: false });
      }
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
    nextMission: nextUnfinished,
    abort() {
      state.index = -1;
      state.stage = 0;
      state.pendingNext = -1;
      setObjective('', null);
      dropEntities();
    },
  };
}
