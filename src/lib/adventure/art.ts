// Los dibujos de Koki Adventure, en pixel art: el barrio (pintado una vez en un canvas del tamaño del mapa)
// y la pandilla (sprites de 16x16 escritos con letras, como en la versión de Game Boy Color).
import { TILE, exitOpen, type World } from "./world";

type Px = (x: number, y: number, c: number) => void;
const hsh = (a: number, b: number) => ((a * 73856093) ^ (b * 19349663)) & 0xffff;

function painter(w: number, h: number) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const px: Px = (x, y, c) => {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    img.data[i] = (c >> 16) & 255;
    img.data[i + 1] = (c >> 8) & 255;
    img.data[i + 2] = c & 255;
    img.data[i + 3] = 255;
  };
  const rect = (x: number, y: number, rw: number, rh: number, c: number) => {
    for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) px(xx, yy, c);
  };
  return { cv, px, rect, done: () => ctx.putImageData(img, 0, 0) };
}

/* ---------- el mapa donde está Koki (el barrio o la plaza) ---------- */
export function paintMap(wd: World): HTMLCanvasElement {
  const W = wd.w * TILE,
    H = wd.h * TILE;
  const { cv, px, rect, done } = painter(W, H);
  const grass = (tx: number, ty: number) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const v = hsh(tx * TILE + x, ty * TILE + y) % 11;
        px(tx * TILE + x, ty * TILE + y, v > 2 ? 0x5dbb4b : v > 0 ? 0x4fa83f : 0x79cf62);
      }
  };
  const tileAt = (tx: number, ty: number) => (wd.ground[ty] ?? "")[tx] ?? "b";
  for (let ty = 0; ty < wd.h; ty++)
    for (let tx = 0; tx < wd.w; tx++) {
      const c = tileAt(tx, ty),
        X = tx * TILE,
        Y = ty * TILE;
      /* la salida: camino si está abierta, arbusto si no */
      const open = c === "e" && exitOpen(wd);
      if (c === "p" || open) {
        for (let y = 0; y < TILE; y++)
          for (let x = 0; x < TILE; x++)
            px(X + x, Y + y, hsh(X + x + 7, Y + y) % 13 > 1 ? 0xe0b97f : 0xc99f63);
      } else if (c === "q" || c === "F" || c === "B" || c === "S") {
        /* baldosas de la plaza (debajo de la pileta, las bancas y los puestos también) */
        for (let y = 0; y < TILE; y++)
          for (let x = 0; x < TILE; x++) {
            const edge = x % 8 === 0 || y % 8 === 0;
            const v = hsh(X + x, Y + y + 3) % 9;
            px(X + x, Y + y, edge ? 0xb9ab95 : v ? 0xd8ccb6 : 0xcbbda5);
          }
      } else if (c === "w") {
        for (let y = 0; y < TILE; y++)
          for (let x = 0; x < TILE; x++)
            px(X + x, Y + y, (x + y * 2 + tx * 5) % 9 ? 0x4aa8e8 : 0x9fd8ff);
        if (tileAt(tx, ty - 1) !== "w") rect(X, Y, TILE, 2, 0xbfe9ff);
        if (tileAt(tx + 1, ty) !== "w") rect(X + TILE - 2, Y, 2, TILE, 0x3b8ed0);
      } else {
        grass(tx, ty);
        if (c === "f")
          for (const [x, y, col] of [
            [3, 4, 0xff5a6e],
            [11, 3, 0xffe14d],
            [7, 10, 0xffffff],
            [13, 12, 0xff5a6e],
            [2, 13, 0xb27bff],
          ]) {
            rect(X + x, Y + y, 2, 2, col);
            px(X + x, Y + y + 2, 0x2f8a2f);
          }
        if (c === "b" || (c === "e" && !open)) {
          for (let y = 0; y < TILE; y++)
            for (let x = 0; x < TILE; x++) {
              const d = Math.hypot(x - 7.5, y - 8);
              if (d < 8.5)
                px(X + x, Y + y, d > 6.5 ? 0x2b7a33 : hsh(X + x, Y + y) % 5 ? 0x3d9c42 : 0x62c556);
            }
        }
      }
    }
  /* la pileta (donde empieza una zona de 4x4 "F") */
  for (let ty = 0; ty < wd.h; ty++)
    for (let tx = 0; tx < wd.w; tx++) {
      if (tileAt(tx, ty) !== "F" || tileAt(tx - 1, ty) === "F" || tileAt(tx, ty - 1) === "F")
        continue;
      const cx = tx * TILE + 32,
        cy = ty * TILE + 32;
      for (let y = -32; y < 32; y++)
        for (let x = -32; x < 32; x++) {
          const d = Math.hypot(x + 0.5, y + 0.5);
          if (d < 30)
            px(
              cx + x,
              cy + y,
              d > 26
                ? 0x8f8578
                : d > 23
                  ? 0xb3a998
                  : (x * 3 + y * 5 + 900) % 11
                    ? 0x4aa8e8
                    : 0x9fd8ff,
            );
        }
      /* el chorro del medio */
      for (let y = -12; y < 8; y++)
        for (let x = -3; x < 3; x++) px(cx + x, cy + y, Math.abs(x) > 1 ? 0xbfe9ff : 0xffffff);
      for (let y = 4; y < 10; y++) for (let x = -6; x < 6; x++) px(cx + x, cy + y, 0x8f8578);
    }
  /* las bancas */
  for (let ty = 0; ty < wd.h; ty++)
    for (let tx = 0; tx < wd.w; tx++) {
      if (tileAt(tx, ty) !== "B" || tileAt(tx - 1, ty) === "B") continue;
      const X = tx * TILE,
        Y = ty * TILE;
      for (const yy of [3, 7, 11]) rect(X + 1, Y + yy, 30, 3, 0xa86b3c);
      for (const yy of [5, 9, 13]) rect(X + 1, Y + yy, 30, 1, 0x7a4a2a);
      rect(X + 3, Y + 14, 3, 2, 0x3a3a44);
      rect(X + 26, Y + 14, 3, 2, 0x3a3a44);
    }
  /* los puestos de la feria (3x2): toldo de rayas y la mesa con lo que venden; el de la Tía tiene pescados */
  for (let ty = 0; ty < wd.h; ty++)
    for (let tx = 0; tx < wd.w; tx++) {
      if (tileAt(tx, ty) !== "S" || tileAt(tx - 1, ty) === "S" || tileAt(tx, ty - 1) === "S")
        continue;
      const X = tx * TILE,
        Y = ty * TILE;
      const stripe = [0xe8344a, 0x2d9bff, 0xffb02e, 0x3ddc4a][(tx + ty) % 4];
      rect(X + 2, Y + 4, 2, 26, 0x6b4428);
      rect(X + 44, Y + 4, 2, 26, 0x6b4428);
      for (let x = 0; x < 48; x++)
        for (let y = 0; y < 12; y++) px(X + x, Y + y - 2, (x >> 2) % 2 ? stripe : 0xffffff);
      for (let x = 0; x < 48; x += 4) {
        px(X + x + 1, Y + 10, stripe);
        px(X + x + 2, Y + 10, stripe);
      }
      rect(X + 1, Y + 18, 46, 12, 0xc98a4b);
      rect(X + 1, Y + 18, 46, 2, 0xe0a866);
      rect(X + 1, Y + 29, 46, 2, 0x7a4a2a);
      const fish =
        wd.map === "plaza" && tx === 16 && ty === 1; /* el de la Tía (arriba a la derecha) */
      for (let k = 0; k < 5; k++) {
        const gx = X + 5 + k * 8,
          gy = Y + 21 + (k % 2);
        if (fish) {
          rect(gx, gy + 1, 6, 3, 0xa9c4dc);
          px(gx + 6, gy, 0x8aa6c0);
          px(gx + 6, gy + 4, 0x8aa6c0);
          px(gx + 1, gy + 2, 0x222);
        } else {
          const col = [0xe8344a, 0xffb02e, 0x3ddc4a, 0xb27bff, 0xff8fb8][(k + tx) % 5];
          rect(gx, gy, 5, 5, col);
          px(gx + 1, gy + 1, 0xffffff);
        }
      }
    }
  /* la reja */
  for (let ty = 0; ty < wd.h; ty++)
    for (let tx = 0; tx < wd.w; tx++) {
      if (tileAt(tx, ty) !== "n") continue;
      const X = tx * TILE,
        Y = ty * TILE;
      for (let x = X; x < X + TILE; x++) {
        px(x, Y + 4, 0x8a5a3c);
        px(x, Y + 5, 0x6b4428);
        px(x, Y + 10, 0x8a5a3c);
        px(x, Y + 11, 0x6b4428);
      }
      rect(X + 2, Y - 2, 4, 16, 0x9a6a46);
      rect(X + 2, Y - 2, 4, 1, 0x6b4428);
      rect(X + 10, Y - 2, 4, 16, 0x9a6a46);
      rect(X + 10, Y - 2, 4, 1, 0x6b4428);
    }
  /* la casa (donde empieza una zona de 4x3 "H") */
  for (let ty = 0; ty < wd.h; ty++)
    for (let tx = 0; tx < wd.w; tx++) {
      if (tileAt(tx, ty) !== "H" || tileAt(tx - 1, ty) === "H" || tileAt(tx, ty - 1) === "H")
        continue;
      const hx = tx * TILE,
        hy = ty * TILE - 8;
      for (let y = 0; y < 26; y++)
        for (let x = -4; x < 68; x++) {
          if (Math.abs(x - 32) > 4 + y * 1.35 + 18) continue;
          px(hx + x, hy + y + 2, (y >> 2) % 2 === 0 ? 0xd8483a : 0xbf3a2e);
        }
      for (let x = -4; x < 68; x++) px(hx + x, hy + 27, 0x7a1e16);
      rect(hx + 50, hy, 8, 12, 0x8a5a3c);
      rect(hx + 50, hy, 8, 2, 0x5a3a22);
      rect(hx + 2, hy + 28, 60, 28, 0xf3e3c4);
      for (let x = hx + 2; x < hx + 62; x++) px(x, hy + 55, 0xc9b38c);
      rect(hx + 26, hy + 38, 12, 18, 0x8a5a3c);
      rect(hx + 27, hy + 39, 10, 17, 0xa8714a);
      px(hx + 35, hy + 48, 0xffe14d);
      for (const wx of [hx + 8, hx + 44]) {
        rect(wx, hy + 36, 12, 9, 0x3b2a20);
        rect(wx + 1, hy + 37, 10, 7, 0x8fd3ff);
        rect(wx + 5, hy + 37, 1, 7, 0x3b2a20);
        rect(wx - 1, hy + 45, 14, 2, 0xd8483a);
      }
    }
  /* el letrero (Casa de Koki) */
  for (let ty = 0; ty < wd.h; ty++)
    for (let tx = 0; tx < wd.w; tx++) {
      if (tileAt(tx, ty) !== "s") continue;
      const X = tx * TILE,
        Y = ty * TILE;
      rect(X + 7, Y + 6, 2, 10, 0x6b4a2e);
      rect(X, Y, 16, 9, 0xc9925a);
      rect(X, Y, 16, 1, 0x6b4a2e);
      rect(X, Y + 8, 16, 1, 0x6b4a2e);
      for (const [x, y] of [
        [3, 3],
        [5, 3],
        [7, 3],
        [10, 4],
        [12, 4],
      ])
        px(X + x, Y + y, 0x3b2a20);
    }
  /* los árboles (donde empieza una zona de 2x2 "T") */
  for (let ty = 0; ty < wd.h; ty++)
    for (let tx = 0; tx < wd.w; tx++) {
      if (tileAt(tx, ty) !== "T" || tileAt(tx - 1, ty) === "T" || tileAt(tx, ty - 1) === "T")
        continue;
      const x0 = tx * TILE,
        y0 = ty * TILE - 2;
      rect(x0 + 13, y0 + 22, 6, 10, 0x7a4a2a);
      for (let y = 0; y < 26; y++)
        for (let x = 0; x < 32; x++) {
          const d = Math.hypot(x - 15.5, (y - 12) * 1.15);
          if (d >= 15) continue;
          const v = hsh(x0 + x, y0 + y) % 7;
          let col = d > 11 ? 0x2f8f3a : v ? 0x3fae48 : 0x6fd35a;
          if (x + y < 18 && d < 10) col = v % 2 ? 0x6fd35a : 0x4fbf4a;
          px(x0 + x, y0 + y, col);
        }
    }
  done();
  return cv;
}

