// Live multiplayer over Supabase Realtime (broadcast + presence, no tables).
// - "koki-lobby": who is online + invitations between friends.
// - "koki-match-<room>": one match of 2-3 players, N rounds on the same seed.
// The inviter is the host: it decides when rounds start and their seeds.
import { useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getPlayer, modeLabel, type BoardMode } from "./leaderboard";
import { ensureNotifyPermission, notifyChallenge } from "./notify";
import { pushActive, pushChallenge, savePushToken } from "./push";

export type Who = { id: string; nickname: string };
export type Invite = { room: string; mode: BoardMode; rounds: number; from: Who; others: Who[] };
export type Reply = "pending" | "accepted" | "declined" | "expired";
/** Shown to the challenger when nobody joined: who declined and who did not answer in time. */
export type Rejection = { declined: string[]; expired: string[] };
export type Outgoing = { room: string; mode: BoardMode; rounds: number; to: Who[]; replies: Record<string, Reply> };
export type Phase = "lobby" | "countdown" | "playing" | "roundEnd" | "done";
export type Match = {
  room: string;
  hostId: string;
  mode: BoardMode;
  rounds: number;
  me: Who;
  players: Who[];
  round: number;
  countdown: number;
  phase: Phase;
  wins: Record<string, number>;
  totals: Record<string, number>;
  scores: Record<string, number>; // this round, filled as players crash
  roundWinners: string[];
  left: string[];
  rematch: string[];
};
export type Ghost = { nickname: string; y: number; rot: number; score: number; alive: boolean; dy: number | null };

type State = {
  online: string[]; incoming: Invite | null; outgoing: Outgoing | null; match: Match | null; notice: string | null;
  rejected: Rejection | null;
};

// 60 s: da tiempo a abrir la app desde la notificación aunque estuviera cerrada
const INVITE_MS = 60000;
const COUNTDOWN = 3;
const NEXT_ROUND_MS = 4000;

let state: State = { online: [], incoming: null, outgoing: null, match: null, notice: null, rejected: null };
const subs = new Set<() => void>();
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  subs.forEach((f) => f());
}
function setMatch(patch: Partial<Match>) {
  if (state.match) set({ match: { ...state.match, ...patch } });
}
export const getMp = () => state;
export function useMp() {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
    () => state,
    () => state,
  );
}

/** Other players in the current match, keyed by id. Updated ~8 times/s, read by the canvas loop. */
export const ghosts: Record<string, Ghost> = {};

let roundStarter: ((seed: number, mode: BoardMode) => void) | null = null;
export function setRoundStarter(fn: typeof roundStarter) { roundStarter = fn; }

export const isHost = (m: Match) => m.hostId === m.me.id;
export const activePlayers = (m: Match) => m.players.filter((p) => !m.left.includes(p.id));

function notify(msg: string) {
  set({ notice: msg });
  setTimeout(() => { if (state.notice === msg) set({ notice: null }); }, 3500);
}
const randomId = () => Math.random().toString(36).slice(2, 10);

// ---------------- Lobby ----------------

let lobby: RealtimeChannel | null = null;
let lobbyFor: string | null = null;
// Identity captured when joining the lobby (used by every later call).
let self: Who | null = null;
const lobbySend = (event: string, payload: Record<string, unknown>) =>
  lobby?.send({ type: "broadcast", event, payload });

/** Connects to the lobby once a nickname exists. Safe to call repeatedly. */
export function initLobby() {
  const me = getPlayer();
  if (!me) {
    // usuario eliminado: desconectarse del lobby
    if (lobby) void supabase.removeChannel(lobby);
    lobby = null;
    lobbyFor = null;
    self = null;
    set({ online: [], incoming: null });
    return;
  }
  if (lobbyFor === me.id) return;
  if (lobby) void supabase.removeChannel(lobby);
  lobbyFor = me.id;
  self = { id: me.id, nickname: me.nickname };
  // quien tiene usuario online puede recibir retos: pedir permiso de notificaciones
  void ensureNotifyPermission();
  void savePushToken();
  const ch = supabase.channel("koki-lobby", { config: { presence: { key: me.id } } });
  ch.on("presence", { event: "sync" }, () => set({ online: Object.keys(ch.presenceState()) }))
    .on("broadcast", { event: "invite" }, ({ payload }) => onInvite(payload))
    .on("broadcast", { event: "reply" }, ({ payload }) => onReply(payload))
    .on("broadcast", { event: "cancel" }, ({ payload }) => {
      if (state.incoming?.room === payload.room) set({ incoming: null });
    })
    .subscribe((s) => { if (s === "SUBSCRIBED") void ch.track({ nickname: me.nickname }); });
  lobby = ch;
}

