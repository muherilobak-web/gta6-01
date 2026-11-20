// Vice Point — screenshot scenes behind ?shot=chase|street|combat|marina.
// Each one stages a real moment of the game — the same world, the same
// rules, the same HUD — then hands control to a small autopilot (or none)
// while the page paints. main.js sets window.__shotReady once the scene
// has settled, so a screenshot is a frame of the game actually running,
// never a mock-up. The cover (chase) is the most important: the camera is
// a 3/4 rear view, so the player coupe AND the dark VPPD cars behind it
// are both in frame, with the warm horizon at the end of the avenue.
import { VEHICLE_TYPES } from './config.js';
import { clampNumber } from './rng.js';
import { makeCar } from './vehicles.js';

export const SHOT_NAMES = ['chase', 'street', 'combat', 'marina'];

export function stageShot(name, G) {
  const L = G.city.LOCATIONS;
  const shot = { name, autopilot: null, settleSeconds: 2.2 };
  if (name === 'chase') {
    const coupe = makeCar(G.scene, VEHICLE_TYPES[1], 0, -120, 0, { driver: null });
    G.allCars.push(coupe);
    G.enterCar(coupe);
    coupe.speed = 28;
    G.police.wanted = 3;
    // Two interceptors close behind, offset sideways so the 3/4 camera
    // sees both of them beside the coupe instead of hidden behind it.
    const p1 = G.police.spawnAt(2.2, -128, 0);
    const p2 = G.police.spawnAt(-2.4, -138, 0);
    p1.speed = 27;
    p2.speed = 26;
    G.missions.setObjective('Lose the tail — get to the marina', L.marina);
    G.hud.showCard('First Gear', 'One last job. Drive to the docks and lose the patrol car on your tail.');
    let t = 0;
    shot.autopilot = (dt) => {
      t += dt;
      const car = G.playerCar;
      if (!car) return;
      const steer = clampNumber((0 - car.x) * 0.09, -0.5, 0.5) + Math.sin(t * 0.8) * 0.06;
      car.update(dt, car.speed < 32 ? 0.9 : 0.4, steer, false, (x, z, r) => G.city.collideCircle(x, z, r));
      G.trafficAvoidPlayer = true;
    };
    shot.settleSeconds = 2.6;
  } else if (name === 'street') {
    G.player.x = 7;
    G.player.z = -100;
    G.player.camYaw = 0;
    G.player.camPitch = 0.4;
    G.missions.setObjective('Get to the stash house', L.stashHouse);
    G.hud.toast('Vice Point — every street is open. Find work, or make it.');
    shot.settleSeconds = 1.6;
  } else if (name === 'combat') {
    G.player.x = L.stashHouse.x - 14;
    G.player.z = L.stashHouse.z - 6;
    G.player.camYaw = Math.atan2(L.stashHouse.x - G.player.x, L.stashHouse.z - G.player.z);
    G.playerWeapon = 'smg';
    G.ammo = { fists: Infinity, pistol: 60, smg: 120 };
    G.combat.spawnEnemy('gang', L.stashHouse.x + 4, L.stashHouse.z - 2, 50);
    G.combat.spawnEnemy('gang', L.stashHouse.x - 2, L.stashHouse.z + 5, 50);
    G.combat.spawnEnemy('gang', L.stashHouse.x + 8, L.stashHouse.z + 6, 50);
    G.missions.setObjective('Defend the stash house — wave 1 of 3', L.stashHouse);
    G.effects.muzzle(G.player.x + 1, 1.4, G.player.z + 1, 0.5, 0.5);
    shot.settleSeconds = 1.4;
  } else {
    const coupe = makeCar(G.scene, VEHICLE_TYPES[1], 134, 118, 2.6, { driver: 'parked' });
    G.allCars.push(coupe);
    G.player.x = 140;
    G.player.z = 114;
    G.player.camYaw = 0.15;
    G.player.camPitch = 0.5;
    G.missions.setObjective('Deliver the sedan to the marina', L.marina);
    G.hud.toast('The boat is waiting. One more delivery and the job is done.');
    shot.settleSeconds = 1.6;
  }
  return shot;
}
