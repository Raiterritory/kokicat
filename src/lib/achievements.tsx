// Achievements: from easiest to hardest. Unlocked ones and play stats are stored locally
// ("koki-achievements" / "koki-stats") and travel with the save export and online backup.
import { useEffect, useState } from "react";

export type Stats = {
  games: number;          // partidas de Koki terminadas
  bestNormal: number;
  bestHard: number;
  coins: number;          // pastelitos juntados en total
  bosses: number;         // jefes derrotados
  goldens: number;        // Kokis dorados atrapados
  characters: number;     // personajes desbloqueados
  allCharacters: number;  // cuántos personajes hay en total
  friends: number;
  onlineMatches: number;
  onlineWins: number;
  tazGames: number;
  tazHits: number;        // Taz atrapados en total
  tazBest: number;
};

const EMPTY: Stats = {
  games: 0, bestNormal: 0, bestHard: 0, coins: 0, bosses: 0, goldens: 0, characters: 1, allCharacters: 99,
  friends: 0, onlineMatches: 0, onlineWins: 0, tazGames: 0, tazHits: 0, tazBest: 0,
};

export type Achievement = {
  id: string;
  icon: string;
  name: string;
  desc: string;
  /** current progress and goal, to draw the bar */
  progress: (s: Stats) => [number, number];
};

const goal = (pick: (s: Stats) => number, target: number) => (s: Stats): [number, number] => [Math.min(pick(s), target), target];

