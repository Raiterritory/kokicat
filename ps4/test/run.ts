// Runs the WebAssembly build of the PS4 core (images from a previous build.ps1) with scripted controller presses and a fake
// server, and saves screenshots to ps4/test/out/*.png. Usage: bun ps4/test/run.ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const W = 1280, H = 720;
const B = { CROSS: 1, CIRCLE: 2, SQUARE: 4, TRIANGLE: 8, UP: 16, DOWN: 32, LEFT: 64, RIGHT: 128, L1: 256, R1: 512, OPTIONS: 1024 };

const { instance } = await WebAssembly.instantiate(readFileSync(join(root, "test/out/core.wasm")), { env: {} });
const x = instance.exports as Record<string, any>;
const mem = () => new Uint8Array((x.memory as WebAssembly.Memory).buffer);

["koki", "logo", "coin"].forEach((name, i) => {
  const f = readFileSync(join(root, `build/pkg/assets/${name}.rgba`));
  const w = f.readUInt32LE(0), h = f.readUInt32LE(4);
  const ptr = x.alloc(w * h * 4);
  // RGBA en bytes -> 0xAARRGGBB en memoria little-endian (B, G, R, A)
  const m = mem();
  for (let i = 0; i < w * h; i++) {
    m[ptr + i * 4] = f[8 + i * 4 + 2];
    m[ptr + i * 4 + 1] = f[8 + i * 4 + 1];
    m[ptr + i * 4 + 2] = f[8 + i * 4];
    m[ptr + i * 4 + 3] = f[8 + i * 4 + 3];
  }
  x.set_image(i, w, h, ptr);
});

const cstr = (ptr: number) => { const m = mem(); let e = ptr; while (m[e]) e++; return new TextDecoder().decode(m.subarray(ptr, e)); };
const requests: string[] = [];
let reply: ((fn: string, body: string) => [boolean, string]) | null = null;
function serveNet() {
  if (!x.net_busy()) return;
  const fn = cstr(x.net_fn()), body = cstr(x.net_req());
  requests.push(`${fn} ${body}`);
  const [ok, text] = reply ? reply(fn, body) : [false, ""];
  const bytes = new TextEncoder().encode(text);
  mem().set([...bytes, 0], x.net_reply_buf());
  x.net_finish(ok ? 1 : 0);
}
const frames = (n: number, buttons = 0) => { for (let i = 0; i < n; i++) { x.frame(buttons); serveNet(); } };
const press = (b: number, times = 1) => { for (let i = 0; i < times; i++) { frames(1, b); frames(2); } };

mkdirSync(join(root, "test/out"), { recursive: true });
function shot(name: string) {
  const fb = new Uint8Array((x.memory as WebAssembly.Memory).buffer, x.fb(), W * H * 4);
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0;
    for (let i = 0; i < W; i++) {
      const s = (y * W + i) * 4, d = y * (W * 3 + 1) + 1 + i * 3;
      raw[d] = fb[s + 2]; raw[d + 1] = fb[s + 1]; raw[d + 2] = fb[s];
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  writeFileSync(join(root, `test/out/${name}.png`), Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]));
  console.log("shot", name);
}
function crc32(buf: Buffer) {
  let c = ~0;
  for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; }
  return ~c;
}

// ----- guion de prueba -----
x.init(42);
frames(60);
shot("1-titulo");

// iniciar sesión: opción 4, escribir "Rai" + contraseña
press(B.DOWN, 3); press(B.CROSS);
frames(5);
press(B.TRIANGLE);            // MAYUS
press(B.DOWN, 2); press(B.RIGHT, 3); press(B.CROSS); // R (fila ASDF.. no: fila 2 = ASDFGHJKL_) -> F; se corrige abajo
press(B.SQUARE);              // borrar
press(B.UP); press(B.CROSS);  // fila QWERTYUIOP, col 3 -> R
press(B.TRIANGLE);            // minúsculas
press(B.DOWN); press(B.LEFT, 3); press(B.CROSS); // a
press(B.UP); press(B.RIGHT, 7); press(B.CROSS);  // i
frames(10);
shot("2-login-apodo");
press(B.OPTIONS);
press(B.CROSS, 3);
frames(10);
shot("3-login-clave");
reply = (fn) => fn === "login_player"
  ? [true, '[{"id":"11111111-2222-3333-4444-555555555555","secret":"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee","nickname":"Rai","save_data":{"koki-best":"42","koki-best-hard":"7"}}]']
  : fn === "global_leaderboard"
    ? [true, '[{"id":"1","nickname":"Raiterritory","score":88,"skin":"koki"},{"id":"2","nickname":"Rai","score":42,"skin":"taz"},{"id":"3","nickname":"Naomi","score":31,"skin":"koki"}]']
    : [true, ""];
press(B.OPTIONS);
frames(30);
shot("4-titulo-conectado");

// ranking
press(B.UP); press(B.CROSS);
frames(20);
shot("5-ranking");
press(B.CIRCLE);

// jugar: listo, saltar un rato y chocar
press(B.UP, 2); press(B.CROSS);
frames(20);
shot("6-listo");
press(B.CROSS);
for (let i = 0; i < 9; i++) { frames(17); press(B.CROSS); }
shot("7-jugando");
frames(400);
shot("8-game-over");
console.log("requests:\n" + requests.join("\n"));
