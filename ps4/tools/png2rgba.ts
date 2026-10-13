// Converts a PNG into the raw format the PS4 build loads: 4-byte width, 4-byte height
// (little endian) and then RGBA pixels. Optionally scales it down to `maxSide`.
// Usage: bun ps4/tools/png2rgba.ts <in.png> <out.rgba> [maxSide]
import { readFileSync, writeFileSync } from "node:fs";
import { decodePng, shrink } from "./pnglib";

const [input, output, max] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: bun ps4/tools/png2rgba.ts <in.png> <out.rgba> [maxSide]");
  process.exit(1);
}
let img = decodePng(readFileSync(input));
if (max) img = shrink(img, Number(max));
const head = Buffer.alloc(8);
head.writeUInt32LE(img.w, 0);
head.writeUInt32LE(img.h, 4);
writeFileSync(output, Buffer.concat([head, img.rgba]));
console.log(`${output}: ${img.w}x${img.h}`);