/* ---------- la pandilla ---------- */
const SPRITES: Record<string, [string[], Record<string, number>]> = {
  koki: [
    [
      "................",
      "..oo........oo..",
      ".ommo......ommo.",
      ".ommmoooooommmo.",
      "occmmmmmmmmmmcco",
      "occmeemmmmeemcco",
      "occmeemmmmeemcco",
      "occmmmmppmmmmcco",
      "occcmmmmmmmmccco",
      ".occcmmmmmmccco.",
      "..ooccccccccoo..",
      "...occcccccco...",
      "..occcccccccco..",
      "..occcccccccco..",
      "..owwo....owwo..",
      "..oooo....oooo..",
    ],
    { o: 0x3b2a20, c: 0xf4e3c8, m: 0x6b4a35, e: 0x4fa3e0, p: 0xff9fb0, w: 0xffffff },
  ],
  taz: [
    [
      "................",
      "..oo........oo..",
      ".ommo......ommo.",
      ".ommmoooooommmo.",
      "occmmmmmmmmmmcco",
      "occmeemmmmeemcco",
      "occmeemmmmeemcco",
      "occmmmmppmmmmcco",
      "occcmmmmmmmmccco",
      ".occcmmmmmmccco.",
      "..ooccccccccoo..",
      "...occcccccco...",
      "..occcccccccco..",
      "..occcccccccco..",
      "..occo....occo..",
      "..oooo....oooo..",
    ],
    { o: 0x0c0c12, c: 0x2b2b38, m: 0x22222e, e: 0xd6e35a, p: 0x44445a },
  ],
  gufi: [
    [
      "...oo......oo...",
      "..otto....otto..",
      "..ottoooooootto..",
      ".otttttttttttto.",
      ".ottkkttttkktto.",
      ".otttttttttttto.",
      ".otttttkkttttto.",
      ".ottttttppttttо.",
      "..otttttppttto..",
      "...otttttttto...",
      "..obbbbbbbbbbo..",
      ".obbbbbbbbbbbbo.",
      ".obbbbbbbbbbbbo.",
      ".obbbbbbbbbbbbo.",
      "..otto....otto..",
      "..oooo....oooo..",
    ],
    { o: 0x3b2a1a, t: 0xc99a5b, k: 0x111111, p: 0xff8fa8, b: 0x6f7b8f },
  ],
  raton: [
    [
      "..ooo......ooo..",
      ".oppgo....ogppo.",
      ".oppgoooooogppo.",
      "..oggggggggggo..",
      ".oggkkggggkkggo.",
      ".oggggggggggggo.",
      ".ogggggppgggggo.",
      "..ollggggggllo..",
      "...oggggggggo...",
      "..ollllllllllo..",
      "..ollllllllllo..",
      "..oggllllllggo..",
      "...oggggggggo...",
      "..oppo....oppo..",
      "..oooo....oooo..",
      "................",
    ],
    { o: 0x2a2a30, g: 0x8a8d98, l: 0xb8bac4, p: 0xf2a7b8, k: 0x111111 },
  ],
  /* la Tía del pescado: pelo gris tomado, delantal blanco */
  tia: [
    [
      "....oooooooo....",
      "...ohhhhhhhho...",
      "..ohhhhhhhhhho..",
      "..ohssssssssho..",
      "..osskksskksso..",
      "..osssssssssso..",
      "..osssmmmmssso..",
      "...osssssssso...",
      "..oddddddddddo..",
      ".oddaaaaaaaaddo.",
      ".osdaaaaaaaadso.",
      ".osdaaaaaaaadso.",
      "..odaaaaaaaado..",
      "..oddddddddddo..",
      "...okko..okko...",
      "...oooo..oooo...",
    ],
    { o: 0x2a1e1e, h: 0xc9c9d6, s: 0xf1c49a, k: 0x2a2a3a, m: 0xd2485a, d: 0xe35d9a, a: 0xffffff },
  ],
  /* el Quiltro de la plaza: café, orejas caídas */
  quiltro: [
    [
      "................",
      ".oo..........oo.",
      "oeeo........oeeo",
      "oeeoooooooooooeo",
      "oeettttttttttteo",
      ".ottkkttttkktto.",
      ".otttttttttttto.",
      ".otttttkkttttto.",
      "..otttttppttto..",
      "...otttttttto...",
      "..obbbbbbbbbbo..",
      ".obbbwwbbbbbbbo.",
      ".obbbwwbbbbbbbo.",
      ".obbbbbbbbbbbbo.",
      "..otto....otto..",
      "..oooo....oooo..",
    ],
    { o: 0x3b2414, e: 0x6b3f1e, t: 0xb07a43, k: 0x111111, p: 0xff8fa8, b: 0x9a6534, w: 0xd9b07a },
  ],
  /* una paloma de la feria */
  paloma: [
    [
      "................",
      "................",
      "................",
      "........ooo.....",
      ".......ohhho....",
      ".......ohkhoyy..",
      "...oooooohhho...",
      "..oggggggggggo..",
      ".oggwwwwgggo....",
      ".ogwwwwwwggo....",
      "..oggggggggo....",
      "...ooooooooo....",
      ".....y...y......",
      "................",
      "................",
      "................",
    ],
    { o: 0x2a2a35, h: 0x5c6b8a, k: 0x111111, y: 0xff9a2d, g: 0x9aa3b5, w: 0xc4cad6 },
  ],
};
/* cada sprite en dos poses (quieto y con un pie levantado) */
export function paintSprites() {
  const out: Record<string, HTMLCanvasElement[]> = {};
  for (const [name, [rows, pal]] of Object.entries(SPRITES)) {
    out[name] = [0, 1].map((pose) => {
      const { cv, px, done } = painter(16, 17);
      rows.forEach((r, y) =>
        [...r.replace(/о/g, "o").slice(0, 16)].forEach((ch, x) => {
          if (!(ch in pal)) return;
          /* al caminar, la pata derecha sube un punto */
          const lift = pose && y >= 14 && x >= 8 ? -1 : 0;
          px(x, y + 1 + lift, pal[ch]);
        }),
      );
      done();
      return cv;
    });
  }
  return out;
}
/* un pastelito (8x8) */
export function paintCake() {
  const { cv, px, rect, done } = painter(8, 9);
  rect(1, 4, 6, 4, 0xff8fb8);
  rect(0, 2, 8, 3, 0xffe3ef);
  px(3, 0, 0xe8344a);
  px(4, 1, 0xe8344a);
  for (let x = 1; x < 7; x += 2) px(x, 5, 0xffffff);
  done();
  return cv;
}
