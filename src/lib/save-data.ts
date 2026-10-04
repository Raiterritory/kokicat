// Export / import of the local save (pastelitos, characters, records, sound and online account).
import { Capacitor } from "@capacitor/core";

const SAVE_KEYS = [
  "koki-coins", "koki-unlocked", "koki-selected", "koki-best", "koki-best-hard",
  "koki-vol-music", "koki-vol-sfx", "koki-player",
] as const;

export type SaveFile = { app: "kokicat"; version: 1; exportedAt: string; data: Record<string, string> };

export type SaveSummary = { coins: number; best: number; bestHard: number; characters: number; nickname: string | null };

function readJSON<T>(raw: string | null | undefined, fallback: T): T {
  try { return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}

export function summarize(data: Record<string, string | null | undefined>): SaveSummary {
  return {
    coins: Number(data["koki-coins"] || 0),
    best: Number(data["koki-best"] || 0),
    bestHard: Number(data["koki-best-hard"] || 0),
    characters: readJSON<string[]>(data["koki-unlocked"], ["koki"]).length,
    nickname: readJSON<{ nickname?: string } | null>(data["koki-player"], null)?.nickname ?? null,
  };
}

export function currentData(): Record<string, string> {
  const data: Record<string, string> = {};
  for (const k of SAVE_KEYS) {
    const v = localStorage.getItem(k);
    if (v !== null) data[k] = v;
  }
  return data;
}

/** Saves a .json file: on the phone opens "Compartir / Guardar en…", on the web downloads it. */
export async function exportSave(): Promise<{ ok: boolean; msg: string }> {
  const save: SaveFile = { app: "kokicat", version: 1, exportedAt: new Date().toISOString(), data: currentData() };
  const json = JSON.stringify(save, null, 2);
  const name = `kokicat-guardado-${new Date().toISOString().slice(0, 10)}.json`;
  try {
    if (Capacitor.isNativePlatform()) {
      const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
      const { Share } = await import("@capacitor/share");
      const file = await Filesystem.writeFile({ path: name, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
      try {
        await Share.share({ title: "Datos de KokiCat", files: [file.uri], dialogTitle: "Guardar datos de KokiCat" });
      } catch (e) {
        if (/cancel/i.test(String(e))) return { ok: false, msg: "Exportación cancelada" };
        throw e;
      }
      return { ok: true, msg: "✅ Datos exportados" };
    }
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { ok: true, msg: `✅ Descargado: ${name}` };
  } catch {
    return { ok: false, msg: "No se pudo exportar" };
  }
}

/** Reads and validates a save file. Only known keys are kept. */
export function parseSave(text: string): SaveFile | null {
  const save = readJSON<Partial<SaveFile> | null>(text, null);
  if (!save || save.app !== "kokicat" || typeof save.data !== "object" || !save.data) return null;
  const data: Record<string, string> = {};
  for (const k of SAVE_KEYS) {
    const v = (save.data as Record<string, unknown>)[k];
    if (typeof v === "string") data[k] = v;
  }
  return { app: "kokicat", version: 1, exportedAt: String(save.exportedAt ?? ""), data };
}

/**
 * Applies an imported save. Records keep the highest value and characters are merged,
 * so importing never makes you lose progress on this device.
 */
export function applySave(save: SaveFile) {
  const cur = currentData();
  const imp = save.data;
  const next: Record<string, string> = { ...cur, ...imp };
  for (const k of ["koki-best", "koki-best-hard"] as const) {
    next[k] = String(Math.max(Number(cur[k] || 0), Number(imp[k] || 0)));
  }
  const unlocked = Array.from(new Set([
    ...readJSON<string[]>(cur["koki-unlocked"], ["koki"]),
    ...readJSON<string[]>(imp["koki-unlocked"], ["koki"]),
  ]));
  next["koki-unlocked"] = JSON.stringify(unlocked);
  if (next["koki-selected"] && !unlocked.includes(next["koki-selected"])) next["koki-selected"] = "koki";
  for (const [k, v] of Object.entries(next)) localStorage.setItem(k, v);
}
