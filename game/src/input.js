// Keyboard + mouse input for Vice Point. Held keys give movement axes; one-shot presses
// (enter a car, jump, pause, weapon swap) are queued as bit flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice. Mouse orbits
// the camera (pointer lock when clicked, drag as fallback) and holding the button shoots.
export const ACTION_ENTER = 1;    // E — enter / exit / steal a car
export const ACTION_JUMP = 2;      // Space — jump on foot, handbrake in a car
export const ACTION_PAUSE = 4;     // Esc / P — pause
export const ACTION_CONFIRM = 8;   // Enter / click — menus
export const ACTION_WEAPON = 16;   // Q or wheel — next weapon
export const ACTION_HORN = 32;     // H — horn
export const ACTION_MAP = 64;      // M — minimap zoom toggle

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseDX = 0;
  let mouseDY = 0;
  let mouseDown = false;
  let locked = false;

  function onKeyDown(event) {
    if (event.repeat) return;
    held.add(event.code);
    if (event.code === 'KeyE') actions |= ACTION_ENTER;
    else if (event.code === 'Space') { actions |= ACTION_JUMP; event.preventDefault(); }
    else if (event.code === 'Escape' || event.code === 'KeyP') actions |= ACTION_PAUSE;
    else if (event.code === 'Enter') actions |= ACTION_CONFIRM;
    else if (event.code === 'KeyQ') actions |= ACTION_WEAPON;
    else if (event.code === 'KeyH') actions |= ACTION_HORN;
    else if (event.code === 'KeyM') actions |= ACTION_MAP;
    else if (event.code.startsWith('Digit')) {
      const n = Number(event.code.slice(5));
      if (n >= 1 && n <= 3) actions |= ACTION_WEAPON << n; // weapon 1..3 slots
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  }
  function onKeyUp(event) {
    held.delete(event.code);
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('click', () => {
    // Pointer lock gives the smoothest camera orbit; a denied lock just falls back to drag.
    if (canvas.requestPointerLock) {
      try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* drag fallback */ }
    }
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (event) => {
    if (locked) { mouseDX += event.movementX; mouseDY += event.movementY; }
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) mouseDown = true;
    if (!locked) mouseDX = 0; // drag mode accumulates on move below
  });
  window.addEventListener('mouseup', () => { mouseDown = false; });
  canvas.addEventListener('mousemove', (event) => {
    if (!locked && mouseDown) { mouseDX += event.movementX; mouseDY += event.movementY; }
  });
  canvas.addEventListener('wheel', (event) => {
    actions |= ACTION_WEAPON;
    event.preventDefault();
  }, { passive: false });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function hasAny(set) {
    for (const code of held) if (set.has(code)) return true;
    return false;
  }

  return {
    /** Forward/back axis: +1 forward, -1 back. Strafe: +1 right, -1 left. */
    axes() {
      return {
        fwd: (hasAny(FORWARD) ? 1 : 0) - (hasAny(BACK) ? 1 : 0),
        strafe: (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0),
        run: hasAny(RUN),
      };
    },
    /** Driving axes: throttle -1..1, steer -1..1, brake held. */
    drive() {
      return {
        throttle: (hasAny(FORWARD) ? 1 : 0) - (hasAny(BACK) ? 1 : 0),
        steer: (hasAny(LEFT) ? 1 : 0) - (hasAny(RIGHT) ? 1 : 0),
        handbrake: held.has('Space'),
        run: false,
      };
    },
    /** Mouse orbit deltas since the last call, in pixels. */
    takeMouse() {
      const d = { dx: mouseDX, dy: mouseDY };
      mouseDX = 0; mouseDY = 0;
      return d;
    },
    /** Is the fire button held down right now. */
    firing() { return mouseDown; },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    isLocked() { return locked; },
  };
}
