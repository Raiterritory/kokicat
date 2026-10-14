// Misiones semanales (3 por semana, iguales para todos) y la racha de días seguidos jugando.
// Se guardan en "koki-weekly" y "koki-streak"; los premios son pastelitos (y algo especial a los 7 días).
import { dayKey, yesterdayKey, weekNumber, daySeed } from "./daily";
import { announce, onMissionDone, onStreak } from "./achievements";
import { grantItem } from "./accessories";

export type MissionKind =
  | "bosses" | "bossKinds" | "tazGoldens" | "tazHits" | "coins" | "games" | "goldens"
  | "shieldSaves" | "powerups" | "dailies" | "scoreRun" | "timeRun" | "hardRun";

export type Mission = { id: string; icon: string; name: string; desc: string; kind: MissionKind; target: number; reward: number };

export const MISSIONS: Mission[] = [
  { id: "jefes", icon: "⚔️", name: "Pa' la casa, jefes", desc: "Vence 3 jefes", kind: "bosses", target: 3, reward: 60 },
  { id: "tropa", icon: "🎭", name: "La tropa de weones", desc: "Vence a los 3 tipos de jefe: rayo, tubos y muro", kind: "bossKinds", target: 3, reward: 90 },
  { id: "oro", icon: "🌟", name: "Taz de oro, wea pulenta", desc: "Atrapa 15 Taz dorados", kind: "tazGoldens", target: 15, reward: 80 },
  { id: "feria", icon: "🔨", name: "Martillazo de feria", desc: "Atrapa 100 Taz", kind: "tazHits", target: 100, reward: 60 },
  { id: "once", icon: "🧁", name: "Once con pastelitos", desc: "Junta 150 pastelitos jugando", kind: "coins", target: 150, reward: 50 },
  { id: "vicio", icon: "🎮", name: "Más vicio que la tía con el Candy", desc: "Juega 20 partidas (Koki o Taz)", kind: "games", target: 20, reward: 50 },
  { id: "tinca", icon: "✨", name: "Me tinca la suerte", desc: "Atrapa 3 Kokis dorados", kind: "goldens", target: 3, reward: 50 },
  { id: "salvado", icon: "🛡️", name: "Te salvaste, weón", desc: "Que el escudo te salve 3 veces", kind: "shieldSaves", target: 3, reward: 50 },
  { id: "completo", icon: "🌭", name: "Completo italiano", desc: "Agarra 8 power-ups", kind: "powerups", target: 8, reward: 50 },
  { id: "canon", icon: "🗓️", name: "Al pie del cañón", desc: "Juega 3 retos de hoy (en días distintos)", kind: "dailies", target: 3, reward: 70 },
  { id: "luz", icon: "☔", name: "Cayó una gota y se cortó la luz", desc: "Llega a la lluvia: 40 puntos en una partida", kind: "scoreRun", target: 40, reward: 80 },
  { id: "toque", icon: "⏱", name: "Al toque", desc: "Haz 15 puntos en contrarreloj", kind: "timeRun", target: 15, reward: 50 },
  { id: "pebre", icon: "🌶️", name: "Más picante que el pebre", desc: "Haz 15 puntos en modo difícil", kind: "hardRun", target: 15, reward: 60 },
];
/** Estas cuentan el mejor de una partida, no se suman. */
const MAX_KINDS: MissionKind[] = ["scoreRun", "timeRun", "hardRun", "bossKinds"];

type Weekly = { week: number; prog: Partial<Record<MissionKind, number>>; claimed: string[]; kinds?: string[] };
const WKEY = "koki-weekly";

/** Las 3 misiones de esta semana (iguales para todos: salen de la semilla de la semana). */
export function weekMissions(week = weekNumber()): Mission[] {
  let h = daySeed(`semana-${week}`);
  const pool = [...MISSIONS];
  const out: Mission[] = [];
  while (out.length < 3 && pool.length) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const m = pool.splice(h % pool.length, 1)[0];
    // nunca dos misiones del Taz la misma semana
    if (out.some((o) => o.kind.startsWith("taz")) && m.kind.startsWith("taz")) continue;
    out.push(m);
  }
  return out;
}

export function loadWeekly(): Weekly {
  const week = weekNumber();
  try {
    const w = JSON.parse(localStorage.getItem(WKEY) || "null") as Weekly | null;
    if (w && w.week === week) return { ...w, prog: w.prog ?? {}, claimed: w.claimed ?? [] };
  } catch { /* */ }
  return { week, prog: {}, claimed: [] };
}
function saveWeekly(w: Weekly) {
  try { localStorage.setItem(WKEY, JSON.stringify(w)); } catch { /* */ }
  window.dispatchEvent(new Event("koki-weekly"));
}

