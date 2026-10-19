// Horario de la versión web (hora de Chile): abierta de 10:00 a 21:00.
//
// La app de Android (APK) NUNCA tiene horario: se reconoce por varias señales y,
// ante la duda, se deja jugar. El bloqueo solo aplica cuando es seguro que es la web.

export const WEB_OPEN_HOUR = 10;
export const WEB_CLOSE_HOUR = 21;

type AnyWin = {
  __KOKICAT_APK__?: boolean;
  Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
  document?: { querySelector?: (s: string) => unknown };
  navigator?: { userAgent?: string };
  location?: { protocol?: string };
} | undefined;

function currentWin(): AnyWin {
  return typeof window === "undefined" ? undefined : (window as AnyWin);
}

/** Verdadero solo si hay una señal clara de que esto corre dentro del APK de Android. */
export function isNativeApp(win: AnyWin = currentWin()): boolean {
  if (!win) return false;
  // 1. Marcador que el build estático (scripts/build-static.mjs) mete en el index.html del APK.
  if (win.__KOKICAT_APK__ === true) return true;
  // 2. Puente de Capacitor.
  if (win.Capacitor?.isNativePlatform?.() === true) return true;
  if (typeof win.Capacitor?.getPlatform === "function") {
    const p = win.Capacitor.getPlatform();
    if (p && p !== "web") return true;
  }
  // 3. Meta tag del APK (por si el script inline no llegó a correr).
  if (typeof win.document?.querySelector === "function" && win.document.querySelector('meta[name="kokicat-app"]')) return true;
  // 4. WebView de Android (el navegador normal no trae "; wv)").
  if (/; wv\)/.test(win.navigator?.userAgent ?? "")) return true;
  // 5. Esquemas que solo existen dentro de la app.
  const proto = win.location?.protocol ?? "";
  return proto === "capacitor:" || proto === "content:" || proto === "file:";
}

/** Hora actual (0-23) en Chile; si el dispositivo no tiene la zona, usa su hora local. */
export function chileHour(now: number = Date.now()): number {
  try {
    const h = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: "America/Santiago", hour: "numeric", hour12: false }).format(now),
    );
    if (Number.isFinite(h)) return h % 24;
  } catch {
    // sin zona horaria disponible: se usa la hora del aparato
  }
  return new Date(now).getHours();
}

/** ¿Se puede jugar? El APK siempre; la web solo de 10:00 a 21:00 (hora de Chile). */
export function webIsOpen(win: AnyWin = currentWin(), hour: number = chileHour()): boolean {
  if (isNativeApp(win)) return true;
  return hour >= WEB_OPEN_HOUR && hour < WEB_CLOSE_HOUR;
}
