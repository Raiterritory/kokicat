import { useEffect, useRef } from "react";

// Morado → azul → verde → amarillo → naranjo → rojo
export const RAINBOW_COLORS = ["#8b3dff", "#2684ff", "#29c56f", "#ffe13b", "#ff9a2d", "#ff3f45"];

const spans = new WeakMap<HTMLImageElement, [number, number]>();
const layers = new WeakMap<HTMLImageElement, HTMLCanvasElement>();

/** Horizontal extent (0..1) of the visible pixels, so the gradient covers the body and not the empty margins. */
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

/** Paints the photo with the rainbow gradient while keeping its fur, eyes and shading visible. */
function paintRainbow(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  const [l, r] = opaqueSpan(image);
  ctx.drawImage(image, 0, 0, width, height);
  ctx.globalCompositeOperation = "source-in";
  const gradient = ctx.createLinearGradient(l * width, 0, r * width, 0);
  RAINBOW_COLORS.forEach((color, i) => gradient.addColorStop(i / (RAINBOW_COLORS.length - 1), color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = "hard-light";
  ctx.globalAlpha = 0.7;
  ctx.drawImage(image, 0, 0, width, height);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

export function drawRainbowCharacter(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const w = Math.ceil(width);
  const h = Math.ceil(height);
  let layer = layers.get(image);
  if (!layer || layer.width !== w || layer.height !== h) {
    layer = document.createElement("canvas");
    layer.width = w;
    layer.height = h;
    const layerCtx = layer.getContext("2d");
    if (!layerCtx) return;
    paintRainbow(layerCtx, image, w, h);
    layers.set(image, layer);
  }
  ctx.drawImage(layer, x, y, width, height);
}

/** Rainbow skin preview for menus (the real photo, colored — not just a silhouette). */
export function RainbowSkin({ url, label, className }: { url: string; label: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = ref.current;
      const ctx = c?.getContext("2d");
      if (!c || !ctx) return;
      ctx.clearRect(0, 0, c.width, c.height);
      paintRainbow(ctx, img, c.width, c.height);
    };
    img.src = url;
  }, [url]);
  return <canvas ref={ref} width={160} height={160} role="img" aria-label={label} className={className} />;
}
