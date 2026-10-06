import { useCallback, useEffect, useState } from "react";
import {
  type BoardMode, type BoardRow, type FriendRow, type Player,
  getPlayer, registerPlayer, syncScores, globalBoard, friendsBoard,
  searchPlayers, myFriends, sendRequest, respondRequest, removeFriend, setPassword,
} from "./leaderboard";
import { ChallengeFriends } from "./multiplayer-ui";
import { SkinAvatar } from "./character-skins";
import { RecoverProfileForm } from "./options-ui";
import { onFriends } from "./achievements";

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

export function NicknameForm({ onDone }: { onDone: (p: Player) => void }) {
  const [nick, setNick] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setErr("");
    const r = await registerPlayer(nick);
    if (r.error) { setBusy(false); setErr(r.error); return; }
    // la contraseña sirve para recuperar el usuario si se borra la app
    // (si el servidor aún no la acepta, el juego la pedirá después)
    await setPassword(pw);
    setBusy(false);
    if (r.player) { await syncScores(); onDone(r.player); }
  };
  const field = "rounded-full bg-white px-4 py-2 font-bold text-slate-800 outline-none";
  const mismatch = pw2.length > 0 && pw !== pw2;
  return (
    <div className="flex flex-col gap-2" onPointerDown={stop} onClick={stop}>
      <div className="text-sm font-bold text-white/90">Elige tu apodo para el ranking</div>
      <input
        value={nick}
        maxLength={16}
        onChange={(e) => setNick(e.target.value)}
        placeholder="Tu apodo"
        className={field}
      />
      <input type="password" value={pw} maxLength={64} onChange={(e) => setPw(e.target.value)} placeholder="Contraseña (mínimo 6)" className={field} />
      <input type="password" value={pw2} maxLength={64} onChange={(e) => setPw2(e.target.value)} placeholder="Repite la contraseña" className={field} />
      <div className="text-[11px] text-white/60">Con tu apodo y contraseña recuperas tu perfil si borras la app.</div>
      {mismatch && <div className="text-xs font-bold text-red-300">Las contraseñas no son iguales</div>}
      {err && <div className="text-xs font-bold text-red-300">{err}</div>}
      <button
        disabled={busy || nick.trim().length < 3 || pw.length < 6 || pw !== pw2}
        onClick={submit}
        className="rounded-full bg-gradient-to-b from-amber-300 to-orange-500 px-4 py-2 font-black text-white disabled:opacity-50"
      >
        {busy ? "..." : "GUARDAR"}
      </button>
      <div className="mt-2">
        <RecoverProfileForm />
      </div>
    </div>
  );
}

function Rows({ rows, meId }: { rows: BoardRow[]; meId?: string }) {
  if (rows.length === 0) return <div className="py-6 text-center text-sm text-white/60">Aún no hay puntajes</div>;
  return (
    <ol className="flex flex-col gap-1.5">
      {rows.map((r, i) => (
        <li
          key={r.id}
          className={`flex items-center gap-3 rounded-xl px-3 py-2 font-bold ${r.id === meId ? "bg-amber-400/90 text-slate-900" : "bg-white/10 text-white"}`}
        >
          <span className="w-7 text-center">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
          {r.skin && <SkinAvatar skin={r.skin} className="h-8 w-8 shrink-0" />}
          <span className="flex-1 truncate">{r.nickname}</span>
          <span className="font-black">{r.score}</span>
        </li>
      ))}
    </ol>
  );
}

export type Tab = "global" | "friends" | "add";