function onInvite(p: { room: string; mode: BoardMode; rounds: number; from: Who; to: Who[] }) {
  const me = self;
  if (!me || !p.to.some((t) => t.id === me.id)) return;
  if (state.match || state.outgoing || state.incoming) {
    void lobbySend("reply", { room: p.room, from: me.id, accept: false });
    return;
  }
  set({ incoming: { room: p.room, mode: p.mode, rounds: p.rounds, from: p.from, others: p.to.filter((t) => t.id !== me.id) } });
  setTimeout(() => { if (state.incoming?.room === p.room) set({ incoming: null }); }, INVITE_MS);
  const players = p.to.length + 1;
  // con Firebase activo y la app en segundo plano, el sistema ya muestra el aviso push
  if (pushActive() && typeof document !== "undefined" && document.visibilityState !== "visible") return;
  void notifyChallenge(p.from.nickname, `${modeLabel(p.mode)} · ${p.rounds} rondas · ${players} jugadores`);
}

function onReply(p: { room: string; from: string; accept: boolean }) {
  const o = state.outgoing;
  if (!o || o.room !== p.room || o.replies[p.from] !== "pending") return;
  const who = o.to.find((t) => t.id === p.from);
  if (!p.accept && who && o.to.length > 1) notify(`${who.nickname} no es suitjus`);
  set({ outgoing: { ...o, replies: { ...o.replies, [p.from]: p.accept ? "accepted" : "declined" } } });
  maybeStart();
}

export function sendInvite(to: Who[], mode: BoardMode, rounds: number) {
  const me = self;
  if (!me || !to.length || state.match) return;
  const room = randomId();
  set({ rejected: null, outgoing: { room, mode, rounds, to, replies: Object.fromEntries(to.map((t) => [t.id, "pending" as Reply])) } });
  void lobbySend("invite", { room, mode, rounds, from: { id: me.id, nickname: me.nickname }, to });
  void pushChallenge(to.map((t) => t.id), room, mode, rounds);
  joinMatch(room, me.id, mode, rounds);
  setTimeout(() => {
    const o = state.outgoing;
    if (o?.room !== room) return;
    const replies = { ...o.replies };
    for (const id in replies) if (replies[id] === "pending") replies[id] = "expired";
    set({ outgoing: { ...o, replies } });
    maybeStart();
  }, INVITE_MS);
}

/** Closes the "nobody joined" screen. */
export function dismissRejected() {
  set({ rejected: null });
}

export function cancelInvite() {
  const o = state.outgoing;
  if (o) void lobbySend("cancel", { room: o.room });
  set({ outgoing: null });
  leaveMatch();
}

export function acceptInvite() {
  const inv = state.incoming;
  const me = self;
  if (!inv || !me) return;
  set({ incoming: null });
  joinMatch(inv.room, inv.from.id, inv.mode, inv.rounds);
  void lobbySend("reply", { room: inv.room, from: me.id, accept: true });
}

/** Tapped a push notification (app may have been closed): show that challenge if it is still valid. */
export function inviteFromPush(d: Record<string, string>) {
  if (d.type !== "challenge" || !d.room || !d.fromId) return;
  const age = Date.now() - Number(d.sentAt || 0);
  if (!(age < INVITE_MS)) { notify("Ese reto ya expiró"); return; }
  if (state.match || state.outgoing || state.incoming?.room === d.room) return;
  let people: Who[] = [];
  try { people = JSON.parse(d.players || "[]") as Who[]; } catch { /* sin lista */ }
  set({
    incoming: {
      room: d.room,
      mode: d.mode === "hard" ? "hard" : d.mode === "taz" ? "taz" : "normal",
      rounds: Number(d.rounds) === 2 ? 2 : 3,
      from: { id: d.fromId, nickname: d.fromName || "Un amigo" },
      others: people.filter((p) => p.id !== self?.id),
    },
  });
  setTimeout(() => { if (state.incoming?.room === d.room) set({ incoming: null }); }, INVITE_MS - age);
}

