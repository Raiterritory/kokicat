// Auto-update for the Android app: on start, compares the installed version with the
// latest GitHub release. If there is a newer one, it offers to download the APK inside
// the app and opens Android's installer (Android always asks for that last "Install" tap).
import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { ensureNotifyPermission } from "./notify";

const REPO = "Raiterritory/kokicat";
const LATER_KEY = "koki-update-later";
const LATER_MS = 12 * 60 * 60 * 1000;

export type UpdateInfo = { version: string; notes: string[]; apkUrl: string; size: number };

// ---- Aviso en la barra de notificaciones ----
const BAR_ID = 90010;
const BAR_KIND = "kokicat-update";
let channelsReady = false;

async function bar(title: string, body: string, opts: { progress?: boolean } = {}) {
  if (!Capacitor.isNativePlatform() || !(await ensureNotifyPermission())) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    if (!channelsReady) {
      channelsReady = true;
      await LocalNotifications.createChannel({ id: "actualizaciones", name: "Actualizaciones", description: "Versiones nuevas de KokiCat", importance: 4, visibility: 1 }).catch(() => {});
      await LocalNotifications.createChannel({ id: "descargas", name: "Descarga de actualizaciones", description: "Progreso de la descarga", importance: 2, visibility: 1, vibration: false }).catch(() => {});
    }
    await LocalNotifications.schedule({
      notifications: [{
        id: BAR_ID, title, body,
        channelId: opts.progress ? "descargas" : "actualizaciones",
        ongoing: !!opts.progress, autoCancel: !opts.progress,
        extra: { kind: BAR_KIND },
      }],
    });
  } catch { /* sin notificación: queda la ventana dentro del juego */ }
}

async function clearBar() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.cancel({ notifications: [{ id: BAR_ID }] });
  } catch { /* nada que borrar */ }
}

const mbOf = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

/** Compares "1.10" with "1.9" number by number. >0 when a is newer. */
export function compareVersions(a: string, b: string) {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** Release notes as plain lines: only the bullet points, without markdown symbols. */
function notesFrom(body: string) {
  return body
    .split(/\r?\n/)
    .filter((l) => /^\s*[-*]\s+/.test(l))
    .map((l) => l.replace(/^\s*[-*]\s+/, "").replace(/\*\*/g, "").trim())
    .slice(0, 12);
}

export async function checkForUpdate(ignoreLater = false): Promise<UpdateInfo | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { App } = await import("@capacitor/app");
    const installed = (await App.getInfo()).version;
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    const rel = (await res.json()) as { tag_name?: string; body?: string; assets?: { name: string; browser_download_url: string; size: number }[] };
    const latest = String(rel.tag_name ?? "").replace(/^v/i, "");
    if (!latest || compareVersions(latest, installed) <= 0) {
      void clearBar(); // ya está al día: se quita un aviso viejo de la barra
      return null;
    }
    const apk = (rel.assets ?? []).find((a) => a.name.toLowerCase().endsWith(".apk"));
    if (!apk) return null;
    // "Más tarde": no volver a preguntar por esta misma versión durante unas horas
    try {
      const later = JSON.parse(localStorage.getItem(LATER_KEY) || "null") as { v: string; t: number } | null;
      if (!ignoreLater && later && later.v === latest && Date.now() - later.t < LATER_MS) return null;
    } catch { /* sin dato */ }
    return { version: latest, notes: notesFrom(rel.body ?? ""), apkUrl: apk.browser_download_url, size: apk.size };
  } catch {
    return null; // sin internet: se revisa la próxima vez
  }
}

/** Downloads the APK into the app's cache (reporting 0..1) and returns its file uri. */
async function downloadApk(u: UpdateInfo, onProgress: (p: number) => void) {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const { FileTransfer } = await import("@capacitor/file-transfer");
  const { uri } = await Filesystem.getUri({ directory: Directory.Cache, path: `KokiCat-${u.version}.apk` });
  let lastPct = -1;
  void bar(`Descargando KokiCat ${u.version}`, `0% · 0 de ${mbOf(u.size)} MB`, { progress: true });
  const listener = await FileTransfer.addListener("progress", (p) => {
    const total = p.lengthComputable && p.contentLength > 0 ? p.contentLength : u.size;
    if (total <= 0) return;
    const frac = Math.min(1, p.bytes / total);
    onProgress(frac);
    // la barra del teléfono se actualiza cada 5%
    const pct = Math.floor(frac * 20) * 5;
    if (pct !== lastPct) {
      lastPct = pct;
      void bar(`Descargando KokiCat ${u.version}`, `${pct}% · ${mbOf(p.bytes)} de ${mbOf(total)} MB`, { progress: true });
    }
  });
  try {
    await FileTransfer.downloadFile({ url: u.apkUrl, path: uri, progress: true });
  } catch (e) {
    void bar(`No se pudo descargar KokiCat ${u.version}`, "Toca para intentarlo de nuevo");
    throw e;
  } finally {
    await listener.remove();
  }
  void bar(`KokiCat ${u.version} lista para instalar`, "Toca para instalar la actualización 📲");
  return uri;
}

