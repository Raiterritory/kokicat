// Export / import of the local save (pastelitos, characters, records, sound and online account).
import { Capacitor } from "@capacitor/core";

const SAVE_KEYS = [
  "koki-coins", "koki-unlocked", "koki-selected", "koki-best", "koki-best-hard",
  "koki-vol-music", "koki-vol-sfx", "koki-player",
  "koki-best-taz", "koki-achievements", "koki-stats",
  // 2.9: estilo (gorros, lentes, estelas), misiones, racha y reto de hoy
  "koki-best-time", "koki-style", "koki-weekly", "koki-streak", "koki-daily",
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

/** Gorros, lentes y estelas comprados: se juntan los de ambos lados; lo puesto es lo de este teléfono. */
function mergeStyle(local: string | null | undefined, other: string | null | undefined): string | null {
  if (!other) return null;
  const a = readJSON<{ owned?: string[] }>(local, {});
  const b = readJSON<{ owned?: string[] }>(other, {});
  const base = local ? a : b;
  return JSON.stringify({ ...base, owned: Array.from(new Set([...(a.owned ?? []), ...(b.owned ?? [])])) });
}

type Weekly = { week: number; prog?: Record<string, number>; claimed?: string[]; kinds?: string[] };
type Streak = { last: string; count: number; best: number };
type Daily = { day: string; score: number; done: boolean; sent: boolean };
/**
 * Weekly missions (same week: each counter keeps the highest, claims and boss kinds are joined),
 * the streak (the most recent one wins; best is the highest) and today's challenge (played on
 * either device counts as played).
 */
export function mergeProgress(local: (k: string) => string | null | undefined, other: (k: string) => string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  const lw = readJSON<Weekly | null>(local("koki-weekly"), null), ow = readJSON<Weekly | null>(other("koki-weekly"), null);
  if (ow && (!lw || ow.week > lw.week)) out["koki-weekly"] = JSON.stringify(ow);
  else if (ow && lw && ow.week === lw.week) {
    const prog: Record<string, number> = { ...(lw.prog ?? {}) };
    for (const [k, v] of Object.entries(ow.prog ?? {})) if (typeof v === "number" && v > (prog[k] ?? 0)) prog[k] = v;
    const kinds = Array.from(new Set([...(lw.kinds ?? []), ...(ow.kinds ?? [])]));
    if (kinds.length) prog.bossKinds = Math.max(prog.bossKinds ?? 0, kinds.length);
    out["koki-weekly"] = JSON.stringify({ week: lw.week, prog, claimed: Array.from(new Set([...(lw.claimed ?? []), ...(ow.claimed ?? [])])), kinds });
  }
  const ls = readJSON<Streak | null>(local("koki-streak"), null), os = readJSON<Streak | null>(other("koki-streak"), null);
  if (os && os.last) {
    const best = Math.max(ls?.best ?? 0, os.best ?? 0);
    if (!ls || !ls.last || os.last > ls.last) out["koki-streak"] = JSON.stringify({ ...os, best });
    else if (os.last === ls.last) out["koki-streak"] = JSON.stringify({ last: ls.last, count: Math.max(ls.count, os.count), best });
    else if (best > ls.best) out["koki-streak"] = JSON.stringify({ ...ls, best });
  }
  const ld = readJSON<Daily | null>(local("koki-daily"), null), od = readJSON<Daily | null>(other("koki-daily"), null);
  if (od && od.day && (!ld || od.day > ld.day)) out["koki-daily"] = JSON.stringify(od);
  else if (od && ld && od.day === ld.day) {
    out["koki-daily"] = JSON.stringify({ day: ld.day, score: Math.max(ld.score, od.score), done: ld.done || od.done, sent: ld.sent });
  }
  return out;
}

/** Pastelitos que había en la nube la última vez que se juntó (cada aparato lleva el suyo). */
const COINS_SYNCED = "koki-coins-synced";
/** After adopting a profile from the cloud: from now on only this phone's changes are added. */
export function markCoinsSynced() {
  localStorage.setItem(COINS_SYNCED, localStorage.getItem("koki-coins") || "0");
}

/**
 * Merges the online save (written by this phone or by another device, like the PS4) into this
 * phone without losing anything: records keep the highest, characters and achievements are
 * joined, each stat keeps the highest, and pastelitos add up what changed on each device since the
 * last merge (what you earn on one and spend on the other both count). Returns true if something
 * changed here.
 */
export function mergeCloud(cloud: Record<string, unknown>): boolean {
  const str = (k: string) => (typeof cloud[k] === "string" ? (cloud[k] as string) : undefined);
  const before = JSON.stringify(currentData());
  const cloudCoins = str("koki-coins");
  if (cloudCoins !== undefined) {
    const local = Number(localStorage.getItem("koki-coins") || 0);
    const c = Number(cloudCoins) || 0;
    const synced = localStorage.getItem(COINS_SYNCED);
    const merged = synced === null ? Math.max(c, local) : Math.max(0, c + (local - Number(synced)));
    localStorage.setItem("koki-coins", String(merged));
  }
  markCoinsSynced();
  for (const k of ["koki-best", "koki-best-hard", "koki-best-taz", "koki-best-time"] as const) {
    const v = Math.max(Number(localStorage.getItem(k) || 0), Number(str(k) || 0));
    if (v > 0) localStorage.setItem(k, String(v));
  }
  const unlocked = Array.from(new Set([
    ...readJSON<string[]>(localStorage.getItem("koki-unlocked"), ["koki"]),
    ...readJSON<string[]>(str("koki-unlocked"), []),
  ]));
  localStorage.setItem("koki-unlocked", JSON.stringify(unlocked));
  const achievements = {
    ...readJSON<Record<string, number>>(str("koki-achievements"), {}),
    ...readJSON<Record<string, number>>(localStorage.getItem("koki-achievements"), {}),
  };
  localStorage.setItem("koki-achievements", JSON.stringify(achievements));
  const stats = readJSON<Record<string, number>>(localStorage.getItem("koki-stats"), {});
  for (const [k, v] of Object.entries(readJSON<Record<string, number>>(str("koki-stats"), {}))) {
    if (typeof v === "number" && v > (stats[k] ?? 0)) stats[k] = v;
  }
  localStorage.setItem("koki-stats", JSON.stringify(stats));
  const style = mergeStyle(localStorage.getItem("koki-style"), str("koki-style"));
  if (style) localStorage.setItem("koki-style", style);
  // misiones, racha y reto de hoy: lo jugado en otro aparato (la PS4) también cuenta aquí
  const progress = mergeProgress((k) => localStorage.getItem(k), str);
  for (const [k, v] of Object.entries(progress)) localStorage.setItem(k, v);
  return before !== JSON.stringify(currentData());
}

/**
 * Applies an imported save. Records keep the highest value and characters are merged,
 * so importing never makes you lose progress on this device.
 */
export function applySave(save: SaveFile) {
  const cur = currentData();
  const imp = save.data;
  const next: Record<string, string> = { ...cur, ...imp };
  for (const k of ["koki-best", "koki-best-hard", "koki-best-taz"] as const) {
    next[k] = String(Math.max(Number(cur[k] || 0), Number(imp[k] || 0)));
  }
  // logros: se juntan los de ambos; estadísticas: el mayor de cada contador
  const achievements = { ...readJSON<Record<string, number>>(imp["koki-achievements"], {}), ...readJSON<Record<string, number>>(cur["koki-achievements"], {}) };
  next["koki-achievements"] = JSON.stringify(achievements);
  const sCur = readJSON<Record<string, number>>(cur["koki-stats"], {});
  const sImp = readJSON<Record<string, number>>(imp["koki-stats"], {});
  const stats: Record<string, number> = { ...sImp };
  for (const [k, v] of Object.entries(sCur)) stats[k] = Math.max(v, stats[k] ?? 0);
  next["koki-stats"] = JSON.stringify(stats);
  const unlocked = Array.from(new Set([
    ...readJSON<string[]>(cur["koki-unlocked"], ["koki"]),
    ...readJSON<string[]>(imp["koki-unlocked"], ["koki"]),
  ]));
  next["koki-unlocked"] = JSON.stringify(unlocked);
  const style = mergeStyle(cur["koki-style"], imp["koki-style"]);
  if (style) next["koki-style"] = style;
  if (next["koki-selected"] && !unlocked.includes(next["koki-selected"])) next["koki-selected"] = "koki";
  for (const [k, v] of Object.entries(next)) localStorage.setItem(k, v);
}
