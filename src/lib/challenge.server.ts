// Server side of "X quiere jugar contigo": checks the challenger, keeps only accepted friends
// and sends them a push notification through Firebase.
import type { SupabaseClient } from "@supabase/supabase-js";
import { readServiceAccount, sendPush } from "./fcm.server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Body = { p_id?: string; p_secret?: string; to?: string[]; room?: string; mode?: string; rounds?: number };

export async function handleChallenge(request: Request, headers: Record<string, string>) {
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...headers, "content-type": "application/json" } });

  let b: Body;
  try { b = (await request.json()) as Body; } catch { return reply(400, { error: "bad_json" }); }
  const to = Array.isArray(b.to) ? b.to.filter((x) => typeof x === "string" && UUID.test(x)) : [];
  if (!b.p_id || !UUID.test(b.p_id) || !b.p_secret || !UUID.test(b.p_secret) || !to.length || to.length > 2
    || !b.room || !/^[a-z0-9]{4,16}$/.test(b.room)) {
    return reply(400, { error: "bad_request" });
  }
  const mode = b.mode === "hard" ? "hard" : b.mode === "taz" ? "taz" : "normal";
  const rounds = b.rounds === 2 ? 2 : 3;

  const sa = readServiceAccount();
  if (!sa) return reply(503, { error: "push_not_configured" });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // push_tokens is newer than the generated types
  const db = supabaseAdmin as unknown as SupabaseClient;

  const { data: me } = await db.from("players").select("id,nickname").eq("id", b.p_id).eq("secret", b.p_secret).maybeSingle();
  if (!me) return reply(403, { error: "invalid_player" });

  // Solo amigos aceptados pueden recibir el reto
  const { data: links } = await db.from("friendships").select("requester,addressee")
    .eq("accepted", true).or(`requester.eq.${me.id},addressee.eq.${me.id}`);
  const friends = new Set((links ?? []).map((l) => (l.requester === me.id ? l.addressee : l.requester)));
  const targets = to.filter((id) => friends.has(id));
  if (!targets.length) return reply(200, { sent: 0 });

  const { data: people } = await db.from("players").select("id,nickname").in("id", to);
  const { data: rows } = await db.from("push_tokens").select("token").in("player_id", targets);
  const tokens = (rows ?? []).map((r) => r.token as string);
  if (!tokens.length) return reply(200, { sent: 0 });

  const players = to.length + 1;
  const { sent, dead } = await sendPush(sa, tokens, {
    title: `${me.nickname} quiere jugar contigo`,
    body: `${mode === "hard" ? "🔥 Difícil" : mode === "taz" ? "🐈‍⬛ Atrapa al Taz" : "Normal"} · ${rounds} rondas · ${players} jugadores · Toca para aceptar ⚔️`,
    tag: `reto-${b.room}`,
    data: {
      type: "challenge",
      room: b.room,
      mode,
      rounds: String(rounds),
      fromId: me.id,
      fromName: me.nickname,
      players: JSON.stringify(people ?? []),
      sentAt: String(Date.now()),
    },
  });
  if (dead.length) await db.from("push_tokens").delete().in("token", dead);
  return reply(200, { sent });
}