export function declineInvite() {
  const inv = state.incoming;
  const me = self;
  if (inv && me) void lobbySend("reply", { room: inv.room, from: me.id, accept: false });
  set({ incoming: null });
}

// ---------------- Match ----------------

let mch: RealtimeChannel | null = null;
let present: string[] = [];
let timers: ReturnType<typeof setTimeout>[] = [];
const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
const send = (event: string, payload: Record<string, unknown>) =>
  mch?.send({ type: "broadcast", event, payload });

function joinMatch(room: string, hostId: string, mode: BoardMode, rounds: number) {
  const me = self!;
  const meW = { id: me.id, nickname: me.nickname };
  leaveMatch();
  set({
    match: {
      room, hostId, mode, rounds, me: meW, players: [meW], round: 0, countdown: 0, phase: "lobby",
      wins: {}, totals: {}, scores: {}, roundWinners: [], left: [], rematch: [],
    },
  });
  const ch = supabase.channel(`koki-match-${room}`, { config: { presence: { key: me.id } } });
  ch.on("presence", { event: "sync" }, () => { present = Object.keys(ch.presenceState()); onPresence(); })
    .on("broadcast", { event: "round" }, ({ payload }) => applyRound(payload))
    .on("broadcast", { event: "pos" }, ({ payload }) => {
      const g = ghosts[payload.id];
      if (g && g.alive) { g.y = payload.y; g.rot = payload.rot; g.score = payload.score; }
    })
    .on("broadcast", { event: "dead" }, ({ payload }) => onDead(payload.id, payload.score, payload.round))
    .on("broadcast", { event: "rematch" }, ({ payload }) => onRematch(payload.id))
    .subscribe((s) => { if (s === "SUBSCRIBED") void ch.track({ nickname: me.nickname }); });
  mch = ch;
}

export function leaveMatch() {
  clearTimers();
  if (mch) void supabase.removeChannel(mch);
  mch = null;
  present = [];
  for (const k in ghosts) delete ghosts[k];
  if (state.match) set({ match: null });
}

/** Host: start round 1 once every invitee answered and the ones who accepted are connected. */
function maybeStart() {
  const m = state.match;
  const o = state.outgoing;
  if (!m || !o || !isHost(m) || m.round > 0) return;
  const pending = o.to.filter((t) => o.replies[t.id] === "pending");
  const accepted = o.to.filter((t) => o.replies[t.id] === "accepted");
  if (pending.length) return;
  if (!accepted.length) {
    // nadie aceptó: pantalla con quién rechazó y quién no respondió
    const names = (r: Reply) => o.to.filter((t) => o.replies[t.id] === r).map((t) => t.nickname);
    set({ outgoing: null, rejected: { declined: names("declined"), expired: names("expired") } });
    leaveMatch();
    return;
  }
  if (accepted.every((a) => present.includes(a.id))) startRound(1, [m.me, ...accepted]);
}

function onPresence() {
  const m = state.match;
  if (!m) return;
  if (m.round === 0) { maybeStart(); return; }
  const gone = activePlayers(m).filter((p) => p.id !== m.me.id && !present.includes(p.id));
  if (!gone.length) return;
  gone.forEach((p) => { if (ghosts[p.id]) ghosts[p.id].alive = false; });
  const left = [...m.left, ...gone.map((p) => p.id)];
  const stillHere = m.players.filter((p) => !left.includes(p.id));
  const hostId = left.includes(m.hostId) ? [...stillHere].sort((a, b) => a.id.localeCompare(b.id))[0].id : m.hostId;
  setMatch({ left, hostId });
  gone.forEach((p) => notify(`${p.nickname} se desconectó`));
  const now = state.match!;
  if (activePlayers(now).length <= 1) {
    clearTimers();
    setMatch({ phase: "done" });
  } else if (now.phase === "playing") {
    checkRoundEnd();
  } else if (now.phase === "roundEnd" && isHost(now) && !timers.length) {
    timers.push(setTimeout(() => startRound(now.round + 1, activePlayers(state.match!)), NEXT_ROUND_MS));
  }
}

function startRound(round: number, players: Who[]) {
  const m = state.match;
  if (!m) return;
  // el modo viaja con cada ronda: todos juegan lo que eligió quien retó
  const payload = { round, seed: Math.floor(Math.random() * 2 ** 31), players, hostId: m.hostId, mode: m.mode };
  void send("round", payload);
  applyRound(payload);
}

