// "El reto de hoy": una partida al día, con la misma semilla para todos (las mismas tuberías, como en
// vivo) y un "condimento" distinto cada día. Tiene su propio ranking del día (migración 0017).
import { supabase } from "@/integrations/supabase/client";
import { getPlayer, type BoardRow } from "./leaderboard";

/** El día y la semana se cuentan con la hora de Chile, igual para todos los jugadores. */
const TZ = "America/Santiago";
export function dayKey(at = Date.now()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  } catch {
    return new Date(at).toISOString().slice(0, 10);
  }
}
export const yesterdayKey = () => dayKey(Date.now() - 86400000);
/** Días desde 2026-01-01 (para elegir el condimento y la semana). */
export const dayNumber = (key = dayKey()) => Math.round((Date.parse(`${key}T12:00:00Z`) - Date.parse("2026-01-01T12:00:00Z")) / 86400000);
/** Número de la semana (las semanas empiezan el lunes). */
export function weekNumber(key = dayKey()) {
  const d = dayNumber(key);
  // 2026-01-01 fue jueves: el lunes de esa semana es el día -3
  return Math.floor((d + 3) / 7);
}
/** Cuántos días quedan para que cambie la semana (1..7). */
export const daysLeftInWeek = (key = dayKey()) => 7 - ((dayNumber(key) + 3) % 7);

export const daySeed = (key = dayKey()) => {
  let h = 2166136261;
  for (const ch of `koki-reto-${key}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
};

/** El condimento del día: cambia un poco las reglas, igual para todos. */
export type Twist = {
  id: string;
  icon: string;
  name: string;
  desc: string;
  gravity?: number;
  speed?: number;
  coins?: number;
  /** escenario fijo: 1 noche, 2 lluvia */
  scene?: number;
  shield?: boolean;
  bossEvery?: number;
  shake?: boolean;
};
export const TWISTS: Twist[] = [
  { id: "puelche", icon: "🌬️", name: "Sopla el puelche", desc: "Viento tibio: caes más lento", gravity: 0.85 },
  { id: "micro", icon: "🚌", name: "Micro apurada", desc: "Todo va más rápido, como micro atrasada", speed: 1.22 },
  { id: "once", icon: "🧁", name: "Día de once", desc: "Cada pastelito vale doble", coins: 2 },
  { id: "carrete", icon: "🌙", name: "Carrete hasta tarde", desc: "Es de noche toda la partida", scene: 1 },
  { id: "temporal", icon: "🌧️", name: "Temporal en Santiago", desc: "Llueve toda la partida (y se corta la luz)", scene: 2 },
  { id: "tia", icon: "🛡️", name: "La tía te cuida", desc: "Empiezas con escudo", shield: true },
  { id: "pega", icon: "👹", name: "Junta de jefes", desc: "Llega un jefe cada 8 puntos", bossEvery: 8 },
  { id: "temblor", icon: "🌋", name: "Temblor grado 7", desc: "La pantalla tiembla… pero ni se movió", shake: true },
];
export const todayTwist = (key = dayKey()) => TWISTS[((dayNumber(key) % TWISTS.length) + TWISTS.length) % TWISTS.length];

// ---- la partida de hoy (una sola) ----
type DailyState = { day: string; score: number; done: boolean; sent: boolean };
const KEY = "koki-daily";
export function dailyState(): DailyState | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null") as DailyState | null;
    return s && s.day === dayKey() ? s : null;
  } catch {
    return null;
  }
}
export const playedToday = () => dailyState() !== null;
/** Al empezar: ya cuenta como jugada (cerrar la app no regala otro intento). */
export function startDaily() {
  try { localStorage.setItem(KEY, JSON.stringify({ day: dayKey(), score: 0, done: false, sent: false })); } catch { /* */ }
}
export function finishDaily(score: number) {
  const s = dailyState() ?? { day: dayKey(), score: 0, done: false, sent: false };
  s.score = Math.max(s.score, score);
  s.done = true;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* */ }
  void sendDaily();
}

type Rpc = (fn: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = async (fn, a) => {
  try { return await (supabase.rpc as unknown as Rpc)(fn, a); } catch (e) { return { data: null, error: { message: String(e) } }; }
};
const missingFn = (msg: string) => /function|schema cache/i.test(msg);

/** Sube el puntaje de hoy (si no hay internet, se reintenta al sincronizar). */
export async function sendDaily() {
  const s = dailyState();
  const p = getPlayer();
  if (!s || !s.done || s.sent || !p) return;
  const { error } = await rpc("submit_daily", { p_id: p.id, p_secret: p.secret, p_day: s.day, p_score: s.score });
  if (!error || /invalid_day/.test(error.message)) {
    s.sent = true;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* */ }
  }
}

/** Ranking de hoy. "missing": el servidor aún no tiene el reto (falta la migración 0017). */
export async function dailyBoard(): Promise<BoardRow[] | "missing" | null> {
  const p = getPlayer();
  const { data, error } = await rpc("daily_leaderboard_for_player", {
    p_day: dayKey(), p_limit: 50, p_id: p?.id ?? null, p_secret: p?.secret ?? null,
  });
  if (error) return missingFn(error.message) ? "missing" : null;
  return (data as BoardRow[]) ?? [];
}
