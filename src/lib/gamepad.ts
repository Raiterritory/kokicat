// Controller support (DualShock/DualSense, Xbox, generic) through the browser Gamepad API.
// - In the Flappy game, ✕ / A (or Options/Start) jumps.
// - Everywhere else the D-pad or left stick moves a highlight between the buttons on screen,
//   ✕ / A presses the highlighted one and ◯ / B goes back ("← Volver", "Volver a Koki"…).
// - L1 / R1 switch between the Koki and Taz modes (the touch version drags the logo).
import { useEffect, useRef } from "react";

const CROSS = 0, CIRCLE = 1, L1 = 4, R1 = 5, OPTIONS = 9;
const UP = 12, DOWN = 13, LEFT = 14, RIGHT = 15;
const FOCUSABLE = 'button, [role="button"], a[href], input, select, textarea';
const REPEAT_DELAY = 350, REPEAT_EVERY = 140;

type Dir = "up" | "down" | "left" | "right";

export type PadHandlers = {
  /** ✕ while playing: return true when the game used it (jump), false to press the highlighted button instead */
  onAction?: () => boolean;
  /** L1 (-1) / R1 (+1) */
  onShoulder?: (side: -1 | 1) => void;
};

let highlighted: HTMLElement | null = null;
/** true while the controller itself sends a pointerdown (so it doesn't clear its own highlight) */
let synthetic = false;

/** Buttons a player could press right now: visible and not covered by a modal. */
function candidates(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    if ((el as HTMLButtonElement).disabled) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false;
    const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2));
    const y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
    const hit = document.elementFromPoint(x, y);
    return !!hit && (hit === el || el.contains(hit) || hit.contains(el));
  });
}

function highlight(el: HTMLElement | null) {
  highlighted?.classList.remove("pad-focus");
  highlighted = el;
  if (!el) return;
  el.classList.add("pad-focus");
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: "nearest", inline: "nearest" });
}

const center = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/** Moves the highlight to the nearest button in that direction (spatial navigation). */
function move(dir: Dir) {
  const list = candidates();
  if (!list.length) return highlight(null);
  if (!highlighted || !list.includes(highlighted)) return highlight(list[0]);
  const c = center(highlighted);
  let best: HTMLElement | null = null, bestScore = Infinity;
  for (const el of list) {
    if (el === highlighted) continue;
    const p = center(el);
    const dx = p.x - c.x, dy = p.y - c.y;
    const main = dir === "up" ? -dy : dir === "down" ? dy : dir === "left" ? -dx : dx;
    const side = dir === "up" || dir === "down" ? Math.abs(dx) : Math.abs(dy);
    if (main <= 8) continue;
    const score = main + side * 2;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) highlight(best);
}

/** Presses the highlighted button (the Taz holes react to pointerdown, the rest to click). */
function press() {
  const el = highlighted && candidates().includes(highlighted) ? highlighted : null;
  if (!el) return move("down");
  if (el.dataset.pad === "down") {
    synthetic = true;
    el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" }));
    synthetic = false;
  } else el.click();
}

/** ◯: presses the "back" button on top, if there is one. */
function back() {
  const list = candidates().reverse();
  const el = list.find((b) => /^\s*(←|✕|×)|volver|cerrar/i.test(b.textContent ?? ""));
  el?.click();
}

/** Polls the controllers about 60 times a second and turns their buttons into game actions. */
export function useGamepad(handlers: PadHandlers) {
  const h = useRef(handlers);
  h.current = handlers;

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.getGamepads) return;
    const prev = new Map<number, boolean>();
    const held: Partial<Record<Dir, number>> = {};
    let timer = 0;

    const pressedNow = (b: number) =>
      [...navigator.getGamepads()].some((g) => g?.buttons[b]?.pressed);
    const edge = (b: number) => {
      const now = pressedNow(b);
      const was = prev.get(b) ?? false;
      prev.set(b, now);
      return now && !was;
    };
    const dirDown = (d: Dir) => {
      const pads = [...navigator.getGamepads()].filter(Boolean) as Gamepad[];
      return pads.some((g) => {
        const [ax, ay] = [g.axes[0] ?? 0, g.axes[1] ?? 0];
        if (d === "up") return g.buttons[UP]?.pressed || ay < -0.5;
        if (d === "down") return g.buttons[DOWN]?.pressed || ay > 0.5;
        if (d === "left") return g.buttons[LEFT]?.pressed || ax < -0.5;
        return g.buttons[RIGHT]?.pressed || ax > 0.5;
      });
    };

    const tick = () => {
      if (!navigator.getGamepads().some(Boolean)) return;
      const t = performance.now();
      // dirección: un paso al apretar y, si se mantiene, se repite
      for (const d of ["up", "down", "left", "right"] as Dir[]) {
        if (!dirDown(d)) { delete held[d]; continue; }
        if (held[d] === undefined) { held[d] = t + REPEAT_DELAY; move(d); }
        else if (t >= held[d]!) { held[d] = t + REPEAT_EVERY; move(d); }
      }
      const cross = edge(CROSS), options = edge(OPTIONS);
      if (cross || options) {
        if (!h.current.onAction?.()) press();
      }
      if (edge(CIRCLE)) back();
      if (edge(L1)) h.current.onShoulder?.(-1);
      if (edge(R1)) h.current.onShoulder?.(1);
    };
    // un temporizador (no requestAnimationFrame) para que el control siga respondiendo aunque el navegador frene los cuadros
    timer = window.setInterval(tick, 16);
    // al tocar la pantalla o usar el mouse, se quita el resaltado del control
    const clear = () => { if (!synthetic) highlight(null); };
    window.addEventListener("pointerdown", clear, true);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pointerdown", clear, true);
    };
  }, []);
}
