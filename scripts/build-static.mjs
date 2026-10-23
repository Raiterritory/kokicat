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
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
// En algunas PCs el build queda en ./dist y en otras en ./.output (nitro).
// Se revisa después del build cuál existe.
let CLIENT_DIR = join(ROOT, "dist", "client");
let SERVER_ENTRY = join(ROOT, "dist", "server", "index.mjs");
function resolveBuildDirs() {
  if (!existsSync(SERVER_ENTRY) && existsSync(join(ROOT, ".output", "server", "index.mjs"))) {
    CLIENT_DIR = join(ROOT, ".output", "public");
    SERVER_ENTRY = join(ROOT, ".output", "server", "index.mjs");
  }
}
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
  const res = spawnSync(cmd, args, { stdio: "inherit", cwd: ROOT, shell: process.platform === "win32" });
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
  // Push con Firebase solo si el APK lleva android/app/google-services.json
  process.env.VITE_FCM_ENABLED = existsSync(join(ROOT, "android", "app", "google-services.json")) ? "true" : "false";
  console.log(`Push Firebase: ${process.env.VITE_FCM_ENABLED === "true" ? "activado" : "sin google-services.json (desactivado)"}`);
  run("bun", ["run", "build"]);
  resolveBuildDirs();

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
  await rm(join(OUT_DIR, "_headers"), { force: true });
  // El APK se reconoce a sí mismo con este marcador, así el horario de la web nunca
  // bloquea la app de Android (ver src/lib/web-hours.ts).
  const APP_MARKER = '<meta name="kokicat-app" content="apk"><script>window.__KOKICAT_APK__=true;</script>';
  const marked = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + APP_MARKER) : APP_MARKER + html;
  await writeFile(join(OUT_DIR, "index.html"), marked, "utf8");

  await downloadUploadedAssets();

  console.log(`\n✔ Static build ready: dist-static/index.html`);
}

// Las imágenes y audios subidos por Lovable viven en /__l5e/... y no están en el
// repo. Para que el APK funcione sin internet hay que meterlos en el paquete.
// Primero se buscan en el servidor local (que ya trae los archivos del build) y,
// si no están, se bajan de la web publicada. Si tampoco se encuentran, el build
// falla: es mejor no publicar un APK con imágenes rotas.
const FALLBACK_BASE = process.env.ASSET_FALLBACK ?? "https://kokicat.lovable.app";

async function fetchAsset(url) {
  try {
    const res = await fetch(url);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
  } catch {
    /* servidor local apagado: se prueba la web publicada */
  }
  return null;
}

async function downloadUploadedAssets() {
  const base = process.env.ASSET_BASE ?? "http://localhost:8080";
  const dir = join(ROOT, "src", "assets");
  if (!existsSync(dir)) return;

  const files = (await readdir(dir)).filter((f) => f.endsWith(".asset.json"));
  for (const file of files) {
    const meta = JSON.parse(await readFile(join(dir, file), "utf8"));
    if (!meta.url?.startsWith("/")) continue;
    const target = join(OUT_DIR, ...meta.url.split("/").filter(Boolean));
    const local = join(CLIENT_DIR, ...meta.url.split("/").filter(Boolean));
    // si el archivo ya viene dentro del build (por ejemplo, está en public/), no se descarga
    if (existsSync(local)) {
      await mkdir(join(target, ".."), { recursive: true });
      await writeFile(target, await readFile(local));
      continue;
    }
    const body = (await fetchAsset(base + meta.url)) ?? (await fetchAsset(FALLBACK_BASE + meta.url));
    if (!body) {
      console.error(`No se pudo descargar ${meta.url} ni de ${base} ni de ${FALLBACK_BASE}.`);
      console.error("Arranca el servidor local o define ASSET_BASE / ASSET_FALLBACK.");
      process.exit(1);
    }
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, body);
    console.log(`  ↓ ${meta.url}`);
  }
}


main().catch((error) => {
  console.error(error);
  process.exit(1);
});