export const progressOf = (w: Weekly, m: Mission) => Math.min(w.prog[m.kind] ?? 0, m.target);

/** Something happened in a game: adds (or keeps the max of) the counters of this week's missions. */
export function missionEvent(kind: MissionKind, amount = 1, tag?: string) {
  if (amount <= 0) return;
  const w = loadWeekly();
  const before = weekMissions().filter((m) => progressOf(w, m) >= m.target).map((m) => m.id);
  if (kind === "bossKinds") {
    // tipos de jefe distintos vencidos esta semana
    const kinds = new Set(w.kinds ?? []);
    if (tag) kinds.add(tag);
    w.kinds = [...kinds];
    w.prog.bossKinds = kinds.size;
  } else if (MAX_KINDS.includes(kind)) {
    w.prog[kind] = Math.max(w.prog[kind] ?? 0, amount);
  } else {
    w.prog[kind] = (w.prog[kind] ?? 0) + amount;
  }
  saveWeekly(w);
  for (const m of weekMissions()) {
    if (!before.includes(m.id) && progressOf(w, m) >= m.target && !w.claimed.includes(m.id)) {
      announce(m.icon, m.name, `Reclama tus ${m.reward} 🧁 en Misiones`, "📜 ¡Misión cumplida, bacán!");
    }
  }
}

export const claimableCount = () => {
  const w = loadWeekly();
  return weekMissions().filter((m) => progressOf(w, m) >= m.target && !w.claimed.includes(m.id)).length;
};

/** Cobra el premio de una misión cumplida. Devuelve los pastelitos ganados (0 si no se puede). */
export function claimMission(id: string): number {
  const w = loadWeekly();
  const m = weekMissions().find((x) => x.id === id);
  if (!m || w.claimed.includes(id) || progressOf(w, m) < m.target) return 0;
  w.claimed.push(id);
  saveWeekly(w);
  addCoins(m.reward);
  onMissionDone();
  return m.reward;
}

export function addCoins(n: number) {
  const total = Number(localStorage.getItem("koki-coins") || 0) + n;
  try { localStorage.setItem("koki-coins", String(total)); } catch { /* */ }
  window.dispatchEvent(new Event("koki-cloud"));
  void import("./leaderboard").then((l) => l.backupProfile());
}

// ---- racha de días seguidos ----
type Streak = { last: string; count: number; best: number };
const SKEY = "koki-streak";
export function loadStreak(): Streak {
  try {
    const s = JSON.parse(localStorage.getItem(SKEY) || "null") as Streak | null;
    if (s) {
      // si ayer no jugaste, la racha visible ya se cortó
      const alive = s.last === dayKey() || s.last === yesterdayKey();
      return { ...s, count: alive ? s.count : 0 };
    }
  } catch { /* */ }
  return { last: "", count: 0, best: 0 };
}
/** Premio de cada día de racha: 10 🧁 por día (hasta 70) y un bono cada 7 días. */
export const streakReward = (days: number) => 10 * Math.min(days, 7) + (days % 7 === 0 ? 100 : 0);

/** Llamar al terminar cualquier partida (Koki o Taz): el primer juego del día suma a la racha. */
export function onPlayedToday() {
  const today = dayKey();
  let raw: Streak = { last: "", count: 0, best: 0 };
  try { raw = JSON.parse(localStorage.getItem(SKEY) || "null") ?? raw; } catch { /* */ }
  if (raw.last === today) return;
  const broke = raw.count > 1 && raw.last !== yesterdayKey();
  const count = raw.last === yesterdayKey() ? raw.count + 1 : 1;
  const s: Streak = { last: today, count, best: Math.max(raw.best, count) };
  try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch { /* */ }
  const reward = streakReward(count);
  addCoins(reward);
  onStreak(count);
  if (count >= 7) grantItem("hat", "corona");
  const msg = count === 1
    ? (broke ? `Se te cortó la racha, ni ahí. Parte de nuevo: +${reward} 🧁` : `Día 1, vamos que se puede: +${reward} 🧁`)
    : count % 7 === 0
      ? `¡${count} días! La corona de Viña es tuya 👑 +${reward} 🧁`
      : `${count} días seguidos, tamo activo: +${reward} 🧁`;
  announce("🔥", `Racha de ${count} ${count === 1 ? "día" : "días"}`, msg, "🔥 Racha diaria");
}
