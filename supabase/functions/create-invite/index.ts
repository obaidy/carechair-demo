import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

type CreateInviteBody = {
  salon_id?: string;
  role?: "MANAGER" | "STAFF" | string;
  expires_in_hours?: number;
  max_uses?: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

function bearerToken(req: Request) {
  const header = req.headers.get("authorization") || "";
  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return "";
  return parts[1] || "";
}

function normalizeRole(input: unknown): "MANAGER" | "STAFF" {
  const role = String(input || "").trim().toUpperCase();
  if (role === "MANAGER") return "MANAGER";
  return "STAFF";
}

function normalizeHours(input: unknown) {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(Math.floor(n), 24 * 365);
}

function normalizeMaxUses(input: unknown) {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), 1000);
}

function randomCode(length = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

function randomToken(bytesLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(bytesLength));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeLegacyRole(role: unknown) {
  const text = String(role || "").trim().toLowerCase();
  if (text === "owner") return "OWNER";
  if (text === "manager" || text === "admin" || text === "salon_admin") return "MANAGER";
  if (text === "staff" || text === "employee") return "STAFF";
  return null;
}

function isActiveStatus(status: unknown) {
  const text = String(status || "").trim().toUpperCase();
  return text === "" || text === "ACTIVE";
}

function safeErrorCode(message: string) {
  const text = message.toLowerCase();
  if (text.includes("forbidden")) return "FORBIDDEN";
  if (text.includes("rate")) return "RATE_LIMITED";
  if (text.includes("salon")) return "SALON_REQUIRED";
  return "INVITE_CREATE_FAILED";
}

async function writeAudit(
  serviceClient: ReturnType<typeof createClient>,
  payload: { salonId?: string | null; actorUserId: string; action: string; meta?: Record<string, unknown> },
) {
  try {
    await serviceClient.from("audit_log").insert({
      salon_id: payload.salonId || null,
      actor_user_id: payload.actorUserId,
      action: payload.action,
      meta: payload.meta || {},
    });
  } catch {
    // best effort
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Only POST is allowed." });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const APP_WEB_URL = (Deno.env.get("APP_WEB_URL") || "https://carechair.vercel.app").replace(/\/+$/, "");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { ok: false, error: "Missing Supabase environment variables." });
  }

  const accessToken = bearerToken(req);
  if (!accessToken) return json(401, { ok: false, error: "Missing bearer token." });

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const userRes = await authClient.auth.getUser(accessToken);
  const user = userRes.data?.user;
  if (userRes.error || !user?.id) {
    return json(401, { ok: false, error: "Unauthorized." });
  }

  let body: CreateInviteBody = {};
  try {
    body = (await req.json()) as CreateInviteBody;
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body." });
  }

  const salonId = String(body.salon_id || "").trim();
  if (!salonId) return json(400, { ok: false, error: "salon_id is required." });

  const role = normalizeRole(body.role);
  const maxUses = normalizeMaxUses(body.max_uses);
  const expiresInHours = normalizeHours(body.expires_in_hours);
  const expiresAt = expiresInHours ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString() : null;

  const dayKey = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const createRateKey = `create-invite:salon:${salonId}:user:${user.id}:${dayKey}`;
  const rateRes = await serviceClient.rpc("consume_rate_limit", {
    p_key: createRateKey,
    p_limit: 20,
    p_window_seconds: 24 * 60 * 60,
  });
  if (rateRes.error || !rateRes.data?.ok) {
    await writeAudit(serviceClient, {
      salonId,
      actorUserId: user.id,
      action: "invite.create_failed",
      meta: {
        reason: "RATE_LIMITED",
        key: createRateKey,
      },
    });
    return json(429, { ok: false, error: "RATE_LIMITED" });
  }

  // Permission check against new membership table.
  let callerRole: string | null = null;
  const memberRes = await serviceClient
    .from("salon_members")
    .select("role,status")
    .eq("salon_id", salonId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!memberRes.error && memberRes.data && isActiveStatus(memberRes.data.status)) {
    callerRole = String(memberRes.data.role || "").toUpperCase();
  }

  // Legacy fallback for existing web setup.
  if (!callerRole) {
    const legacyRes = await serviceClient
      .from("salon_memberships")
      .select("role,status")
      .eq("salon_id", salonId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!legacyRes.error && legacyRes.data && isActiveStatus(legacyRes.data.status)) {
      callerRole = normalizeLegacyRole(legacyRes.data.role);
    }
  }

  if (callerRole !== "OWNER" && callerRole !== "MANAGER") {
    await writeAudit(serviceClient, {
      salonId,
      actorUserId: user.id,
      action: "invite.create_failed",
      meta: { reason: "FORBIDDEN" },
    });
    return json(403, { ok: false, error: "FORBIDDEN" });
  }

  const rawToken = randomToken(32);
  const tokenHash = await sha256Hex(rawToken);

  let created: { code: string; expires_at: string | null } | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomCode(8);

    const basePayload = {
      salon_id: salonId,
      created_by: user.id,
      role,
      code,
      token_hash: tokenHash,
      expires_at: expiresAt,
      max_uses: maxUses,
      used_count: 0,
      revoked_at: null,
    };

    // Preferred insert (no raw token storage).
    let insert = await serviceClient.from("salon_invites").insert(basePayload).select("code,expires_at").single();

    // Compatibility fallback if old schema still forces legacy columns.
    if (insert.error) {
      const message = String(insert.error.message || "").toLowerCase();
      if (message.includes("token") || message.includes("country_code") || message.includes("uses")) {
        insert = await serviceClient
          .from("salon_invites")
          .insert({
            ...basePayload,
            token: `h_${tokenHash}`,
            country_code: null,
            uses: 0,
          })
          .select("code,expires_at")
          .single();
      }
    }

    if (!insert.error && insert.data) {
      created = { code: String(insert.data.code), expires_at: insert.data.expires_at ?? null };
      break;
    }

    const codeCollision = insert.error?.code === "23505" || String(insert.error?.message || "").toLowerCase().includes("duplicate");
    if (!codeCollision || attempt === 4) {
      await writeAudit(serviceClient, {
        salonId,
        actorUserId: user.id,
        action: "invite.create_failed",
        meta: {
          reason: safeErrorCode(String(insert.error?.message || "unknown")),
          provider_error: insert.error?.message || "unknown",
        },
      });
      return json(500, { ok: false, error: safeErrorCode(String(insert.error?.message || "unknown")) });
    }
  }

  if (!created) {
    await writeAudit(serviceClient, {
      salonId,
      actorUserId: user.id,
      action: "invite.create_failed",
      meta: { reason: "INVITE_CREATE_FAILED" },
    });
    return json(500, { ok: false, error: "INVITE_CREATE_FAILED" });
  }

  const encoded = encodeURIComponent(rawToken);
  await writeAudit(serviceClient, {
    salonId,
    actorUserId: user.id,
    action: "invite.created",
    meta: {
      role,
      code: created.code,
      expires_at: created.expires_at,
      max_uses: maxUses,
    },
  });

  return json(200, {
    ok: true,
    role,
    code: created.code,
    expires_at: created.expires_at,
    invite_link: `carechair://join?token=${encoded}`,
    web_link: `${APP_WEB_URL}/join?token=${encoded}`,
  });
});
