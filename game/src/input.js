// Vice Point — keyboard and mouse input.
// Keys are read every frame into a small axis record; one-shot actions
// (enter car, jump, pause, weapon swap) are queued as bits and consumed by
// the main loop with takeActions(), so a short keypress is never lost
// between frames. Mouse movement orbits the camera; holding the left
// button fires. Pointer lock is requested on canvas click while playing.
export const ACT_ENTER = 1;
export const ACT_JUMP = 2;
export const ACT_PAUSE = 4;
export const ACT_CONFIRM = 8;
export const ACT_WEAPON = 16;
export const ACT_HORN = 32;
export const ACT_MAP = 64;

export function makeInput(canvas) {
  const held = new Set();
  let queued = 0;
  let mouseDeltaX = 0;
  let mouseDeltaY = 0;
  let firing = false;

  function keyName(event) {
    return event.code || event.key || '';
  }

  function onKeyDown(event) {
    const code = keyName(event);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    held.add(code);
    if (code === 'KeyE') queued |= ACT_ENTER;
    if (code === 'Space') queued |= ACT_JUMP;
    if (code === 'Escape' || code === 'KeyP') queued |= ACT_PAUSE;
    if (code === 'Enter') queued |= ACT_CONFIRM;
    if (code === 'KeyQ') queued |= ACT_WEAPON;
    if (code === 'KeyH') queued |= ACT_HORN;
    if (code === 'KeyM') queued |= ACT_MAP;
  }

  function onKeyUp(event) {
    held.delete(keyName(event));
  }

  function onMouseMove(event) {
    if (document.pointerLockElement === canvas) {
      mouseDeltaX += event.movementX || 0;
      mouseDeltaY += event.movementY || 0;
    }
  }

  function onMouseDown(event) {
    if (event.button === 0) firing = true;
    if (document.pointerLockElement !== canvas && canvas.requestPointerLock) {
      canvas.requestPointerLock();
    }
  }

  function onMouseUp(event) {
    if (event.button === 0) firing = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  document.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function axisDown(...codes) {
    return codes.some((c) => held.has(c));
  }

  return {
    // WASD / arrows as -1..1 axes. Forward is +1 on throttle.
    axes() {
      const forward = (axisDown('KeyW', 'ArrowUp') ? 1 : 0)
        - (axisDown('KeyS', 'ArrowDown') ? 1 : 0);
      const strafe = (axisDown('KeyD', 'ArrowRight') ? 1 : 0)
        - (axisDown('KeyA', 'ArrowLeft') ? 1 : 0);
      return { forward, strafe, run: held.has('ShiftLeft') || held.has('ShiftRight') };
    },
    // Driving axes: throttle -1..1, steering -1..1, handbrake held.
    drive() {
      const throttle = (axisDown('KeyW', 'ArrowUp') ? 1 : 0)
        - (axisDown('KeyS', 'ArrowDown') ? 1 : 0);
      const steer = (axisDown('KeyA', 'ArrowLeft') ? 1 : 0)
        - (axisDown('KeyD', 'ArrowRight') ? 1 : 0);
      return { throttle, steer, handbrake: held.has('Space') };
    },
    takeActions() {
      const actions = queued;
      queued = 0;
      return actions;
    },
    takeMouse() {
      const delta = { x: mouseDeltaX, y: mouseDeltaY };
      mouseDeltaX = 0;
      mouseDeltaY = 0;
      return delta;
    },
    firing() {
      return firing;
    },
    // Test hook: pretend a key is held, so a headless play-test can drive
    // without a real keyboard.
    press(code) {
      held.add(code);
    },
    release(code) {
      held.delete(code);
    },
    queueAction(bit) {
      queued |= bit;
    },
  };
}
