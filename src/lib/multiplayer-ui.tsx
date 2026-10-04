import { useEffect, useState } from "react";
import type { BoardMode, FriendRow } from "./leaderboard";
import {
  type Match, useMp, ghosts, activePlayers, standings,
  sendInvite, cancelInvite, acceptInvite, declineInvite, leaveMatch, requestRematch,
} from "./multiplayer";

const stop = (e: React.SyntheticEvent) => e.stopPropagation();
const modeLabel = (m: BoardMode) => (m === "hard" ? "🔥 Difícil" : "Normal");
const card = "w-full max-w-sm rounded-3xl border-2 border-white/10 bg-gradient-to-b from-indigo-900 to-slate-900 p-5 text-white shadow-2xl";
const primary = "w-full rounded-full bg-gradient-to-b from-red-400 to-red-600 px-6 py-3 text-lg font-black text-white shadow-[0_5px_0_rgb(127_29_29)] active:translate-y-1 active:shadow-[0_2px_0_rgb(127_29_29)] disabled:opacity-50";
const secondary = "w-full rounded-full bg-white/90 px-6 py-3 text-lg font-black text-slate-800 shadow-[0_4px_0_rgba(0,0,0,0.3)] active:translate-y-0.5";

/**
 * Friends-tab section: pick 1-2 friends, rounds, and send the challenge.
 * Offline friends can be challenged too: they get a push notification and have 60 s to join.
 */
