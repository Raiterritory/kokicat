// Las estelas que deja el personaje al volar (se eligen aparte del personaje, en Personajes → Estelas).
// Cada punto de la estela recuerda en qué cuadro nació (f), así los dibujos quedan pegados a su punto.
import type { TrailId } from "./accessories";

export type TrailPoint = { x: number; y: number; f: number };

const hash = (n: number) => { const v = Math.sin(n * 127.1) * 43758.5453; return v - Math.floor(v); };

export function drawTrail(ctx: CanvasRenderingContext2D, id: TrailId, pts: TrailPoint[], frame: number) {
  if (pts.length < 4) return;
  ctx.save();
  switch (id) {
    case "asado": fire(ctx, pts, frame); break;
    case "festival": stars(ctx, pts, frame); break;
    case "piscola": bubbles(ctx, pts, frame); break;
    case "cumbia": notes(ctx, pts, frame); break;
    case "chispazo": spark(ctx, pts, frame); break;
    case "quiltro": paws(ctx, pts); break;
    case "sopaipillas": sopaipillas(ctx, pts, frame); break;
    case "dieciocho": flags(ctx, pts, frame); break;
    default: rainbow(ctx, pts, frame);
  }
  ctx.restore();
}

/** 0 at the tail, 1 next to the character. */
const life = (i: number, n: number) => i / (n - 1);

function fire(ctx: CanvasRenderingContext2D, pts: TrailPoint[], frame: number) {
  const n = pts.length;
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < n; i += 2) {
    const p = pts[i], t = life(i, n), age = 1 - t;
    const r = 4 + 13 * t * (0.7 + 0.3 * hash(p.f));
    const y = p.y - age * 26 + Math.sin(p.f * 0.9 + frame * 0.3) * 3 * age;
    const g = ctx.createRadialGradient(p.x, y, 0, p.x, y, r);
    g.addColorStop(0, `rgba(255,240,150,${0.9 * t})`);
    g.addColorStop(0.4, `rgba(255,140,20,${0.75 * t})`);
    g.addColorStop(1, "rgba(200,30,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x, y, r, 0, Math.PI * 2); ctx.fill();
  }
}

function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const rr = k % 2 ? r * 0.45 : r, a = rot + (k * Math.PI) / 5;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function stars(ctx: CanvasRenderingContext2D, pts: TrailPoint[], frame: number) {
  const n = pts.length;
  const cols = ["#fff36b", "#ffffff", "#ffd1f0", "#9fe8ff"];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    if (p.f % 4) continue;
    const t = life(i, n);
    const off = (hash(p.f) - 0.5) * 30 * (1 - t);
    ctx.globalAlpha = t;
    ctx.fillStyle = cols[p.f % cols.length];
    starPath(ctx, p.x, p.y + off, 3 + 6 * t, frame * 0.08 + p.f);
    ctx.fill();
  }
}

function bubbles(ctx: CanvasRenderingContext2D, pts: TrailPoint[], frame: number) {
  const n = pts.length;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    if (p.f % 3) continue;
    const t = life(i, n), age = 1 - t;
    const r = 3 + 7 * hash(p.f + 3);
    const x = p.x + Math.sin(frame * 0.1 + p.f) * 4 * age;
    const y = p.y + (hash(p.f) - 0.5) * 20 - age * 40;
    ctx.globalAlpha = 0.2 + 0.7 * t;
    ctx.fillStyle = "rgba(200,240,255,0.25)";
    ctx.strokeStyle = "rgba(230,250,255,0.9)";
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, Math.PI * 2); ctx.fill();
  }
}

function notes(ctx: CanvasRenderingContext2D, pts: TrailPoint[], frame: number) {
  const n = pts.length;
  const cols = ["#ff5fa2", "#ffd23f", "#4fd1ff", "#7dff8a"];
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    if (p.f % 7) continue;
    const t = life(i, n), age = 1 - t;
    ctx.globalAlpha = t;
    ctx.fillStyle = cols[(p.f / 7) % cols.length | 0];
    ctx.font = `bold ${Math.round(12 + 10 * t)}px system-ui, sans-serif`;
    const y = p.y - age * 30 + Math.sin(frame * 0.15 + p.f) * 6;
    ctx.save();
    ctx.translate(p.x, y);
    ctx.rotate(Math.sin(frame * 0.12 + p.f) * 0.35);
    ctx.fillText((p.f / 7) % 2 ? "♫" : "♪", 0, 0);
    ctx.restore();
  }
}

