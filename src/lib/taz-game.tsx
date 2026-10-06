// "Atrapa al Taz": whack-a-mole with 9 holes. Taz (normal skin) pops out of random holes;
// tap him before he hides. 30 seconds, faster and faster; a golden Taz is worth 3.
// The pop-up schedule comes from a seed, so in multiplayer everyone gets the same Taz at the same time.
import { useEffect, useRef, useState } from "react";
import tazPng from "@/assets/gato-negro.png";
import { seededRandom, getMp, ghosts, activePlayers } from "./multiplayer";
import { syncScores } from "./leaderboard";
import { onTazGameEnd } from "./achievements";
import { playMeow, playFlap } from "./sounds";

export const TAZ_DURATION = 30000;

type Pop = { t: number; hole: number; dur: number; golden: boolean };

/** Level inside a run: every 10 seconds it gets harder (1, 2, 3). */
export const tazLevel = (elapsed: number) => (elapsed < 10000 ? 1 : elapsed < 20000 ? 2 : 3);

/**
 * Same seed -> same list of pop-ups (depends only on time, never on taps).
 * `round` (multiplayer: 0 for round 1, 1 for round 2…) makes the whole run faster.
 */
export function tazSchedule(seed: number, round = 0): Pop[] {
  const rng = seededRandom(seed);
  const pops: Pop[] = [];
  const busyUntil = new Array(9).fill(0);
  const speed = 1 + 0.15 * Math.min(round, 4);   // cada ronda online es más rápida
  let t = 700;
  let last = -1;
  const freeHole = (avoid: number) => {
    let hole = Math.floor(rng() * 9);
    for (let tries = 0; tries < 9 && (hole === avoid || busyUntil[hole] > t); tries++) hole = (hole + 1 + Math.floor(rng() * 8)) % 9;
    return hole;
  };
  while (t < TAZ_DURATION - 400) {
    const level = tazLevel(t);
    const p = t / TAZ_DURATION;
    // cada nivel se esconde más rápido y sale más seguido
    const dur = (1150 - 520 * p - 70 * (level - 1)) / speed;
    const interval = (900 - 470 * p - 50 * (level - 1)) / speed;
    const hole = freeHole(last);
    pops.push({ t, hole, dur, golden: rng() < 0.07 });
    busyUntil[hole] = t + dur + 120;
    last = hole;
    // desde el nivel 2 a veces salen dos Taz a la vez
    if (level >= 2 && rng() < (level === 2 ? 0.2 : 0.35)) {
      const second = freeHole(hole);
      if (busyUntil[second] <= t) {
        pops.push({ t, hole: second, dur, golden: false });
        busyUntil[second] = t + dur + 120;
      }
    }
    t += interval * (0.75 + rng() * 0.5);
  }
  return pops;
}

type Float = { id: number; hole: number; text: string; t: number };

const FLOWER_COLORS = ["#ff5d8f", "#ffd23f", "#ffffff", "#c77dff", "#ff8c42"];

