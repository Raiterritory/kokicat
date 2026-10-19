// Las reglas de Koki Adventure (sin dibujar nada): la física de Koki, los bloques, las ratas, los
// pastelitos y la meta. Todo en píxeles del mundo, a 60 pasos por segundo.
import type { Level } from "./levels";

export const TILE = 40;
const GRAVITY = 0.6;
const FALL_MAX = 13;
const GLIDE_FALL = 1.6; /* planeando con el arcoíris cae despacito */
const GLIDE_FRAMES = 90; /* cuánto dura el planeo en cada salto (1,5 s) */
const RUN = 4.4;
const ACCEL = 0.55;
const FRICTION = 0.75;
const JUMP = -13.2; /* llega a unos 3,5 bloques de alto */
const COYOTE = 6; /* se puede saltar un ratito después de dejar el borde */
const BUFFER = 7; /* y apretar un ratito antes de caer al suelo */
const KOKI_W = 30,
  KOKI_H = 34;
const RAT_W = 32,
  RAT_H = 22,
  RAT_SPEED = 1.1;
export const LIVES = 3;

export type Input = { left: boolean; right: boolean; jump: boolean };
export type Rat = { x: number; y: number; vx: number; alive: boolean; squash: number };
export type Coin = { x: number; y: number; golden: boolean; taken: boolean };
export type Trail = { x: number; y: number; life: number };
export type Game = {
  level: Level;
  w: number;
  h: number; /* el mundo, en bloques */
  solid: Uint8Array; /* 1 suelo, 2 ladrillo, 3 tubo, 4 boca de tubo */
  x: number;
  y: number;
  vx: number;
  vy: number;
  face: 1 | -1;
  onGround: boolean;
  coyote: number;
  buffer: number;
  glide: number;
  gliding: boolean;
  jumpHeld: boolean;
  rats: Rat[];
  coins: Coin[];
  trail: Trail[];
  startX: number;
  startY: number;
  flagX: number;
  lives: number;
  pastelitos: number;
  goldens: number;
  hurt: number; /* cuadros sin poder recibir daño */
  frame: number;
  state: "playing" | "won" | "lost";
  events: string[]; /* lo que pasó este paso (para los sonidos) */
};

export function newGame(level: Level): Game {
  const h = level.map.length,
    w = Math.max(...level.map.map((r) => r.length));
  const solid = new Uint8Array(w * h);
  const g: Game = {
    level,
    w,
    h,
    solid,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    face: 1,
    onGround: false,
    coyote: 0,
    buffer: 0,
    glide: 0,
    gliding: false,
    jumpHeld: false,
    rats: [],
    coins: [],
    trail: [],
    startX: 0,
    startY: 0,
    flagX: (w - 2) * TILE,
    lives: LIVES,
    pastelitos: 0,
    goldens: 0,
    hurt: 0,
    frame: 0,
    state: "playing",
    events: [],
  };
  for (let ty = 0; ty < h; ty++)
    for (let tx = 0; tx < w; tx++) {
      const c = level.map[ty][tx] ?? ".";
      const px = tx * TILE,
        py = ty * TILE;
      if (c === "=") solid[ty * w + tx] = 1;
      else if (c === "#") solid[ty * w + tx] = 2;
      else if (c === "|") solid[ty * w + tx] = 3;
      else if (c === "T") solid[ty * w + tx] = 4;
      else if (c === "o" || c === "*")
        g.coins.push({ x: px + TILE / 2, y: py + TILE / 2, golden: c === "*", taken: false });
      else if (c === "r")
        g.rats.push({
          x: px + (TILE - RAT_W) / 2,
          y: py + TILE - RAT_H,
          vx: -RAT_SPEED,
          alive: true,
          squash: 0,
        });
      else if (c === "K") {
        g.startX = px + (TILE - KOKI_W) / 2;
        g.startY = py + TILE - KOKI_H;
      } else if (c === "F") g.flagX = px;
    }
  g.x = g.startX;
  g.y = g.startY;
  return g;
}

export const solidAt = (g: Game, tx: number, ty: number) =>
  tx < 0 ? 1 : tx >= g.w || ty < 0 || ty >= g.h ? 0 : g.solid[ty * g.w + tx];
