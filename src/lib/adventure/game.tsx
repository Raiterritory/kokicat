// Koki Adventure (prototipo): dibuja el nivel en un canvas y lo controla con el teclado (flechas o A/D y
// espacio), con un control (cruceta y A) o con los botones de la pantalla. Las reglas están en engine.ts.
import { useEffect, useRef, useState } from "react";
import kokiAsset from "@/assets/koki-real.png.asset.json";
import pastelitoImg from "@/assets/pastelito.png";
import logoImg from "@/assets/koki-adventure-logo.png";
import { playFlap, playMeow } from "@/lib/sounds";
import { LEVELS } from "./levels";
import {
  newGame,
  step,
  solidAt,
  TILE,
  KOKI_SIZE,
  RAT_SIZE,
  LIVES,
  type Game,
  type Input,
} from "./engine";

const VW = 960,
  VH = 540;
const RAINBOW = ["#ff3b3b", "#ff9a2d", "#ffe62d", "#3ddc4a", "#2d9bff", "#a44bff"];

/* las imágenes subidas a Lovable (/__l5e/…) no existen en la copia local de desarrollo: ahí se piden a la web publicada */
function loadImg(src: string) {
  const i = new Image();
  i.onerror = () => {
    if (src.startsWith("/") && !i.src.startsWith("https://kokicat.lovable.app"))
      i.src = "https://kokicat.lovable.app" + src;
  };
  i.src = src;
  return i;
}

