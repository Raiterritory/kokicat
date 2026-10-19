// Koki Adventure (prototipo): el barrio de Koki visto desde arriba, en pixel art. Se camina con las flechas,
// WASD, la cruceta de un control o la de la pantalla; se habla con A, espacio o Enter (o el botón A de la
// pantalla). Las reglas y los diálogos están en world.ts; los dibujos en art.ts.
import { useEffect, useRef, useState } from "react";
import kokiAsset from "@/assets/koki-real.png.asset.json";
import gufiAsset from "@/assets/gufi.png.asset.json";
import ratonAsset from "@/assets/raton.png.asset.json";
import tazPng from "@/assets/gato-negro.png";
import logoImg from "@/assets/koki-adventure-logo.png";
import pixelFont from "@/assets/PixelifySans.ttf?url"; /* SIL Open Font License (PixelifySans-OFL.txt) */
import { playFlap, playMeow } from "@/lib/sounds";
import {
  newWorld,
  stepWorld,
  nearby,
  nearSpot,
  rustle,
  SPOTS,
  TILE,
  type World,
  type Pad,
  type Line,
} from "./world";
import { paintBarrio, paintSprites, paintCake } from "./art";

const VW = 240,
  VH = 160; /* la pantalla, en puntos de pixel art (se agranda sin suavizar) */
const NAMES: Record<Line["who"], string> = {
  gufi: "GUFI",
  raton: "EL RATÓN",
  taz: "EL TAZ",
  koki: "KOKI",
  nadie: "",
};
const FACES: Partial<Record<Line["who"], { src: string; pos: string; size: string }>> = {
  gufi: { src: gufiAsset.url, pos: "62% 30%", size: "230%" },
  raton: { src: ratonAsset.url, pos: "70% 30%", size: "190%" },
  taz: { src: tazPng, pos: "55% 25%", size: "160%" },
  koki: { src: kokiAsset.url, pos: "72% 22%", size: "210%" },
};
/* las fotos subidas a Lovable (/__l5e/…) no existen en la copia local de desarrollo: ahí se piden a la web publicada */
const withFallback = (src: string) =>
  import.meta.env.DEV && src.startsWith("/__l5e") ? "https://kokicat.lovable.app" + src : src;

