import { useEffect, useRef } from "react";
import { CHAR_BY_ID } from "./characters";

/** Special skin effects painted over the character photo. */
export type SkinFx = "rainbow" | "azul" | "rosa" | "verde" | "dorado" | "violeta" | "fuego" | "hielo";

// Morado → azul → verde → amarillo → naranjo → rojo
export const RAINBOW_COLORS = ["#8b3dff", "#2684ff", "#29c56f", "#ffe13b", "#ff9a2d", "#ff3f45"];

// Paletas de sombra → luz: cada pixel toma el color según qué tan claro es en la foto,
// así se conservan ojos, pelaje y sombras pero el personaje queda de ese color.
const RAMPS: Record<Exclude<SkinFx, "rainbow">, string[]> = {
  azul: ["#06123d", "#1546b8", "#3f8cff", "#a9d4ff", "#eef7ff"],
  rosa: ["#3d0626", "#b0185f", "#ff4fa3", "#ffb3da", "#fff0f8"],
  verde: ["#03260f", "#0f7a34", "#2fc35a", "#9cf0a8", "#f0fff2"],
  dorado: ["#2e1a00", "#8a5a00", "#d9a200", "#ffd84a", "#fff6c9"],
  violeta: ["#1a0536", "#4f16a3", "#8a3dff", "#c99bff", "#f4ebff"],
  fuego: ["#2b0000", "#a10d0d", "#ef3b0c", "#ff9100", "#ffe066"],
  hielo: ["#2f7fae", "#6cc6ef", "#b5e9ff", "#e6f8ff", "#ffffff"],
};

const spans = new WeakMap<HTMLImageElement, [number, number]>();
const layers = new WeakMap<HTMLImageElement, Map<string, HTMLCanvasElement>>();

/** Horizontal extent (0..1) of the visible pixels, so gradients cover the body and not the empty margins. */
function opaqueSpan(image: HTMLImageElement): [number, number] {
  const cached = spans.get(image);
  if (cached) return cached;
  let span: [number, number] = [0, 1];
  try {
    const w = 96;
    const h = Math.max(1, Math.round((w * image.naturalHeight) / image.naturalWidth));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cx = c.getContext("2d")!;
    cx.drawImage(image, 0, 0, w, h);
    const d = cx.getImageData(0, 0, w, h).data;
    let l = w, r = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 40) { if (x < l) l = x; if (x > r) r = x; }
      }
    }
    if (r > l) span = [l / w, (r + 1) / w];
  } catch {
    // canvas sin permiso de lectura: usa todo el ancho
  }
  spans.set(image, span);
  return span;
}

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));

function rampColor(stops: number[][], t: number) {
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const a = stops[i], b = stops[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** Recolors the photo with a palette by brightness (normalized so dark cats also get the full range). */
function paintRamp(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number, fx: Exclude<SkinFx, "rainbow">) {
  ctx.drawImage(image, x, y, w, h);
  const W = ctx.canvas.width, H = ctx.canvas.height;
  let img: ImageData;
  try {
    img = ctx.getImageData(0, 0, W, H);
  } catch {
    return; // sin permiso de lectura: queda la foto original
  }
  const d = img.data;
  const hist = new Array(256).fill(0);
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 40) continue;
    hist[Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])]++;
    n++;
  }
  const pct = (p: number) => { let acc = 0; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * p) return v; } return 255; };
  const lo = pct(0.03), hi = Math.max(lo + 1, pct(0.97));
  const stops = RAMPS[fx].map(hex);
  for (let p = 0; p < d.length; p += 4) {
    if (d[p + 3] === 0) continue;
    const lum = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
    let t = (lum - lo) / (hi - lo);
    if (fx === "fuego") {
      // más amarillo arriba, más rojo abajo: parece que arde
      const py = Math.floor(p / 4 / W) / H;
      t = t * 0.6 + (1 - py) * 0.5;
    }
    const [r, g, b] = rampColor(stops, t);
    d[p] = r; d[p + 1] = g; d[p + 2] = b;
  }
  ctx.putImageData(img, 0, 0);
}

