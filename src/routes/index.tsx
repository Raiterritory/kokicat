import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import kokiAsset from "@/assets/koki-real.png.asset.json";
import kokiLogo from "@/assets/koki-logo.png";
import { playFlap, playMeow } from "@/lib/sounds";

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

type Pipe = { x: number; top: number; passed: boolean };
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: "puff" | "star";
};
type GameState = "menu" | "ready" | "playing" | "over";

function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [state, setState] = useState<GameState>("menu");

  const stateRef = useRef(state);
  stateRef.current = state;

  // dynamic viewport
  const sizeRef = useRef({ w: 400, h: 600 });
  const [size, setSize] = useState({ w: 400, h: 600 });

  const gameRef = useRef({
    y: 300,
    vy: 0,
    pipes: [] as Pipe[],
    frame: 0,
    score: 0,
    rot: 0,
    flap: 0,
    particles: [] as Particle[],
  });

  useEffect(() => {
    const b = Number(localStorage.getItem("koki-best") || 0);
    setBest(b);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = kokiAsset.url;
    imgRef.current = img;

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
      y: h / 2,
      vy: 0,
      pipes: [],
      frame: 0,
      score: 0,
      rot: 0,
      flap: 0,
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
        x,
        y,
        vx: Math.cos(a) * sp - 1.5,
        vy: Math.sin(a) * sp + 0.5,
        life: 30,
        maxLife: 30,
        size: 4 + Math.random() * 4,
        color: "rgba(255,255,255,0.9)",
        kind: "puff",
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
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 40,
        maxLife: 40,
        size: 3 + Math.random() * 4,
        color: colors[i % colors.length],
        kind: "star",
      });
    }
  };

  const startGame = useCallback(() => {
    reset();
    setState("playing");
    gameRef.current.vy = JUMP;
    gameRef.current.flap = 1;
    spawnPuff(80, gameRef.current.y + 10);
    playFlap();
  }, []);

  const flap = useCallback(() => {
    const s = stateRef.current;
    if (s === "menu") return;
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

      // sky gradient
      const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      grad.addColorStop(0, "#1a2947");
      grad.addColorStop(0.5, "#4a5f8a");
      grad.addColorStop(1, "#f4a06a");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // sun
      ctx.fillStyle = "rgba(255, 210, 140, 0.45)";
      ctx.beginPath();
      ctx.arc(WIDTH - 80, 140, 55, 0, Math.PI * 2);
      ctx.fill();

      // simplified skyline: two flat silhouette layers, no windows
      drawSimpleSkyline(ctx, WIDTH, HEIGHT - GROUND_H, {
        offset: g.frame * 0.3,
        baseY: HEIGHT - GROUND_H - 90,
        color: "#2a3255",
        spacing: 70,
        maxH: 110,
        minH: 55,
        seed: 1,
      });
      drawSimpleSkyline(ctx, WIDTH, HEIGHT - GROUND_H, {
        offset: g.frame * 0.9,
        baseY: HEIGHT - GROUND_H - 30,
        color: "#141a33",
        spacing: 90,
        maxH: 100,
        minH: 40,
        seed: 7,
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
        }
        g.pipes.forEach((p) => (p.x -= PIPE_SPEED));
        g.pipes = g.pipes.filter((p) => p.x + PIPE_W > 0);

        const kx = 80;
        const ky = g.y;
        const r = KOKI_SIZE / 2 - 6;
        if (ky + r > HEIGHT - GROUND_H || ky - r < 0) {
          endGame();
        }
        for (const p of g.pipes) {
          if (kx + r > p.x && kx - r < p.x + PIPE_W) {
            if (ky - r < p.top || ky + r > p.top + GAP) {
              endGame();
            }
          }
          if (!p.passed && p.x + PIPE_W < kx) {
            p.passed = true;
            g.score++;
            setScore(g.score);
            spawnStars(kx, ky);
            playMeow();
          }
        }
      } else {
        g.y = HEIGHT / 2 + Math.sin(g.frame * 0.08) * 12;
        g.rot = Math.sin(g.frame * 0.08) * 0.1;
      }

      // pipes
      for (const p of g.pipes) {
        drawPipe(ctx, p.x, 0, PIPE_W, p.top, true);
        drawPipe(ctx, p.x, p.top + GAP, PIPE_W, HEIGHT - GROUND_H - (p.top + GAP), false);
      }

      // ground
      ctx.fillStyle = "#2a2a30";
      ctx.fillRect(0, HEIGHT - GROUND_H, WIDTH, GROUND_H);
      ctx.fillStyle = "#f5d547";
      for (let i = 0; i < WIDTH; i += 30) {
        const off = (g.frame * PIPE_SPEED) % 30;
        ctx.fillRect(i - off, HEIGHT - GROUND_H + 18, 16, 4);
      }

      // koki
      const img = imgRef.current;
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

      // particles
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
          // star / sparkle
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

      // score
      if (stateRef.current === "playing") {
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 4;
        ctx.font = "bold 48px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.strokeText(String(g.score), WIDTH / 2, 80);
        ctx.fillText(String(g.score), WIDTH / 2, 80);
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
      setState("over");
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const goToMenu = () => {
    reset();
    setState("menu");
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-slate-900">
      <div
        className="relative h-full w-full cursor-pointer select-none"
        onPointerDown={(e) => {
          if (state === "menu") return;
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
            <div className="flex flex-col items-center gap-8 px-6 text-center">
              <img
                src={kokiLogo}
                alt="Estamos aqui con Koki"
                className="w-full max-w-[340px] drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]"
                style={{ animation: "koki-logo-bob 2.4s ease-in-out infinite" }}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startGame();
                }}
                className="rounded-full bg-gradient-to-b from-amber-300 to-orange-500 px-10 py-4 text-2xl font-black tracking-wide text-white shadow-[0_6px_0_rgb(154_52_18),0_10px_20px_rgba(0,0,0,0.4)] transition-transform hover:scale-105 active:translate-y-1 active:shadow-[0_2px_0_rgb(154_52_18),0_4px_10px_rgba(0,0,0,0.4)]"
                style={{ WebkitTextStroke: "1px rgba(0,0,0,0.3)" }}
              >
                ▶ JUGAR
              </button>
              <div className="text-xs font-semibold uppercase tracking-widest text-white/80">
                Mejor: {best}
              </div>
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
            <div className="rounded-xl bg-white/95 px-8 py-6 text-center shadow-xl">
              <div className="text-2xl font-black text-slate-800">¡Game Over!</div>
              <div className="mt-3 text-slate-700">
                Score: <span className="font-bold">{score}</span>
              </div>
              <div className="text-slate-700">
                Mejor: <span className="font-bold">{best}</span>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startGame();
                  }}
                  className="rounded-lg bg-orange-500 px-4 py-2 font-bold text-white hover:bg-orange-600"
                >
                  Reintentar
                </button>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    goToMenu();
                  }}
                  className="rounded-lg bg-slate-200 px-4 py-2 font-bold text-slate-800 hover:bg-slate-300"
                >
                  Menú
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
    <div className="absolute inset-0 flex items-center justify-center bg-black/25">
      {children}
    </div>
  );
}

function drawPipe(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  isTop: boolean,
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
  width: number,
  groundY: number,
  opts: {
    offset: number;
    baseY: number;
    color: string;
    spacing: number;
    maxH: number;
    minH: number;
    seed: number;
  },
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