export function ChallengeFriends({ friends, mode, onSent }: { friends: FriendRow[]; mode: BoardMode; onSent: () => void }) {
  const { online } = useMp();
  const [picked, setPicked] = useState<string[]>([]);
  const [rounds, setRounds] = useState(3);
  const isOn = (id: string) => online.includes(id);
  // conectados primero, después el resto por nombre
  const allFriends = friends
    .filter((f) => f.status === "friend")
    .sort((a, b) => Number(isOn(b.id)) - Number(isOn(a.id)) || a.nickname.localeCompare(b.nickname));
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 2 ? p : [...p, id]));
  const btn = (active: boolean) =>
    `flex-1 rounded-full px-3 py-1 text-xs font-black ${active ? "bg-white text-slate-900" : "bg-white/10 text-white"}`;

  return (
    <div className="mb-3 rounded-2xl bg-white/5 p-3" onPointerDown={stop} onClick={stop}>
      <div className="mb-2 text-xs font-bold uppercase text-white/60">⚔️ Jugar en vivo</div>
      {allFriends.length === 0 ? (
        <div className="text-xs text-white/60">Aún no tienes amigos. Agrégalos con ➕ para retarlos.</div>
      ) : (
        <>
          <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
            {allFriends.map((f) => (
              <button
                key={f.id}
                onClick={() => toggle(f.id)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left font-bold ${picked.includes(f.id) ? "bg-emerald-500 text-white" : "bg-white/10 text-white"}`}
              >
                <span>{picked.includes(f.id) ? "✅" : isOn(f.id) ? "🟢" : "⚪"}</span>
                <span className="flex-1 truncate">{f.nickname}</span>
                <span className="text-[10px] font-semibold opacity-70">{isOn(f.id) ? "conectado" : "le llegará un aviso"}</span>
              </button>
            ))}
          </div>
          <div className="mt-1 text-[11px] text-white/50">Elige 1 amigo (2 jugadores) o 2 amigos (3 jugadores)</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs font-bold text-white/70">Rondas</span>
            <button className={btn(rounds === 2)} onClick={() => setRounds(2)}>2</button>
            <button className={btn(rounds === 3)} onClick={() => setRounds(3)}>3</button>
          </div>
          <button
            disabled={!picked.length}
            onClick={() => {
              sendInvite(allFriends.filter((f) => picked.includes(f.id)).map(({ id, nickname }) => ({ id, nickname })), mode, rounds);
              onSent();
            }}
            className="mt-3 w-full rounded-full bg-gradient-to-b from-amber-300 to-orange-500 px-4 py-2 font-black text-white disabled:opacity-50"
          >
            ⚔️ Retar · {modeLabel(mode)} · {picked.length + 1} jugadores
          </button>
        </>
      )}
    </div>
  );
}

function Scoreboard({ m, showRound }: { m: Match; showRound?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      {standings(m).map((p, i) => {
        const gone = m.left.includes(p.id);
        return (
          <div
            key={p.id}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 font-bold ${p.id === m.me.id ? "bg-amber-400/90 text-slate-900" : "bg-white/10"} ${gone ? "opacity-50" : ""}`}
          >
            <span className="w-6 text-center">{i === 0 ? "👑" : i + 1}</span>
            <span className="flex-1 truncate">{p.id === m.me.id ? "Tú" : p.nickname}{gone ? " (salió)" : ""}</span>
            {showRound && <span className="text-xs opacity-80">{m.scores[p.id] ?? "—"} pts</span>}
            <span className="font-black">{"⭐".repeat(m.wins[p.id] ?? 0) || "·"}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Live scores of everyone still flying, re-read from the ghost data a few times per second. */
function useGhostTick(active: boolean) {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setT((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [active]);
}

/** All multiplayer overlays: invitations, waiting room, countdown, round results, final results. */
export function MultiplayerLayer({ onExit }: { onExit: () => void }) {
  const { incoming, outgoing, match: m, notice, online } = useMp();
  const waitingOthers = !!m && m.phase === "playing" && m.scores[m.me.id] != null;
  useGhostTick(waitingOthers);
  const exit = () => { leaveMatch(); onExit(); };

  return (
    <>
      {notice && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-sm font-bold text-white">
          {notice}
        </div>
      )}

      {incoming && (
        <div className="absolute inset-x-3 top-16 z-50 mx-auto max-w-sm rounded-2xl bg-slate-900/95 p-4 text-white shadow-2xl ring-2 ring-amber-400" onPointerDown={stop} onClick={stop}>
          <div className="text-lg font-black">⚔️ {incoming.from.nickname} te reta</div>
          <div className="text-xs font-bold text-white/70">
            {modeLabel(incoming.mode)} · {incoming.rounds} rondas · {incoming.others.length + 2} jugadores
            {incoming.others.length > 0 && ` (con ${incoming.others.map((o) => o.nickname).join(", ")})`}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={acceptInvite} className="flex-1 rounded-full bg-emerald-500 py-2 font-black">Aceptar</button>
            <button onClick={declineInvite} className="flex-1 rounded-full bg-white/15 py-2 font-black">Rechazar</button>
          </div>
        </div>
      )}

      {m && m.phase === "lobby" && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onPointerDown={stop} onClick={stop}>
          <div className={card}>
            <h2 className="text-center text-2xl font-black">⚔️ Sala de juego</h2>
            <div className="mb-3 text-center text-xs font-bold text-white/70">{modeLabel(m.mode)} · {m.rounds} rondas</div>
            {outgoing ? (
              <div className="flex flex-col gap-1.5">
                {outgoing.to.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 font-bold">
                    <span className="flex-1 truncate">{t.nickname}</span>
                    {outgoing.replies[t.id] === "pending" && !online.includes(t.id) && (
                      <span className="text-[10px] font-semibold text-white/60">📲 avisado</span>
                    )}
                    <span>{outgoing.replies[t.id] === "accepted" ? "✅" : outgoing.replies[t.id] === "declined" ? "❌" : "⏳"}</span>
                  </div>
                ))}
                <div className="mt-1 text-center text-xs text-white/60">Esperando respuestas… tienen 60 segundos para unirse</div>
              </div>
            ) : (
              <div className="py-4 text-center text-sm text-white/70">Conectando con la sala…</div>
            )}
            <button onClick={() => { if (outgoing) cancelInvite(); else leaveMatch(); onExit(); }} className={`${secondary} mt-4`}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {m && m.phase === "countdown" && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onPointerDown={stop} onClick={stop}>
          <div className={card}>
            <div className="text-center text-sm font-black uppercase tracking-wider text-white/70">Ronda {m.round} de {m.rounds}</div>
            <div className="my-2 text-center text-7xl font-black">{m.countdown}</div>
            <Scoreboard m={m} />
          </div>
        </div>
      )}

      {m && m.phase === "playing" && !waitingOthers && (
        <div className="pointer-events-none absolute left-1/2 top-[100px] z-10 -translate-x-1/2 rounded-full bg-black/35 px-3 py-1 text-xs font-bold text-white/85">
          Ronda {m.round}/{m.rounds} · {activePlayers(m).map((p) => `${p.id === m.me.id ? "Tú" : p.nickname} ${"⭐".repeat(m.wins[p.id] ?? 0)}`).join(" · ")}
        </div>
      )}

      {waitingOthers && m && (
        <div className="absolute inset-x-3 bottom-6 z-40 mx-auto max-w-sm rounded-2xl bg-slate-900/90 p-4 text-white" onPointerDown={stop} onClick={stop}>
          <div className="text-sm font-black">💥 Chocaste con {m.scores[m.me.id]} puntos</div>
          <div className="mb-2 text-xs text-white/70">Mira a los demás mientras terminan…</div>
          {activePlayers(m).filter((p) => p.id !== m.me.id).map((p) => (
            <div key={p.id} className="flex justify-between text-sm font-bold">
              <span>{ghosts[p.id]?.alive ? "🟢" : "💥"} {p.nickname}</span>
              <span>{m.scores[p.id] ?? ghosts[p.id]?.score ?? 0}</span>
            </div>
          ))}
        </div>
      )}

      {m && m.phase === "roundEnd" && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onPointerDown={stop} onClick={stop}>
          <div className={card}>
            <div className="text-center text-sm font-black uppercase tracking-wider text-white/70">Fin de la ronda {m.round}</div>
            <h2 className="mb-3 text-center text-2xl font-black">
              {m.roundWinners.includes(m.me.id)
                ? m.roundWinners.length > 1 ? "🤝 ¡Empate!" : "🎉 ¡Ganaste la ronda!"
                : `Ganó ${m.players.filter((p) => m.roundWinners.includes(p.id)).map((p) => p.nickname).join(" y ")}`}
            </h2>
            <Scoreboard m={m} showRound />
            <div className="mt-3 text-center text-xs text-white/60">La siguiente ronda empieza en un momento…</div>
          </div>
        </div>
      )}

      {m && m.phase === "done" && <FinalCard m={m} onExit={exit} />}
    </>
  );
}

function FinalCard({ m, onExit }: { m: Match; onExit: () => void }) {
  const order = standings(m).filter((p) => !m.left.includes(p.id));
  const top = order[0];
  const tiedTop = order.filter(
    (p) => (m.wins[p.id] ?? 0) === (m.wins[top.id] ?? 0) && (m.totals[p.id] ?? 0) === (m.totals[top.id] ?? 0),
  );
  const iWon = tiedTop.length === 1 && top.id === m.me.id;
  const others = activePlayers(m).filter((p) => p.id !== m.me.id);
  const tiedRounds = order.length > 1 && (m.wins[order[0].id] ?? 0) === (m.wins[order[1].id] ?? 0);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onPointerDown={stop} onClick={stop}>
      <div className={card}>
        <h2 className="text-center text-3xl font-black">
          {tiedTop.length > 1 ? "🤝 ¡Empate!" : iWon ? "🏆 ¡Ganaste!" : `👑 Ganó ${top.nickname}`}
        </h2>
        {tiedRounds && tiedTop.length === 1 && (
          <div className="text-center text-xs text-white/70">Empate en rondas: gana quien sumó más puntos</div>
        )}
        <div className="mt-3">
          <Scoreboard m={m} />
        </div>
        <div className="mt-2 text-center text-xs text-white/60">
          Puntos totales: {standings(m).map((p) => `${p.id === m.me.id ? "Tú" : p.nickname} ${m.totals[p.id] ?? 0}`).join(" · ")}
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {others.length > 0 && (
            <button onClick={requestRematch} disabled={m.rematch.includes(m.me.id)} className={primary}>
              🔄 Revancha ({m.rematch.length}/{others.length + 1})
            </button>
          )}
          <button onClick={onExit} className={secondary}>🏠 Salir</button>
        </div>
      </div>
    </div>
  );
}
