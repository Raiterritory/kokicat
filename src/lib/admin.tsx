// Admin panel (opens from debug mode). Every action is authorized by the server:
// it only works if the user on this phone is marked as admin (migration 0012).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPlayer, formatRecoveryCode } from "./leaderboard";

type Rpc = (fn: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = async (fn, a) => {
  try {
    return await (supabase.rpc as unknown as Rpc)(fn, a);
  } catch (e) {
    return { data: null, error: { message: String(e) } };
  }
};

export type AdminRow = {
  id: string; nickname: string; best_normal: number; best_hard: number;
  has_password: boolean; has_code: boolean; is_admin: boolean; created_at: string;
};

const creds = () => {
  const p = getPlayer();
  return p ? { p_id: p.id, p_secret: p.secret } : null;
};

function explain(msg: string) {
  if (msg.includes("not_admin")) return "Tu usuario no es administrador";
  if (msg.includes("protected")) return "No se puede borrar a un administrador";
  if (msg.includes("invalid_password")) return "Usa entre 6 y 64 caracteres";
  if (msg.includes("not_found")) return "Ese jugador ya no existe";
  if (/function|schema cache/i.test(msg)) return "El servidor aún no tiene el panel activado";
  return "Sin conexión, intenta de nuevo";
}

/** null while checking; false if this user is not an admin (or no user / no server support). */
export async function isAdmin(): Promise<boolean> {
  const c = creds();
  if (!c) return false;
  const { data, error } = await rpc("admin_check", c);
  return !error && data === true;
}

async function findPlayers(query: string) {
  const c = creds();
  if (!c) return { error: "Primero crea tu usuario online" };
  const { data, error } = await rpc("admin_find_players", { ...c, p_query: query });
  return error ? { error: explain(error.message) } : { rows: (data as AdminRow[]) ?? [] };
}

async function setPlayerPassword(target: string, password: string) {
  const c = creds();
  if (!c) return "Primero crea tu usuario online";
  const { error } = await rpc("admin_set_password", { ...c, p_target: target, p_password: password });
  return error ? explain(error.message) : null;
}

async function playerCode(target: string) {
  const c = creds();
  if (!c) return { error: "Primero crea tu usuario online" };
  const { data, error } = await rpc("admin_recovery_code", { ...c, p_target: target });
  return error || typeof data !== "string" ? { error: explain(error?.message ?? "") } : { code: formatRecoveryCode(data) };
}

async function deletePlayerAsAdmin(target: string) {
  const c = creds();
  if (!c) return "Primero crea tu usuario online";
  const { error } = await rpc("admin_delete_player", { ...c, p_target: target });
  return error ? explain(error.message) : null;
}

const btn = "rounded-lg px-2 py-1 text-[11px] font-black text-white active:translate-y-0.5 disabled:opacity-50";

function PlayerCard({ row, onChanged }: { row: AdminRow; onChanged: () => void }) {
  const [action, setAction] = useState<"" | "password" | "delete">("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<string | null>, ok: string) => {
    setBusy(true);
    setMsg("");
    const err = await fn();
    setBusy(false);
    setMsg(err ? `❌ ${err}` : ok);
    if (!err) { setAction(""); setPw(""); onChanged(); }
  };

  return (
    <div className="rounded-xl bg-white/10 p-2 text-white">
      <div className="flex items-center gap-2">
        <span className="flex-1 truncate font-black">{row.is_admin ? "🛡️ " : ""}{row.nickname}</span>
        <span className="text-[10px] text-white/60">🏆 {row.best_normal} · 🔥 {row.best_hard}</span>
      </div>
      <div className="text-[10px] text-white/60">
        {row.has_password ? "🔒 con contraseña" : "🔓 sin contraseña"} · {row.has_code ? "🔑 con código" : "sin código"} · desde {new Date(row.created_at).toLocaleDateString()}
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        <button className={`${btn} bg-emerald-600`} onClick={() => { setAction(action === "password" ? "" : "password"); setMsg(""); }}>🔒 Contraseña</button>
        <button
          className={`${btn} bg-amber-600`}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMsg("");
            const r = await playerCode(row.id);
            setBusy(false);
            setMsg(r.code ? `🔑 ${r.code}` : `❌ ${r.error}`);
            if (r.code) onChanged();
          }}
        >
          🔑 Código
        </button>
        {!row.is_admin && (
          <button className={`${btn} bg-red-600`} onClick={() => { setAction(action === "delete" ? "" : "delete"); setMsg(""); }}>🗑️ Borrar</button>
        )}
      </div>
      {action === "password" && (
        <div className="mt-2 flex gap-1">
          <input
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Nueva contraseña (mín. 6)"
            maxLength={64}
            className="min-w-0 flex-1 rounded-lg bg-white px-2 py-1 text-xs font-bold text-slate-800 outline-none"
          />
          <button
            className={`${btn} bg-emerald-600`}
            disabled={busy || pw.length < 6}
            onClick={() => run(() => setPlayerPassword(row.id, pw), `✅ Contraseña nueva para ${row.nickname}`)}
          >
            Guardar
          </button>
        </div>
      )}
      {action === "delete" && (
        <div className="mt-2 rounded-lg bg-red-950/50 p-2 text-[11px]">
          ¿Borrar a <b>{row.nickname}</b>? Se pierden su usuario, récords y amigos.
          <div className="mt-1 flex gap-1">
            <button className={`${btn} bg-white/20`} onClick={() => setAction("")}>Cancelar</button>
            <button className={`${btn} bg-red-600`} disabled={busy} onClick={() => run(() => deletePlayerAsAdmin(row.id), `🗑️ ${row.nickname} borrado`)}>
              Sí, borrar
            </button>
          </div>
        </div>
      )}
      {msg && <div className="mt-1 select-all text-center text-[11px] font-bold text-white/85">{msg}</div>}
    </div>
  );
}

/** Shown inside debug mode. Checks with the server that this user is an admin first. */
export function AdminPanel() {
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { void isAdmin().then(setAdmin); }, []);

  const search = async () => {
    setBusy(true);
    setMsg("");
    const r = await findPlayers(query);
    setBusy(false);
    if (r.error) { setMsg(`❌ ${r.error}`); setRows([]); return; }
    setRows(r.rows ?? []);
    if (!r.rows?.length) setMsg("No hay jugadores con ese apodo");
  };

  if (admin === null) return <div className="mt-3 text-center text-xs text-white/60">Revisando permisos…</div>;
  if (!admin) {
    return (
      <div className="mt-3 rounded-xl bg-black/30 p-3 text-center text-xs text-white/70">
        🛡️ Panel de administración: tu usuario online no es administrador.
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-xl border border-fuchsia-400/40 bg-black/40 p-3">
      <div className="mb-2 text-sm font-black text-fuchsia-200">🛡️ Panel de administración</div>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void search(); }}
          placeholder="Buscar apodo (vacío = recientes)"
          className="min-w-0 flex-1 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-slate-800 outline-none"
        />
        <button className={`${btn} bg-fuchsia-600 px-3 text-sm`} disabled={busy} onClick={search}>{busy ? "…" : "🔍"}</button>
      </div>
      {msg && <div className="mt-2 text-center text-xs font-bold text-white/80">{msg}</div>}
      <div className="mt-2 flex max-h-72 flex-col gap-1.5 overflow-y-auto">
        {rows.map((r) => <PlayerCard key={r.id} row={r} onChanged={search} />)}
      </div>
    </div>
  );
}
