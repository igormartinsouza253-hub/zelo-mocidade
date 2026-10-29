import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type NotificationPayload = { id?: string; title?: string; message?: string; url?: string; icon?: string; image?: string };

function preferenceAllows(prefs: Record<string, boolean>, type: string) {
  if (!prefs.enabled) return false;
  const key = type === "birthday" ? "birthdays_enabled"
    : type === "note_created" ? "notes_enabled"
    : type === "chat_message" ? "chat_enabled"
    : type === "group_join_request" ? "group_requests_enabled"
    : type === "event_created" ? "events_enabled"
    : type.startsWith("absence_") ? "absences_enabled"
    : null;
  return key ? prefs[key] !== false : true;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function encodeBase64Url(value: ArrayBuffer | Uint8Array) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function concat(...parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

async function hmac(key: Uint8Array, value: string | Uint8Array) {
  const imported = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", imported, typeof value === "string" ? new TextEncoder().encode(value) : value));
}

async function hkdf(key: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number) {
  const prk = await hmac(salt, key);
  return (await hmac(prk, concat(info, new Uint8Array([1])))).slice(0, length);
}

async function encryptPayload(payload: Uint8Array, clientPublicKey: string, authSecret: string) {
  const clientKey = decodeBase64Url(clientPublicKey);
  const auth = decodeBase64Url(authSecret);
  const serverKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const client = await crypto.subtle.importKey("raw", clientKey, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: client }, serverKeys.privateKey, 256));
  const serverPublicKey = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeys.publicKey));

  const keyInfo = concat(new TextEncoder().encode("WebPush: info\0"), clientKey, serverPublicKey);
  const ikm = await hkdf(shared, auth, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const contentInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const contentKey = await hkdf(ikm, salt, contentInfo, 16);
  const nonce = await hkdf(ikm, salt, new TextEncoder().encode("Content-Encoding: nonce\0"), 12);

  const plaintext = concat(payload, new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey("raw", contentKey, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, plaintext));
  const recordSize = new Uint8Array([0, 0, 16, 0]);
  return concat(salt, recordSize, new Uint8Array([serverPublicKey.length]), serverPublicKey, ciphertext);
}

