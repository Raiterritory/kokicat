// Pantallas de la 2.9: misiones semanales + racha, el reto de hoy con su ranking, y la tienda de
// estilo (gorros, lentes y estelas) con una vista previa animada sobre el personaje elegido.
import { useEffect, useRef, useState } from "react";
import { weekMissions, loadWeekly, progressOf, claimMission, loadStreak, streakReward } from "./rewards";
import { dailyBoard, dailyState, todayTwist, daysLeftInWeek } from "./daily";
import { getPlayer, type BoardRow } from "./leaderboard";
import { SkinAvatar, drawSkinCharacter } from "./character-skins";
import { CHAR_BY_ID } from "./characters";
import {
  HATS, GLASSES, TRAILS, loadStyle, saveStyle, owns, ownedKey, drawAccessories,
  type HatId, type GlassesId, type TrailId, type Style,
} from "./accessories";
import { drawTrail, type TrailPoint } from "./trails";

const stop = (e: React.SyntheticEvent) => e.stopPropagation();
const panel = "flex max-h-[92vh] w-full max-w-sm flex-col rounded-3xl border-2 border-white/10 bg-gradient-to-b from-indigo-900 to-slate-900 p-5 text-white shadow-2xl";
const backBtn = "mt-4 w-full rounded-full bg-white/90 px-6 py-3 text-lg font-black text-slate-800 shadow-[0_4px_0_rgba(0,0,0,0.3)] active:translate-y-0.5";