function spark(ctx: CanvasRenderingContext2D, pts: TrailPoint[], frame: number) {
  const n = pts.length;
  // un rayo eléctrico que cambia de forma cada pocos cuadros
  const seed = Math.floor(frame / 3);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [w, color, a] of [[9, "#2fb8ff", 0.35], [3.5, "#e9fbff", 1]] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    for (let i = 0; i < n; i += 3) {
      const t = life(i, n);
      const j = (hash(seed * 31 + i) - 0.5) * 18 * (0.3 + t);
      ctx.globalAlpha = a;
      if (i === 0) ctx.moveTo(pts[i].x, pts[i].y + j); else ctx.lineTo(pts[i].x, pts[i].y + j);
    }
    ctx.stroke();
  }
  // chispas sueltas
  ctx.fillStyle = "#fff36b";
  for (let k = 0; k < 5; k++) {
    const i = Math.floor(hash(seed + k * 7) * n);
    ctx.globalAlpha = life(i, n);
    ctx.fillRect(pts[i].x + (hash(k + seed) - 0.5) * 20, pts[i].y + (hash(k * 3 + seed) - 0.5) * 20, 3, 3);
  }
}

function paws(ctx: CanvasRenderingContext2D, pts: TrailPoint[]) {
  const n = pts.length;
  ctx.fillStyle = "#5b3a29";
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    if (p.f % 9) continue;
    const t = life(i, n);
    const side = (p.f / 9) % 2 ? -1 : 1;
    const x = p.x, y = p.y + side * 9, s = 4 + 3 * t;
    ctx.globalAlpha = 0.25 + 0.75 * t;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    ctx.beginPath(); ctx.ellipse(0, s * 0.4, s * 0.9, s * 0.75, 0, 0, Math.PI * 2); ctx.fill();
    for (let k = 0; k < 4; k++) {
      const a = -Math.PI / 2 + (k - 1.5) * 0.55;
      ctx.beginPath(); ctx.arc(Math.cos(a) * s * 1.35, Math.sin(a) * s * 1.35 + s * 0.2, s * 0.36, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

function sopaipillas(ctx: CanvasRenderingContext2D, pts: TrailPoint[], frame: number) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    if (p.f % 6) continue;
    const t = life(i, n), age = 1 - t;
    const r = 5 + 5 * t;
    const x = p.x, y = p.y + (hash(p.f) - 0.5) * 16 + age * age * 50;
    ctx.globalAlpha = 0.3 + 0.7 * t;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(frame * 0.05 + p.f);
    // la sopaipilla: redonda, dorada, con su rayita de mostaza
    ctx.fillStyle = "#e3962f";
    ctx.strokeStyle = "#a35f12";
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#f2b65a";
    ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.25, r * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#ffd400";
    ctx.lineWidth = Math.max(1, r * 0.25);
    ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.quadraticCurveTo(0, -r * 0.5, r * 0.6, 0.2); ctx.stroke();
    ctx.restore();
  }
}

function flags(ctx: CanvasRenderingContext2D, pts: TrailPoint[], frame: number) {
  const n = pts.length;
  // un cordel con banderitas chilenas, como en las fondas
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < n; i++) { if (i === 0) ctx.moveTo(pts[i].x, pts[i].y); else ctx.lineTo(pts[i].x, pts[i].y); }
  ctx.stroke();
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    if (p.f % 8) continue;
    const t = life(i, n);
    const w = 10 + 6 * t, h = w * 0.66;
    ctx.globalAlpha = 0.35 + 0.65 * t;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.sin(frame * 0.2 + p.f) * 0.15);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h / 2);
    ctx.fillStyle = "#d52b1e"; ctx.fillRect(0, h / 2, w, h / 2);
    ctx.fillStyle = "#0039a6"; ctx.fillRect(0, 0, w / 3, h / 2);
    ctx.fillStyle = "#ffffff"; starPath(ctx, w / 6, h / 4, h * 0.15, -Math.PI / 2); ctx.fill();
    ctx.restore();
  }
}