async function send(subscription: Record<string, any>, message: string, vapidPublicKey: string, vapidPrivateKey: string, subject: string) {
  const endpoint = new URL(subscription.endpoint);
  const audience = `${endpoint.protocol}//${endpoint.host}`;
  const expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const header = encodeBase64Url(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = encodeBase64Url(new TextEncoder().encode(JSON.stringify({ aud: audience, exp: expiration, sub: subject })));
  const signingInput = `${header}.${claims}`;
  const privateKey = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: encodeBase64Url(decodeBase64Url(vapidPublicKey).slice(1, 33)), y: encodeBase64Url(decodeBase64Url(vapidPublicKey).slice(33, 65)), d: vapidPrivateKey, ext: true, key_ops: ["sign"] }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, new TextEncoder().encode(signingInput)));
  const body = await encryptPayload(new TextEncoder().encode(message), subscription.keys.p256dh, subscription.keys.auth);
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${signingInput}.${encodeBase64Url(signature)}, k=${vapidPublicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "normal",
    },
    body,
  });
  return response.status;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authorization = request.headers.get("Authorization");
    const dispatchSecret = Deno.env.get("PUSH_DISPATCH_SECRET");
    const isDispatch = !!dispatchSecret && request.headers.get("x-zelo-push-secret") === dispatchSecret;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Called by Supabase Cron. This branch is intentionally protected by a dedicated
    // secret and is allowed to run without a user JWT.
    if (isDispatch) {
      const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
      const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
      if (!vapidPublicKey || !vapidPrivateKey) return new Response("VAPID is not configured", { status: 503, headers: corsHeaders });
      const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:suporte@zelo.app";
      const { data: queue, error } = await admin.from("notification_push_queue").select("notification_id,attempts,notifications(id,user_id,title,message,type,entity_type,entity_id,metadata)").is("processed_at", null).lt("attempts", 5).order("created_at").limit(100);
      if (error) throw error;
      let sent = 0;
      for (const entry of queue || []) {
        const notification = (entry as any).notifications;
        if (!notification) {
          await admin.from("notification_push_queue").update({ processed_at: new Date().toISOString() }).eq("notification_id", entry.notification_id);
          continue;
        }
        const { data: prefs } = await admin.from("notification_preferences").select("enabled,birthdays_enabled,notes_enabled,group_requests_enabled,events_enabled,absences_enabled").eq("user_id", notification.user_id).maybeSingle();
        const { data: devices } = await admin.from("notification_devices").select("endpoint,p256dh,auth").eq("user_id", notification.user_id);
        if ((prefs && !preferenceAllows(prefs, notification.type)) || !devices?.length) {
          await admin.from("notification_push_queue").update({ processed_at: new Date().toISOString() }).eq("notification_id", entry.notification_id);
          continue;
        }
        const url = notification.entity_type === "nota" && notification.entity_id ? `/notas/editar/${notification.entity_id}` : notification.entity_type === "evento" && notification.entity_id ? `/calendario?eventId=${notification.entity_id}` : notification.entity_type === "group_join_request" ? "/grupo/info" : `/notificacoes/abrir?id=${notification.id}`;
        const payload = JSON.stringify({ id: notification.id, title: notification.title, message: notification.message, url, icon: "/pwa-192.png", ...(typeof notification.metadata?.photo_url === "string" ? { image: notification.metadata.photo_url } : {}) });
        const statuses = await Promise.all(devices.map(async (device) => {
          try {
            const status = await send({ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } }, payload, vapidPublicKey, vapidPrivateKey, subject);
            if (status === 404 || status === 410) await admin.from("notification_devices").delete().eq("endpoint", device.endpoint);
            return status;
          } catch { return 0; }
        }));
        if (statuses.some((status) => status >= 200 && status < 300)) {
          sent += 1;
          await admin.from("notification_push_queue").update({ processed_at: new Date().toISOString(), attempts: entry.attempts + 1 }).eq("notification_id", entry.notification_id);
        } else {
          await admin.from("notification_push_queue").update({ attempts: entry.attempts + 1 }).eq("notification_id", entry.notification_id);
        }
      }
      return new Response(JSON.stringify({ processed: queue?.length || 0, sent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!authorization) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authorization } } });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const body = await request.json();
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:suporte@zelo.app";
    if (!vapidPublicKey || !vapidPrivateKey) return jsonResponse({ error: "VAPID não configurado" }, 503);

    if (body.action === "public-key") {
      return jsonResponse({ publicKey: vapidPublicKey });
    }

    if (body.action === "subscribe") {
      const { endpoint, keys } = body.subscription || {};
      if (!endpoint || !keys?.p256dh || !keys?.auth || !endpoint.startsWith("https://")) return new Response("Invalid subscription", { status: 400, headers: corsHeaders });
      const { error } = await admin.from("notification_devices").upsert({ user_id: authData.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, user_agent: request.headers.get("user-agent") || "" }, { onConflict: "endpoint" });
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    if (body.action === "unsubscribe") {
      await admin.from("notification_devices").delete().eq("user_id", authData.user.id).eq("endpoint", body.endpoint);
      return jsonResponse({ ok: true });
    }

    if (body.action === "send" || body.action === "send-test") {
      const recipientId = body.action === "send-test" ? authData.user.id : body.userId;
      if (body.action === "send" && (!recipientId || recipientId !== authData.user.id)) return new Response("Forbidden", { status: 403, headers: corsHeaders });
      const { data: devices, error } = await admin.from("notification_devices").select("endpoint,p256dh,auth").eq("user_id", recipientId);
      if (error) throw error;
      const { data: notificationData } = await admin.from("notifications").select("id,title,message,type,entity_type,entity_id,metadata").eq("user_id", recipientId).eq("id", body.notification?.id ?? "").maybeSingle();
      if (body.action === "send" && !notificationData) return new Response(JSON.stringify({ sent: 0, devices: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (body.action === "send") {
        const { data: prefs } = await admin.from("notification_preferences").select("enabled,birthdays_enabled,notes_enabled,group_requests_enabled,events_enabled,absences_enabled").eq("user_id", recipientId).maybeSingle();
        if (prefs && !preferenceAllows(prefs, notificationData!.type)) return new Response(JSON.stringify({ sent: 0, devices: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const notification: NotificationPayload = body.action === "send-test"
        ? { title: "Tudo certo!", message: "As notificações do Zelo estão prontas neste dispositivo.", url: "/configuracoes?section=notifications" }
        : {
          id: notificationData!.id,
          title: notificationData!.title,
          message: notificationData!.message,
          url: notificationData!.entity_type === "nota" && notificationData!.entity_id ? `/notas/editar/${notificationData!.entity_id}`
            : notificationData!.entity_type === "evento" && notificationData!.entity_id ? `/calendario?eventId=${notificationData!.entity_id}`
            : notificationData!.entity_type === "group_join_request" ? "/grupo/info"
            : (notificationData!.entity_type === "birthday" || notificationData!.entity_type?.startsWith("absence_")) ? `/notificacoes/abrir?id=${notificationData!.id}`
            : `/notificacoes/abrir?id=${notificationData!.id}`,
          icon: "/pwa-192.png",
          ...(typeof notificationData!.metadata?.photo_url === "string" ? { image: notificationData!.metadata.photo_url } : {}),
        };
      const message = JSON.stringify(notification);
      const statuses = await Promise.all((devices || []).map(async (device) => {
        try {
          const status = await send({ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } }, message, vapidPublicKey, vapidPrivateKey, subject);
          if (status === 404 || status === 410) await admin.from("notification_devices").delete().eq("endpoint", device.endpoint);
          return status;
        } catch (error) {
          console.error("Push delivery failed", error);
          return 0;
        }
      }));
      return jsonResponse({ sent: statuses.filter((status) => status >= 200 && status < 300).length, devices: statuses.length });
    }

    return new Response("Unknown action", { status: 400, headers: corsHeaders });
  } catch (error) {
    console.error("send-web-push error", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});