/** Garden scene behind the mode: sky, sun, clouds, hills, a wooden fence, bushes, lawn and flowers. */
function GardenBackground() {
  // flores fijas (posiciones "al azar" pero siempre iguales)
  const flowers = Array.from({ length: 34 }, (_, i) => {
    const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
    return { x: r(1) * 1000, y: 690 + r(2) * 300, s: 7 + r(3) * 7, c: FLOWER_COLORS[i % FLOWER_COLORS.length] };
  });
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <defs>
        <linearGradient id="gSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6ec6ff" /><stop offset="1" stopColor="#c9f0ff" /></linearGradient>
        <linearGradient id="gLawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5fcf5a" /><stop offset="1" stopColor="#2f9a3a" /></linearGradient>
      </defs>
      <rect width="1000" height="1000" fill="url(#gSky)" />
      {/* sol y nubes */}
      <circle cx="840" cy="150" r="70" fill="#ffe66d" />
      <circle cx="840" cy="150" r="95" fill="#ffe66d" opacity="0.25" />
      {[[180, 150, 1], [520, 95, 0.8], [680, 250, 0.65]].map(([x, y, k], i) => (
        <g key={i} fill="#ffffff" opacity="0.92" transform={`translate(${x} ${y}) scale(${k})`}>
          <ellipse cx="0" cy="0" rx="70" ry="34" /><ellipse cx="55" cy="-18" rx="50" ry="36" /><ellipse cx="-55" cy="-10" rx="44" ry="28" /><ellipse cx="100" cy="6" rx="42" ry="26" />
        </g>
      ))}
      {/* colinas */}
      <path d="M0 520 Q 180 420 360 500 T 720 480 T 1000 470 V 1000 H 0 Z" fill="#8fd97e" />
      <path d="M0 560 Q 250 480 520 550 T 1000 530 V 1000 H 0 Z" fill="#74c96a" />
      {/* reja de madera */}
      <g>
        <rect x="0" y="575" width="1000" height="14" fill="#b07a45" />
        <rect x="0" y="615" width="1000" height="14" fill="#b07a45" />
        {Array.from({ length: 21 }, (_, i) => (
          <path key={i} d={`M${i * 50 + 8} 650 V560 L${i * 50 + 25} 540 L${i * 50 + 42} 560 V650 Z`} fill="#d29a5c" stroke="#8a5a2b" strokeWidth="3" />
        ))}
      </g>
      {/* arbustos */}
      {[[60, 650, 1.1], [300, 655, 0.9], [620, 650, 1], [900, 655, 1.2]].map(([x, y, k], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${k})`} fill="#2f8f3a">
          <circle cx="-40" cy="0" r="38" /><circle cx="0" cy="-18" r="46" /><circle cx="42" cy="0" r="38" />
          <circle cx="-10" cy="-30" r="8" fill="#ff5d8f" /><circle cx="25" cy="-12" r="7" fill="#ffd23f" />
        </g>
      ))}
      {/* pasto */}
      <rect x="0" y="660" width="1000" height="340" fill="url(#gLawn)" />
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={i * 100} y="660" width="50" height="340" fill="#ffffff" opacity="0.05" />
      ))}
      {/* flores */}
      {flowers.map((f, i) => (
        <g key={i} transform={`translate(${f.x} ${f.y})`}>
          <line x1="0" y1="0" x2="0" y2={f.s * 1.8} stroke="#2a7d33" strokeWidth="2.5" />
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} cx={Math.cos((a * Math.PI) / 180) * f.s * 0.7} cy={Math.sin((a * Math.PI) / 180) * f.s * 0.7} r={f.s * 0.55} fill={f.c} />
          ))}
          <circle r={f.s * 0.45} fill="#ffcf33" />
        </g>
      ))}
    </svg>
  );
}

/** One 30-second round. Calls onEnd(score, hits) when time is up. */
export function TazGame({
  seed, round = 0, onEnd, onScore,
}: { seed: number; round?: number; onEnd: (score: number, hits: number) => void; onScore?: (score: number) => void }) {
  const pops = useRef<Pop[]>(tazSchedule(seed, round));
  const start = useRef(performance.now());
  const hitSet = useRef(new Set<number>());
  const scoreRef = useRef(0);
  const hitsRef = useRef(0);
  const ended = useRef(false);
  const [now, setNow] = useState(0);
  const [score, setScore] = useState(0);
  const [floats, setFloats] = useState<Float[]>([]);
  const [miss, setMiss] = useState<number | null>(null);

  useEffect(() => {
    pops.current = tazSchedule(seed, round);
    start.current = performance.now();
    hitSet.current = new Set();
    scoreRef.current = 0;
    hitsRef.current = 0;
    ended.current = false;
    setScore(0);
    const id = setInterval(() => {
      const el = performance.now() - start.current;
      setNow(el);
      setFloats((f) => f.filter((x) => el - x.t < 700));
      if (el >= TAZ_DURATION && !ended.current) {
        ended.current = true;
        clearInterval(id);
        onEnd(scoreRef.current, hitsRef.current);
      }
    }, 40);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  const tap = (hole: number) => {
    if (ended.current) return;
    const el = performance.now() - start.current;
    const i = pops.current.findIndex((p, k) => p.hole === hole && !hitSet.current.has(k) && el >= p.t && el < p.t + p.dur);
    if (i < 0) {
      setMiss(hole);
      setTimeout(() => setMiss((m) => (m === hole ? null : m)), 180);
      return;
    }
    hitSet.current.add(i);
    const gain = pops.current[i].golden ? 3 : 1;
    scoreRef.current += gain;
    hitsRef.current += 1;
    setScore(scoreRef.current);
    onScore?.(scoreRef.current);
    setFloats((f) => [...f, { id: Math.random(), hole, text: `+${gain}`, t: el }]);
    if (pops.current[i].golden) playMeow(); else playFlap();
  };

  const left = Math.max(0, TAZ_DURATION - now);
  const level = tazLevel(now);
  // aviso de "¡Nivel 2!" / "¡Nivel 3!" durante el primer segundo y medio de cada nivel
  const levelBanner = level > 1 && now - (level - 1) * 10000 < 1500;
  const match = getMp().match;
  const rivals = match ? activePlayers(match).filter((p) => p.id !== match.me.id) : [];

  return (
    <div className="absolute inset-0 z-20 isolate flex flex-col items-center overflow-hidden bg-sky-300 px-4 pb-4 pt-14 text-white select-none">
      <div className="absolute inset-0 -z-10"><GardenBackground /></div>
      <div className="flex w-full max-w-md items-center justify-between">
        <div className="text-3xl font-black drop-shadow">🐈‍⬛ {score}</div>
        <div className="rounded-full bg-black/25 px-3 py-1 text-sm font-black">Nivel {level}{round > 0 ? ` · Ronda ${round + 1}` : ""}</div>
        <div className="text-2xl font-black drop-shadow">⏱️ {Math.ceil(left / 1000)}</div>
      </div>
      {levelBanner && (
        <div className="pointer-events-none absolute left-1/2 top-1/3 z-30 -translate-x-1/2 animate-bounce rounded-2xl bg-red-600 px-6 py-3 text-3xl font-black shadow-2xl ring-4 ring-white/70">
          ¡Nivel {level}! ⚡
        </div>
      )}
      <div className="mt-2 h-3 w-full max-w-md overflow-hidden rounded-full bg-black/25">
        <div className="h-full rounded-full bg-amber-300 transition-[width] duration-100" style={{ width: `${(left / TAZ_DURATION) * 100}%` }} />
      </div>
      {rivals.length > 0 && (
        <div className="mt-2 flex flex-wrap justify-center gap-2 text-xs font-black">
          {rivals.map((r) => (
            <span key={r.id} className="rounded-full bg-black/30 px-3 py-1">{r.nickname}: {match?.scores[r.id] ?? ghosts[r.id]?.score ?? 0}</span>
          ))}
        </div>
      )}

      <div className="mt-auto mb-auto grid w-full max-w-md grid-cols-3 gap-x-4 gap-y-12 pt-10 sm:gap-x-6 [@media(orientation:landscape)_and_(max-height:540px)]:max-w-[16rem] [@media(orientation:landscape)_and_(max-height:540px)]:gap-y-6">
        {Array.from({ length: 9 }, (_, hole) => {
          const k = pops.current.findIndex((p, i) => p.hole === hole && !hitSet.current.has(i) && now >= p.t && now < p.t + p.dur);
          const pop = k >= 0 ? pops.current[k] : null;
          // sube rápido, se queda, y baja al final
          let rise = 0;
          if (pop) {
            const a = now - pop.t, b = pop.t + pop.dur - now;
            rise = Math.min(1, a / 130, b / 130);
          }
          const f = floats.filter((x) => x.hole === hole);
          return (
            <button
              key={hole}
              onPointerDown={(e) => { e.stopPropagation(); tap(hole); }}
              className={`relative aspect-square ${miss === hole ? "translate-y-0.5" : ""}`}
              style={{ background: "radial-gradient(ellipse 50% 22% at 50% 76%, #24150c 0 70%, #6b4126 72% 86%, #8d5d36 88% 100%, transparent 101%)" }}
            >
              {/* Taz sale por encima del hoyo sin cortarse; solo se esconde bajo el borde de tierra */}
              <div className="pointer-events-none absolute inset-0" style={{ clipPath: "inset(-150% -30% 24% -30%)" }}>
                {pop && (
                  <img
                    src={tazPng}
                    alt="Taz"
                    draggable={false}
                    className="absolute bottom-[24%] left-1/2 w-[86%] transition-none"
                    style={{
                      transform: `translate(-50%, ${(1 - rise) * 105}%)`,
                      filter: pop.golden ? "sepia(1) saturate(6) hue-rotate(-12deg) brightness(1.25) drop-shadow(0 0 10px #ffd84a)" : undefined,
                    }}
                  />
                )}
              </div>
              {/* borde delantero de tierra: tapa la parte de abajo de Taz */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[24%]" style={{ background: "radial-gradient(ellipse 50% 60% at 50% 0%, #8d5d36 0 62%, transparent 64%)" }} />
              {f.map((x) => (
                <span key={x.id} className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 animate-bounce text-2xl font-black text-amber-200 drop-shadow">
                  {x.text}
                </span>
              ))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type Screen = "menu" | "playing" | "result";

/** The whole mode: its menu (logo, Jugar, Ranking, Multijugador), the game and the results. */
export function TazModeScreen({
  onBack, onRanking, onMultiplayer,
}: { onBack: () => void; onRanking: () => void; onMultiplayer: () => void }) {
  const [screen, setScreen] = useState<Screen>("menu");
  const [seed, setSeed] = useState(1);
  const [last, setLast] = useState(0);
  const [best, setBest] = useState(0);
  const [record, setRecord] = useState(false);
  const swipeX = useRef<number | null>(null);

  useEffect(() => { setBest(Number(localStorage.getItem("koki-best-taz") || 0)); }, []);

  const play = () => {
    setSeed(Math.floor(Math.random() * 2 ** 31));
    setScreen("playing");
  };
  const finish = (score: number, hits: number) => {
    const prev = Number(localStorage.getItem("koki-best-taz") || 0);
    const isRecord = score > prev;
    if (isRecord) localStorage.setItem("koki-best-taz", String(score));
    setBest(Math.max(prev, score));
    setRecord(isRecord);
    setLast(score);
    onTazGameEnd(score, hits);
    void syncScores();
    setScreen("result");
  };

  if (screen === "playing") return <TazGame seed={seed} onEnd={finish} />;

  const big = "w-full rounded-full px-8 py-3 text-lg font-black text-white active:translate-y-1";
  return (
    <div className="absolute inset-0 z-20 isolate overflow-y-auto bg-sky-300" onPointerDown={(e) => e.stopPropagation()}>
      <div className="fixed inset-0 -z-10"><GardenBackground /></div>
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center short:flex-row short:gap-8">
        {/* logo: deslizar hacia la izquierda vuelve a KokiCat */}
        <div
          className="flex cursor-grab touch-pan-y flex-col items-center"
          onPointerDown={(e) => { swipeX.current = e.clientX; }}
          onPointerUp={(e) => { if (swipeX.current != null && e.clientX - swipeX.current < -60) onBack(); swipeX.current = null; }}
        >
          <img src={tazPng} alt="Taz" draggable={false} className="w-40 drop-shadow-[0_8px_16px_rgba(0,0,0,0.45)] short:w-32" style={{ animation: "koki-logo-bob 2.4s ease-in-out infinite" }} />
          <div
            className="-mt-2 text-5xl font-black leading-none tracking-tight text-red-600 short:text-4xl"
            style={{ textShadow: "0 4px 0 #7f1d1d, 0 0 2px #fff, 0 8px 18px rgba(0,0,0,0.4)" }}
          >
            ATRAPA<br />AL TAZ
          </div>
          <div className="mt-2 text-[11px] font-bold text-white/80">← desliza para volver a KokiCat</div>
        </div>

        <div className="flex w-full max-w-sm flex-col gap-3">
          {screen === "result" && (
            <div className="rounded-2xl bg-black/30 p-3 text-white">
              <div className="text-xs font-bold uppercase tracking-widest text-white/70">{record ? "🎉 ¡Nuevo récord!" : "Fin del tiempo"}</div>
              <div className="text-5xl font-black">{last}</div>
              <div className="text-xs font-bold text-white/80">Récord: {best}</div>
            </div>
          )}
          <button onClick={play} className={`${big} bg-gradient-to-b from-red-400 to-red-600 py-4 text-2xl shadow-[0_6px_0_rgb(127_29_29)]`}>
            {screen === "result" ? "🔄 OTRA VEZ" : "▶ JUGAR"}
          </button>
          <button onClick={onRanking} className={`${big} bg-gradient-to-b from-amber-300 to-amber-500 shadow-[0_5px_0_rgb(146_64_14)]`}>🏆 RANKING</button>
          <button onClick={onMultiplayer} className={`${big} bg-gradient-to-b from-violet-400 to-indigo-600 shadow-[0_5px_0_rgb(49_46_129)]`}>⚔️ MULTIJUGADOR</button>
          <button onClick={onBack} className={`${big} bg-white/90 text-slate-800 shadow-[0_4px_0_rgba(0,0,0,0.3)]`}>← KokiCat</button>
          {screen === "menu" && <div className="text-xs font-bold text-white/80">🐈‍⬛ Récord: {best}</div>}
        </div>
      </div>
    </div>
  );
}
