// Online leaderboard client. Talks to the backend straight from the browser
// (absolute URL), so it also works inside the offline APK when there is internet.
import { supabase } from "@/integrations/supabase/client";

export type BoardMode = "normal" | "hard";
/** skin: id of the character the player uses (missing until the server has migration 0007). */
export type BoardRow = { id: string; nickname: string; score: number; skin?: string };
export type FriendRow = { id: string; nickname: string; status: "friend" | "sent" | "incoming" };
export type Player = { id: string; secret: string; nickname: string };

const KEY = "koki-player";

export function getPlayer(): Player | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Player) : null;
  } catch {
    return null;
  }
}

export async function registerPlayer(nick: string): Promise<{ player?: Player; error?: string }> {
  const { data, error } = await supabase.rpc("register_player", { p_nick: nick });
  if (error) {
    if (error.message.includes("nick_taken")) return { error: "Ese apodo ya existe" };
    if (error.message.includes("invalid_nick")) return { error: "Usa 3-16 letras o números" };
    return { error: "Sin conexión, intenta de nuevo" };
  }
  const row = (data as Player[])[0];
  localStorage.setItem(KEY, JSON.stringify(row));
  window.dispatchEvent(new Event("koki-player"));
  return { player: row };
}

/** Deletes your online account (nickname, scores, friends). Local game data is kept. */
export async function deletePlayer(): Promise<{ ok: boolean; error?: string }> {
  const p = getPlayer();
  if (!p) return { ok: true };
  // delete_player comes from migration 0004
  const { error } = await (supabase.rpc as unknown as (
    fn: string, args: Record<string, unknown>,
  ) => Promise<{ error: { message: string } | null }>)("delete_player", { p_id: p.id, p_secret: p.secret });
  if (error) {
    if (/delete_player|function|schema cache/i.test(error.message)) {
      return { ok: false, error: "El servidor aún no tiene esta opción activada" };
    }
    if (error.message.includes("invalid_player")) {
      // la cuenta ya no existe en el servidor: basta con olvidarla aquí
    } else {
      return { ok: false, error: "Sin conexión, intenta de nuevo" };
    }
  }
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("koki-player"));
  return { ok: true };
}

// ---- Recuperar el perfil (migración 0009): código de recuperación + copia del guardado ----

