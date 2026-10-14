// Accesorios combinables (un gorro + unos lentes) que se ponen sobre cualquier personaje, y la
// estela elegida aparte. Todo se dibuja con trazos (sin imágenes), así se ve igual en todos lados.
// Lo comprado y lo puesto se guarda en "koki-style" (viaja con el respaldo en la nube).

export type HatId = "huaso" | "fonda" | "jockey" | "calchona" | "sopaipillero" | "minero" | "corona" | "aureola";
export type GlassesId = "flaite" | "enamorao" | "cine3d" | "cuico" | "farandula" | "lanza";
export type TrailId = "arcoiris" | "asado" | "festival" | "piscola" | "cumbia" | "chispazo" | "quiltro" | "sopaipillas" | "dieciocho";

export type StyleItem<T extends string> = {
  id: T;
  name: string;
  desc: string;
  price: number;
  /** no se compra: es premio de la racha de 7 días */
  streak?: boolean;
};

export const HATS: StyleItem<HatId>[] = [
  { id: "huaso", name: "Chupalla de huaso", desc: "Pa' la ramada", price: 120 },
  { id: "fonda", name: "Gorro de fonda", desc: "Dieciochero todo el año", price: 90 },
  { id: "jockey", name: "Jockey con hélice", desc: "El flaite volador", price: 160 },
  { id: "calchona", name: "Sombrero de la Calchona", desc: "Asusta a los jefes", price: 150 },
  { id: "sopaipillero", name: "Gorro de sopaipillero", desc: "Con mostaza o con pebre", price: 110 },
  { id: "minero", name: "Casco de minero", desc: "Con linterna y todo", price: 200 },
  { id: "aureola", name: "Aureola de santito", desc: "Yo no fui", price: 250 },
  { id: "corona", name: "Corona de Viña", desc: "Premio: 7 días seguidos jugando", price: 0, streak: true },
];

export const GLASSES: StyleItem<GlassesId>[] = [
  { id: "flaite", name: "Lentes de flaite", desc: "Oscuros y envolventes", price: 90 },
  { id: "enamorao", name: "Lentes de enamorao", desc: "Ella no te ama, pero igual", price: 120 },
  { id: "cine3d", name: "Lentes 3D del cine", desc: "Robados de la sala", price: 100 },
  { id: "cuico", name: "Monóculo cuico", desc: "Desde Lo Barnechea", price: 160 },
  { id: "farandula", name: "Lentes de farándula", desc: "Pa' salir en la tele", price: 150 },
  { id: "lanza", name: "Antifaz de lanza", desc: "Nadie te reconoce", price: 130 },
];

export const TRAILS: StyleItem<TrailId>[] = [
  { id: "arcoiris", name: "Arcoíris", desc: "La clásica", price: 0 },
  { id: "asado", name: "Fuego de asado", desc: "Como parrilla de domingo", price: 150 },
  { id: "festival", name: "Estrellas de Viña", desc: "Gaviota de plata incluida", price: 160 },
  { id: "piscola", name: "Burbujas de piscola", desc: "Pura bebida, eso sí", price: 120 },
  { id: "cumbia", name: "Cumbia ranchera", desc: "Notas que se mueven solas", price: 180 },
  { id: "chispazo", name: "Chispazo del poste", desc: "Cayó una gota y se cortó la luz", price: 220 },
  { id: "quiltro", name: "Huellitas de quiltro", desc: "Te sigue a todas partes", price: 200 },
  { id: "sopaipillas", name: "Lluvia de sopaipillas", desc: "Pasadas y con mostaza", price: 250 },
  { id: "dieciocho", name: "Banderitas del 18", desc: "Viva Chile, mierda", price: 180 },
];

export type Style = { hat: HatId | null; glasses: GlassesId | null; trail: TrailId; owned: string[] };
const KEY = "koki-style";

