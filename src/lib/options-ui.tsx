import { useEffect, useRef, useState } from "react";
import {
  type Player, getPlayer, deletePlayer, syncScores,
  getRecoveryCode, recoverPlayer, formatRecoveryCode,
  hasPassword, setPassword, loginPlayer,
} from "./leaderboard";
import { Capacitor } from "@capacitor/core";
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

/** Shows the recovery code with buttons to copy it or send it somewhere safe. */
export function RecoveryCodeBox() {
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const show = async () => {
    setBusy(true);
    setMsg("");
    const r = await getRecoveryCode();
    setBusy(false);
    if (r.code) setCode(formatRecoveryCode(r.code));
    else setMsg(`❌ ${r.error}`);
  };

  const nickname = getPlayer()?.nickname ?? "";
  const text = `KokiCat · recuperar mi perfil\nApodo: ${nickname}\nCódigo: ${code}`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setMsg("✅ Copiado"); } catch { setMsg("Mantén presionado el código para copiarlo"); }
  };
  const share = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const { Share } = await import("@capacitor/share");
        await Share.share({ title: "Mi código de KokiCat", text, dialogTitle: "Guardar mi código de KokiCat" });
      } else {
        await copy();
      }
    } catch { /* cancelado */ }
  };

  if (!code) {
    return (
      <div className="mb-2">
        <button onClick={show} disabled={busy} className={`${btn} w-full bg-gradient-to-b from-amber-400 to-orange-600`}>
          {busy ? "…" : "🔑 Ver código de recuperación"}
        </button>
        {msg && <div className="mt-2 text-center text-xs font-bold text-red-300">{msg}</div>}
      </div>
    );
  }
  return (
    <div className="mb-3 rounded-xl bg-amber-400/15 p-3">
      <div className="text-xs font-bold text-amber-200">🔑 Tu código de recuperación</div>
      <div className="my-1 select-all text-center font-mono text-xl font-black tracking-wider text-white">{code}</div>
      <div className="text-[11px] leading-snug text-white/70">
        Guárdalo junto a tu apodo <b>{nickname}</b>. Si borras la app, con los dos recuperas tu usuario, amigos, récords, pastelitos y personajes. No se lo des a nadie.
      </div>
      <div className="mt-2 flex gap-2">
        <button onClick={copy} className={`${btn} bg-white/15`}>📋 Copiar</button>
        <button onClick={share} className={`${btn} bg-sky-600`}>📤 Enviar</button>
      </div>
      {msg && <div className="mt-2 text-center text-xs font-bold text-white/80">{msg}</div>}
    </div>
  );
}

/** Nickname + recovery code -> signs in to that profile again and restores its save. */
export function RecoverProfileForm({ onDone }: { onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<"password" | "code">("password");
  const [nick, setNick] = useState("");
  const [code, setCode] = useState("");
  const [password, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const submit = async () => {
    setBusy(true);
    setMsg("");
    const r = method === "password" ? await loginPlayer(nick, password) : await recoverPlayer(nick, code);
    setBusy(false);
    if (r.error) { setMsg(`❌ ${r.error}`); return; }
    setMsg(r.restored ? "✅ ¡Perfil recuperado! Volviendo a cargar…" : "✅ ¡Usuario recuperado! Volviendo a cargar…");
    onDone?.();
    // recarga para que el juego tome los pastelitos, personajes y récords recuperados
    setTimeout(() => window.location.reload(), 1200);
  };

  const input = "w-full rounded-full bg-white px-4 py-2 font-bold text-slate-800 outline-none";
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full text-center text-xs font-bold text-amber-300 underline">
        ¿Ya tenías un usuario? Recupéralo
      </button>
    );
  }
  const tab = (active: boolean) =>
    `flex-1 rounded-full px-2 py-1 text-xs font-black ${active ? "bg-white text-slate-900" : "bg-white/10 text-white"}`;
  const ready = nick.trim().length >= 3 && (method === "password" ? password.length >= 6 : code.replace(/[^0-9a-f]/gi, "").length === 16);
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-white/5 p-3">
      <div className="text-xs font-bold text-white/80">🔑 Recuperar mi perfil</div>
      <div className="flex gap-2">
        <button className={tab(method === "password")} onClick={() => { setMethod("password"); setMsg(""); }}>🔒 Contraseña</button>
        <button className={tab(method === "code")} onClick={() => { setMethod("code"); setMsg(""); }}>🔑 Código</button>
      </div>
      <input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Tu apodo" maxLength={16} className={input} />
      {method === "password" ? (
        <input
          type="password"
          value={password}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Tu contraseña"
          maxLength={64}
          className={input}
        />
      ) : (
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Código: XXXX-XXXX-XXXX-XXXX"
          maxLength={24}
          autoCapitalize="characters"
          className={`${input} font-mono`}
        />
      )}
      <button
        onClick={submit}
        disabled={busy || !ready}
        className={`${btn} w-full bg-gradient-to-b from-emerald-500 to-emerald-700`}
      >
        {busy ? "…" : "Recuperar"}
      </button>
      {msg && <div className="text-center text-xs font-bold text-white/85">{msg}</div>}
    </div>
  );
}