export function AdventureGame({ onExit }: { onExit?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World>(newWorld());
  const keys = useRef<Pad>({ up: false, down: false, left: false, right: false, act: false });
  const touch = useRef<Pad>({ up: false, down: false, left: false, right: false, act: false });
  const [screen, setScreen] = useState<"title" | "playing">("title");
  /* lo que muestra la interfaz (se copia del mundo cuando cambia) */
  const [ui, setUi] = useState({
    talk: null as Line[] | null,
    page: 0,
    quest: 0,
    found: 0,
    seek: 0 /* cuántas veces encontraste al Ratón */,
    done: 0 /* el encargo recién cumplido (muestra su cartel) */,
  });

  useEffect(() => {
    const map: Record<string, keyof Pad> = {
      arrowup: "up",
      w: "up",
      arrowdown: "down",
      s: "down",
      arrowleft: "left",
      a: "left",
      arrowright: "right",
      d: "right",
      " ": "act",
      enter: "act",
      z: "act",
      e: "act",
    };
    const set = (e: KeyboardEvent, on: boolean) => {
      const k = map[e.key.toLowerCase()];
      if (!k) return;
      keys.current[k] = on;
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

  useEffect(() => {
    if (screen !== "playing") return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const wd = worldRef.current;
    const barrio = paintBarrio(wd),
      spr = paintSprites(),
      cake = paintCake();
    let raf = 0,
      last = performance.now(),
      acc = 0,
      prevAct = false;
    const loop = (now: number) => {
      acc = Math.min(acc + (now - last), 100);
      last = now;
      while (acc >= 1000 / 60) {
        acc -= 1000 / 60;
        const gp = navigator.getGamepads?.()[0];
        const k = keys.current,
          t = touch.current;
        const pad: Pad = {
          up: k.up || t.up || !!(gp && (gp.buttons[12]?.pressed || gp.axes[1] < -0.4)),
          down: k.down || t.down || !!(gp && (gp.buttons[13]?.pressed || gp.axes[1] > 0.4)),
          left: k.left || t.left || !!(gp && (gp.buttons[14]?.pressed || gp.axes[0] < -0.4)),
          right: k.right || t.right || !!(gp && (gp.buttons[15]?.pressed || gp.axes[0] > 0.4)),
          act: k.act || t.act || !!(gp && gp.buttons[0]?.pressed),
        };
        const act = pad.act && !prevAct;
        prevAct = pad.act;
        const before = `${!!wd.talk}${wd.page}${wd.quest}${wd.found}${wd.hideRound}`;
        stepWorld(wd, pad, act);
        for (const ev of wd.events) {
          if (ev === "cake" || ev === "found") playFlap();
          else if (ev === "done" || ev === "quest" || ev === "caught") playMeow();
        }
        if (`${!!wd.talk}${wd.page}${wd.quest}${wd.found}${wd.hideRound}` !== before)
          setUi({
            talk: wd.talk,
            page: wd.page,
            quest: wd.quest,
            found: wd.found,
            seek: wd.hideRound,
            done: !wd.talk ? wd.justDone : 0,
          });
      }
      /* la cámara sigue a Koki sin salirse del barrio (en puntos enteros: el pixel art no se ve borroso) */
      const camX = Math.round(Math.max(0, Math.min(wd.w * TILE - VW, wd.x - VW / 2)));
      const camY = Math.round(Math.max(0, Math.min(wd.h * TILE - VH, wd.y - VH / 2)));
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(barrio, -camX, -camY);
      /* los de adelante tapan a los de atrás: se dibujan de arriba hacia abajo */
      const things: { y: number; draw: () => void }[] = [];
      const shadow = (x: number, y: number) => {
        ctx.fillStyle = "rgba(20,50,20,.35)";
        ctx.fillRect(Math.round(x - 5 - camX), Math.round(y + 7 - camY), 10, 2);
      };
      if (wd.quest === 1)
        for (const c of wd.cakes)
          if (!c.taken)
            things.push({
              y: c.y,
              draw: () => {
                const bob = Math.round(Math.sin(wd.frame * 0.08 + c.x) * 1.5);
                ctx.drawImage(cake, Math.round(c.x - 4 - camX), Math.round(c.y - 6 + bob - camY));
              },
            });
      for (const n of wd.npcs)
        if (!n.hidden)
          things.push({
            y: n.y,
            draw: () => {
              shadow(n.x, n.y);
              const idle = Math.floor((wd.frame + n.x) / 40) % 2;
              ctx.drawImage(
                spr[n.who][idle],
                Math.round(n.x - 8 - camX),
                Math.round(n.y - 9 - camY),
              );
              /* el "!" de quien tiene un encargo nuevo: Gufi (el 1 y el 2) y el Ratón (el 3) */
              const ask =
                n.who === "gufi"
                  ? wd.quest === 0 || wd.quest === 2
                  : n.who === "raton" && wd.quest === 5;
              if (ask && nearby(wd) !== n) {
                /* el "!" de quien tiene un encargo */
                const by = Math.round(n.y - 22 - camY + Math.sin(wd.frame * 0.1) * 1.5);
                ctx.fillStyle = "#3b2a1a";
                ctx.fillRect(n.x - 2 - camX, by - 1, 5, 10);
                ctx.fillStyle = "#ffe14d";
                ctx.fillRect(n.x - 1 - camX, by, 3, 5);
                ctx.fillRect(n.x - 1 - camX, by + 6, 3, 2);
              }
            },
          });
      things.push({
        y: wd.y,
        draw: () => {
          shadow(wd.x, wd.y);
          const pose = wd.moving ? Math.floor(wd.frame / 8) % 2 : 0;
          ctx.save();
          ctx.translate(Math.round(wd.x - camX), Math.round(wd.y - 9 - camY));
          if (wd.face < 0) ctx.scale(-1, 1);
          ctx.drawImage(spr.koki[pose], -8, 0);
          ctx.restore();
        },
      });
      things.sort((a, b) => a.y - b.y).forEach((t) => t.draw());
      /* jugando a las escondidas: las hojas se mueven cerca del escondite de verdad */
      const r = !wd.talk && rustle(wd);
      if (r && Math.floor(wd.frame / 6) % 2) {
        ctx.fillStyle = "#e9ffd9";
        for (const [ox, oy] of [
          [-7, -6],
          [6, -8],
          [-2, -11],
          [8, -2],
        ])
          ctx.fillRect(Math.round(r.x + ox - camX), Math.round(r.y + oy - camY), 2, 1);
      }
      /* "A" sobre quien se puede hablar (o el rincón que se puede revisar) */
      const near = !wd.talk && nearby(wd);
      const spot = !wd.talk && !near ? nearSpot(wd) : -1;
      const target = near
        ? near
        : spot >= 0
          ? { x: SPOTS[spot].tx * TILE + TILE / 2, y: SPOTS[spot].ty * TILE + TILE / 2 + 6 }
          : null;
      if (target) {
        const bx = Math.round(target.x - camX),
          by = Math.round(target.y - 24 - camY);
        ctx.fillStyle = "#1a1030";
        ctx.fillRect(bx - 5, by - 5, 11, 10);
        ctx.fillStyle = "#fff";
        ctx.fillRect(bx - 4, by - 4, 9, 8);
        ctx.fillStyle = "#1a1030";
        ctx.font = "8px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("A", bx + 0.5, by + 0.5);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    if (import.meta.env.DEV)
      (window as unknown as { __kokiAdventure: unknown }).__kokiAdventure =
        worldRef; /* para probarlo */
    return () => cancelAnimationFrame(raf);
  }, [screen]);

  const start = () => {
    worldRef.current = newWorld();
    setUi({ talk: null, page: 0, quest: 0, found: 0, seek: 0, done: 0 });
    setScreen("playing");
  };
  const hold = (key: keyof Pad) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      touch.current[key] = true;
    },
    onPointerUp: () => {
      touch.current[key] = false;
    },
    onPointerCancel: () => {
      touch.current[key] = false;
    },
    onPointerLeave: () => {
      touch.current[key] = false;
    },
  });
  /* tocar el diálogo lo avanza (como apretar A) */
  const tapTalk = () => {
    touch.current.act = true;
    setTimeout(() => {
      touch.current.act = false;
    }, 60);
  };
  const line = ui.talk?.[ui.page];
  const face = line && FACES[line.who];
  const box = "rounded-md border-4 border-white bg-[#1a1030] shadow-[0_0_0_4px_#1a1030] text-white";
  const btn =
    "pointer-events-auto select-none touch-none bg-white/25 border-2 border-white/70 text-white flex items-center justify-center active:bg-white/50";

  return (
    <div
      className="fixed inset-0 bg-[#0d1226] flex items-center justify-center overflow-hidden"
      style={{ fontFamily: "KokiPixel, system-ui, sans-serif", fontVariantLigatures: "none" }}
    >
      <style>{`@font-face { font-family: KokiPixel; src: url("${pixelFont}"); }`}</style>
      <div
        className="relative w-full"
        style={{
          aspectRatio: `${VW} / ${VH}`,
          maxHeight: "100vh",
          maxWidth: `calc(100vh * ${VW / VH})`,
        }}
      >
        <canvas
          ref={canvasRef}
          width={VW}
          height={VH}
          className="absolute inset-0 w-full h-full"
          style={{ imageRendering: "pixelated" }}
        />
        {screen === "playing" && (
          <>
            {ui.quest > 0 && (
              <div
                className={`${box} absolute left-2 top-2 px-3 py-1 text-[clamp(11px,2.2vw,20px)]`}
              >
                {ui.quest === 1 ? (
                  <>
                    📜 <span className="text-[#ffe14d]">Encargo:</span> los pastelitos de Gufi · 🧁{" "}
                    {ui.found}/3
                  </>
                ) : ui.quest === 3 ? (
                  <>
                    📜 <span className="text-[#ffe14d]">Encargo:</span> pilla al Taz
                  </>
                ) : ui.quest === 4 ? (
                  <>
                    📜 <span className="text-[#ffe14d]">Encargo:</span> lleva al Taz donde Gufi
                  </>
                ) : ui.quest === 6 ? (
                  <>
                    📜 <span className="text-[#ffe14d]">Encargo:</span> encuentra al Ratón · 🐭{" "}
                    {ui.seek}/3
                  </>
                ) : (
                  <>✅ Encargo cumplido</>
                )}
              </div>
            )}
            {line && (
              <div
                onPointerDown={tapTalk}
                className={`${box} absolute left-[2.5%] right-[2.5%] bottom-[3%] h-[28%] flex gap-[2%] p-[1.5%] cursor-pointer`}
              >
                {face && (
                  <div
                    className="h-full aspect-square flex-none rounded-md border-4 border-[#ffe14d]"
                    style={{
                      background: `#c99a5b url("${withFallback(face.src)}") ${face.pos} / ${face.size} no-repeat`,
                    }}
                  />
                )}
                <div className="min-w-0">
                  {NAMES[line.who] && (
                    <div className="inline-block rounded bg-[#ffe14d] px-2 text-[#1a1030] text-[clamp(10px,2vw,18px)] mb-1">
                      {NAMES[line.who]}
                    </div>
                  )}
                  <div className="text-[clamp(12px,2.5vw,24px)] leading-snug">{line.text}</div>
                </div>
                <div className="absolute right-3 bottom-1 text-[#ffe14d] animate-pulse">▼</div>
              </div>
            )}
            {ui.done > 0 && (
              <div className={`${box} absolute inset-x-[15%] top-[18%] p-4 text-center`}>
                <div className="text-[clamp(16px,3.5vw,32px)] text-[#ffe14d]">
                  ¡Encargo cumplido!
                </div>
                <div className="text-[clamp(12px,2.4vw,22px)] mt-1">
                  {ui.done === 1
                    ? "Gufi tiene su once (casi entera) · 🧁 +30"
                    : ui.done === 2
                      ? "El Taz pidió perdón (más o menos) · 🧁 +40"
                      : "Le ganaste al Ratón a las escondidas · 🧁 +50"}
                </div>
                <div className="text-[clamp(11px,2vw,18px)] mt-1 opacity-75">
                  {ui.done === 1
                    ? "Gufi tiene algo más que pedirte…"
                    : ui.done === 2
                      ? "El Ratón se está aburriendo…"
                      : "Próximamente: la plaza y la feria del domingo…"}
                </div>
                <div className="flex gap-2 justify-center mt-3">
                  <button
                    className="rounded bg-[#ffe14d] text-[#1a1030] px-4 py-1"
                    onClick={() => {
                      worldRef.current.justDone = 0;
                      setUi((u) => ({ ...u, done: 0 }));
                    }}
                  >
                    Seguir paseando
                  </button>
                  {onExit && (
                    <button className="rounded bg-white/20 px-4 py-1" onClick={onExit}>
                      Salir
                    </button>
                  )}
                </div>
              </div>
            )}
            {!line && !ui.done && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute left-[2%] bottom-[4%] grid grid-cols-3 grid-rows-3 w-[26%] aspect-square gap-1 opacity-80">
                  <div />
                  <div className={`${btn} rounded-t-lg`} {...hold("up")}>
                    ▲
                  </div>
                  <div />
                  <div className={`${btn} rounded-l-lg`} {...hold("left")}>
                    ◀
                  </div>
                  <div className="bg-white/15" />
                  <div className={`${btn} rounded-r-lg`} {...hold("right")}>
                    ▶
                  </div>
                  <div />
                  <div className={`${btn} rounded-b-lg`} {...hold("down")}>
                    ▼
                  </div>
                  <div />
                </div>
                <div
                  className={`${btn} absolute right-[4%] bottom-[8%] w-[13%] aspect-square rounded-full text-2xl`}
                  {...hold("act")}
                >
                  A
                </div>
              </div>
            )}
          </>
        )}
        {screen === "title" && (
          <div className="absolute inset-0 bg-gradient-to-b from-[#0f1a33] via-[#3a4d78] to-[#f4a06a] flex flex-col items-center justify-center gap-3 p-4 text-white text-center">
            <img
              src={logoImg}
              alt="Koki Adventure"
              className="w-[68%] max-w-[620px] drop-shadow-2xl"
            />
            <div className="text-[clamp(12px,2.4vw,20px)] opacity-90">
              Encargo 1: los pastelitos de Gufi
            </div>
            <div className="text-[clamp(10px,1.8vw,15px)] opacity-75">
              Camina con la cruceta o las flechas · habla con A o espacio
            </div>
            <div className="flex gap-3">
              <button
                className="rounded bg-[#ffe14d] text-[#1a1030] px-8 py-2 text-xl"
                onClick={start}
              >
                ▶ JUGAR
              </button>
              {onExit && (
                <button className="rounded bg-white/20 px-6 py-2 text-xl" onClick={onExit}>
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
