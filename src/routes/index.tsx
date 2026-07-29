import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import kokiAsset from "@/assets/koki-real.png.asset.json";
import menuLogo from "@/assets/koki-menu-logo.png.asset.json";
import tazAsset from "@/assets/taz.png.asset.json";
import gufiAsset from "@/assets/gufi.png.asset.json";
import ratonAsset from "@/assets/raton.png.asset.json";
import pastelitoImg from "@/assets/pastelito.png";
import {
  playFlap, playMeow,
  startMusic, setMusicVolume, setSfxVolume,
  getMusicVolume, getSfxVolume,
} from "@/lib/sounds";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Estamos Aqui con Koki - El juego del gato volador" },
      { name: "description", content: "Ayuda a Koki, el gato volador, a esquivar edificios en este divertido juego estilo Flappy Bird." },
      { property: "og:title", content: "Estamos Aqui con Koki" },
      { property: "og:description", content: "El juego del gato volador Koki" },
    ],
  }),
  component: Game,
});

const GRAVITY = 0.5;
const JUMP = -8.5;
const PIPE_W = 70;
const GAP = 190;
const PIPE_SPEED = 2.5;
const KOKI_SIZE = 64;
const GROUND_H = 40;
const COIN_SIZE = 36;
const SKIN_PRICE = 50;

type Pipe = { x: number; top: number; passed: boolean };
type Coin = { x: number; y: number; taken: boolean; bob: number };
type Particle = {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string;
  kind: "puff" | "star" | "coin";
};
type GameState = "menu" | "characters" | "ready" | "playing" | "over";

type Character = {
  id: string;
  name: string;
  url: string;
  price: number;
};

const CHARACTERS: Character[] = [
  { id: "koki", name: "Koki", url: kokiAsset.url, price: 0 },
  { id: "taz", name: "Taz", url: tazAsset.url, price: SKIN_PRICE },
  { id: "gufi", name: "Gufi", url: gufiAsset.url, price: SKIN_PRICE },
  { id: "raton", name: "Ratón", url: ratonAsset.url, price: SKIN_PRICE },
];

function loadUnlocked(): string[] {
  try {
    const raw = localStorage.getItem("koki-unlocked");
    if (raw) return JSON.parse(raw);
  } catch {}
  return ["koki"];
}