// Ordenados de más fácil a más difícil
export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-flight", icon: "🐣", name: "Primer vuelo", desc: "Juega tu primera partida", progress: goal((s) => s.games, 1) },
  { id: "taz-first", icon: "🔨", name: "¡Te pillé!", desc: "Atrapa a Taz por primera vez", progress: goal((s) => s.tazHits, 1) },
  { id: "score-5", icon: "🪶", name: "Despegue", desc: "Haz 5 puntos en una partida", progress: goal((s) => s.bestNormal, 5) },
  { id: "score-10", icon: "🌤️", name: "Calentando motores", desc: "Haz 10 puntos en una partida", progress: goal((s) => s.bestNormal, 10) },
  { id: "taz-15", icon: "🐾", name: "Manos rápidas", desc: "Haz 15 puntos en Atrapa al Taz", progress: goal((s) => s.tazBest, 15) },
  { id: "hard-10", icon: "🌶️", name: "Picante", desc: "Haz 10 puntos en modo difícil", progress: goal((s) => s.bestHard, 10) },
  { id: "golden", icon: "✨", name: "Brillo dorado", desc: "Atrapa un Koki dorado", progress: goal((s) => s.goldens, 1) },
  { id: "friend", icon: "🤝", name: "Social", desc: "Ten tu primer amigo en el ranking", progress: goal((s) => s.friends, 1) },
  { id: "score-25", icon: "🐱", name: "Gato volador", desc: "Haz 25 puntos en una partida", progress: goal((s) => s.bestNormal, 25) },
  { id: "boss-1", icon: "⚔️", name: "Cazajefes", desc: "Derrota a tu primer jefe", progress: goal((s) => s.bosses, 1) },
  { id: "online-1", icon: "🌐", name: "Retador", desc: "Juega una partida online", progress: goal((s) => s.onlineMatches, 1) },
  { id: "coins-100", icon: "🧁", name: "Golosa", desc: "Junta 100 pastelitos en total", progress: goal((s) => s.coins, 100) },
  { id: "taz-30", icon: "🐈‍⬛", name: "Cazador de Taz", desc: "Haz 30 puntos en Atrapa al Taz", progress: goal((s) => s.tazBest, 30) },
  { id: "chars-5", icon: "🎨", name: "Coleccionista", desc: "Desbloquea 5 personajes", progress: goal((s) => s.characters, 5) },
  { id: "hard-20", icon: "🔥", name: "Fuego interior", desc: "Haz 20 puntos en modo difícil", progress: goal((s) => s.bestHard, 20) },
  { id: "score-35", icon: "🌈", name: "Arcoíris en el cielo", desc: "Haz 35 puntos en una partida", progress: goal((s) => s.bestNormal, 35) },
  { id: "taz-45", icon: "🎯", name: "Puntería felina", desc: "Haz 45 puntos en Atrapa al Taz", progress: goal((s) => s.tazBest, 45) },
  { id: "hard-35", icon: "☄️", name: "Meteoro", desc: "Haz 35 puntos en modo difícil", progress: goal((s) => s.bestHard, 35) },
  { id: "score-50", icon: "🚀", name: "Imparable", desc: "Haz 50 puntos en una partida", progress: goal((s) => s.bestNormal, 50) },
  { id: "online-win", icon: "🏆", name: "Rimjober de corazón", desc: "Gana una partida online", progress: goal((s) => s.onlineWins, 1) },
  { id: "games-100", icon: "🎮", name: "Veterano", desc: "Juega 100 partidas", progress: goal((s) => s.games, 100) },
  { id: "taz-60", icon: "⚡", name: "Reflejos felinos", desc: "Haz 60 puntos en Atrapa al Taz", progress: goal((s) => s.tazBest, 60) },
  { id: "coins-1000", icon: "🎂", name: "Pastelera", desc: "Junta 1000 pastelitos en total", progress: goal((s) => s.coins, 1000) },
  { id: "boss-10", icon: "👑", name: "Exterminador", desc: "Derrota 10 jefes", progress: goal((s) => s.bosses, 10) },
  { id: "hard-50", icon: "🌋", name: "Infierno", desc: "Haz 50 puntos en modo difícil", progress: goal((s) => s.bestHard, 50) },
  { id: "score-75", icon: "🛸", name: "Fuera de órbita", desc: "Haz 75 puntos en una partida", progress: goal((s) => s.bestNormal, 75) },
  { id: "taz-80", icon: "🥇", name: "Maestro del Taz", desc: "Haz 80 puntos en Atrapa al Taz", progress: goal((s) => s.tazBest, 80) },
  { id: "score-100", icon: "🌟", name: "Leyenda felina", desc: "Haz 100 puntos en una partida", progress: goal((s) => s.bestNormal, 100) },
  { id: "hard-75", icon: "🐉", name: "Dragón", desc: "Haz 75 puntos en modo difícil", progress: goal((s) => s.bestHard, 75) },
  { id: "score-150", icon: "🌌", name: "Galáctica", desc: "Haz 150 puntos en una partida", progress: goal((s) => s.bestNormal, 150) },
  { id: "taz-100", icon: "💯", name: "Cien Taz", desc: "Haz 100 puntos en Atrapa al Taz", progress: goal((s) => s.tazBest, 100) },
  { id: "score-200", icon: "👑", name: "Reina del cielo", desc: "Haz 200 puntos en una partida", progress: goal((s) => s.bestNormal, 200) },
  { id: "chars-all", icon: "💎", name: "Todos los gatos", desc: "Desbloquea todos los personajes", progress: (s) => [Math.min(s.characters, s.allCharacters), s.allCharacters] },
];

const STATS_KEY = "koki-stats";
const DONE_KEY = "koki-achievements";
const EVENT = "koki-achievement";

function read<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? { ...fallback, ...JSON.parse(raw) } : fallback; } catch { return fallback; }
}

export const getStats = () => read<Stats>(STATS_KEY, { ...EMPTY });
export const getUnlocked = () => read<Record<string, number>>(DONE_KEY, {});

/** Updates the stats and announces any achievement that just became complete. */
export function updateStats(change: (s: Stats) => void) {
  const s = getStats();
  change(s);
  try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch { /* sin almacenamiento */ }
  const done = getUnlocked();
  const fresh: Achievement[] = [];
  for (const a of ACHIEVEMENTS) {
    if (done[a.id]) continue;
    const [cur, target] = a.progress(s);
    if (cur >= target) { done[a.id] = Date.now(); fresh.push(a); }
  }
  if (fresh.length) {
    try { localStorage.setItem(DONE_KEY, JSON.stringify(done)); } catch { /* sin almacenamiento */ }
    for (const a of fresh) window.dispatchEvent(new CustomEvent<Achievement>(EVENT, { detail: a }));
  }
}

