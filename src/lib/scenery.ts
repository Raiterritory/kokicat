// The sky of the Koki game changes as you score: sunset (as always), then night with stars and
// the moon, then rain with lightning, and again from the start. It blends smoothly between them.

export const SCENE_EVERY = 20; // puntos por escenario

type Palette = { top: string; mid: string; bottom: string; far: string; near: string };
const SCENES: Palette[] = [
  // atardecer (el de siempre)
  { top: "#1a2947", mid: "#4a5f8a", bottom: "#f4a06a", far: "#2a3255", near: "#141a33" },
  // noche
  { top: "#050816", mid: "#111a3a", bottom: "#2b2f5e", far: "#1a1f3d", near: "#0a0d1f" },
  // lluvia
  { top: "#20262f", mid: "#3d4a57", bottom: "#6b7a86", far: "#2b333d", near: "#161b22" },
];

const hex = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mix = (a: string, b: string, t: number) => {
  const x = hex(a), y = hex(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`;
};

/** Smooth position between scenes (eases toward the one that matches the score). */
let scenePos = 0;
let lastScore = -1;
export function resetScenery() { scenePos = 0; lastScore = -1; }

/** Which scene (with fraction) to draw now; call once per frame. */
export function sceneryStep(score: number): number {
  const target = Math.floor(score / SCENE_EVERY);
  // al volver a empezar una partida, sin transición
  if (score < lastScore) scenePos = target;
  lastScore = score;
  scenePos += (target - scenePos) * 0.02;
  if (Math.abs(target - scenePos) < 0.002) scenePos = target;
  return scenePos;
}

function blend(pos: number) {
  const i = Math.floor(pos), t = pos - i;
  const a = SCENES[((i % 3) + 3) % 3], b = SCENES[(((i + 1) % 3) + 3) % 3];
  const p: Palette = { top: mix(a.top, b.top, t), mid: mix(a.mid, b.mid, t), bottom: mix(a.bottom, b.bottom, t), far: mix(a.far, b.far, t), near: mix(a.near, b.near, t) };
  // cuánto hay de cada escenario (para las estrellas, la luna y la lluvia)
  const w = [0, 0, 0];
  w[((i % 3) + 3) % 3] += 1 - t;
  w[(((i + 1) % 3) + 3) % 3] += t;
  return { p, w };
}

/** Sky, sun or moon, stars, rain: everything behind the city. Returns the colors for the city. */
export function drawSky(ctx: CanvasRenderingContext2D, width: number, height: number, pos: number, frame: number) {
  const { p, w } = blend(pos);
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, p.top);
  grad.addColorStop(0.5, p.mid);
  grad.addColorStop(1, p.bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // estrellas (noche), siempre en el mismo lugar, titilando
  if (w[1] > 0.01) {
    ctx.save();
    for (let i = 0; i < 70; i++) {
      const r1 = Math.sin(i * 91.7) * 43758.5453, r2 = Math.sin(i * 17.3) * 12345.678;
      const x = (r1 - Math.floor(r1)) * width, y = (r2 - Math.floor(r2)) * height * 0.6;
      const tw = 0.55 + 0.45 * Math.sin(frame * 0.05 + i);
      ctx.globalAlpha = w[1] * tw;
      ctx.fillStyle = "#fff";
      const s = i % 7 === 0 ? 2.4 : 1.4;
      ctx.fillRect(x, y, s, s);
    }
    ctx.restore();
  }
  // sol (atardecer) y luna (noche)
  if (w[0] > 0.01) {
    ctx.fillStyle = `rgba(255, 210, 140, ${0.45 * w[0]})`;
    ctx.beginPath();
    ctx.arc(width - 80, 140, 55, 0, Math.PI * 2);
    ctx.fill();
  }
  if (w[1] > 0.01) {
    ctx.save();
    ctx.globalAlpha = w[1];
    ctx.fillStyle = "#f4f1de";
    ctx.shadowColor = "#f4f1de";
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(width - 110, 110, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = p.top; // creciente: un círculo del color del cielo encima
    ctx.beginPath();
    ctx.arc(width - 94, 100, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // relámpago de vez en cuando (lluvia)
  if (w[2] > 0.5 && frame % 420 < 6 && frame % 420 !== 2) {
    ctx.fillStyle = `rgba(255,255,255,${0.35 * w[2]})`;
    ctx.fillRect(0, 0, width, height);
  }
  return p;
}

/** Rain in front of the city (call after drawing it). */
export function drawRain(ctx: CanvasRenderingContext2D, width: number, groundY: number, pos: number, frame: number) {
  const { w } = blend(pos);
  if (w[2] < 0.01) return;
  ctx.save();
  ctx.strokeStyle = `rgba(190, 210, 230, ${0.55 * w[2]})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const drops = 90;
  for (let i = 0; i < drops; i++) {
    const r = Math.sin(i * 53.1) * 9871.13;
    const x0 = (r - Math.floor(r)) * (width + 100);
    const speed = 9 + (i % 5);
    const y = ((frame * speed + i * 37) % (groundY + 40)) - 20;
    const x = (x0 - frame * 2.2) % (width + 100);
    const xx = x < 0 ? x + width + 100 : x;
    ctx.moveTo(xx, y);
    ctx.lineTo(xx - 5, y + 14);
  }
  ctx.stroke();
  ctx.restore();
}