function applyRound(p: { round: number; seed: number; players: Who[]; hostId: string; mode?: BoardMode }) {
  const m = state.match;
  if (!m) return;
  clearTimers();
  const fresh = p.round === 1;
  const wins = fresh ? Object.fromEntries(p.players.map((x) => [x.id, 0])) : m.wins;
  const totals = fresh ? Object.fromEntries(p.players.map((x) => [x.id, 0])) : m.totals;
  for (const k in ghosts) delete ghosts[k];
  for (const x of p.players) {
    if (x.id !== m.me.id) ghosts[x.id] = { nickname: x.nickname, y: 0.5, rot: 0, score: 0, alive: true, dy: null };
  }
  set({ outgoing: null });
  setMatch({
    round: p.round, players: fresh ? p.players : m.players, hostId: p.hostId, wins, totals,
    mode: p.mode ?? m.mode,
    left: fresh ? [] : m.left, rematch: [], scores: {}, roundWinners: [], phase: "countdown", countdown: COUNTDOWN,
  });
  for (let i = 1; i <= COUNTDOWN; i++) {
    timers.push(setTimeout(() => {
      if (i < COUNTDOWN) { setMatch({ countdown: COUNTDOWN - i }); return; }
      setMatch({ phase: "playing", countdown: 0 });
      roundStarter?.(p.seed, state.match!.mode);
    }, i * 1000));
  }
}

/** Called by the game ~8 times per second while alive. y is relative to the pipe gaps (see toGapSpace), so it lines up on any screen. */
export function reportPos(y: number, rot: number, score: number) {
  const m = state.match;
  if (m?.phase === "playing") void send("pos", { id: m.me.id, y, rot, score });
}

export function reportDead(score: number) {
  const m = state.match;
  if (!m || m.phase !== "playing") return;
  void send("dead", { id: m.me.id, score, round: m.round });
  onDead(m.me.id, score, m.round);
}

function onDead(id: string, score: number, round: number) {
  const m = state.match;
  if (!m || round !== m.round || m.scores[id] != null) return;
  if (ghosts[id]) { ghosts[id].alive = false; ghosts[id].score = score; }
  setMatch({ scores: { ...m.scores, [id]: score } });
  checkRoundEnd();
}

function checkRoundEnd() {
  const m = state.match;
  if (!m || m.phase !== "playing") return;
  const active = activePlayers(m);
  if (!active.every((p) => m.scores[p.id] != null)) return;
  const best = Math.max(...active.map((p) => m.scores[p.id]));
  const roundWinners = active.filter((p) => m.scores[p.id] === best).map((p) => p.id);
  const wins = { ...m.wins };
  const totals = { ...m.totals };
  roundWinners.forEach((id) => { wins[id] = (wins[id] ?? 0) + 1; });
  active.forEach((p) => { totals[p.id] = (totals[p.id] ?? 0) + m.scores[p.id]; });
  const remaining = m.rounds - m.round;
  const sorted = active.map((p) => wins[p.id] ?? 0).sort((a, b) => b - a);
  const clinched = sorted.length > 1 && sorted[0] - sorted[1] > remaining;
  const done = remaining <= 0 || clinched;
  setMatch({ wins, totals, roundWinners, phase: done ? "done" : "roundEnd" });
  if (!done && isHost(m)) {
    timers.push(setTimeout(() => startRound(m.round + 1, activePlayers(state.match!)), NEXT_ROUND_MS));
  }
}

/** Final ranking: most rounds won, then most total points. */
export function standings(m: Match) {
  return [...m.players].sort(
    (a, b) => (m.wins[b.id] ?? 0) - (m.wins[a.id] ?? 0) || (m.totals[b.id] ?? 0) - (m.totals[a.id] ?? 0),
  );
}

export function requestRematch() {
  const m = state.match;
  if (!m || m.phase !== "done" || m.rematch.includes(m.me.id)) return;
  void send("rematch", { id: m.me.id });
  onRematch(m.me.id);
}

function onRematch(id: string) {
  const m = state.match;
  if (!m || m.rematch.includes(id)) return;
  const rematch = [...m.rematch, id];
  setMatch({ rematch });
  const active = activePlayers(m).filter((p) => present.includes(p.id) || p.id === m.me.id);
  if (isHost(m) && active.length > 1 && active.every((p) => rematch.includes(p.id))) {
    startRound(1, active);
  }
}

/** Deterministic PRNG so every player gets the same pipes from the same seed. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