async function openInstaller(uri: string) {
  const { FileOpener } = await import("@capacitor-community/file-opener");
  await FileOpener.open({ filePath: uri, contentType: "application/vnd.android.package-archive", openWithDefault: true });
}

type Step = "ask" | "downloading" | "ready" | "error";

/** Window that appears on start when a newer version is published. */
export function UpdatePrompt() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [step, setStep] = useState<Step>("ask");
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState<string | null>(null);

  const fileRef = useRef<string | null>(null);
  fileRef.current = file;

  useEffect(() => {
    let alive = true;
    void checkForUpdate().then((u) => {
      if (!alive || !u) return;
      setInfo(u);
      void bar(`¡Nueva versión ${u.version} de KokiCat!`, "Toca para descargarla y actualizar 🎉");
    });
    // tocar el aviso de la barra: abre el instalador si ya se descargó, o vuelve a mostrar la ventana
    let remove: (() => void) | null = null;
    if (Capacitor.isNativePlatform()) {
      void import("@capacitor/local-notifications").then(async ({ LocalNotifications }) => {
        const h = await LocalNotifications.addListener("localNotificationActionPerformed", (a) => {
          if (a.notification.extra?.kind !== BAR_KIND) return;
          if (fileRef.current) { void openInstaller(fileRef.current); return; }
          void checkForUpdate(true).then((u) => { if (u) { setInfo(u); setStep("ask"); } });
        });
        if (alive) remove = () => void h.remove(); else void h.remove();
      });
    }
    return () => { alive = false; remove?.(); };
  }, []);

  if (!info) return null;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const start = async () => {
    setStep("downloading");
    setProgress(0);
    try {
      const uri = file ?? (await downloadApk(info, setProgress));
      setFile(uri);
      setStep("ready");
      await openInstaller(uri);
    } catch {
      setStep("error");
    }
  };

  const later = () => {
    try { localStorage.setItem(LATER_KEY, JSON.stringify({ v: info.version, t: Date.now() })); } catch { /* sin almacenamiento */ }
    setInfo(null);
  };

  const mb = (info.size / 1024 / 1024).toFixed(1);
  const btn = "w-full rounded-full px-6 py-3 text-lg font-black active:translate-y-0.5 disabled:opacity-60";

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onPointerDown={stop} onClick={stop}>
      <div className="flex max-h-[92vh] w-full max-w-sm flex-col rounded-3xl border-2 border-white/10 bg-gradient-to-b from-indigo-900 to-slate-900 p-5 text-white shadow-2xl">
        <div className="text-center text-4xl">🎉</div>
        <h2 className="text-center text-2xl font-black">¡Nueva versión {info.version}!</h2>
        <div className="mb-3 text-center text-xs font-bold text-white/60">Descarga de {mb} MB · tus datos se mantienen</div>
        {info.notes.length > 0 && (
          <ul className="mb-3 flex-1 space-y-1 overflow-y-auto rounded-2xl bg-black/30 p-3 text-xs leading-snug text-white/85">
            {info.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        )}

        {step === "downloading" && (
          <div className="mb-3">
            <div className="h-3 w-full overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <div className="mt-1 text-center text-xs font-bold text-white/70">Descargando… {Math.round(progress * 100)}%</div>
          </div>
        )}
        {step === "ready" && (
          <div className="mb-3 text-center text-xs text-white/70">
            Toca <b>Instalar</b> en la ventana de Android. Si te pide permiso para instalar apps de KokiCat, actívalo y vuelve aquí.
          </div>
        )}
        {step === "error" && (
          <div className="mb-3 text-center text-xs font-bold text-red-300">No se pudo descargar. Revisa tu internet e intenta de nuevo.</div>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={start}
            disabled={step === "downloading"}
            className={`${btn} bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-[0_4px_0_rgb(6_78_59)]`}
          >
            {step === "ready" ? "📲 Instalar" : step === "error" ? "🔄 Reintentar" : step === "downloading" ? "Descargando…" : "⬇️ Actualizar"}
          </button>
          {step !== "downloading" && (
            <button onClick={later} className={`${btn} bg-white/10 text-white/80`}>Más tarde</button>
          )}
        </div>
      </div>
    </div>
  );
}
