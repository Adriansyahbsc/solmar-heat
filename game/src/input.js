// Keyboard and pointer input. Held keys give movement and driving; one-shot presses
// (start, pause, enter a car, mute) are queued as bit flags and taken once by the loop,
// so a press between two frames is never lost and never counted twice. The mouse gives
// an aim point in world coordinates, converted by the caller with the camera.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_MUTE = 8;
export const ACTION_RESTART_MISSION = 16;
export const ACTION_CONTINUE = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER_CAR = new Set(['KeyE']);
const MUTE = new Set(['KeyM']);
const RESTART_MISSION = new Set(['KeyR']);
const CONTINUE = new Set(['KeyC']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseSeen = false;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || RUN.has(event.code)) {
      held.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (ENTER_CAR.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ENTER_CAR;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (RESTART_MISSION.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART_MISSION;
    } else if (CONTINUE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONTINUE;
    } else {
      return;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
    mouseDown = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseSeen = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseSeen = true;
    mouseDown = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function hasAny(codes) {
    for (const code of codes) if (held.has(code)) return true;
    return false;
  }

  return {
    /** -1/0/1 on each axis: left/right and up/down from WASD or the arrows. */
    move() {
      const x = (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0);
      const y = (hasAny(DOWN) ? 1 : 0) - (hasAny(UP) ? 1 : 0);
      return { x, y };
    },
    /** True while either Shift is held: run on foot. */
    running() {
      return hasAny(RUN);
    },
    /** True while the left mouse button is held: fire. */
    firing() {
      return mouseDown;
    },
    /** The mouse position in canvas CSS pixels, or null before the mouse moves. */
    mouse() {
      return mouseSeen ? { x: mouseX, y: mouseY } : null;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