function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgCacheRef = useRef<Record<string, HTMLImageElement>>({});
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [coins, setCoins] = useState(0);
  const [state, setState] = useState<GameState>("menu");
  const [selectedId, setSelectedId] = useState<string>("koki");
  const [unlocked, setUnlocked] = useState<string[]>(["koki"]);
  const [showSettings, setShowSettings] = useState(false);
  const [musicVol, setMusicVol] = useState(0.3);
  const [sfxVol, setSfxVol] = useState(1);
  const musicStartedRef = useRef(false);

  const kickMusic = useCallback(() => {
    if (musicStartedRef.current) return;
    musicStartedRef.current = true;
    startMusic();
  }, []);

  const stateRef = useRef(state);
  stateRef.current = state;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  const sizeRef = useRef({ w: 400, h: 600 });
  const [size, setSize] = useState({ w: 400, h: 600 });

  const gameRef = useRef({
    y: 300, vy: 0,
    pipes: [] as Pipe[],
    coins: [] as Coin[],
    frame: 0, score: 0, rot: 0, flap: 0,
    runCoins: 0,
    particles: [] as Particle[],
  });

  useEffect(() => {
    setBest(Number(localStorage.getItem("koki-best") || 0));
    setCoins(Number(localStorage.getItem("koki-coins") || 0));
    setUnlocked(loadUnlocked());
    setSelectedId(localStorage.getItem("koki-selected") || "koki");
    setMusicVol(getMusicVolume());
    setSfxVol(getSfxVolume());

    for (const c of CHARACTERS) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = c.url;
      imgCacheRef.current[c.id] = img;
    }
    const coinImg = new Image();
    coinImg.src = pastelitoImg;
    imgCacheRef.current["__coin"] = coinImg;

    const updateSize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      sizeRef.current = { w, h };
      setSize({ w, h });
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    window.addEventListener("orientationchange", updateSize);
    return () => {
      window.removeEventListener("resize", updateSize);
      window.removeEventListener("orientationchange", updateSize);
    };
  }, []);

  const reset = () => {
    const { h } = sizeRef.current;
    gameRef.current = {
      y: h / 2, vy: 0, pipes: [], coins: [],
      frame: 0, score: 0, rot: 0, flap: 0, runCoins: 0,
      particles: [],
    };
    setScore(0);
  };

  const spawnPuff = (x: number, y: number) => {
    const g = gameRef.current;
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 2.5;
      g.particles.push({
        x, y, vx: Math.cos(a) * sp - 1.5, vy: Math.sin(a) * sp + 0.5,
        life: 30, maxLife: 30, size: 4 + Math.random() * 4,
        color: "rgba(255,255,255,0.9)", kind: "puff",
      });
    }
  };

  const spawnStars = (x: number, y: number) => {
    const g = gameRef.current;
    const colors = ["#ffd966", "#ffb84d", "#fff2a8", "#ff8fa3"];
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 3.5;
      g.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 40, maxLife: 40, size: 3 + Math.random() * 4,
        color: colors[i % colors.length], kind: "star",
      });
    }
  };

  const spawnCoinBurst = (x: number, y: number) => {
    const g = gameRef.current;
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 3;
      g.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1,
        life: 35, maxLife: 35, size: 4 + Math.random() * 3,
        color: "#ff69b4", kind: "coin",
      });
    }
  };

  const startGame = useCallback(() => {
    kickMusic();
    reset();
    setState("playing");
    gameRef.current.vy = JUMP;
    gameRef.current.flap = 1;
    spawnPuff(80, gameRef.current.y + 10);
    playFlap();
  }, [kickMusic]);

  const flap = useCallback(() => {
    const s = stateRef.current;
    if (s === "menu" || s === "characters") return;
    if (s === "ready") {
      startGame();
    } else if (s === "playing") {
      gameRef.current.vy = JUMP;
      gameRef.current.flap = 1;
      spawnPuff(80, gameRef.current.y + 10);
      playFlap();
    } else if (s === "over") {
      reset();
      setState("ready");
    }
  }, [startGame]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        flap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flap]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;

    const draw = () => {
      const { w: WIDTH, h: HEIGHT } = sizeRef.current;
      const g = gameRef.current;

      const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      grad.addColorStop(0, "#1a2947");
      grad.addColorStop(0.5, "#4a5f8a");
      grad.addColorStop(1, "#f4a06a");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = "rgba(255, 210, 140, 0.45)";
      ctx.beginPath();
      ctx.arc(WIDTH - 80, 140, 55, 0, Math.PI * 2);
      ctx.fill();

      drawSimpleSkyline(ctx, WIDTH, HEIGHT - GROUND_H, {
        offset: g.frame * 0.3, baseY: HEIGHT - GROUND_H - 90,
        color: "#2a3255", spacing: 70, maxH: 110, minH: 55, seed: 1,
      });
      drawSimpleSkyline(ctx, WIDTH, HEIGHT - GROUND_H, {
        offset: g.frame * 0.9, baseY: HEIGHT - GROUND_H - 30,
        color: "#141a33", spacing: 90, maxH: 100, minH: 40, seed: 7,
      });

      g.frame++;
      if (g.flap > 0) g.flap = Math.max(0, g.flap - 0.06);

      if (stateRef.current === "playing") {
        g.vy += GRAVITY;
        g.y += g.vy;
        g.rot = Math.max(-0.4, Math.min(1.2, g.vy * 0.08));

        if (g.frame % 90 === 0) {
          const top = 60 + Math.random() * (HEIGHT - GAP - 180);
          g.pipes.push({ x: WIDTH, top, passed: false });
          // ~55% chance to spawn a coin between this pipe and the next
          if (Math.random() < 0.55) {
            const gapCenter = top + GAP / 2;
            const jitter = (Math.random() - 0.5) * (GAP - 60);
            g.coins.push({
              x: WIDTH + PIPE_W / 2 + 45,
              y: gapCenter + jitter,
              taken: false,
              bob: Math.random() * Math.PI * 2,
            });
          }
        }
        g.pipes.forEach((p) => (p.x -= PIPE_SPEED));
        g.pipes = g.pipes.filter((p) => p.x + PIPE_W > 0);
        g.coins.forEach((c) => { c.x -= PIPE_SPEED; c.bob += 0.1; });
        g.coins = g.coins.filter((c) => c.x + COIN_SIZE > 0 && !c.taken);

        const kx = 80;
        const ky = g.y;
        const r = KOKI_SIZE / 2 - 6;
        if (ky + r > HEIGHT - GROUND_H || ky - r < 0) endGame();
        for (const p of g.pipes) {
          if (kx + r > p.x && kx - r < p.x + PIPE_W) {
            if (ky - r < p.top || ky + r > p.top + GAP) endGame();
          }
          if (!p.passed && p.x + PIPE_W < kx) {
            p.passed = true;
            g.score++;
            setScore(g.score);
            spawnStars(kx, ky);
            playMeow();
          }
        }
        // coin pickup
        for (const c of g.coins) {
          if (c.taken) continue;
          const dx = c.x - kx;
          const dy = c.y - ky;
          if (dx * dx + dy * dy < (r + COIN_SIZE / 2) * (r + COIN_SIZE / 2)) {
            c.taken = true;
            g.runCoins++;
            spawnCoinBurst(c.x, c.y);
            playFlap();
          }
        }
      } else {
        g.y = HEIGHT / 2 + Math.sin(g.frame * 0.08) * 12;
        g.rot = Math.sin(g.frame * 0.08) * 0.1;
      }

      for (const p of g.pipes) {
        drawPipe(ctx, p.x, 0, PIPE_W, p.top, true);
        drawPipe(ctx, p.x, p.top + GAP, PIPE_W, HEIGHT - GROUND_H - (p.top + GAP), false);
      }

      // coins
      const coinImg = imgCacheRef.current["__coin"];
      for (const c of g.coins) {
        if (c.taken) continue;
        const yy = c.y + Math.sin(c.bob) * 3;
        if (coinImg && coinImg.complete) {
          ctx.save();
          ctx.translate(c.x, yy);
          const sx = Math.cos(c.bob * 0.7);
          ctx.scale(Math.abs(sx) * 0.4 + 0.6, 1);
          ctx.drawImage(coinImg, -COIN_SIZE / 2, -COIN_SIZE / 2, COIN_SIZE, COIN_SIZE);
          ctx.restore();
        }
      }

      ctx.fillStyle = "#2a2a30";
      ctx.fillRect(0, HEIGHT - GROUND_H, WIDTH, GROUND_H);
      ctx.fillStyle = "#f5d547";
      for (let i = 0; i < WIDTH; i += 30) {
        const off = (g.frame * PIPE_SPEED) % 30;
        ctx.fillRect(i - off, HEIGHT - GROUND_H + 18, 16, 4);
      }

      const img = imgCacheRef.current[selectedRef.current] || imgCacheRef.current["koki"];
      if (img && img.complete) {
        const flapPulse = g.flap;
        const idleFlutter = Math.sin(g.frame * 0.35) * 0.06;
        const scaleY = 1 + idleFlutter - flapPulse * 0.18;
        const scaleX = 1 - idleFlutter + flapPulse * 0.15;
        const extraRot = -flapPulse * 0.35;

        if (flapPulse > 0.2) {
          ctx.save();
          ctx.globalAlpha = flapPulse * 0.35;
          ctx.translate(80 - 12, g.y + 4);
          ctx.rotate(g.rot + extraRot);
          ctx.scale(scaleX, scaleY);
          ctx.drawImage(img, -KOKI_SIZE / 2, -KOKI_SIZE / 2, KOKI_SIZE, KOKI_SIZE);
          ctx.restore();
        }

        ctx.save();
        ctx.translate(80, g.y);
        ctx.rotate(g.rot + extraRot);
        ctx.scale(scaleX, scaleY);
        ctx.drawImage(img, -KOKI_SIZE / 2, -KOKI_SIZE / 2, KOKI_SIZE, KOKI_SIZE);
        ctx.restore();
      }

      for (const p of g.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.kind === "puff" ? 0.05 : 0.12;
        p.vx *= 0.96;
        p.life--;
        const t = p.life / p.maxLife;
        ctx.save();
        ctx.globalAlpha = Math.max(0, t);
        if (p.kind === "puff") {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * t + 1, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.translate(p.x, p.y);
          ctx.rotate(g.frame * 0.2 + p.x);
          ctx.fillStyle = p.color;
          const s = p.size * (0.6 + t * 0.8);
          ctx.fillRect(-s, -1, s * 2, 2);
          ctx.fillRect(-1, -s, 2, s * 2);
        }
        ctx.restore();
      }
      g.particles = g.particles.filter((p) => p.life > 0);

      if (stateRef.current === "playing") {
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 4;
        ctx.font = "bold 48px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.strokeText(String(g.score), WIDTH / 2, 80);
        ctx.fillText(String(g.score), WIDTH / 2, 80);

        // coin HUD
        ctx.font = "bold 20px system-ui, sans-serif";
        ctx.textAlign = "right";
        const label = `🧁 ${g.runCoins}`;
        ctx.strokeText(label, WIDTH - 16, 40);
        ctx.fillText(label, WIDTH - 16, 40);
      }

      raf = requestAnimationFrame(draw);
    };

    const endGame = () => {
      if (stateRef.current !== "playing") return;
      const g = gameRef.current;
      const b = Number(localStorage.getItem("koki-best") || 0);
      if (g.score > b) {
        localStorage.setItem("koki-best", String(g.score));
        setBest(g.score);
      }
      const totalCoins = Number(localStorage.getItem("koki-coins") || 0) + g.runCoins;
      localStorage.setItem("koki-coins", String(totalCoins));
      setCoins(totalCoins);
      setState("over");
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const goToMenu = () => {
    reset();
    setState("menu");
  };

  const selectCharacter = (id: string) => {
    if (!unlocked.includes(id)) return;
    setSelectedId(id);
    localStorage.setItem("koki-selected", id);
  };

  const tryUnlock = (id: string) => {
    if (unlocked.includes(id)) { selectCharacter(id); return; }
    if (coins < SKIN_PRICE) return;
    const newCoins = coins - SKIN_PRICE;
    const newUnlocked = [...unlocked, id];
    setCoins(newCoins);
    setUnlocked(newUnlocked);
    localStorage.setItem("koki-coins", String(newCoins));
    localStorage.setItem("koki-unlocked", JSON.stringify(newUnlocked));
    setSelectedId(id);
    localStorage.setItem("koki-selected", id);
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-slate-900">
      <div
        className="relative h-full w-full cursor-pointer select-none"
        onPointerDown={(e) => {
          if (state === "menu" || state === "characters") return;
          e.preventDefault();
          flap();
        }}
      >
        <canvas
          ref={canvasRef}
          width={size.w}
          height={size.h}
          className="block h-full w-full touch-none select-none"
        />

        {state === "menu" && (
          <Overlay>
            <div className="flex flex-col items-center gap-6 px-6 text-center w-full max-w-sm">
              <img
                src={menuLogo.url}
                alt="Estamos aqui con Koki"
                className="w-full max-w-[320px] drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]"
                style={{ animation: "koki-logo-bob 2.4s ease-in-out infinite" }}
              />
              <div className="flex items-center gap-2 rounded-full bg-black/40 px-4 py-1.5 text-white font-bold text-sm backdrop-blur">
                <span>🧁</span><span>{coins} pastelitos</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); startGame(); }}
                className="w-full rounded-full bg-gradient-to-b from-red-400 to-red-600 px-10 py-4 text-2xl font-black tracking-wide text-white shadow-[0_6px_0_rgb(127_29_29),0_10px_20px_rgba(0,0,0,0.4)] transition-transform hover:scale-105 active:translate-y-1 active:shadow-[0_2px_0_rgb(127_29_29),0_4px_10px_rgba(0,0,0,0.4)]"
                style={{ WebkitTextStroke: "1px rgba(0,0,0,0.3)" }}
              >
                ▶ JUGAR
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setState("characters"); }}
                className="w-full rounded-full bg-gradient-to-b from-sky-400 to-blue-600 px-8 py-3 text-lg font-black text-white shadow-[0_5px_0_rgb(30_58_138),0_8px_16px_rgba(0,0,0,0.4)] active:translate-y-1 active:shadow-[0_2px_0_rgb(30_58_138)]"
              >
                🐾 PERSONAJES
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); kickMusic(); setShowSettings(true); }}
                className="w-full rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 px-8 py-3 text-lg font-black text-white shadow-[0_5px_0_rgb(6_78_59),0_8px_16px_rgba(0,0,0,0.4)] active:translate-y-1 active:shadow-[0_2px_0_rgb(6_78_59)]"
              >
                🔊 SONIDO
              </button>
              <div className="text-xs font-semibold uppercase tracking-widest text-white/80">
                Mejor: {best}
              </div>
            </div>
          </Overlay>
        )}

        {state === "characters" && (
          <Overlay>
            <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-indigo-900/95 to-slate-900/95 p-5 shadow-2xl border-2 border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-black text-white">Personajes</h2>
                <div className="flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1 text-white font-bold text-sm">
                  <span>🧁</span><span>{coins}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {CHARACTERS.map((c) => {
                  const isUnlocked = unlocked.includes(c.id);
                  const isSelected = selectedId === c.id;
                  const canBuy = coins >= SKIN_PRICE;
                  return (
                    <button
                      key={c.id}
                      onClick={(e) => { e.stopPropagation(); tryUnlock(c.id); }}
                      className={`relative flex flex-col items-center gap-2 rounded-2xl p-3 transition-transform active:scale-95 ${
                        isSelected
                          ? "bg-gradient-to-b from-amber-300 to-orange-500 ring-4 ring-yellow-200"
                          : isUnlocked
                          ? "bg-white/15 hover:bg-white/25"
                          : "bg-white/10"
                      }`}
                    >
                      <div className="relative h-20 w-20 flex items-center justify-center">
                        <img
                          src={c.url}
                          alt={c.name}
                          className={`h-20 w-20 object-contain ${!isUnlocked ? "grayscale opacity-50" : ""}`}
                        />
                        {!isUnlocked && (
                          <div className="absolute inset-0 flex items-center justify-center text-3xl">🔒</div>
                        )}
                      </div>
                      <div className={`text-sm font-black ${isSelected ? "text-white" : "text-white"}`}>
                        {c.name}
                      </div>
                      {isUnlocked ? (
                        isSelected ? (
                          <div className="text-[10px] font-bold uppercase tracking-wider text-white">Elegido</div>
                        ) : (
                          <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">Tocar</div>
                        )
                      ) : (
                        <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black ${canBuy ? "bg-pink-500 text-white" : "bg-white/20 text-white/60"}`}>
                          🧁 {c.price}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setState("menu"); }}
                className="mt-5 w-full rounded-full bg-white/90 px-6 py-3 text-lg font-black text-slate-800 shadow-[0_4px_0_rgba(0,0,0,0.3)] active:translate-y-0.5"
              >
                ← Volver
              </button>
            </div>
          </Overlay>
        )}

        {state === "ready" && (
          <Overlay>
            <div className="text-center">
              <div className="mb-2 text-3xl font-black text-white drop-shadow">¿Listo?</div>
              <div className="text-white/90">Toca para empezar</div>
            </div>
          </Overlay>
        )}

        {state === "over" && (
          <Overlay>
            <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-white to-slate-100 px-6 py-6 text-center shadow-2xl border-4 border-white/60">
              <div className="text-3xl font-black text-red-600 drop-shadow-sm">¡Game Over!</div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-slate-100 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Score</div>
                  <div className="text-2xl font-black text-slate-800">{score}</div>
                </div>
                <div className="rounded-2xl bg-amber-100 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Mejor</div>
                  <div className="text-2xl font-black text-amber-700">{best}</div>
                </div>
                <div className="rounded-2xl bg-pink-100 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-pink-700">🧁</div>
                  <div className="text-2xl font-black text-pink-700">+{gameRef.current.runCoins}</div>
                </div>
              </div>
              <div className="mt-5 flex flex-col gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); startGame(); }}
                  className="w-full rounded-full bg-gradient-to-b from-red-400 to-red-600 px-6 py-4 text-xl font-black text-white shadow-[0_5px_0_rgb(127_29_29),0_8px_16px_rgba(0,0,0,0.4)] active:translate-y-1 active:shadow-[0_2px_0_rgb(127_29_29)]"
                >
                  🔄 REINTENTAR
                </button>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); goToMenu(); }}
                  className="w-full rounded-full bg-gradient-to-b from-slate-200 to-slate-400 px-6 py-3 text-lg font-black text-slate-800 shadow-[0_4px_0_rgb(71_85_105)] active:translate-y-1 active:shadow-[0_2px_0_rgb(71_85_105)]"
                >
                  🏠 MENÚ
                </button>
              </div>
            </div>
          </Overlay>
        )}
      </div>
      <style>{`
        @keyframes koki-logo-bob {
          0%, 100% { transform: translateY(0) rotate(-1.5deg) scale(1); }
          50% { transform: translateY(-8px) rotate(1.5deg) scale(1.03); }
        }
        html, body, #root { height: 100%; margin: 0; overscroll-behavior: none; }
      `}</style>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/25 p-4">
      {children}
    </div>
  );
}

function drawPipe(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, isTop: boolean,
) {
  const grad = ctx.createLinearGradient(x, 0, x + w, 0);
  grad.addColorStop(0, "#5a6478");
  grad.addColorStop(0.4, "#8b95ad");
  grad.addColorStop(1, "#3d4658");
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#1f2635";
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  const capH = 24;
  const capY = isTop ? y + h - capH : y;
  ctx.fillRect(x - 4, capY, w + 8, capH);
  ctx.strokeRect(x - 4, capY, w + 8, capH);
}

function drawSimpleSkyline(
  ctx: CanvasRenderingContext2D,
  width: number, groundY: number,
  opts: { offset: number; baseY: number; color: string; spacing: number; maxH: number; minH: number; seed: number; },
) {
  const { offset, baseY, color, spacing, maxH, minH, seed } = opts;
  const buildingCount = Math.ceil(width / spacing) + 3;
  const scrollLoop = spacing * buildingCount;
  const off = offset % scrollLoop;

  ctx.fillStyle = color;
  for (let i = 0; i < buildingCount; i++) {
    const r = Math.sin((i + seed) * 12.9898) * 43758.5453;
    const rand = r - Math.floor(r);
    const h = minH + rand * (maxH - minH);
    const bx = i * spacing - off;
    const bw = spacing - 8;
    const by = baseY - h;
    ctx.fillRect(bx, by, bw, groundY - by);
  }
}
