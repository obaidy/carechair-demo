import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

type AcceptInviteBody = {
  token?: string;
  code?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeRole(input: unknown): "OWNER" | "MANAGER" | "STAFF" {
  const role = String(input || "").trim().toUpperCase();
  if (role === "OWNER") return "OWNER";
  if (role === "MANAGER") return "MANAGER";
  return "STAFF";
}

function safeInviteError(message: string) {
  const text = message.toLowerCase();
  if (text.includes("invite_expired") || text.includes("expired")) return "EXPIRED";
  if (text.includes("invite_revoked") || text.includes("revoked")) return "REVOKED";
  if (text.includes("max_uses") || text.includes("max uses")) return "MAX_USES";
  if (text.includes("not_found") || text.includes("invalid")) return "INVALID_INVITE";
  if (text.includes("rate")) return "RATE_LIMITED";
  if (text.includes("auth")) return "UNAUTHORIZED";
  return "INVALID_INVITE";
}

async function writeAudit(
  serviceClient: ReturnType<typeof createClient>,
  payload: {
    salonId?: string | null;
    actorUserId: string;
    action: string;
    meta?: Record<string, unknown>;
  },
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

  let body: AcceptInviteBody = {};
  try {
    body = (await req.json()) as AcceptInviteBody;
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body." });
  }

  const code = String(body.code || "").trim().toUpperCase();
  const token = String(body.token || "").trim();
  if (!code && !token) return json(400, { ok: false, error: "INVALID_INVITE" });

  const ip = String(req.headers.get("x-forwarded-for") || "")
    .split(",")[0]
    .trim()
    .slice(0, 64);
  const actorKey = `accept-invite:user:${user.id}`;
  const ipKey = ip ? `accept-invite:ip:${ip}` : null;
  const keyBucket = new Date().toISOString().slice(0, 13).replace(/[-:T]/g, "");

  const userRate = await serviceClient.rpc("consume_rate_limit", {
    p_key: `${actorKey}:${keyBucket}`,
    p_limit: 10,
    p_window_seconds: 60 * 60,
  });

  if (userRate.error || !userRate.data?.ok) {
    await writeAudit(serviceClient, {
      actorUserId: user.id,
      action: "invite.accept_failed",
      meta: { reason: "RATE_LIMITED", scope: "user" },
    });
    return json(429, { ok: false, error: "RATE_LIMITED" });
  }

  if (ipKey) {
    const ipRate = await serviceClient.rpc("consume_rate_limit", {
      p_key: `${ipKey}:${keyBucket}`,
      p_limit: 30,
      p_window_seconds: 60 * 60,
    });
    if (ipRate.error || !ipRate.data?.ok) {
      await writeAudit(serviceClient, {
        actorUserId: user.id,
        action: "invite.accept_failed",
        meta: { reason: "RATE_LIMITED", scope: "ip" },
      });
      return json(429, { ok: false, error: "RATE_LIMITED" });
    }
  }

  const tokenHash = token ? await sha256Hex(token) : null;

  // Preferred path: atomic DB function with row lock + counters.
  const rpc = await serviceClient.rpc("accept_salon_invite_atomic", {
    p_user_id: user.id,
    p_code: code || null,
    p_token_hash: tokenHash,
  });

  if (!rpc.error && rpc.data) {
    const out = rpc.data as { salon_id?: string; role?: string; ok?: boolean };
    await writeAudit(serviceClient, {
      salonId: out.salon_id ? String(out.salon_id) : null,
      actorUserId: user.id,
      action: "invite.accepted",
      meta: {
        method: token ? "token" : "code",
        role: out.role || null,
      },
    });
    return json(200, {
      ok: true,
      salon_id: out.salon_id,
      role: out.role,
    });
  }

  // Compatibility fallback if RPC is not deployed yet.
  const rpcErrorMessage = String(rpc.error?.message || "");
  if (!rpcErrorMessage.toLowerCase().includes("accept_salon_invite_atomic")) {
    const errorCode = safeInviteError(rpcErrorMessage);
    await writeAudit(serviceClient, {
      actorUserId: user.id,
      action: "invite.accept_failed",
      meta: { reason: errorCode, raw_error: rpcErrorMessage },
    });
    return json(400, { ok: false, error: errorCode });
  }

  const inviteQuery = serviceClient
    .from("salon_invites")
    .select("id,salon_id,role,expires_at,max_uses,used_count,uses,revoked_at")
    .limit(1);

  const inviteRes = tokenHash
    ? await inviteQuery.eq("token_hash", tokenHash).maybeSingle()
    : await inviteQuery.eq("code", code).maybeSingle();

  if (inviteRes.error || !inviteRes.data?.id) {
    await writeAudit(serviceClient, {
      actorUserId: user.id,
      action: "invite.accept_failed",
      meta: { reason: "INVALID_INVITE" },
    });
    return json(400, { ok: false, error: "INVALID_INVITE" });
  }

  const invite = inviteRes.data;
  if (!invite.salon_id) return json(400, { ok: false, error: "INVALID_INVITE" });
  if (invite.revoked_at) {
    await writeAudit(serviceClient, {
      salonId: String(invite.salon_id),
      actorUserId: user.id,
      action: "invite.accept_failed",
      meta: { reason: "REVOKED" },
    });
    return json(400, { ok: false, error: "REVOKED" });
  }
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
    await writeAudit(serviceClient, {
      salonId: String(invite.salon_id),
      actorUserId: user.id,
      action: "invite.accept_failed",
      meta: { reason: "EXPIRED" },
    });
    return json(400, { ok: false, error: "EXPIRED" });
  }
  const used = Number(invite.used_count ?? invite.uses ?? 0);
  const maxUses = Number(invite.max_uses ?? 1);
  if (used >= maxUses) {
    await writeAudit(serviceClient, {
      salonId: String(invite.salon_id),
      actorUserId: user.id,
      action: "invite.accept_failed",
      meta: { reason: "MAX_USES" },
    });
    return json(400, { ok: false, error: "MAX_USES" });
  }

  const role = normalizeRole(invite.role);
  const grantRole = role === "OWNER" ? "MANAGER" : role;

  const upsertRes = await serviceClient
    .from("salon_members")
    .upsert(
      {
        salon_id: invite.salon_id,
        user_id: user.id,
        role: grantRole,
        status: "ACTIVE",
        removed_at: null,
      },
      { onConflict: "salon_id,user_id" },
    )
    .select("salon_id,role,status")
    .single();

  if (upsertRes.error) {
    await writeAudit(serviceClient, {
      salonId: String(invite.salon_id),
      actorUserId: user.id,
      action: "invite.accept_failed",
      meta: { reason: "MEMBERSHIP_WRITE_FAILED", raw_error: upsertRes.error.message || "unknown" },
    });
    return json(400, { ok: false, error: "INVALID_INVITE" });
  }

  await serviceClient
    .from("salon_invites")
    .update({
      used_count: used + 1,
      uses: used + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", invite.id);

  await serviceClient.from("audit_log").insert({
    salon_id: invite.salon_id,
    actor_user_id: user.id,
    action: "invite.accepted",
    meta: {
      invite_id: invite.id,
      role: grantRole,
    },
  });

  return json(200, {
    ok: true,
    salon_id: invite.salon_id,
    role: grantRole,
  });
});
