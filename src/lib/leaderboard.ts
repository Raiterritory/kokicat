// Online leaderboard client. Talks to the backend straight from the browser
// (absolute URL), so it also works inside the offline APK when there is internet.
import { supabase } from "@/integrations/supabase/client";

export type BoardMode = "normal" | "hard";
export type BoardRow = { id: string; nickname: string; score: number };
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
  // delete_player is added by migration 0001; not yet in the generated types
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

/**
 * Uploads local records exactly as they are on this device (they can go down,
 * e.g. after wiping the save). Falls back to the max-only submit_score while
 * the set_score function (migration 0002) is not on the server yet.
 */
export async function syncScores(): Promise<boolean> {
  const p = getPlayer();
  if (!p) return false;
  const args = {
    p_id: p.id,
    p_secret: p.secret,
    p_normal: Number(localStorage.getItem("koki-best") || 0),
    p_hard: Number(localStorage.getItem("koki-best-hard") || 0),
  };
  const { error } = await (supabase.rpc as unknown as (
    fn: string, a: Record<string, unknown>,
  ) => Promise<{ error: { message: string } | null }>)("set_score", args);
  if (!error) return true;
  if (!/set_score|function|schema cache/i.test(error.message)) return false;
  const fallback = await supabase.rpc("submit_score", args);
  return !fallback.error;
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