/** "📜 Misiones": la racha arriba y las 3 misiones de la semana con su premio. */
export function MissionsModal({ onClose }: { onClose: () => void }) {
  const [, setTick] = useState(0);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener("koki-weekly", on);
    return () => window.removeEventListener("koki-weekly", on);
  }, []);
  const w = loadWeekly();
  const streak = loadStreak();
  const left = daysLeftInWeek();
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-4" onPointerDown={stop} onClick={stop}>
      <div className={panel}>
        <h2 className="text-2xl font-black">📜 Misiones</h2>
        <div className="mt-3 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 p-3">
          <div className="flex items-center justify-between">
            <div className="text-lg font-black">🔥 Racha: {streak.count} {streak.count === 1 ? "día" : "días"}</div>
            <div className="text-[11px] font-bold text-white/80">Mejor: {Math.max(streak.best, streak.count)}</div>
          </div>
          <div className="mt-1 flex gap-1">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className={`flex-1 rounded-md py-1 text-center text-[10px] font-black ${i < (streak.count % 7 || (streak.count ? 7 : 0)) ? "bg-yellow-300 text-orange-800" : "bg-black/25 text-white/60"}`}>
                {i === 6 ? "👑" : `${i + 1}`}
              </div>
            ))}
          </div>
          <div className="mt-1 text-[11px] font-semibold text-white/90">
            Juega una partida cada día. Mañana ganas {streakReward(streak.count + 1)} 🧁 · al día 7, la Corona de Viña 👑
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs font-bold text-white/70">
          <span>Misiones de la semana</span>
          <span>Se renuevan en {left} {left === 1 ? "día" : "días"}</span>
        </div>
        <div className="mt-2 flex-1 space-y-2 overflow-y-auto pr-1">
          {weekMissions().map((m) => {
            const cur = progressOf(w, m);
            const done = cur >= m.target;
            const claimed = w.claimed.includes(m.id);
            return (
              <div key={m.id} className={`rounded-xl px-3 py-2 ${claimed ? "bg-emerald-500/20 ring-1 ring-emerald-300/50" : done ? "bg-amber-400/20 ring-1 ring-amber-300/60" : "bg-white/5"}`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{m.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-black">{m.name}</div>
                    <div className="text-[11px] text-white/65">{m.desc}</div>
                  </div>
                  {claimed ? (
                    <span className="text-lg">✅</span>
                  ) : done ? (
                    <button
                      onClick={() => { const n = claimMission(m.id); if (n) setMsg(`+${n} 🧁 ¡bacán!`); }}
                      className="rounded-full bg-gradient-to-b from-amber-300 to-orange-500 px-3 py-1.5 text-xs font-black text-white shadow"
                    >
                      Cobrar {m.reward} 🧁
                    </button>
                  ) : (
                    <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-black text-white/70">{m.reward} 🧁</span>
                  )}
                </div>
                {!claimed && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-sky-400" style={{ width: `${(cur / m.target) * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-white/50">{cur}/{m.target}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {msg && <div className="mt-2 text-center text-sm font-black text-amber-300">{msg}</div>}
        <button onClick={onClose} className={backBtn}>← Volver</button>
      </div>
    </div>
  );
}

/** Ranking del reto de hoy (todos los que jugaron hoy, el tuyo marcado). */
export function DailyBoard({ compact }: { compact?: boolean }) {
  const [rows, setRows] = useState<BoardRow[] | "missing" | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    // un momento para que alcance a subir el puntaje recién hecho
    const t = setTimeout(() => void dailyBoard().then((r) => { if (alive) setRows(r); }), compact ? 1200 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [compact]);
  const me = getPlayer()?.id;
  if (rows === undefined) return <div className="py-3 text-center text-sm font-bold opacity-70">Cargando el ranking de hoy…</div>;
  if (rows === "missing") return <div className="py-3 text-center text-xs font-bold opacity-70">El ranking del día aún no está activado en el servidor.</div>;
  if (rows === null) return <div className="py-3 text-center text-sm font-bold opacity-70">Sin conexión, intenta más rato</div>;
  if (!rows.length) return <div className="py-3 text-center text-sm font-bold opacity-70">Nadie ha jugado hoy todavía. ¡Sé la primera!</div>;
  const pos = rows.findIndex((r) => r.id === me);
  const shown = compact ? rows.slice(0, 3) : rows;
  return (
    <div className="space-y-1">
      {compact && pos >= 0 && (
        <div className="text-center text-sm font-black">Quedaste #{pos + 1} de {rows.length} hoy</div>
      )}
      {!getPlayer() && <div className="text-center text-[11px] font-bold opacity-70">Crea tu usuario en Ranking para aparecer aquí</div>}
      {shown.map((r, i) => (
        <div key={r.id} className={`flex items-center gap-2 rounded-xl px-3 py-1.5 ${r.id === me ? "bg-amber-400/30 ring-1 ring-amber-300" : "bg-black/10"}`}>
          <span className="w-6 text-center text-sm font-black">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
          <SkinAvatar skin={r.skin ?? "koki"} className="h-7 w-7" />
          <span className="flex-1 truncate text-sm font-bold">{r.nickname}</span>
          <span className="text-sm font-black">{r.score}</span>
        </div>
      ))}
    </div>
  );
}

export function DailyBoardModal({ onClose }: { onClose: () => void }) {
  const tw = todayTwist();
  const st = dailyState();
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onPointerDown={stop} onClick={stop}>
      <div className={panel}>
        <h2 className="text-2xl font-black">🗓️ Ranking de hoy</h2>
        <div className="mt-1 text-xs font-bold text-white/70">{tw.icon} {tw.name} · {st?.done ? `tu puntaje: ${st.score}` : "aún no juegas hoy"}</div>
        <div className="mt-3 flex-1 overflow-y-auto pr-1"><DailyBoard /></div>
        <button onClick={onClose} className={backBtn}>← Volver</button>
      </div>
    </div>
  );
}

// ---- tienda de estilo ----

type Kind = "hat" | "glasses" | "trail";

/** Small animated canvas: the chosen character with a hat/glasses on, or flying with a trail. */
function StylePreview({ charId, hat, glasses, trail, className }: { charId: string; hat: HatId | null; glasses: GlassesId | null; trail?: TrailId; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = CHAR_BY_ID[charId] ?? CHAR_BY_ID.koki;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = c.url;
    let raf = 0, frame = 0;
    const pts: TrailPoint[] = [];
    const draw = () => {
      const cv = ref.current;
      const ctx = cv?.getContext("2d");
      if (!cv || !ctx) return;
      frame++;
      ctx.clearRect(0, 0, cv.width, cv.height);
      const W = cv.width, H = cv.height;
      let size = W * 0.62, x = W / 2, y = H / 2;
      if (trail) {
        size = W * 0.4; x = W * 0.68; y = H / 2 + Math.sin(frame * 0.08) * H * 0.12;
        for (const p of pts) p.x -= 2.6;
        pts.push({ x, y, f: frame });
        while (pts.length && pts[0].x < -20) pts.shift();
        drawTrail(ctx, trail, pts, frame);
      }
      if (img.complete && img.naturalWidth) {
        ctx.save();
        ctx.translate(x, y);
        if (c.filter) ctx.filter = c.filter;
        if (c.fx) drawSkinCharacter(ctx, img, c.fx, -size / 2, -size / 2, size, size);
        else ctx.drawImage(img, -size / 2, -size / 2, size, size);
        ctx.filter = "none";
        drawAccessories(ctx, c.base, hat, glasses, -size / 2, -size / 2, size, frame);
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [charId, hat, glasses, trail]);
  return <canvas ref={ref} width={180} height={150} className={className} />;
}

/**
 * Gorros, lentes o estelas: comprar con pastelitos, ponerse y sacarse. Se combinan con cualquier
 * personaje (la vista previa usa el que tienes elegido).
 */
export function StyleShop({ kind, charId, coins, onSpend }: { kind: Kind; charId: string; coins: number; onSpend: (n: number) => void }) {
  const [style, setStyle] = useState<Style>(() => loadStyle());
  useEffect(() => {
    const on = () => setStyle(loadStyle());
    window.addEventListener("koki-style", on);
    return () => window.removeEventListener("koki-style", on);
  }, []);
  const items = kind === "hat" ? HATS : kind === "glasses" ? GLASSES : TRAILS;
  const worn = kind === "hat" ? style.hat : kind === "glasses" ? style.glasses : style.trail;
  const wear = (id: string | null) => {
    const s = { ...loadStyle() };
    if (kind === "hat") s.hat = id as HatId | null;
    else if (kind === "glasses") s.glasses = id as GlassesId | null;
    else s.trail = (id ?? "arcoiris") as TrailId;
    saveStyle(s);
  };
  const tap = (id: string, price: number, streak?: boolean) => {
    const s = loadStyle();
    if (owns(s, kind, id)) { wear(worn === id && kind !== "trail" ? null : id); return; }
    if (streak || coins < price) return;
    s.owned.push(ownedKey(kind, id));
    saveStyle(s);
    onSpend(price);
    wear(id);
  };
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((it) => {
        const have = owns(style, kind, it.id);
        const on = worn === it.id;
        return (
          <button
            key={it.id}
            onClick={(e) => { e.stopPropagation(); tap(it.id, it.price, it.streak); }}
            className={`flex flex-col items-center gap-1 rounded-2xl p-2 transition-transform active:scale-95 ${on ? "bg-gradient-to-b from-amber-300 to-orange-500 ring-4 ring-yellow-200" : have ? "bg-white/15" : "bg-white/10"}`}
          >
            <StylePreview
              charId={charId}
              hat={kind === "hat" ? (it.id as HatId) : null}
              glasses={kind === "glasses" ? (it.id as GlassesId) : null}
              trail={kind === "trail" ? (it.id as TrailId) : undefined}
              className={`h-[75px] w-[90px] ${have ? "" : "opacity-60"}`}
            />
            <div className="text-xs font-black leading-tight text-white">{it.name}</div>
            <div className="text-[10px] leading-tight text-white/70">{it.desc}</div>
            {have ? (
              <div className="text-[10px] font-bold uppercase tracking-wider text-white">{on ? (kind === "trail" ? "Puesta" : "Puesto · tocar para sacar") : "Tocar para poner"}</div>
            ) : it.streak ? (
              <div className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-black text-white/80">🔥 Racha de 7 días</div>
            ) : (
              <div className={`rounded-full px-2 py-0.5 text-[11px] font-black ${coins >= it.price ? "bg-pink-500 text-white" : "bg-white/20 text-white/60"}`}>🧁 {it.price}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** El personaje elegido con todo puesto (arriba de la tienda). */
export function OutfitPreview({ charId }: { charId: string }) {
  const [style, setStyle] = useState<Style>(() => loadStyle());
  useEffect(() => {
    const on = () => setStyle(loadStyle());
    window.addEventListener("koki-style", on);
    return () => window.removeEventListener("koki-style", on);
  }, []);
  return <StylePreview charId={charId} hat={style.hat} glasses={style.glasses} trail={style.trail} className="mx-auto h-[110px] w-[132px]" />;
}