export function LeaderboardModal({ initialMode, initialTab = "global", onClose }: { initialMode: BoardMode; initialTab?: Tab; onClose: () => void }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [mode, setMode] = useState<BoardMode>(initialMode);
  const [rows, setRows] = useState<BoardRow[] | null>([]);
  const [loading, setLoading] = useState(false);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; nickname: string }[]>([]);

  useEffect(() => { setPlayer(getPlayer()); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    await syncScores();
    if (tab === "global") setRows(await globalBoard(mode));
    else if (tab === "friends") setRows(await friendsBoard(mode));
    if (tab !== "global") {
      const list = await myFriends();
      setFriends(list);
      onFriends(list.filter((f) => f.status === "friend").length);
    }
    setLoading(false);
  }, [tab, mode]);

  useEffect(() => { load(); }, [load, player]);

  useEffect(() => {
    if (tab !== "add" || q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => setResults(await searchPlayers(q)), 300);
    return () => clearTimeout(t);
  }, [q, tab]);

  const btn = (active: boolean) =>
    `flex-1 rounded-full px-3 py-1.5 text-sm font-black ${active ? "bg-white text-slate-900" : "bg-white/10 text-white"}`;
  const incoming = friends.filter((f) => f.status === "incoming");

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-4"
      onPointerDown={stop}
      onClick={stop}
    >
      <div className="flex max-h-[90vh] w-full max-w-sm flex-col rounded-3xl border-2 border-white/10 bg-gradient-to-b from-indigo-900 to-slate-900 p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl font-black text-white">🏆 Ranking</h2>
          {player && <span className="truncate text-xs font-bold text-white/70">👤 {player.nickname}</span>}
        </div>

        {!player ? (
          <NicknameForm onDone={setPlayer} />
        ) : (
          <>
            <div className="mb-2 flex gap-2">
              <button className={btn(tab === "global")} onClick={() => setTab("global")}>🌍 Global</button>
              <button className={btn(tab === "friends")} onClick={() => setTab("friends")}>
                👥 Amigos{incoming.length ? ` (${incoming.length})` : ""}
              </button>
              <button
                aria-label="Agregar amigos"
                onClick={() => setTab("add")}
                className={`flex-1 rounded-full px-3 py-1.5 text-xl font-black leading-none text-white ${tab === "add" ? "bg-white/30 ring-2 ring-white" : "bg-white/10"}`}
              >
                +
              </button>
            </div>
            {tab !== "add" && initialMode !== "taz" && (
              <div className="mb-3 flex gap-2">
                <button className={btn(mode === "normal")} onClick={() => setMode("normal")}>Normal</button>
                <button className={btn(mode === "hard")} onClick={() => setMode("hard")}>🔥 Difícil</button>
              </div>
            )}
            {tab !== "add" && initialMode === "taz" && (
              <div className="mb-3 text-center text-sm font-black text-red-300">🐈‍⬛ Atrapa al Taz</div>
            )}
            <div className="flex-1 overflow-y-auto pr-1">
              {tab === "friends" && <ChallengeFriends friends={friends} mode={mode} onSent={onClose} />}
              {tab === "friends" && incoming.length > 0 && (
                <div className="mb-3 flex flex-col gap-1.5">
                  <div className="text-xs font-bold uppercase text-white/60">Solicitudes</div>
                  {incoming.map((f) => (
                    <div key={f.id} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-white">
                      <span className="flex-1 truncate font-bold">{f.nickname}</span>
                      <button className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-black" onClick={async () => { await respondRequest(f.id, true); load(); }}>✓</button>
                      <button className="rounded-full bg-red-500 px-3 py-1 text-xs font-black" onClick={async () => { await respondRequest(f.id, false); load(); }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              {tab === "add" ? (
                <div className="flex flex-col gap-2">
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar apodo..."
                    className="rounded-full bg-white px-4 py-2 font-bold text-slate-800 outline-none"
                  />
                  {results.map((r) => {
                    const rel = friends.find((f) => f.id === r.id);
                    return (
                      <div key={r.id} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-white">
                        <span className="flex-1 truncate font-bold">{r.nickname}</span>
                        {rel?.status === "friend" ? (
                          <span className="text-xs text-white/60">Amigo</span>
                        ) : rel?.status === "sent" ? (
                          <span className="text-xs text-white/60">Enviada</span>
                        ) : (
                          <button className="rounded-full bg-sky-500 px-3 py-1 text-xs font-black" onClick={async () => { await sendRequest(r.id); setFriends(await myFriends()); }}>Agregar</button>
                        )}
                      </div>
                    );
                  })}
                  {friends.filter((f) => f.status === "friend").length > 0 && (
                    <div className="mt-3 flex flex-col gap-1.5">
                      <div className="text-xs font-bold uppercase text-white/60">Mis amigos</div>
                      {friends.filter((f) => f.status === "friend").map((f) => (
                        <div key={f.id} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-white">
                          <span className="flex-1 truncate font-bold">{f.nickname}</span>
                          <button className="text-xs text-red-300" onClick={async () => { await removeFriend(f.id); load(); }}>Quitar</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : rows === null ? (
                <div className="py-6 text-center text-sm text-white/70">📡 Sin conexión. Tu récord se subirá al volver internet.</div>
              ) : loading && rows.length === 0 ? (
                <div className="py-6 text-center text-sm text-white/60">Cargando...</div>
              ) : (
                <Rows rows={rows} meId={player.id} />
              )}
            </div>
          </>
        )}
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-full bg-white/90 px-6 py-3 text-lg font-black text-slate-800 shadow-[0_4px_0_rgba(0,0,0,0.3)] active:translate-y-0.5"
        >
          ← Volver
        </button>
      </div>
    </div>
  );
}

/** Compact friends ranking shown on the Game Over card. */
export function GameOverFriends({ mode, onOpen }: { mode: BoardMode; onOpen: () => void }) {
  const [rows, setRows] = useState<BoardRow[] | null | undefined>(undefined);
  const [player, setPlayer] = useState<Player | null>(null);
  useEffect(() => {
    const p = getPlayer();
    setPlayer(p);
    if (!p) return;
    (async () => { await syncScores(); setRows(await friendsBoard(mode)); })();
  }, [mode]);

  return (
    <div className="mt-4 rounded-2xl bg-slate-800 p-3 text-left" onPointerDown={stop} onClick={stop}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-wider text-white/80">👥 Tú y tus amigos</span>
        <button onClick={onOpen} className="text-xs font-bold text-amber-300">Ver ranking →</button>
      </div>
      {!player ? (
        <button onClick={onOpen} className="w-full rounded-xl bg-white/10 py-2 text-sm font-bold text-white">Crea tu apodo para competir</button>
      ) : rows === undefined ? (
        <div className="text-center text-xs text-white/60">Cargando...</div>
      ) : rows === null ? (
        <div className="text-center text-xs text-white/60">📡 Sin conexión — se subirá luego</div>
      ) : (
        <div className="max-h-36 overflow-y-auto">
          <Rows rows={rows.slice(0, 10)} meId={player.id} />
          {rows.length <= 1 && <div className="mt-1 text-center text-[11px] text-white/60">Agrega amigos desde el ranking</div>}
        </div>
      )}
    </div>
  );
}