/** Flame tongues rising from the top edge of the silhouette (drawn behind the character). */
function paintFlames(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const probe = document.createElement("canvas");
  probe.width = Math.ceil(w);
  probe.height = Math.ceil(h);
  const pc = probe.getContext("2d")!;
  pc.drawImage(image, 0, 0, w, h);
  let alpha: Uint8ClampedArray;
  try { alpha = pc.getImageData(0, 0, probe.width, probe.height).data; } catch { return; }
  const top = (col: number) => {
    for (let r = 0; r < probe.height; r++) if (alpha[(r * probe.width + col) * 4 + 3] > 60) return r;
    return -1;
  };
  const tongues = 11;
  for (let i = 0; i < tongues; i++) {
    const col = Math.round(((i + 0.5) / tongues) * (probe.width - 1));
    const ty = top(col);
    if (ty < 0) continue;
    const fh = h * (0.16 + 0.12 * Math.abs(Math.sin(i * 2.3 + 1)));
    const fw = (w / tongues) * 1.5;
    const bx = x + col, by = y + ty + h * 0.06;
    const g = ctx.createLinearGradient(bx, by, bx, by - fh);
    g.addColorStop(0, "rgba(255,60,0,0.95)");
    g.addColorStop(0.45, "rgba(255,150,0,0.9)");
    g.addColorStop(1, "rgba(255,235,90,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(bx - fw / 2, by);
    ctx.quadraticCurveTo(bx - fw / 2, by - fh * 0.55, bx + Math.sin(i) * fw * 0.25, by - fh);
    ctx.quadraticCurveTo(bx + fw / 2, by - fh * 0.55, bx + fw / 2, by);
    ctx.closePath();
    ctx.fill();
  }
}

/** Diagonal gloss for gold, sparkles for ice — only over the character's own pixels. */
function paintShine(ctx: CanvasRenderingContext2D, W: number, H: number, fx: SkinFx) {
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  if (fx === "dorado") {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0.3, "rgba(255,255,255,0)");
    g.addColorStop(0.42, "rgba(255,250,210,0.55)");
    g.addColorStop(0.5, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (fx === "hielo") {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    for (let i = 0; i < 9; i++) {
      const sx = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * W;
      const sy = ((Math.sin(i * 78.233) * 12543.123) % 1 + 1) % 1 * H;
      const s = Math.max(1, W / 110);
      ctx.fillRect(sx - s * 2, sy - s / 2, s * 4, s);
      ctx.fillRect(sx - s / 2, sy - s * 2, s, s * 4);
    }
  }
  ctx.restore();
}

/** Paints the whole skin into a W×H canvas. */
function paintSkin(ctx: CanvasRenderingContext2D, image: HTMLImageElement, W: number, H: number, fx: SkinFx) {
  if (fx === "rainbow") {
    const [l, r] = opaqueSpan(image);
    ctx.drawImage(image, 0, 0, W, H);
    ctx.globalCompositeOperation = "source-in";
    const gradient = ctx.createLinearGradient(l * W, 0, r * W, 0);
    RAINBOW_COLORS.forEach((color, i) => gradient.addColorStop(i / (RAINBOW_COLORS.length - 1), color));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "hard-light";
    ctx.globalAlpha = 0.7;
    ctx.drawImage(image, 0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    return;
  }
  if (fx === "fuego") {
    // el gato un poco más chico para que quepan las llamas arriba
    const s = 0.84, w = W * s, h = H * s, x = (W - w) / 2, y = H - h;
    const body = document.createElement("canvas");
    body.width = W;
    body.height = H;
    paintRamp(body.getContext("2d")!, image, x, y, w, h, fx);
    paintFlames(ctx, image, x, y, w, h);
    ctx.drawImage(body, 0, 0);
    return;
  }
  paintRamp(ctx, image, 0, 0, W, H, fx);
  paintShine(ctx, W, H, fx);
}

function skinLayer(image: HTMLImageElement, fx: SkinFx, w: number, h: number) {
  const key = `${fx}:${w}x${h}`;
  let byKey = layers.get(image);
  if (!byKey) { byKey = new Map(); layers.set(image, byKey); }
  let layer = byKey.get(key);
  if (!layer) {
    layer = document.createElement("canvas");
    layer.width = w;
    layer.height = h;
    paintSkin(layer.getContext("2d")!, image, w, h, fx);
    byKey.set(key, layer);
  }
  return layer;
}

/** Draws a character with a special skin (rendered once at 2x and cached). */
export function drawSkinCharacter(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  fx: SkinFx,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  ctx.drawImage(skinLayer(image, fx, Math.ceil(width * 2), Math.ceil(height * 2)), x, y, width, height);
}

/** Skin preview for menus (the real photo, recolored). */
export function SkinPreview({ url, fx, label, className }: { url: string; fx: SkinFx; label: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = ref.current;
      const ctx = c?.getContext("2d");
      if (!c || !ctx) return;
      ctx.clearRect(0, 0, c.width, c.height);
      paintSkin(ctx, img, c.width, c.height, fx);
    };
    img.src = url;
  }, [url, fx]);
  return <canvas ref={ref} width={160} height={160} role="img" aria-label={label} className={className} />;
}

/** Small picture of the skin a player uses (ranking, lists). Unknown ids fall back to Koki. */
export function SkinAvatar({ skin, className }: { skin: string; className?: string }) {
  const c = CHAR_BY_ID[skin] ?? CHAR_BY_ID.koki;
  if (c.fx) return <SkinPreview url={c.url} fx={c.fx} label={c.name} className={className} />;
  return (
    <img
      src={c.url}
      alt={c.name}
      title={c.name}
      style={c.filter ? { filter: c.filter } : undefined}
      className={`object-contain ${className ?? ""}`}
    />
  );
}
