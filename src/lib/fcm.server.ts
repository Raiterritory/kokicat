// Firebase Cloud Messaging (HTTP v1) from the server, using the service account
// stored in the FIREBASE_SERVICE_ACCOUNT secret. Only WebCrypto + fetch, so it runs on Workers and Node.

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

export type PushMessage = {
  title: string;
  body: string;
  tag: string;
  data: Record<string, string>;
};

let cachedToken: { value: string; exp: number } | null = null;

function b64url(input: ArrayBuffer | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function readServiceAccount(): ServiceAccount | null {
  const raw = process.env["FIREBASE_SERVICE_ACCOUNT"];
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    return sa.project_id && sa.client_email && sa.private_key ? sa : null;
  } catch {
    return null;
  }
}

async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.value;

  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }))}`;
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${b64url(sig)}`,
    }),
  });
  if (!res.ok) throw new Error(`oauth ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, exp: now + json.expires_in };
  return json.access_token;
}

/** Sends the message to each device token. Returns the tokens that no longer exist (to delete them). */
export async function sendPush(sa: ServiceAccount, tokens: string[], msg: PushMessage) {
  const auth = await accessToken(sa);
  const dead: string[] = [];
  let sent = 0;
  await Promise.all(tokens.map(async (token) => {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST",
      headers: { authorization: `Bearer ${auth}`, "content-type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: msg.title, body: msg.body },
          data: msg.data,
          android: {
            priority: "HIGH",
            ttl: "60s",
            notification: { channel_id: "retos", icon: "ic_stat_koki", color: "#ff5a5f", tag: msg.tag },
          },
        },
      }),
    });
    if (res.ok) { sent++; return; }
    if (res.status === 404 || res.status === 400) dead.push(token);
  }));
  return { sent, dead };
}
