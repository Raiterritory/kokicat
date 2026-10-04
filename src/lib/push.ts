// Push notifications (Firebase) so challenges arrive even with the app fully closed.
// Only active in the Android app built with android/app/google-services.json
// (build-static sets VITE_FCM_ENABLED automatically when that file exists).
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { getPlayer } from "./leaderboard";

const API_BASE = "https://kokicat.lovable.app";
const ENABLED = Capacitor.isNativePlatform() && import.meta.env.VITE_FCM_ENABLED === "true";

let token: string | null = null;
let started = false;

/** True when this phone receives Firebase pushes (then the system shows challenges by itself in background). */
export const pushActive = () => token !== null;

/** Registers the phone and listens for taps on challenge notifications. Safe to call repeatedly. */
export async function initPush(onTap: (data: Record<string, string>) => void) {
  if (!ENABLED || started) return;
  started = true;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.addListener("registration", (t) => { token = t.value; void savePushToken(); });
    await PushNotifications.addListener("pushNotificationActionPerformed", (a) => onTap((a.notification.data ?? {}) as Record<string, string>));
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") perm = await PushNotifications.requestPermissions();
    if (perm.receive === "granted") await PushNotifications.register();
  } catch {
    // sin Firebase: quedan las notificaciones con la app abierta
  }
}

/** Links this phone to the current online user (call again after creating / changing the user). */
export async function savePushToken() {
  const p = getPlayer();
  if (!p || !token) return;
  // save_push_token is added by migration 0003; not yet in the generated types
  await (supabase.rpc as unknown as (fn: string, a: Record<string, unknown>) => Promise<unknown>)(
    "save_push_token", { p_id: p.id, p_secret: p.secret, p_token: token },
  );
}

/** Asks the server to push the challenge to the invited friends' phones. */
export async function pushChallenge(to: string[], room: string, mode: string, rounds: number) {
  const p = getPlayer();
  if (!p) return;
  try {
    await fetch(`${API_BASE}/api/challenge`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ p_id: p.id, p_secret: p.secret, to, room, mode, rounds }),
    });
  } catch {
    // sin conexión o servidor sin Firebase: el reto igual llega a quien tenga el juego abierto
  }
}
