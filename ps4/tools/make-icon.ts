// Makes the PS4 menu icon (512x512 PNG): the KokiCat logo on the sunset sky of the game.
// Usage: bun ps4/tools/make-icon.ts <logo.png> <out.png>
import { readFileSync, writeFileSync } from "node:fs";
import { decodePng, encodePng, shrink } from "./pnglib";

const [input, output] = process.argv.slice(2);
const S = 512;
const icon = Buffer.alloc(S * S * 4);
// cielo de atardecer: #1a2947 -> #4a5f8a -> #f4a06a
const stops = [[0x1a, 0x29, 0x47], [0x4a, 0x5f, 0x8a], [0xf4, 0xa0, 0x6a]];
for (let y = 0; y < S; y++) {
  const t = y / (S - 1), k = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  const [a, b] = t < 0.5 ? [stops[0], stops[1]] : [stops[1], stops[2]];
  for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    for (let c = 0; c < 3; c++) icon[i + c] = Math.round(a[c] + (b[c] - a[c]) * k);
    icon[i + 3] = 255;
  }
}
const logo = shrink(decodePng(readFileSync(input)), 470);
const ox = Math.floor((S - logo.w) / 2), oy = Math.floor((S - logo.h) / 2);
for (let y = 0; y < logo.h; y++) {
  for (let x = 0; x < logo.w; x++) {
    const s = (y * logo.w + x) * 4, d = ((y + oy) * S + x + ox) * 4, a = logo.rgba[s + 3] / 255;
    for (let c = 0; c < 3; c++) icon[d + c] = Math.round(logo.rgba[s + c] * a + icon[d + c] * (1 - a));
  }
}
writeFileSync(output, encodePng({ w: S, h: S, rgba: icon }));
console.log(`${output}: ${S}x${S}`);
