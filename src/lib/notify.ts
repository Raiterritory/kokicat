// System notifications for multiplayer challenges ("X quiere jugar contigo").
// On Android uses @capacitor/local-notifications; in the browser, the Notification API.
import { Capacitor } from "@capacitor/core";

const CHANNEL = "retos";
let ready: Promise<boolean> | null = null;

async function setupNative(): Promise<boolean> {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  let perm = await LocalNotifications.checkPermissions();
  if (perm.display === "prompt" || perm.display === "prompt-with-rationale") {
    perm = await LocalNotifications.requestPermissions();
  }
  if (perm.display !== "granted") return false;
  // Canal de importancia alta: aparece arriba de la pantalla y vibra
  await LocalNotifications.createChannel({
    id: CHANNEL,
    name: "Retos de amigos",
    description: "Cuando un amigo te reta a jugar en vivo",
    importance: 5,
    vibration: true,
    visibility: 1,
  }).catch(() => {});
  return true;
}

async function setupWeb(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch { /* bloqueado */ }
  }
  return Notification.permission === "granted";
}

/** Asks for notification permission once (Android 13+ shows the system dialog). */
export function ensureNotifyPermission(): Promise<boolean> {
  if (!ready) {
    ready = (Capacitor.isNativePlatform() ? setupNative() : setupWeb()).catch(() => false);
  }
  return ready;
}

/** Shows "<name> quiere jugar contigo". */
export async function notifyChallenge(name: string, detail: string) {
  if (!(await ensureNotifyPermission())) return;
  const title = `${name} quiere jugar contigo`;
  const body = `${detail} · Toca para abrir KokiCat y aceptar ⚔️`;
  try {
    if (Capacitor.isNativePlatform()) {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.schedule({
        notifications: [{ id: Math.floor(Math.random() * 2_000_000_000), title, body, channelId: CHANNEL, autoCancel: true }],
      });
    } else {
      new Notification(title, { body, tag: "kokicat-reto" });
    }
  } catch {
    // sin notificación: queda el aviso dentro del juego
  }
}
