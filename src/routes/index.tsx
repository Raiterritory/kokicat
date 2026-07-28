import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import kokiAsset from "@/assets/koki-real.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Flappy Koki - El juego del gato volador" },
      { name: "description", content: "Ayuda a Koki, el gato volador, a esquivar las tuberías en este divertido juego estilo Flappy Bird." },
      { property: "og:title", content: "Flappy Koki" },
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

function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [state, setState] = useState<"ready" | "playing" | "over">("ready");

  const stateRef = useRef(state);
  stateRef.current = state;

  const gameRef = useRef({
    y: HEIGHT / 2,
    vy: 0,
    pipes: [] as Pipe[],
    frame: 0,
    score: 0,
    rot: 0,
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
    gameRef.current = { y: HEIGHT / 2, vy: 0, pipes: [], frame: 0, score: 0, rot: 0 };
    setScore(0);
  };

  const flap = useCallback(() => {
    if (stateRef.current === "ready") {
      reset();
      setState("playing");
      gameRef.current.vy = JUMP;
    } else if (stateRef.current === "playing") {
      gameRef.current.vy = JUMP;
    } else if (stateRef.current === "over") {
      reset();
      setState("ready");
    }
  }, []);

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


      if (stateRef.current === "playing") {
        g.vy += GRAVITY;
        g.y += g.vy;
        g.frame++;
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
          }
        }
      }

      // pipes
      for (const p of gameRef.current.pipes) {
        drawPipe(ctx, p.x, 0, PIPE_W, p.top, true);
        drawPipe(ctx, p.x, p.top + GAP, PIPE_W, HEIGHT - 40 - (p.top + GAP), false);
      }

      // ground
      ctx.fillStyle = "#8ec36a";
      ctx.fillRect(0, HEIGHT - 40, WIDTH, 40);
      ctx.fillStyle = "#6ea34a";
      for (let i = 0; i < WIDTH; i += 20) {
        const off = (g.frame * PIPE_SPEED) % 20;
        ctx.fillRect(i - off, HEIGHT - 40, 10, 6);
      }

      // koki
      const img = imgRef.current;
      if (img && img.complete) {
        ctx.save();
        ctx.translate(80, g.y);
        ctx.rotate(g.rot);
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-b from-sky-300 to-amber-100 p-4">
      <h1 className="text-4xl font-black tracking-tight text-white drop-shadow-lg">
        Flappy Koki 🐱
      </h1>
      <p className="text-sm font-medium text-white/90 drop-shadow">
        Toca / click / espacio para volar
      </p>
      <div
        className="relative cursor-pointer overflow-hidden rounded-2xl border-4 border-white shadow-2xl"
        style={{ width: WIDTH, maxWidth: "100%" }}
        onPointerDown={(e) => {
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
              <div className="mt-4 rounded-lg bg-orange-500 px-4 py-2 font-bold text-white">
                Toca para reintentar
              </div>
            </div>
          </Overlay>
        )}
      </div>
      <div className="text-sm font-medium text-slate-700">
        Mejor puntuación: <span className="font-bold">{best}</span>
      </div>
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
  grad.addColorStop(0, "#4ea54a");
  grad.addColorStop(0.4, "#8ed66b");
  grad.addColorStop(1, "#3d8a3a");
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#2d6b2a";
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  // cap
  const capH = 24;
  const capY = isTop ? y + h - capH : y;
  ctx.fillRect(x - 4, capY, w + 8, capH);
  ctx.strokeRect(x - 4, capY, w + 8, capH);
}