export function loadStyle(): Style {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<Style>;
    return { hat: s.hat ?? null, glasses: s.glasses ?? null, trail: s.trail ?? "arcoiris", owned: Array.isArray(s.owned) ? s.owned : [] };
  } catch {
    return { hat: null, glasses: null, trail: "arcoiris", owned: [] };
  }
}
export function saveStyle(s: Style) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* sin almacenamiento */ }
  window.dispatchEvent(new Event("koki-style"));
}
/** Ids are prefixed by kind so a hat and a trail never share one: "hat:huaso", "trail:asado". */
export const ownedKey = (kind: "hat" | "glasses" | "trail", id: string) => `${kind}:${id}`;
export function owns(s: Style, kind: "hat" | "glasses" | "trail", id: string) {
  if (kind === "trail" && id === "arcoiris") return true;
  return s.owned.includes(ownedKey(kind, id));
}
export function grantItem(kind: "hat" | "glasses" | "trail", id: string) {
  const s = loadStyle();
  if (owns(s, kind, id)) return;
  s.owned.push(ownedKey(kind, id));
  saveStyle(s);
}

// ---- dónde va la cabeza de cada personaje (en la imagen estirada a un cuadrado, 0..1) ----
type Anchor = { eyeX: number; eyeY: number; spacing: number; angle: number; topX: number; topY: number; headW: number; oneEye?: boolean };
const ANCHORS: Record<string, Anchor> = {
  koki: { eyeX: 0.735, eyeY: 0.33, spacing: 0.14, angle: -0.24, topX: 0.73, topY: 0.16, headW: 0.34 },
  taz: { eyeX: 0.69, eyeY: 0.285, spacing: 0.3, angle: 0.02, topX: 0.67, topY: 0.13, headW: 0.52 },
  gufi: { eyeX: 0.61, eyeY: 0.385, spacing: 0.13, angle: -0.2, topX: 0.6, topY: 0.23, headW: 0.3 },
  raton: { eyeX: 0.64, eyeY: 0.215, spacing: 0.12, angle: 0.12, topX: 0.6, topY: 0.12, headW: 0.28, oneEye: true },
  "bola-nieve": { eyeX: 0.6, eyeY: 0.45, spacing: 0.41, angle: 0.04, topX: 0.57, topY: 0.22, headW: 0.66 },
};

/**
 * Draws the hat and glasses over a character drawn at (x, y, size×size) in the current transform
 * (call it right after drawing the character, with the same rotation/squash).
 */
export function drawAccessories(
  ctx: CanvasRenderingContext2D, base: string, hat: HatId | null, glasses: GlassesId | null,
  x: number, y: number, size: number, frame: number,
) {
  if (!hat && !glasses) return;
  const a = ANCHORS[base] ?? ANCHORS.koki;
  if (glasses) {
    ctx.save();
    ctx.translate(x + a.eyeX * size, y + a.eyeY * size);
    ctx.rotate(a.angle);
    drawGlasses(ctx, glasses, Math.max(a.spacing * size, size * 0.13), !!a.oneEye, frame);
    ctx.restore();
  }
  if (hat) {
    ctx.save();
    ctx.translate(x + a.topX * size, y + a.topY * size);
    ctx.rotate(a.angle * 0.8);
    drawHat(ctx, hat, Math.max(a.headW * size * 1.15, size * 0.36), frame);
    ctx.restore();
  }
}

const star = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, inner = 0.45, points = 5, rot = -Math.PI / 2) => {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 ? r * inner : r;
    const t = rot + (i * Math.PI) / points;
    ctx.lineTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr);
  }
  ctx.closePath();
};