/* ---------- el dibujo ---------- */
function drawWorld(
  ctx: CanvasRenderingContext2D,
  g: Game,
  cam: number,
  imgs: { koki: HTMLImageElement; cake: HTMLImageElement },
) {
  const top = g.h * TILE - VH; /* el mundo se ve desde abajo */
  /* cielo, sol y nubes */
  const sky = ctx.createLinearGradient(0, 0, 0, VH);
  sky.addColorStop(0, "#5fb6ee");
  sky.addColorStop(0.7, "#bfe6fa");
  sky.addColorStop(1, "#ffe9c2");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = "rgba(255,240,180,.9)";
  ctx.beginPath();
  ctx.arc(780, 110, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.9)";
  for (let k = 0; k < 8; k++) {
    const x = ((((k * 310 - cam * 0.15) % (VW + 300)) + VW + 300) % (VW + 300)) - 150,
      y = 60 + ((k * 53) % 140);
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, 7);
    ctx.arc(x + 30, y - 12, 32, 0, 7);
    ctx.arc(x + 64, y, 24, 0, 7);
    ctx.fill();
  }
  /* la ciudad, en dos capas que se corren más lento que el nivel */
  const city = (speed: number, base: number, maxH: number, color: string, seed: number) => {
    ctx.fillStyle = color;
    const bw = 70,
      off = cam * speed;
    for (let i = Math.floor(off / bw) - 1; i < Math.floor(off / bw) + VW / bw + 2; i++) {
      const r = Math.sin((i + seed) * 12.9898) * 43758.5453,
        f = r - Math.floor(r);
      const h = maxH * (0.35 + 0.65 * f);
      ctx.fillRect(i * bw - off, base - h, bw - 6, h);
    }
  };
  city(0.25, VH - 60, 220, "#9cc3e0", 1);
  city(0.5, VH - 60, 160, "#7aa4c6", 7);
  ctx.save();
  ctx.translate(-Math.round(cam), -top);
  /* los bloques */
  const tx0 = Math.max(0, Math.floor(cam / TILE)),
    tx1 = Math.min(g.w - 1, Math.floor((cam + VW) / TILE));
  for (let ty = 0; ty < g.h; ty++)
    for (let tx = tx0; tx <= tx1; tx++) {
      const s = solidAt(g, tx, ty);
      if (!s) continue;
      const x = tx * TILE,
        y = ty * TILE;
      if (s === 1) {
        ctx.fillStyle = (tx + ty) % 2 ? "#a0612b" : "#8a4f22";
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "#c98a4b";
        ctx.fillRect(x + 8, y + 12, 7, 5);
        ctx.fillRect(x + 24, y + 26, 6, 4);
        if (!solidAt(g, tx, ty - 1)) {
          ctx.fillStyle = "#3ec456";
          ctx.fillRect(x, y, TILE, 13);
          ctx.fillStyle = "#a6f7a4";
          ctx.fillRect(x, y, TILE, 4);
          ctx.fillStyle = "#2f9e45";
          ctx.fillRect(x, y + 13, TILE, 3);
        }
      } else if (s === 2) {
        ctx.fillStyle = "#c8642e";
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "#7a3416";
        ctx.fillRect(x, y + 19, TILE, 3);
        ctx.fillRect(x, y + TILE - 3, TILE, 3);
        ctx.fillRect(x, y, TILE, 3);
        ctx.fillRect(x + 19, y, 3, 19);
        ctx.fillRect(x + 8, y + 22, 3, 15);
        ctx.fillRect(x + 30, y + 22, 3, 15);
        ctx.fillStyle = "#f09a5c";
        ctx.fillRect(x + 3, y + 3, 14, 3);
      } else {
        /* los tubos grises del juego (de dos bloques de ancho: el izquierdo claro, el derecho oscuro) */
        const left = solidAt(g, tx + 1, ty) >= 3;
        const grad = ctx.createLinearGradient(
          left ? x : x - TILE,
          0,
          left ? x + TILE * 2 : x + TILE,
          0,
        );
        grad.addColorStop(0, "#5a6478");
        grad.addColorStop(0.4, "#8b95ad");
        grad.addColorStop(1, "#3d4658");
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "#1f2635";
        if (left) ctx.fillRect(x, y, 3, TILE);
        else ctx.fillRect(x + TILE - 3, y, 3, TILE);
        if (s === 4) {
          ctx.fillRect(x - (left ? 4 : 0), y, TILE + 4, 4);
          ctx.fillRect(x - (left ? 4 : 0), y + 14, TILE + 4, 3);
        }
      }
    }
  /* la meta */
  const fx = g.flagX + TILE / 2,
    fb = (g.h - 2) * TILE;
  ctx.fillStyle = "#1f2635";
  ctx.fillRect(fx - 4, fb - 230, 8, 230);
  ctx.fillStyle = "#ffd23f";
  ctx.beginPath();
  ctx.arc(fx, fb - 236, 11, 0, 7);
  ctx.fill();
  const wave = Math.sin(g.frame * 0.1) * 6;
  ctx.fillStyle = "#ff4d6d";
  ctx.beginPath();
  ctx.moveTo(fx + 4, fb - 226);
  ctx.lineTo(fx + 92, fb - 200 + wave);
  ctx.lineTo(fx + 4, fb - 170);
  ctx.fill();
  if (imgs.cake.complete) ctx.drawImage(imgs.cake, fx + 18, fb - 214, 34, 34);
  /* pastelitos (los dorados brillan) */
  for (const c of g.coins) {
    if (c.taken || c.x < cam - 40 || c.x > cam + VW + 40) continue;
    const bob = Math.sin(g.frame * 0.08 + c.x * 0.05) * 4;
    if (c.golden) {
      const glow = ctx.createRadialGradient(c.x, c.y + bob, 4, c.x, c.y + bob, 30);
      glow.addColorStop(0, "rgba(255,230,80,.9)");
      glow.addColorStop(1, "rgba(255,200,40,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(c.x, c.y + bob, 30, 0, 7);
      ctx.fill();
    }
    const s = c.golden ? 38 : 28;
    if (imgs.cake.complete) ctx.drawImage(imgs.cake, c.x - s / 2, c.y - s / 2 + bob, s, s);
  }
  /* ratas */
  for (const r of g.rats) {
    if (!r.alive && r.squash <= 0) continue;
    ctx.save();
    ctx.translate(r.x + RAT_SIZE.w / 2, r.y + RAT_SIZE.h);
    if (r.vx > 0) ctx.scale(-1, 1);
    const sq = r.alive ? 1 : 0.35;
    ctx.scale(1, sq);
    const step2 = r.alive ? Math.sin(g.frame * 0.3 + r.x) * 2 : 0;
    ctx.strokeStyle = "#e8a0b0";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(14, -8);
    ctx.quadraticCurveTo(28, -18, 30, -4);
    ctx.stroke();
    ctx.fillStyle = "#6b6f7e";
    ctx.beginPath();
    ctx.ellipse(0, -11, 17, 11, 0, 0, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-14, -14, 9, 7, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#f2a7b8";
    ctx.beginPath();
    ctx.arc(-12, -22, 5, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(-18, -16, 2, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#ff8fa8";
    ctx.beginPath();
    ctx.arc(-23, -13, 2.5, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#4a4d59";
    ctx.fillRect(-10 + step2, -2, 5, 3);
    ctx.fillRect(5 - step2, -2, 5, 3);
    ctx.restore();
  }
  /* el arcoíris al planear */
  for (const t of g.trail) {
    ctx.globalAlpha = t.life / 30;
    RAINBOW.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(t.x - 5, t.y - 15 + i * 5, 10, 5);
    });
  }
  ctx.globalAlpha = 1;
  /* Koki (parpadea si recién lo golpearon; se inclina al planear) */
  if (!(g.hurt > 0 && Math.floor(g.frame / 4) % 2)) {
    const kw = 58,
      kh = (kw * 661) / 618;
    ctx.save();
    ctx.translate(g.x + KOKI_SIZE.w / 2, g.y + KOKI_SIZE.h);
    if (g.face < 0) ctx.scale(-1, 1);
    if (g.gliding) ctx.rotate(0.12);
    else if (!g.onGround) ctx.rotate(-0.1);
    const squash = g.onGround && Math.abs(g.vx) > 0.5 ? 1 + Math.sin(g.frame * 0.4) * 0.04 : 1;
    if (imgs.koki.complete) ctx.drawImage(imgs.koki, -kw / 2, -kh * squash + 4, kw, kh * squash);
    ctx.restore();
  }
  ctx.restore();
}
function drawHud(ctx: CanvasRenderingContext2D, g: Game, cake: HTMLImageElement) {
  ctx.fillStyle = "rgba(15,23,42,.55)";
  ctx.beginPath();
  ctx.roundRect(12, 12, 330, 46, 23);
  ctx.fill();
  ctx.font = "900 24px Roboto, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.fillText("❤️".repeat(g.lives) + "🤍".repeat(Math.max(0, LIVES - g.lives)), 26, 36);
  if (cake.complete) ctx.drawImage(cake, 140, 20, 30, 30);
  ctx.fillText(String(g.pastelitos), 176, 36);
  ctx.fillText(`⭐ ${g.goldens}/3`, 236, 36);
  const s = Math.floor(g.frame / 60);
  ctx.textAlign = "right";
  ctx.fillText(`⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`, VW - 24, 36);
  ctx.textAlign = "left";
}

/* ---------- el componente ---------- */
export function AdventureGame({ onExit }: { onExit?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game>(newGame(LEVELS[0]));
  const inputRef = useRef<Input>({ left: false, right: false, jump: false });
  const touchRef = useRef<Input>({ left: false, right: false, jump: false });
  const [screen, setScreen] = useState<"title" | "playing" | "won" | "lost">("title");
  const [result, setResult] = useState({ pastelitos: 0, goldens: 0, time: 0 });

  /* teclado */
  useEffect(() => {
    const set = (e: KeyboardEvent, on: boolean) => {
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "a") inputRef.current.left = on;
      else if (k === "arrowright" || k === "d") inputRef.current.right = on;
      else if (k === " " || k === "arrowup" || k === "w" || k === "z") inputRef.current.jump = on;
      else return;
      e.preventDefault();
    };
    const down = (e: KeyboardEvent) => set(e, true),
      up = (e: KeyboardEvent) => set(e, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  /* el bucle: 60 pasos por segundo pase lo que pase con los cuadros del teléfono */
  useEffect(() => {
    if (screen !== "playing") return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const imgs = { koki: loadImg(kokiAsset.url), cake: loadImg(pastelitoImg) };
    let raf = 0,
      last = performance.now(),
      acc = 0;
    const camRef = { current: 0 };
    if (import.meta.env.DEV)
      (window as unknown as { __kokiAdventureCam: unknown }).__kokiAdventureCam =
        camRef; /* para probarlo */
    const loop = (now: number) => {
      acc = Math.min(acc + (now - last), 100);
      last = now;
      const g = gameRef.current;
      while (acc >= 1000 / 60) {
        acc -= 1000 / 60;
        const pad = navigator.getGamepads?.()[0];
        const t = touchRef.current,
          k = inputRef.current;
        const inp: Input = {
          left: k.left || t.left || !!(pad && (pad.buttons[14]?.pressed || pad.axes[0] < -0.4)),
          right: k.right || t.right || !!(pad && (pad.buttons[15]?.pressed || pad.axes[0] > 0.4)),
          jump: k.jump || t.jump || !!(pad && pad.buttons[0]?.pressed),
        };
        step(g, inp);
        for (const ev of g.events) {
          if (ev === "jump" || ev === "stomp") playFlap();
          else if (ev === "golden" || ev === "win") playMeow();
        }
        if (g.state !== "playing") {
          setResult({
            pastelitos: g.pastelitos,
            goldens: g.goldens,
            time: Math.floor(g.frame / 60),
          });
          setScreen(g.state);
          break;
        }
      }
      /* la cámara sigue a Koki, un poco adelantada hacia donde mira */
      const want = Math.max(0, Math.min(g.w * TILE - VW, g.x - VW * 0.4 + g.face * 80));
      camRef.current += (want - camRef.current) * 0.12;
      drawWorld(ctx, g, camRef.current, imgs);
      drawHud(ctx, g, imgs.cake);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [screen]);

  const start = () => {
    gameRef.current = newGame(LEVELS[0]);
    if (import.meta.env.DEV)
      (window as unknown as { __kokiAdventure: unknown }).__kokiAdventure =
        gameRef; /* para probarlo */
    setScreen("playing");
  };
  /* los botones de la pantalla (se pueden apretar varios a la vez) */
  const hold = (key: keyof Input) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      touchRef.current[key] = true;
    },
    onPointerUp: () => {
      touchRef.current[key] = false;
    },
    onPointerCancel: () => {
      touchRef.current[key] = false;
    },
    onPointerLeave: () => {
      touchRef.current[key] = false;
    },
  });
  const btn =
    "pointer-events-auto select-none touch-none rounded-full bg-white/25 backdrop-blur border-2 border-white/60 text-white font-black text-3xl active:bg-white/45 flex items-center justify-center";

  return (
    <div className="fixed inset-0 bg-slate-900 flex items-center justify-center overflow-hidden">
      <div
        className="relative w-full max-w-[1280px]"
        style={{ aspectRatio: `${VW} / ${VH}`, maxHeight: "100vh" }}
      >
        <canvas
          ref={canvasRef}
          width={VW}
          height={VH}
          className="absolute inset-0 w-full h-full rounded-xl"
        />
        {screen === "playing" && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-3 bottom-3 flex gap-3">
              <div className={`${btn} w-20 h-20`} {...hold("left")}>
                ◀
              </div>
              <div className={`${btn} w-20 h-20`} {...hold("right")}>
                ▶
              </div>
            </div>
            <div
              className={`${btn} absolute right-4 bottom-4 w-24 h-24 text-2xl`}
              {...hold("jump")}
            >
              SALTO
            </div>
          </div>
        )}
        {screen !== "playing" && (
          <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-[#0f1a33] via-[#3a4d78] to-[#f4a06a] flex flex-col items-center justify-center gap-4 p-4 text-white text-center">
            <img
              src={logoImg}
              alt="Koki Adventure"
              className="w-[70%] max-w-[620px] drop-shadow-2xl"
            />
            {screen === "title" && (
              <>
                <div className="font-black text-lg opacity-90">
                  Nivel {LEVELS[0].id}: {LEVELS[0].name}
                </div>
                <div className="text-sm opacity-80">
                  ◀ ▶ para correr · SALTO para saltar · mantén SALTO en el aire para planear con el
                  arcoíris
                </div>
              </>
            )}
            {screen === "won" && (
              <div className="font-black text-2xl">
                🏁 ¡Nivel completado! · 🧁 {result.pastelitos} · ⭐ {result.goldens}/3 · ⏱{" "}
                {Math.floor(result.time / 60)}:{String(result.time % 60).padStart(2, "0")}
              </div>
            )}
            {screen === "lost" && (
              <div className="font-black text-2xl">😿 Te quedaste sin vidas</div>
            )}
            <div className="flex gap-3">
              <button
                className="rounded-full bg-gradient-to-b from-amber-300 to-orange-500 px-8 py-3 font-black text-xl shadow-lg"
                onClick={start}
              >
                {screen === "title" ? "▶ JUGAR" : "↻ OTRA VEZ"}
              </button>
              {onExit && (
                <button
                  className="rounded-full bg-white/20 px-6 py-3 font-black text-xl"
                  onClick={onExit}
                >
                  ← Volver
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