const hits = (g: Game, x: number, y: number, w: number, h: number) => {
  for (let ty = Math.floor(y / TILE); ty <= Math.floor((y + h - 0.01) / TILE); ty++)
    for (let tx = Math.floor(x / TILE); tx <= Math.floor((x + w - 0.01) / TILE); tx++)
      if (solidAt(g, tx, ty)) return true;
  return false;
};
const overlap = (
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

/* volver a la partida del nivel (al caer a un hoyo o chocar con una rata) */
function hurtKoki(g: Game, fell: boolean) {
  g.lives--;
  g.events.push("hurt");
  if (g.lives <= 0) {
    g.state = "lost";
    return;
  }
  if (fell) {
    g.x = g.startX;
    g.y = g.startY;
    g.vx = g.vy = 0;
  } else {
    g.vy = -7;
    g.vx = -g.face * 5;
  }
  g.hurt = 90;
}

export function step(g: Game, inp: Input) {
  g.events = [];
  if (g.state !== "playing") return;
  g.frame++;
  if (g.hurt > 0) g.hurt--;
  /* correr */
  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  if (dir) {
    g.vx += dir * ACCEL;
    g.face = dir > 0 ? 1 : -1;
  } else g.vx *= FRICTION;
  if (Math.abs(g.vx) > RUN) g.vx = Math.sign(g.vx) * RUN;
  if (Math.abs(g.vx) < 0.05) g.vx = 0;
  /* saltar (con un poco de margen antes y después del borde), y planear manteniendo apretado */
  const pressed = inp.jump && !g.jumpHeld;
  g.jumpHeld = inp.jump;
  if (pressed) g.buffer = BUFFER;
  else if (g.buffer > 0) g.buffer--;
  if (g.onGround) {
    g.coyote = COYOTE;
    g.glide = GLIDE_FRAMES;
  } else if (g.coyote > 0) g.coyote--;
  if (g.buffer > 0 && g.coyote > 0) {
    g.vy = JUMP;
    g.buffer = 0;
    g.coyote = 0;
    g.onGround = false;
    g.events.push("jump");
  }
  if (!inp.jump && g.vy < -4) g.vy = -4; /* soltar antes: salto más bajo */
  g.vy += GRAVITY;
  g.gliding = inp.jump && g.vy > 0 && !g.onGround && g.glide > 0;
  if (g.gliding) {
    g.glide--;
    if (g.vy > GLIDE_FALL) g.vy = GLIDE_FALL;
  }
  if (g.vy > FALL_MAX) g.vy = FALL_MAX;
  /* moverse eje por eje, frenando contra los bloques */
  g.x += g.vx;
  if (hits(g, g.x, g.y, KOKI_W, KOKI_H)) {
    g.x =
      g.vx > 0
        ? Math.floor((g.x + KOKI_W) / TILE) * TILE - KOKI_W - 0.01
        : Math.floor(g.x / TILE + 1) * TILE + 0.01;
    g.vx = 0;
  }
  g.y += g.vy;
  g.onGround = false;
  if (hits(g, g.x, g.y, KOKI_W, KOKI_H)) {
    if (g.vy > 0) {
      g.y = Math.floor((g.y + KOKI_H) / TILE) * TILE - KOKI_H - 0.01;
      g.onGround = true;
    } else {
      g.y = Math.floor(g.y / TILE + 1) * TILE + 0.01;
      g.events.push("bonk");
    }
    g.vy = 0;
  }
  if (g.x < 0) g.x = 0;
  /* el arcoíris al planear */
  if (g.gliding && g.frame % 2 === 0)
    g.trail.push({ x: g.x + KOKI_W / 2 - g.face * 14, y: g.y + KOKI_H / 2, life: 30 });
  for (const t of g.trail) t.life--;
  g.trail = g.trail.filter((t) => t.life > 0);
  /* a un hoyo */
  if (g.y > g.h * TILE + 60) {
    hurtKoki(g, true);
    return;
  }
  /* pastelitos */
  for (const c of g.coins) {
    if (c.taken || !overlap(g.x, g.y, KOKI_W, KOKI_H, c.x - 14, c.y - 14, 28, 28)) continue;
    c.taken = true;
    if (c.golden) {
      g.goldens++;
      g.pastelitos += 5;
      g.events.push("golden");
    } else {
      g.pastelitos++;
      g.events.push("coin");
    }
  }
  /* ratas: caminan, dan la vuelta en paredes y bordes; se aplastan saltándoles encima */
  for (const r of g.rats) {
    if (!r.alive) {
      if (r.squash > 0) r.squash--;
      continue;
    }
    const nx = r.x + r.vx;
    const ahead = r.vx > 0 ? nx + RAT_W : nx;
    const wall = hits(g, nx, r.y, RAT_W, RAT_H);
    const floor = solidAt(g, Math.floor(ahead / TILE), Math.floor((r.y + RAT_H + 2) / TILE));
    if (wall || !floor) r.vx = -r.vx;
    else r.x = nx;
    if (!overlap(g.x, g.y, KOKI_W, KOKI_H, r.x, r.y, RAT_W, RAT_H)) continue;
    if (g.vy > 0 && g.y + KOKI_H - g.vy <= r.y + 6) {
      r.alive = false;
      r.squash = 30;
      g.vy = JUMP * 0.7;
      g.events.push("stomp");
    } else if (g.hurt === 0) {
      hurtKoki(g, false);
      if (g.state !== "playing") return;
    }
  }
  /* la meta */
  if (g.x + KOKI_W >= g.flagX + 12) {
    g.state = "won";
    g.events.push("win");
  }
}

export const KOKI_SIZE = { w: KOKI_W, h: KOKI_H };
export const RAT_SIZE = { w: RAT_W, h: RAT_H };
