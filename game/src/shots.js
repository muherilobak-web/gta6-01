// Screenshot staging: puts the game into a composed frame for each of
// the four shots, then raises window.__shotReady once it has rendered.

import * as THREE from 'three';

function waitReady(game) {
  return new Promise((resolve) => {
    const check = () => {
      if (window.__gameReady) resolve(game);
      else setTimeout(check, 50);
    };
    check();
  });
}

function shotCam(game, px, py, pz, lx, ly, lz) {
  game.shotCamera = {
    pos: new THREE.Vector3(px, py, pz),
    look: new THREE.Vector3(lx, ly, lz),
  };
}

export async function stageShot(name) {
  const game = await waitReady(window.__game);
  // Play straight into the scene: skip the menu, no pause.
  game.setState('playing');
  // Start mission 0 so the HUD objective pill shows a real objective:
  // updateHud rewrites the pill from missions.objective every frame,
  // so without this the pill reads "Mission 1 — First Gear: " empty.
  game.missions.start(0);
  const seed = new URLSearchParams(location.search).get('seed') || '7';
  void seed;
  // Combat only: re-shoot in the ready callback below so the tracer
  // (0.09 s life) is fresh in the captured frame.
  let combatShot = null;

  if (name === 'chase') {
    // Red coupe mid-drift on the beachfront avenue, two interceptors
    // behind, three stars, camera looking west into the sunset.
    const coupe = game.spawnMissionCar('coupe', -60, 20, Math.PI / 2 + 0.35, false);
    game.player.setPosition(-60, 20, Math.PI / 2);
    game.enterCar(coupe);
    coupe.speed = 16;
    const p1 = game.police.cars[0] || null;
    game.police.setWanted(3);
    const cops = game.police.cars;
    if (cops[0]) {
      cops[0].pos.set(-34, 0, 28);
      cops[0].heading = Math.PI / 2;
      cops[0].speed = 14;
    }
    if (cops[1]) {
      cops[1].pos.set(-30, 0, 12);
      cops[1].heading = Math.PI / 2 + 0.1;
      cops[1].speed = 15;
    }
    void p1;
    // Stage 1 of mission 0: the tail is on. Set the mission state itself
    // (hud.setObjective is overwritten by updateHud every frame).
    game.missions.stage = 1;
    game.missions.objective = 'Lose the tail — get out of sight';
    game.missions.setWaypoint(game.missions.waypoint.x, game.missions.waypoint.z, 'Lose the tail');
    shotCam(game, -8, 6.5, 42, -70, 2, 0);
    game.effects.skid(coupe.pos, coupe.heading);
    game.effects.puffSmoke(coupe.pos);
  } else if (name === 'street') {
    // Player on foot in the middle of a road, camera looking straight
    // down the road axis so buildings flank both sides (roads run at
    // x/z = -150,-90,-30,30,90,150; (0,0) is inside a block).
    game.player.setPosition(30, 0, Math.PI);
    game.player.group.visible = true;
    shotCam(game, 30, 3.5, 14, 30, 1.5, -40);
  } else if (name === 'combat') {
    // Shootout staged on the open road x=30 so no building blocks the
    // sightline: player mid-road, three gang members ahead down the road,
    // camera behind the player looking straight down the road axis.
    game.player.setPosition(30, -60, Math.PI);
    game.combat.giveWeapon('pistol', 24);
    game.combat.selectWeapon('pistol');
    game.combat.makeEnemy(30, -72);
    game.combat.makeEnemy(26, -76);
    game.combat.makeEnemy(34, -80);
    const from = game.player.pos.clone();
    const dir = new THREE.Vector3(0, 0.05, -1).normalize();
    game.combat.shoot(from, dir, true);
    combatShot = { from, dir };
    shotCam(game, 30, 4, -44, 30, 1.5, -72);
  } else if (name === 'marina') {
    const car = game.spawnMissionCar('coupe', 132, 140, Math.PI * 0.75, false);
    game.player.setPosition(136, 144, Math.PI * 0.75);
    game.player.group.visible = true;
    void car;
    shotCam(game, 158, 5.5, 118, 128, 1.5, 148);
  } else {
    shotCam(game, -120, 30, -100, -140, 1, -140);
  }
  // Let two frames render, then signal readiness. For combat, fire
  // once more in this same task so the tracer is fresh (0.09 s life)
  // in the frame the harness captures 50 ms later.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (combatShot) {
        game.combat.cooldown = 0;
        game.combat.shoot(combatShot.from, combatShot.dir, true);
        // Hold the staged tracer for the capture: its 0.09 s life would
        // expire in the frames between here and the harness screenshot
        // 50 ms later. Staging-only; the game's own tracer life is untouched.
        for (const t of game.effects.tracers || []) t.userData.life = 0.6;
      }
      window.__shotReady = true;
    });
  });
}

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  stageShot(shot);
}