/** Hat with its base centered at (0,0), w = width of the brim; it grows upwards (negative y). */
function drawHat(ctx: CanvasRenderingContext2D, id: HatId, w: number, frame: number) {
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1, w * 0.04);
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  switch (id) {
    case "huaso": {
      // ala ancha y plana, copa baja, cinta roja
      ctx.fillStyle = "#d9b26a";
      ctx.beginPath(); ctx.ellipse(0, 0, w * 0.75, w * 0.13, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#e6c27c";
      ctx.beginPath();
      ctx.moveTo(-w * 0.32, -w * 0.02); ctx.lineTo(-w * 0.3, -w * 0.32); ctx.lineTo(w * 0.3, -w * 0.32); ctx.lineTo(w * 0.32, -w * 0.02);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#d52b1e";
      ctx.fillRect(-w * 0.315, -w * 0.12, w * 0.63, w * 0.08);
      break;
    }
    case "fonda": {
      // cono con los colores de la bandera, pompón y estrellita
      ctx.save();
      ctx.beginPath(); ctx.moveTo(-w * 0.34, 0); ctx.lineTo(0, -w * 0.95); ctx.lineTo(w * 0.34, 0); ctx.closePath();
      ctx.clip();
      const cols = ["#0039a6", "#ffffff", "#d52b1e"];
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = cols[i % 3];
        ctx.fillRect(-w, -w * 0.95 + i * w * 0.14, w * 2, w * 0.14);
      }
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(-w * 0.34, 0); ctx.lineTo(0, -w * 0.95); ctx.lineTo(w * 0.34, 0); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(0, -w * 0.97, w * 0.1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fff";
      star(ctx, 0, -w * 0.45, w * 0.09); ctx.fill();
      break;
    }
    case "jockey": {
      // jockey con visera y una hélice que gira
      ctx.fillStyle = "#1e1e24";
      ctx.beginPath(); ctx.ellipse(w * 0.22, -w * 0.02, w * 0.42, w * 0.08, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#e23a3a";
      ctx.beginPath(); ctx.arc(0, 0, w * 0.36, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = `900 ${Math.round(w * 0.22)}px system-ui, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("CL", 0, -w * 0.15);
      ctx.strokeStyle = "#333";
      ctx.beginPath(); ctx.moveTo(0, -w * 0.36); ctx.lineTo(0, -w * 0.5); ctx.stroke();
      const spin = Math.cos(frame * 0.6);
      ctx.fillStyle = "#ffd23f";
      ctx.beginPath(); ctx.ellipse(-w * 0.2 * spin, -w * 0.52, w * 0.2 * Math.abs(spin) + 1, w * 0.05, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#3fa9ff";
      ctx.beginPath(); ctx.ellipse(w * 0.2 * spin, -w * 0.52, w * 0.2 * Math.abs(spin) + 1, w * 0.05, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#333";
      ctx.beginPath(); ctx.arc(0, -w * 0.52, w * 0.04, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "calchona": {
      // sombrero de bruja, con la punta doblada y una hebilla
      ctx.fillStyle = "#3b1d5e";
      ctx.beginPath(); ctx.ellipse(0, 0, w * 0.62, w * 0.11, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w * 0.3, -w * 0.03);
      ctx.quadraticCurveTo(-w * 0.12, -w * 0.6, w * 0.05, -w * 0.82);
      ctx.quadraticCurveTo(w * 0.32, -w * 0.88, w * 0.42, -w * 0.7);
      ctx.quadraticCurveTo(w * 0.2, -w * 0.62, w * 0.3, -w * 0.03);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#7d4cc2";
      ctx.fillRect(-w * 0.29, -w * 0.15, w * 0.58, w * 0.09);
      ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = Math.max(1, w * 0.035);
      ctx.strokeRect(-w * 0.07, -w * 0.16, w * 0.14, w * 0.11);
      break;
    }
    case "sopaipillero": {
      // gorro de cocinero, inflado
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-w * 0.28, -w * 0.22, w * 0.56, w * 0.22);
      ctx.strokeRect(-w * 0.28, -w * 0.22, w * 0.56, w * 0.22);
      for (const [cx, cy, r] of [[-w * 0.2, -w * 0.38, w * 0.2], [w * 0.2, -w * 0.38, w * 0.2], [0, -w * 0.5, w * 0.24]] as const) {
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-w * 0.26, -w * 0.4, w * 0.52, w * 0.2);
      ctx.fillStyle = "#e9a23b";
      ctx.beginPath(); ctx.arc(w * 0.16, -w * 0.1, w * 0.07, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "minero": {
      // casco amarillo con linterna que alumbra hacia adelante
      ctx.fillStyle = "rgba(255,245,170,0.28)";
      ctx.beginPath(); ctx.moveTo(w * 0.12, -w * 0.25); ctx.lineTo(w * 1.6, -w * 0.6); ctx.lineTo(w * 1.6, w * 0.15); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffcc1a";
      ctx.beginPath(); ctx.ellipse(0, 0, w * 0.52, w * 0.08, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -w * 0.02, w * 0.38, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath(); ctx.moveTo(0, -w * 0.4); ctx.lineTo(0, -w * 0.05); ctx.stroke();
      ctx.fillStyle = "#555"; ctx.fillRect(w * 0.02, -w * 0.32, w * 0.16, w * 0.13);
      ctx.fillStyle = "#fff8c0"; ctx.beginPath(); ctx.arc(w * 0.1, -w * 0.255, w * 0.05, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "corona": {
      // corona dorada con joyas que brillan
      const g = ctx.createLinearGradient(0, -w * 0.45, 0, 0);
      g.addColorStop(0, "#fff3a0"); g.addColorStop(1, "#d99a00");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-w * 0.36, 0); ctx.lineTo(-w * 0.4, -w * 0.38); ctx.lineTo(-w * 0.18, -w * 0.2); ctx.lineTo(0, -w * 0.46);
      ctx.lineTo(w * 0.18, -w * 0.2); ctx.lineTo(w * 0.4, -w * 0.38); ctx.lineTo(w * 0.36, 0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      const gems = ["#e3263a", "#2a7bff", "#21c46a"];
      gems.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc((i - 1) * w * 0.2, -w * 0.09, w * 0.055, 0, Math.PI * 2); ctx.fill();
      });
      const tw = 0.5 + 0.5 * Math.sin(frame * 0.15);
      ctx.fillStyle = `rgba(255,255,255,${tw})`;
      star(ctx, w * 0.02, -w * 0.46, w * 0.08, 0.3, 4); ctx.fill();
      break;
    }
    case "aureola": {
      // anillo dorado que flota (sube y baja) sobre la cabeza
      const yy = -w * 0.32 + Math.sin(frame * 0.08) * w * 0.05;
      ctx.save();
      ctx.shadowColor = "#ffe36b"; ctx.shadowBlur = w * 0.3;
      ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = Math.max(2, w * 0.09);
      ctx.beginPath(); ctx.ellipse(0, yy, w * 0.36, w * 0.1, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      break;
    }
  }
}

/** Glasses centered between the eyes; s = distance between the eyes. */
function drawGlasses(ctx: CanvasRenderingContext2D, id: GlassesId, s: number, oneEye: boolean, frame: number) {
  const r = s * 0.42;
  const eyes = oneEye ? [0] : [-s / 2, s / 2];
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1, s * 0.09);
  const bridge = (color: string) => {
    if (oneEye) return;
    ctx.strokeStyle = color;
    ctx.beginPath(); ctx.moveTo(-s / 2 + r * 0.9, -r * 0.1); ctx.quadraticCurveTo(0, -r * 0.45, s / 2 - r * 0.9, -r * 0.1); ctx.stroke();
  };
  switch (id) {
    case "flaite": {
      // lentes envolventes, negros con un brillo que cruza
      const g = ctx.createLinearGradient(-s, -r, s, r);
      g.addColorStop(0, "#111"); g.addColorStop(0.45, "#333"); g.addColorStop(0.5, "#6a6a7a"); g.addColorStop(0.55, "#222"); g.addColorStop(1, "#000");
      ctx.fillStyle = g;
      const half = oneEye ? r * 1.25 : s / 2 + r * 1.05;
      ctx.beginPath();
      ctx.moveTo(-half, -r * 0.75); ctx.quadraticCurveTo(0, -r * 1.05, half, -r * 0.75);
      ctx.quadraticCurveTo(half + r * 0.1, r * 0.75, half - r * 0.6, r * 0.8);
      ctx.quadraticCurveTo(0, r * 0.35, -half + r * 0.6, r * 0.8);
      ctx.quadraticCurveTo(-half - r * 0.1, r * 0.75, -half, -r * 0.75);
      ctx.closePath(); ctx.fill();
      break;
    }
    case "enamorao": {
      bridge("#b3123c");
      for (const ex of eyes) {
        const k = 1 + 0.08 * Math.sin(frame * 0.2);
        ctx.save(); ctx.translate(ex, 0); ctx.scale(k, k);
        ctx.fillStyle = "rgba(255,40,100,0.85)"; ctx.strokeStyle = "#b3123c";
        ctx.beginPath();
        ctx.moveTo(0, r * 0.9);
        ctx.bezierCurveTo(-r * 1.6, -r * 0.2, -r * 0.6, -r * 1.3, 0, -r * 0.45);
        ctx.bezierCurveTo(r * 0.6, -r * 1.3, r * 1.6, -r * 0.2, 0, r * 0.9);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case "cine3d": {
      bridge("#f5f5f5");
      eyes.forEach((ex, i) => {
        ctx.fillStyle = oneEye || i === 0 ? "rgba(255,40,40,0.75)" : "rgba(40,220,255,0.75)";
        ctx.strokeStyle = "#f5f5f5";
        ctx.fillRect(ex - r, -r * 0.7, r * 2, r * 1.4);
        ctx.strokeRect(ex - r, -r * 0.7, r * 2, r * 1.4);
      });
      break;
    }
    case "cuico": {
      // monóculo dorado en un ojo, con cadenita
      const ex = oneEye ? 0 : s / 2;
      ctx.strokeStyle = "#d4a017";
      ctx.fillStyle = "rgba(220,240,255,0.35)";
      ctx.beginPath(); ctx.arc(ex, 0, r * 1.05, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.lineWidth = Math.max(1, s * 0.04);
      ctx.beginPath(); ctx.moveTo(ex, r * 1.05); ctx.quadraticCurveTo(ex - r * 0.5, r * 3, ex - r * 1.6, r * 3.4); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.beginPath(); ctx.arc(ex - r * 0.35, -r * 0.35, r * 0.2, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "farandula": {
      // estrellas rosadas con brillitos
      bridge("#ff4fa3");
      for (const ex of eyes) {
        ctx.fillStyle = "rgba(255,95,190,0.85)"; ctx.strokeStyle = "#ff2f8f";
        star(ctx, ex, 0, r * 1.25, 0.55); ctx.fill(); ctx.stroke();
      }
      const tw = (frame % 40) / 40;
      ctx.fillStyle = `rgba(255,255,255,${1 - tw})`;
      star(ctx, eyes[eyes.length - 1] + r, -r, r * 0.35 * (0.5 + tw), 0.25, 4); ctx.fill();
      break;
    }
    case "lanza": {
      // antifaz negro con los ojos al aire
      const half = oneEye ? r * 1.6 : s / 2 + r * 1.3;
      ctx.fillStyle = "#1b1f3a";
      ctx.beginPath();
      ctx.moveTo(-half, -r * 0.5); ctx.quadraticCurveTo(0, -r * 1.2, half, -r * 0.5);
      ctx.quadraticCurveTo(half + r * 0.2, r * 0.9, r * 0.4, r * 0.7);
      ctx.quadraticCurveTo(0, r * 0.3, -r * 0.4, r * 0.7);
      ctx.quadraticCurveTo(-half - r * 0.2, r * 0.9, -half, -r * 0.5);
      for (const ex of eyes) { ctx.moveTo(ex + r * 0.55, 0); ctx.ellipse(ex, 0, r * 0.55, r * 0.4, 0, 0, Math.PI * 2); }
      ctx.fill("evenodd");
      // borde claro: así se ve también sobre caras oscuras (Koki, Taz)
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = Math.max(1, s * 0.05);
      ctx.stroke();
      break;
    }
  }
}