/** La cinta arcoíris de siempre: curvas suaves, se afina hacia la cola, con brillo y destellos. */
function rainbow(ctx: CanvasRenderingContext2D, pts: TrailPoint[], frame: number) {
  const bands = ["#ff3b3b", "#ff9a2d", "#ffe62d", "#3ddc4a", "#2d9bff", "#a44bff"];
  const bandH = 6;
  const total = bands.length * bandH;
  const n = pts.length;
  // suavizado: promedio de vecinos para quitar los saltos del aleteo
  const sm = pts.map((p, i) => ({
    x: p.x,
    y: (pts[Math.max(0, i - 2)].y + pts[Math.max(0, i - 1)].y + p.y + pts[Math.min(n - 1, i + 1)].y) / 4,
  }));
  const tailX = sm[0].x, headX = sm[n - 1].x;
  // ancho relativo: fino en la cola, completo junto a Koki
  const widthAt = (i: number) => 0.3 + 0.7 * (i / (n - 1));
  const smoothPath = (offset: number) => {
    ctx.beginPath();
    ctx.moveTo(sm[0].x, sm[0].y + offset * widthAt(0));
    for (let i = 1; i < n - 1; i++) {
      const mx = (sm[i].x + sm[i + 1].x) / 2;
      const my = (sm[i].y * widthAt(i) + sm[i + 1].y * widthAt(i + 1)) / (widthAt(i) + widthAt(i + 1));
      const mo = offset * (widthAt(i) + widthAt(i + 1)) / 2;
      ctx.quadraticCurveTo(sm[i].x, sm[i].y + offset * widthAt(i), mx, my + mo);
    }
    ctx.lineTo(sm[n - 1].x, sm[n - 1].y + offset);
  };
  const fade = (color: string, maxAlpha: number) => {
    const gr = ctx.createLinearGradient(tailX, 0, headX, 0);
    gr.addColorStop(0, `${color}00`);
    gr.addColorStop(0.35, `${color}${Math.round(maxAlpha * 0.55 * 255).toString(16).padStart(2, "0")}`);
    gr.addColorStop(1, `${color}${Math.round(maxAlpha * 255).toString(16).padStart(2, "0")}`);
    return gr;
  };
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // brillo suave detrás de la cinta
  ctx.lineWidth = total + 10;
  ctx.strokeStyle = fade("#ffffff", 0.22);
  smoothPath(0);
  ctx.stroke();
  // las seis franjas
  ctx.lineWidth = bandH + 0.8;
  bands.forEach((color, bi) => {
    ctx.strokeStyle = fade(color, 0.95);
    smoothPath(-total / 2 + bandH / 2 + bi * bandH);
    ctx.stroke();
  });
  // destellos que titilan a lo largo de la cinta
  for (let k = 0; k < 6; k++) {
    const i = Math.floor(((frame * 0.7 + k * 37) % (n - 2))) + 1;
    const t = i / (n - 1);
    const tw = 0.5 + 0.5 * Math.sin(frame * 0.3 + k * 1.7);
    const s = (2 + 3 * tw) * (0.5 + 0.5 * t);
    const x = sm[i].x, y = sm[i].y + Math.sin(k * 2.3 + frame * 0.05) * total * 0.45 * widthAt(i);
    ctx.globalAlpha = t * (0.4 + 0.6 * tw);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(x, y - s * 2); ctx.lineTo(x + s * 0.5, y - s * 0.5); ctx.lineTo(x + s * 2, y);
    ctx.lineTo(x + s * 0.5, y + s * 0.5); ctx.lineTo(x, y + s * 2); ctx.lineTo(x - s * 0.5, y + s * 0.5);
    ctx.lineTo(x - s * 2, y); ctx.lineTo(x - s * 0.5, y - s * 0.5);
    ctx.closePath();
    ctx.fill();
  }
}
