// Power-ups of the Koki game (besides the golden Koki's magnet): a shield that takes one crash,
// slow motion for a few seconds, and pastelitos worth double. They float between the pipes like
// the golden Koki; only in solo games (live matches stay the same for everyone, like on the PS4).

export type PowerKind = "shield" | "slow" | "double";
export type PowerPickup = { x: number; y: number; kind: PowerKind; bob: number; taken: boolean };
export type PowerState = {
  pickups: PowerPickup[];
  /** escudo puesto (aguanta un choque) */
  shield: boolean;
  /** cuadros que quedan de cámara lenta / de pastelitos dobles */
  slow: number;
  double: number;
  /** cuadros sin chocar después de que el escudo se rompe */
  invuln: number;
  /** tubos desde el último power-up (para que no salgan muy seguido) */
  since: number;
};

export const POWER_SIZE = 46;
const SLOW_FRAMES = 300; // 5 s
const DOUBLE_FRAMES = 600; // 10 s
const INVULN_FRAMES = 70;
const CHANCE = 0.14; // por tubo, si ya pasaron al menos MIN_GAP
const MIN_GAP = 5;
/** en cámara lenta todo va a esta velocidad */
const SLOW_SCALE = 0.55;

const INFO: Record<PowerKind, { icon: string; color: string; label: string }> = {
  shield: { icon: "🛡️", color: "#5ec8ff", label: "ESCUDO" },
  slow: { icon: "⏳", color: "#b48cff", label: "CÁMARA LENTA" },
  double: { icon: "🧁", color: "#ff8fc8", label: "PASTELITOS x2" },
};

export const newPowers = (): PowerState => ({ pickups: [], shield: false, slow: 0, double: 0, invuln: 0, since: 0 });

/** Velocidad del mundo ahora (1 normal; menos en cámara lenta). */
export const timeScale = (p: PowerState) => (p.slow > 0 ? SLOW_SCALE : 1);
/** Cuántos pastelitos vale uno ahora. */
export const coinValue = (p: PowerState) => (p.double > 0 ? 2 : 1);

/** Called when a pipe appears: sometimes a power-up floats in the gap after it. */
/** rnd: the random source (the daily challenge passes a seeded one, so everyone gets the same). */
export function maybeSpawnPower(p: PowerState, x: number, gapCenter: number, gapH: number, blocked: boolean, rnd: () => number = Math.random) {
  p.since++;
  if (blocked || p.since < MIN_GAP || p.pickups.length || rnd() >= CHANCE) return;
  p.since = 0;
  const kinds: PowerKind[] = ["shield", "slow", "double"];
  // el escudo no sale si ya tienes uno
  const pool = p.shield ? kinds.filter((k) => k !== "shield") : kinds;
  const kind = pool[Math.floor(rnd() * pool.length)];
  p.pickups.push({ x, y: gapCenter + (rnd() - 0.5) * (gapH - 100), kind, bob: rnd() * Math.PI * 2, taken: false });
}

/** Moves the pickups with the world and returns the one Koki just took (or null). */
export function updatePowers(p: PowerState, dx: number, kokiX: number, kokiY: number, radius: number): PowerKind | null {
  if (p.slow > 0) p.slow--;
  if (p.double > 0) p.double--;
  if (p.invuln > 0) p.invuln--;
  let got: PowerKind | null = null;
  for (const u of p.pickups) {
    u.x -= dx;
    u.bob += 0.1;
    const ddx = u.x - kokiX, ddy = u.y - kokiY, rr = radius + POWER_SIZE / 2;
    if (!u.taken && ddx * ddx + ddy * ddy < rr * rr) {
      u.taken = true;
      got = u.kind;
      if (u.kind === "shield") p.shield = true;
      else if (u.kind === "slow") p.slow = SLOW_FRAMES;
      else p.double = DOUBLE_FRAMES;
    }
  }
  p.pickups = p.pickups.filter((u) => !u.taken && u.x + POWER_SIZE > 0);
  return got;
}

/** A crash: with the shield it is absorbed (true) and Koki can't crash again for a moment. */
export function absorbCrash(p: PowerState): boolean {
  if (p.invuln > 0) return true;
  if (!p.shield) return false;
  p.shield = false;
  p.invuln = INVULN_FRAMES;
  return true;
}

export function drawPowerPickups(ctx: CanvasRenderingContext2D, p: PowerState) {
  for (const u of p.pickups) {
    const info = INFO[u.kind];
    const y = u.y + Math.sin(u.bob) * 5;
    const r = POWER_SIZE / 2;
    ctx.save();
    const halo = ctx.createRadialGradient(u.x, y, 4, u.x, y, r * 1.8);
    halo.addColorStop(0, `${info.color}aa`);
    halo.addColorStop(1, `${info.color}00`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(u.x, y, r * 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(15,23,42,0.75)";
    ctx.strokeStyle = info.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(u.x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = `${Math.round(r * 1.15)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(info.icon, u.x, y + 1);
    ctx.restore();
  }
}

/** The bubble around Koki while the shield is on (and a blink right after it breaks). */
export function drawShield(ctx: CanvasRenderingContext2D, p: PowerState, x: number, y: number, size: number, frame: number) {
  if (!p.shield && p.invuln <= 0) return;
  if (!p.shield && Math.floor(frame / 5) % 2 === 0) return;
  ctx.save();
  const r = size * 0.72 + Math.sin(frame * 0.15) * 2;
  const g = ctx.createRadialGradient(x, y, r * 0.55, x, y, r);
  g.addColorStop(0, "rgba(94,200,255,0)");
  g.addColorStop(0.8, "rgba(94,200,255,0.25)");
  g.addColorStop(1, "rgba(160,225,255,0.75)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** What is active, under the score: "🛡️ ESCUDO", "⏳ CÁMARA LENTA 3.2s", "🧁 PASTELITOS x2 7.5s". */
export function drawPowerHud(ctx: CanvasRenderingContext2D, p: PowerState, centerX: number, y: number) {
  const parts: { text: string; color: string }[] = [];
  if (p.shield) parts.push({ text: `${INFO.shield.icon} ${INFO.shield.label}`, color: INFO.shield.color });
  if (p.slow > 0) parts.push({ text: `${INFO.slow.icon} ${INFO.slow.label} ${(p.slow / 60).toFixed(1)}s`, color: INFO.slow.color });
  if (p.double > 0) parts.push({ text: `${INFO.double.icon} ${INFO.double.label} ${(p.double / 60).toFixed(1)}s`, color: INFO.double.color });
  ctx.save();
  ctx.font = "bold 16px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#333";
  parts.forEach((part, i) => {
    ctx.fillStyle = part.color;
    ctx.strokeText(part.text, centerX, y + i * 22);
    ctx.fillText(part.text, centerX, y + i * 22);
  });
  ctx.restore();
}