/** Password + confirmation inputs. Calls onSubmit only when both match and have 6+ characters. */
function PasswordFields({ submitLabel, busy, onSubmit }: { submitLabel: string; busy: boolean; onSubmit: (pw: string) => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const input = "w-full rounded-full bg-white px-4 py-2 font-bold text-slate-800 outline-none";
  const mismatch = pw2.length > 0 && pw !== pw2;
  return (
    <div className="flex flex-col gap-2">
      <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Contraseña (mínimo 6)" maxLength={64} className={input} />
      <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Repite la contraseña" maxLength={64} className={input} />
      {mismatch && <div className="text-center text-xs font-bold text-red-300">Las contraseñas no son iguales</div>}
      <button
        onClick={() => onSubmit(pw)}
        disabled={busy || pw.length < 6 || pw !== pw2}
        className={`${btn} w-full bg-gradient-to-b from-emerald-500 to-emerald-700`}
      >
        {busy ? "…" : submitLabel}
      </button>
    </div>
  );
}

/**
 * On start: players who already have an online user but no password are asked to create one
 * (it's how they'll recover the user if they delete the app). Asks again next time if postponed.
 */
export function PasswordPrompt() {
  const [need, setNeed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);

  // Solo al abrir el juego (al crear el usuario la contraseña ya se pide en el mismo formulario)
  useEffect(() => {
    if (!getPlayer()) return;
    void hasPassword().then((has) => setNeed(has === false)); // null (sin conexión): no se molesta
  }, []);

  if (!need) return null;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const save = async (pw: string) => {
    setBusy(true);
    setMsg("");
    const r = await setPassword(pw);
    setBusy(false);
    if (!r.ok) { setMsg(`❌ ${r.error}`); return; }
    setDone(true);
    setTimeout(() => setNeed(false), 1500);
  };
  const nickname = getPlayer()?.nickname ?? "";

  return (
    <div className="absolute inset-0 z-[65] flex items-center justify-center bg-black/70 p-4" onPointerDown={stop} onClick={stop}>
      <div className="w-full max-w-sm rounded-3xl border-2 border-white/10 bg-gradient-to-b from-indigo-900 to-slate-900 p-5 text-white shadow-2xl">
        <div className="text-center text-4xl">🔒</div>
        <h2 className="text-center text-2xl font-black">Crea tu contraseña</h2>
        <div className="mb-3 text-center text-xs text-white/70">
          Para tu usuario <b>{nickname}</b>. Si borras la app, con tu apodo y esta contraseña recuperas tu perfil.
        </div>
        {done ? (
          <div className="py-3 text-center font-black text-emerald-300">✅ ¡Contraseña guardada!</div>
        ) : (
          <>
            <PasswordFields submitLabel="Guardar contraseña" busy={busy} onSubmit={save} />
            {msg && <div className="mt-2 text-center text-xs font-bold text-red-300">{msg}</div>}
            <button onClick={() => setNeed(false)} className="mt-3 w-full text-center text-xs font-bold text-white/50 underline">
              Más tarde (te lo volveré a pedir)
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Options: change the password of the online user. */
function ChangePasswordBox() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const save = async (pw: string) => {
    setBusy(true);
    setMsg("");
    const r = await setPassword(pw);
    setBusy(false);
    if (r.ok) { setMsg("✅ Contraseña guardada"); setOpen(false); } else setMsg(`❌ ${r.error}`);
  };
  return (
    <div className="mb-2">
      {open ? (
        <div className="rounded-xl bg-white/5 p-3">
          <div className="mb-2 text-xs font-bold text-white/80">🔒 Nueva contraseña</div>
          <PasswordFields submitLabel="Guardar" busy={busy} onSubmit={save} />
        </div>
      ) : (
        <button onClick={() => { setOpen(true); setMsg(""); }} className={`${btn} w-full bg-white/15`}>🔒 Cambiar contraseña</button>
      )}
      {msg && <div className="mt-2 text-center text-xs font-bold text-white/85">{msg}</div>}
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
        <>
          <div className="mb-2 text-xs text-white/70">{msg || "No tienes usuario online. Créalo desde 🏆 Ranking."}</div>
          <RecoverProfileForm />
        </>
      ) : !confirm ? (
        <>
          <div className="mb-2 text-sm text-white">👤 {player.nickname}</div>
          <ChangePasswordBox />
          <RecoveryCodeBox />
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