type Rpc = (fn: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
// Se llama como método (supabase.rpc(...)) para no perder el `this` del cliente,
// y cualquier error inesperado vuelve como { error } en vez de dejar la pantalla esperando.
const rpc: Rpc = async (fn, a) => {
  try {
    return await (supabase.rpc as unknown as Rpc)(fn, a);
  } catch (e) {
    return { data: null, error: { message: String(e) } };
  }
};
const RECOVERY_KEY = "koki-recovery";
const missingFn = (msg: string) => /function|schema cache/i.test(msg);

/** "7F3A9C21B04ED85C" -> "7F3A-9C21-B04E-D85C" */
export const formatRecoveryCode = (code: string) => code.replace(/(.{4})(?=.)/g, "$1-");

/** The code that, together with the nickname, recovers this profile after reinstalling the app. */
export async function getRecoveryCode(): Promise<{ code?: string; error?: string }> {
  const p = getPlayer();
  if (!p) return { error: "Primero crea tu usuario online" };
  const cached = localStorage.getItem(RECOVERY_KEY);
  const { data, error } = await rpc("get_recovery_code", { p_id: p.id, p_secret: p.secret });
  if (error || typeof data !== "string") {
    if (cached) return { code: cached };
    return { error: error && missingFn(error.message) ? "El servidor aún no tiene esta opción activada" : "Sin conexión, intenta de nuevo" };
  }
  localStorage.setItem(RECOVERY_KEY, data);
  void backupProfile();
  return { code: data };
}

/** Keeps a copy of the save (pastelitos, characters, records, skin) online, without the account key. */
export async function backupProfile() {
  const p = getPlayer();
  if (!p) return;
  const { currentData } = await import("./save-data");
  const data = currentData();
  delete data["koki-player"];
  await rpc("save_profile", { p_id: p.id, p_secret: p.secret, p_data: data });
}

/** Signs this phone into an existing profile with nickname + recovery code, and restores its save. */
export async function recoverPlayer(nick: string, code: string): Promise<{ player?: Player; restored?: boolean; error?: string }> {
  const { data, error } = await rpc("recover_player", { p_nick: nick, p_code: code });
  if (error) {
    if (error.message.includes("invalid_code")) return { error: "El apodo o el código no coinciden" };
    if (missingFn(error.message)) return { error: "El servidor aún no tiene esta opción activada" };
    return { error: "Sin conexión, intenta de nuevo" };
  }
  const row = (data as ProfileRow[])[0];
  if (!row) return { error: "El apodo o el código no coinciden" };
  localStorage.setItem(RECOVERY_KEY, code.replace(/[^0-9a-f]/gi, "").toUpperCase());
  return adoptProfile(row);
}

type ProfileRow = { id: string; secret: string; nickname: string; save_data: Record<string, unknown> | null };

/** Uses a recovered profile on this phone: account, its save, and the higher records. */
async function adoptProfile(row: ProfileRow): Promise<{ player: Player; restored: boolean }> {
  const player = { id: row.id, secret: row.secret, nickname: row.nickname };
  localStorage.setItem(KEY, JSON.stringify(player));

  let restored = false;
  if (row.save_data && typeof row.save_data === "object") {
    const { applySave } = await import("./save-data");
    const strings: Record<string, string> = {};
    for (const [k, v] of Object.entries(row.save_data)) if (typeof v === "string" && k !== "koki-player") strings[k] = v;
    applySave({ app: "kokicat", version: 1, exportedAt: "", data: strings });
    restored = true;
  }
  // Los récords del ranking nunca bajan al recuperar: se toma el mayor entre el servidor y este teléfono
  for (const [mode, key] of [["normal", "koki-best"], ["hard", "koki-best-hard"]] as const) {
    const rows = await friendsBoard(mode);
    const mine = rows?.find((r) => r.id === player.id)?.score ?? 0;
    if (mine > Number(localStorage.getItem(key) || 0)) localStorage.setItem(key, String(mine));
  }
  window.dispatchEvent(new Event("koki-player"));
  return { player, restored };
}

// ---- Contraseña (migración 0011) ----

/** true / false, or null when it can't be known (offline or server without the option). */
export async function hasPassword(): Promise<boolean | null> {
  const p = getPlayer();
  if (!p) return null;
  const { data, error } = await rpc("has_password", { p_id: p.id, p_secret: p.secret });
  return error || typeof data !== "boolean" ? null : data;
}

export async function setPassword(password: string): Promise<{ ok: boolean; error?: string }> {
  const p = getPlayer();
  if (!p) return { ok: false, error: "Primero crea tu usuario online" };
  if (password.length < 6) return { ok: false, error: "Usa al menos 6 caracteres" };
  const { error } = await rpc("set_password", { p_id: p.id, p_secret: p.secret, p_password: password });
  if (!error) return { ok: true };
  if (error.message.includes("invalid_password")) return { ok: false, error: "Usa entre 6 y 64 caracteres" };
  if (missingFn(error.message)) return { ok: false, error: "El servidor aún no tiene esta opción activada" };
  return { ok: false, error: "Sin conexión, intenta de nuevo" };
}

/** Nickname + password -> signs this phone into that profile and restores its save. */
export async function loginPlayer(nick: string, password: string): Promise<{ player?: Player; restored?: boolean; error?: string }> {
  const { data, error } = await rpc("login_player", { p_nick: nick, p_password: password });
  if (error) {
    if (error.message.includes("locked")) return { error: "Demasiados intentos. Espera 10 minutos" };
    if (error.message.includes("invalid_login")) return { error: "El apodo o la contraseña no coinciden" };
    if (missingFn(error.message)) return { error: "El servidor aún no tiene esta opción activada" };
    return { error: "Sin conexión, intenta de nuevo" };
  }
  const row = (data as ProfileRow[] | null)?.[0];
  if (!row) return { error: "El apodo o la contraseña no coinciden" };
  return adoptProfile(row);
}

/** Tells the server which skin this player uses, so it shows next to their name in the ranking. */
export async function syncSkin() {
  const p = getPlayer();
  if (!p) return;
  // set_skin is added by migration 0007; not yet in the generated types
  await (supabase.rpc as unknown as (fn: string, a: Record<string, unknown>) => Promise<unknown>)(
    "set_skin", { p_id: p.id, p_secret: p.secret, p_skin: localStorage.getItem("koki-selected") || "koki" },
  );
}

/**
 * Uploads local records exactly as they are on this device (they can go down,
 * e.g. after wiping the save). Falls back to the max-only submit_score while
 * the set_score function (migration 0005) is not on the server yet.
 */
export async function syncScores(): Promise<boolean> {
  return (await syncScoresExact()) !== "error";
}

/** "exact": server now matches this device; "maxOnly": server can only raise scores (set_score missing). */
export async function syncScoresExact(): Promise<"exact" | "maxOnly" | "error" | "noPlayer"> {
  const p = getPlayer();
  if (!p) return "noPlayer";
  const args = {
    p_id: p.id,
    p_secret: p.secret,
    p_normal: Number(localStorage.getItem("koki-best") || 0),
    p_hard: Number(localStorage.getItem("koki-best-hard") || 0),
  };
  const { error } = await (supabase.rpc as unknown as (
    fn: string, a: Record<string, unknown>,
  ) => Promise<{ error: { message: string } | null }>)("set_score", args);
  void syncSkin();
  void backupProfile();
  if (!error) return "exact";
  if (!/set_score|function|schema cache/i.test(error.message)) return "error";
  const fallback = await supabase.rpc("submit_score", args);
  return fallback.error ? "error" : "maxOnly";
}

export async function globalBoard(mode: BoardMode): Promise<BoardRow[] | null> {
  const { data, error } = await supabase.rpc("global_leaderboard", { p_mode: mode, p_limit: 50 });
  return error ? null : (data as BoardRow[]);
}

export async function friendsBoard(mode: BoardMode): Promise<BoardRow[] | null> {
  const p = getPlayer();
  if (!p) return null;
  const { data, error } = await supabase.rpc("friends_leaderboard", {
    p_id: p.id, p_secret: p.secret, p_mode: mode,
  });
  return error ? null : (data as BoardRow[]);
}

/** Rivals to beat during a run: friends if you have any, otherwise global. Never includes you. */
export async function loadRivals(mode: BoardMode): Promise<BoardRow[]> {
  const p = getPlayer();
  const fr = p ? await friendsBoard(mode) : null;
  const rows = fr && fr.length > 1 ? fr : await globalBoard(mode);
  return (rows ?? []).filter((r) => r.id !== p?.id && r.score > 0);
}

export async function searchPlayers(q: string): Promise<{ id: string; nickname: string }[]> {
  const p = getPlayer();
  if (!p) return [];
  const { data } = await supabase.rpc("search_players", { p_id: p.id, p_secret: p.secret, p_query: q });
  return (data as { id: string; nickname: string }[]) ?? [];
}

export async function myFriends(): Promise<FriendRow[]> {
  const p = getPlayer();
  if (!p) return [];
  const { data } = await supabase.rpc("my_friends", { p_id: p.id, p_secret: p.secret });
  return (data as FriendRow[]) ?? [];
}

export async function sendRequest(to: string) {
  const p = getPlayer();
  if (!p) return;
  await supabase.rpc("send_friend_request", { p_id: p.id, p_secret: p.secret, p_to: to });
}

export async function respondRequest(from: string, accept: boolean) {
  const p = getPlayer();
  if (!p) return;
  await supabase.rpc("respond_friend_request", { p_id: p.id, p_secret: p.secret, p_from: from, p_accept: accept });
}

export async function removeFriend(other: string) {
  const p = getPlayer();
  if (!p) return;
  await supabase.rpc("remove_friend", { p_id: p.id, p_secret: p.secret, p_other: other });
}
