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

const WIDTH = 400;
const HEIGHT = 600;
const GRAVITY = 0.5;
const JUMP = -8.5;
const PIPE_W = 70;
const GAP = 170;
const PIPE_SPEED = 2.5;
const KOKI_SIZE = 60;

type Pipe = { x: number; top: number; passed: boolean };
type GameState = "menu" | "ready" | "playing" | "over";

function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [state, setState] = useState<GameState>("menu");

  const stateRef = useRef(state);
  stateRef.current = state;

  const gameRef = useRef({
    y: HEIGHT / 2,
    vy: 0,
    pipes: [] as Pipe[],
    frame: 0,
    score: 0,
    rot: 0,
    flap: 0, // flap animation timer (1 -> 0)
  });

  useEffect(() => {
    const b = Number(localStorage.getItem("koki-best") || 0);
    setBest(b);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = kokiAsset.url;
    imgRef.current = img;
  }, []);

  const reset = () => {
    gameRef.current = { y: HEIGHT / 2, vy: 0, pipes: [], frame: 0, score: 0, rot: 0, flap: 0 };
    setScore(0);
  };

  const startGame = useCallback(() => {
    reset();
    setState("playing");
    gameRef.current.vy = JUMP;
    gameRef.current.flap = 1;
    playFlap();
  }, []);

  const flap = useCallback(() => {
    const s = stateRef.current;
    if (s === "menu") return; // menu requires button
    if (s === "ready") {
      startGame();
    } else if (s === "playing") {
      gameRef.current.vy = JUMP;
      gameRef.current.flap = 1;
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
      const g = gameRef.current;

      // sky gradient
      const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      grad.addColorStop(0, "#1a2947");
      grad.addColorStop(0.5, "#4a5f8a");
      grad.addColorStop(1, "#f4a06a");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // sun
      ctx.fillStyle = "rgba(255, 210, 140, 0.55)";
      ctx.beginPath();
      ctx.arc(WIDTH - 80, 140, 55, 0, Math.PI * 2);
      ctx.fill();

      // far city skyline (slow parallax)
      drawSkyline(ctx, g.frame * 0.3, HEIGHT - 40, {
        y: HEIGHT - 200,
        color: "#2b2f52",
        windowColor: "rgba(255, 200, 120, 0.35)",
        spacing: 55,
        maxH: 130,
        minH: 60,
        seed: 1,
      });
      // near city skyline (faster parallax)
      drawSkyline(ctx, g.frame * 0.9, HEIGHT - 40, {
        y: HEIGHT - 140,
        color: "#141a33",
        windowColor: "rgba(255, 220, 140, 0.75)",
        spacing: 48,
        maxH: 110,
        minH: 45,
        seed: 7,
      });



      // always tick global frame for parallax and idle animation
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

        // collisions
        const kx = 80;
        const ky = g.y;
        const r = KOKI_SIZE / 2 - 6;
        if (ky + r > HEIGHT - 40 || ky - r < 0) {
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
            playMeow();
          }
        }
      } else {
        // idle bob on menu / ready / over
        g.y = HEIGHT / 2 + Math.sin(g.frame * 0.08) * 12;
        g.rot = Math.sin(g.frame * 0.08) * 0.1;
      }

      // pipes
      for (const p of gameRef.current.pipes) {
        drawPipe(ctx, p.x, 0, PIPE_W, p.top, true);
        drawPipe(ctx, p.x, p.top + GAP, PIPE_W, HEIGHT - 40 - (p.top + GAP), false);
      }

      // ground (asphalt street)
      ctx.fillStyle = "#2a2a30";
      ctx.fillRect(0, HEIGHT - 40, WIDTH, 40);
      ctx.fillStyle = "#f5d547";
      for (let i = 0; i < WIDTH; i += 30) {
        const off = (g.frame * PIPE_SPEED) % 30;
        ctx.fillRect(i - off, HEIGHT - 22, 16, 4);
      }

      // koki with flap animation
      const img = imgRef.current;
      if (img && img.complete) {
        // flap: strong scale bounce + extra upward tilt on jump; idle: gentle wing flutter
        const flapPulse = g.flap; // 1 -> 0 after jump
        const idleFlutter = Math.sin(g.frame * 0.35) * 0.06;
        const scaleY = 1 + idleFlutter - flapPulse * 0.18; // squash on flap
        const scaleX = 1 - idleFlutter + flapPulse * 0.15; // stretch wide
        const extraRot = -flapPulse * 0.35;

        // motion blur trail on flap
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


      // score
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 4;
      ctx.font = "bold 48px system-ui, sans-serif";
      ctx.textAlign = "center";
      if (stateRef.current === "playing") {
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-b from-slate-900 via-indigo-900 to-orange-400 p-4">
      <div
        className="relative cursor-pointer overflow-hidden rounded-2xl border-4 border-white shadow-2xl"
        style={{ width: WIDTH, maxWidth: "100%" }}
        onPointerDown={(e) => {
          if (state === "menu") return;
          e.preventDefault();
          flap();
        }}
      >
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="block h-auto w-full touch-none select-none"
        />

        {state === "menu" && (
          <Overlay>
            <div className="flex flex-col items-center gap-6 px-6 text-center">
              <img
                src={kokiLogo}
                alt="Estamos aqui con Koki"
                className="w-full max-w-[340px] animate-[fade-in_0.5s_ease-out] drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]"
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
                  onClick={(e) => {
                    e.stopPropagation();
                    reset();
                    setState("menu");
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
      {state !== "menu" && (
        <p className="text-sm font-medium text-white/90 drop-shadow">
          Toca / click / espacio para volar · Mejor: {best}
        </p>
      )}
      <style>{`
        @keyframes koki-logo-bob {
          0%, 100% { transform: translateY(0) rotate(-1.5deg) scale(1); }
          50% { transform: translateY(-8px) rotate(1.5deg) scale(1.03); }
        }
      `}</style>
    </div>
  );
}


function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
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
  // cap
  const capH = 24;
  const capY = isTop ? y + h - capH : y;
  ctx.fillRect(x - 4, capY, w + 8, capH);
  ctx.strokeRect(x - 4, capY, w + 8, capH);
}

function drawSkyline(
  ctx: CanvasRenderingContext2D,
  offset: number,
  groundY: number,
  opts: {
    y: number;
    color: string;
    windowColor: string;
    spacing: number;
    maxH: number;
    minH: number;
    seed: number;
  },
) {
  const { y, color, windowColor, spacing, maxH, minH, seed } = opts;
  const totalWidth = 400;
  const buildingCount = Math.ceil(totalWidth / spacing) + 3;
  const scrollLoop = spacing * buildingCount;
  const off = offset % scrollLoop;

  ctx.fillStyle = color;
  for (let i = 0; i < buildingCount; i++) {
    // deterministic pseudo-random height
    const r = Math.sin((i + seed) * 12.9898) * 43758.5453;
    const rand = r - Math.floor(r);
    const h = minH + rand * (maxH - minH);
    const bx = i * spacing - off;
    const bw = spacing - 6;
    const by = y - h;
    ctx.fillRect(bx, by, bw, groundY - by);

    // roof detail: antenna or water tank
    const r2 = Math.sin((i + seed) * 78.233) * 43758.5453;
    const rand2 = r2 - Math.floor(r2);
    if (rand2 > 0.6) {
      ctx.fillRect(bx + bw / 2 - 2, by - 12, 4, 12);
    } else if (rand2 > 0.3) {
      ctx.fillRect(bx + bw * 0.2, by - 8, bw * 0.3, 8);
    }

    // windows
    ctx.fillStyle = windowColor;
    const winW = 5;
    const winH = 6;
    const gapX = 10;
    const gapY = 12;
    for (let wy = by + 8; wy < groundY - 6; wy += gapY) {
      for (let wx = bx + 6; wx < bx + bw - winW; wx += gapX) {
        const rw = Math.sin((wx * 0.7 + wy * 1.3 + seed) * 12.9898) * 43758.5453;
        const litRand = rw - Math.floor(rw);
        if (litRand > 0.35) {
          ctx.fillRect(wx, wy, winW, winH);
        }
      }
    }
    ctx.fillStyle = color;
  }
}