// ---- Eventos del juego ----
export const onFlappyGameEnd = (mode: "normal" | "hard", score: number, coins: number) =>
  updateStats((s) => {
    s.games += 1;
    s.coins += coins;
    if (mode === "hard") s.bestHard = Math.max(s.bestHard, score);
    else s.bestNormal = Math.max(s.bestNormal, score);
  });
export const onBossBeaten = () => updateStats((s) => { s.bosses += 1; });
export const onGoldenCaught = () => updateStats((s) => { s.goldens += 1; });
export const onCharacters = (unlocked: number, total: number) =>
  updateStats((s) => { s.characters = Math.max(s.characters, unlocked); s.allCharacters = total; });
export const onFriends = (count: number) => updateStats((s) => { s.friends = Math.max(s.friends, count); });
export const onOnlineMatch = (won: boolean) => updateStats((s) => { s.onlineMatches += 1; if (won) s.onlineWins += 1; });
export const onTazGameEnd = (score: number, hits: number) =>
  updateStats((s) => { s.tazGames += 1; s.tazHits += hits; s.tazBest = Math.max(s.tazBest, score); });

/** "¡Logro desbloqueado!" banner, a few seconds per achievement. */
export function AchievementToast() {
  const [queue, setQueue] = useState<Achievement[]>([]);
  useEffect(() => {
    const on = (e: Event) => setQueue((q) => [...q, (e as CustomEvent<Achievement>).detail]);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  useEffect(() => {
    if (!queue.length) return;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), 3200);
    return () => clearTimeout(t);
  }, [queue]);
  const a = queue[0];
  if (!a) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-16 z-[80] w-[min(92vw,360px)] -translate-x-1/2 animate-bounce rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-3 text-white shadow-2xl ring-2 ring-white/70">
      <div className="text-[10px] font-black uppercase tracking-widest text-white/85">🏅 ¡Logro desbloqueado!</div>
      <div className="flex items-center gap-2">
        <span className="text-3xl">{a.icon}</span>
        <div>
          <div className="text-lg font-black leading-tight">{a.name}</div>
          <div className="text-xs font-semibold text-white/90">{a.desc}</div>
        </div>
      </div>
    </div>
  );
}

/** The "🏅 LOGROS" window: every achievement with its progress. */
export function AchievementsModal({ onClose }: { onClose: () => void }) {
  const stats = getStats();
  const done = getUnlocked();
  const count = ACHIEVEMENTS.filter((a) => done[a.id]).length;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-4" onPointerDown={stop} onClick={stop}>
      <div className="flex max-h-[92vh] w-full max-w-sm flex-col rounded-3xl border-2 border-white/10 bg-gradient-to-b from-indigo-900 to-slate-900 p-5 text-white shadow-2xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-2xl font-black">🏅 Logros</h2>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black">{count} / {ACHIEVEMENTS.length}</span>
        </div>
        <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-amber-400" style={{ width: `${(count / ACHIEVEMENTS.length) * 100}%` }} />
        </div>
        <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
          {ACHIEVEMENTS.map((a) => {
            const got = !!done[a.id];
            const [cur, target] = a.progress(stats);
            return (
              <div key={a.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${got ? "bg-amber-400/20 ring-1 ring-amber-300/60" : "bg-white/5"}`}>
                <span className={`text-2xl ${got ? "" : "opacity-40 grayscale"}`}>{a.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-black ${got ? "text-amber-200" : "text-white/80"}`}>{a.name}</div>
                  <div className="text-[11px] text-white/60">{a.desc}</div>
                  {!got && target > 1 && (
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-sky-400" style={{ width: `${(cur / target) * 100}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-white/50">{cur}/{target}</span>
                    </div>
                  )}
                </div>
                {got && <span className="text-lg">✅</span>}
              </div>
            );
          })}
        </div>
        <button onClick={onClose} className="mt-4 w-full rounded-full bg-white/90 px-6 py-3 text-lg font-black text-slate-800 shadow-[0_4px_0_rgba(0,0,0,0.3)] active:translate-y-0.5">
          ← Volver
        </button>
      </div>
    </div>
  );
}
