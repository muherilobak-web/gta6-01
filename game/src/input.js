// Keyboard + mouse input. Pointer lock gives the camera its orbit and
// the aim its direction; the game also runs without it (keys only).

export class Input {
  constructor() {
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.locked = false;
    this.onKey = null;
    this.onClick = null;
    this._down = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (this.onKey) this.onKey(e.code, true);
    };
    this._up = (e) => {
      this.keys.delete(e.code);
      if (this.onKey) this.onKey(e.code, false);
    };
    this._move = (e) => {
      if (this.locked) {
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      }
    };
    this._mDown = (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        if (this.onClick) this.onClick();
      }
    };
    this._mUp = (e) => {
      if (e.button === 0) this.mouseDown = false;
    };
    this._lock = () => {
      this.locked = document.pointerLockElement === this.canvas;
    };
  }

  attach(canvas) {
    this.canvas = canvas;
    window.addEventListener('keydown', this._down);
    window.addEventListener('keyup', this._up);
    window.addEventListener('mousemove', this._move);
    window.addEventListener('mousedown', this._mDown);
    window.addEventListener('mouseup', this._mUp);
    document.addEventListener('pointerlockchange', this._lock);
  }

  lockPointer() {
    if (this.canvas && document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock();
    }
  }

  unlockPointer() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  isDown(code) {
    return this.keys.has(code);
  }

  // WASD / arrows as a -1..1 pair, y forward.
  axes() {
    let x = 0;
    let y = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y += 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y -= 1;
    return { x, y };
  }

  consumeMouse() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }
}
