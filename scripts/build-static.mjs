// Builds a fully static, offline-ready copy of the game into ./dist-static
//
// Steps:
//   1. run the normal production build (vite build)
//   2. render "/" once using the built server bundle (no network needed)
//   3. copy dist/client + the rendered index.html into dist-static
//
// The result is a plain folder with index.html + assets, ready to be wrapped
// with Capacitor / PWABuilder into an offline APK.
import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const CLIENT_DIR = join(ROOT, "dist", "client");
const SERVER_ENTRY = join(ROOT, "dist", "server", "index.mjs");
const OUT_DIR = join(ROOT, "dist-static");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".woff2": "font/woff2",
};

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: "inherit", cwd: ROOT, shell: false });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

// Minimal stand-in for the Cloudflare ASSETS binding, reading from dist/client.
const assets = {
  async fetch(request) {
    const url = new URL(typeof request === "string" ? request : request.url);
    const filePath = normalize(join(CLIENT_DIR, decodeURIComponent(url.pathname)));
    if (!filePath.startsWith(CLIENT_DIR) || !existsSync(filePath)) {
      return new Response("Not found", { status: 404 });
    }
    const body = await readFile(filePath);
    return new Response(body, {
      headers: { "content-type": MIME[extname(filePath)] ?? "application/octet-stream" },
    });
  },
};

async function main() {
  run("bun", ["run", "build"]);

  const mod = await import(pathToFileURL(SERVER_ENTRY).toString());
  const handler = mod.default;
  const response = await handler.fetch(new Request("http://localhost/"), { ASSETS: assets }, {
    waitUntil() {},
    passThroughOnException() {},
  });

  if (response.status !== 200) {
    console.error(`Prerender failed: ${response.status} ${response.statusText}`);
    console.error((await response.text()).slice(0, 800));
    process.exit(1);
  }

  const html = await response.text();

  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });
  await cp(CLIENT_DIR, OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, "index.html"), html, "utf8");

  console.log(`\n✔ Static build ready: dist-static/index.html`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
