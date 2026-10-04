import { useEffect, useRef, useState } from "react";
import { type Player, getPlayer, deletePlayer, syncScores } from "./leaderboard";
import { type SaveFile, type SaveSummary, exportSave, parseSave, applySave, summarize, currentData } from "./save-data";

const box = "mb-5 rounded-2xl bg-black/30 p-3";
const title = "mb-2 text-sm font-bold text-white/80";
const btn = "flex-1 rounded-xl px-3 py-2 font-black text-white active:translate-y-0.5 disabled:opacity-50";

function Summary({ s }: { s: SaveSummary }) {
  return (
    <ul className="text-xs text-white/80">
      <li>🧁 {s.coins} pastelitos · 🐾 {s.characters} personajes</li>
      <li>🏆 Normal {s.best} · 🔥 Difícil {s.bestHard}</li>
      <li>👤 {s.nickname ?? "sin usuario online"}</li>
    </ul>
  );
}

/** Export the save to a file (phone / PC) and import it back. */
export function SaveDataSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<SaveFile | null>(null);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const save = parseSave(await f.text());
    if (!save) { setMsg("❌ Ese archivo no es un guardado de KokiCat"); return; }
    setMsg("");
    setPending(save);
  };

  const confirmImport = async () => {
    if (!pending) return;
    applySave(pending);
    setPending(null);
    setMsg("⏳ Actualizando ranking…");
    await syncScores();
    // recarga para que el juego y el ranking lean los datos importados
    window.location.reload();
  };

  return (
    <div className={box}>
      <div className={title}>💾 Datos de guardado</div>
      {!pending ? (
        <>
          <Summary s={summarize(currentData())} />
          <div className="mt-2 flex gap-2">
            <button
              disabled={busy}
              onClick={async () => { setBusy(true); setMsg((await exportSave()).msg); setBusy(false); }}
              className={`${btn} bg-gradient-to-b from-sky-500 to-blue-700`}
            >
              📤 Exportar
            </button>
            <button onClick={() => fileRef.current?.click()} className={`${btn} bg-gradient-to-b from-violet-500 to-indigo-700`}>
              📥 Importar
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }}
          />
        </>
      ) : (
        <div>
          <div className="mb-1 text-sm font-bold text-white">¿Importar este guardado?</div>
          <Summary s={summarize(pending.data)} />
          <div className="mt-1 text-[11px] text-white/60">
            Los pastelitos se reemplazan por los del archivo. Los récords y personajes se combinan: te quedas con lo mejor de ambos.
          </div>
          <div className="mt-2 flex gap-2">
            <button onClick={() => setPending(null)} className={`${btn} bg-white/20`}>Cancelar</button>
            <button onClick={confirmImport} className={`${btn} bg-emerald-600`}>Importar</button>
          </div>
        </div>
      )}
      {msg && <div className="mt-2 text-center text-xs font-bold text-white/80">{msg}</div>}
    </div>
  );
}

/** Shows the online nickname and lets the player delete their online account. */
export function OnlineAccountSection() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { setPlayer(getPlayer()); }, []);

  return (
    <div className={box}>
      <div className={title}>🌐 Usuario online</div>
      {!player ? (
        <div className="text-xs text-white/70">{msg || "No tienes usuario online. Créalo desde 🏆 Ranking."}</div>
      ) : !confirm ? (
        <>
          <div className="mb-2 text-sm text-white">👤 {player.nickname}</div>
          <button onClick={() => { setConfirm(true); setMsg(""); }} className={`${btn} w-full bg-gradient-to-b from-red-500 to-red-700`}>
            🗑️ Eliminar mi usuario online
          </button>
          {msg && <div className="mt-2 text-center text-xs font-bold text-red-300">{msg}</div>}
        </>
      ) : (
        <div>
          <div className="mb-2 text-center text-sm font-bold text-white">
            ¿Eliminar a «{player.nickname}»? Se borra del ranking y pierdes tus amigos. Tus pastelitos y personajes se quedan en este teléfono.
          </div>
          <div className="flex gap-2">
            <button onClick={() => setConfirm(false)} className={`${btn} bg-white/20`}>Cancelar</button>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const r = await deletePlayer();
                setBusy(false);
                setConfirm(false);
                if (r.ok) { setPlayer(null); setMsg("✅ Usuario eliminado"); } else setMsg(`❌ ${r.error}`);
              }}
              className={`${btn} bg-red-600`}
            >
              {busy ? "…" : "Sí, eliminar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
