import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

type RequestActivationBody = {
  salon_id?: string;
  submitted_data?: Record<string, unknown>;
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

function log(event: string, meta: Record<string, unknown> = {}, level: "info" | "error" = "info") {
  const payload = {
    at: new Date().toISOString(),
    fn: "request-activation",
    event,
    ...meta,
  };
  if (level === "error") {
    console.error(JSON.stringify(payload));
  } else {
    console.log(JSON.stringify(payload));
  }
}

function bearerToken(req: Request) {
  const header = req.headers.get("authorization") || "";
  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return "";
  return parts[1] || "";
}

function toText(input: unknown, max = 500) {
  return String(input ?? "").trim().slice(0, max);
}

function toNullableText(input: unknown, max = 500) {
  const value = toText(input, max);
  return value || null;
}

function toNum(input: unknown, min?: number, max?: number) {
  const n = Number(input);
  if (!Number.isFinite(n)) return null;
  if (typeof min === "number" && n < min) return null;
  if (typeof max === "number" && n > max) return null;
  return n;
}

function normalizeAddressMode(value: unknown): "LOCATION" | "MANUAL" {
  const mode = String(value || "").trim().toUpperCase();
  return mode === "LOCATION" ? "LOCATION" : "MANUAL";
}

function normalizeSalonStatus(value: unknown) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "DRAFT";
  if (raw === "PENDING_APPROVAL" || raw === "PENDING_BILLING") return "PENDING_REVIEW";
  if (raw === "TRIALING" || raw === "PAST_DUE") return "ACTIVE";
  if (raw === "REJECTED") return "DRAFT";
  return raw;
}

function normalizeRole(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function missingRpc(error: unknown, rpcName: string) {
  const message = String((error as any)?.message || (error as any)?.details || "").toLowerCase();
  return message.includes(String(rpcName || "").toLowerCase());
}

async function logAudit(
  serviceClient: any,
  salonId: string,
  actorId: string,
  action: string,
  meta: Record<string, unknown>,
) {
  try {
    await serviceClient.rpc("log_activation_event", {
      p_salon_id: salonId,
      p_actor: actorId,
      p_action: action,
      p_meta: meta,
    });
  } catch {
    try {
      await serviceClient.from("audit_log").insert({
        salon_id: salonId,
        actor_user_id: actorId,
        action,
        meta,
      });
    } catch {
      // best effort
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    log("method_not_allowed", { method: req.method }, "error");
    return json(405, { ok: false, error: "ONLY_POST_ALLOWED" });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    log("missing_env", {}, "error");
    return json(500, { ok: false, error: "MISSING_SUPABASE_ENV" });
  }

  const accessToken = bearerToken(req);
  if (!accessToken) {
    log("missing_bearer", {}, "error");
    return json(401, { ok: false, error: "UNAUTHORIZED" });
  }

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
    log("auth_failed", { error: String(userRes.error?.message || userRes.error || "unknown") }, "error");
    return json(401, { ok: false, error: "UNAUTHORIZED" });
  }

  let body: RequestActivationBody = {};
  try {
    body = (await req.json()) as RequestActivationBody;
  } catch {
    return json(400, { ok: false, error: "INVALID_JSON" });
  }

  const salonId = toText(body.salon_id, 80);
  if (!salonId) {
    log("salon_id_missing", { uid: user.id }, "error");
    return json(400, { ok: false, error: "SALON_ID_REQUIRED" });
  }
  log("start", { uid: user.id, salon_id: salonId });

  const salonRes = await serviceClient
    .from("salons")
    .select("id,status,is_listed,is_public,created_by")
    .eq("id", salonId)
    .maybeSingle();
  if (salonRes.error || !salonRes.data?.id) {
    log("salon_not_found", { uid: user.id, salon_id: salonId, error: String(salonRes.error?.message || salonRes.error || "") }, "error");
    return json(404, { ok: false, error: "SALON_NOT_FOUND" });
  }

  let memberRole = "";
  const roleRes = await serviceClient.rpc("member_role", {
    p_salon_id: salonId,
    p_uid: user.id,
  });
  if (!roleRes.error) {
    memberRole = normalizeRole(roleRes.data);
  } else if (!missingRpc(roleRes.error, "member_role")) {
    return json(500, { ok: false, error: "ROLE_CHECK_FAILED" });
  }

  if (!memberRole) {
    const membershipRes = await serviceClient
      .from("salon_members")
      .select("role,status")
      .eq("salon_id", salonId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membershipRes.error && membershipRes.data) {
      const status = normalizeRole((membershipRes.data as any).status);
      if (status === "ACTIVE") {
        memberRole = normalizeRole((membershipRes.data as any).role);
      }
    }
  }

  if (memberRole !== "OWNER") {
    const createdBy = String((salonRes.data as any).created_by || "");
    if (createdBy && createdBy === user.id) {
      // Self-heal owner membership for freshly created salons when trigger timing/drift occurs.
      const healMembership = await serviceClient
        .from("salon_members")
        .upsert(
          {
            salon_id: salonId,
            user_id: user.id,
            role: "OWNER",
            status: "ACTIVE",
          },
          { onConflict: "salon_id,user_id" },
        )
        .select("salon_id")
        .single();

      if (healMembership.error) {
        await logAudit(serviceClient, salonId, user.id, "activation.request.denied", {
          reason: "OWNER_HEAL_FAILED",
          details: String(healMembership.error.message || healMembership.error.code || ""),
        });
        return json(500, { ok: false, error: "OWNER_MEMBERSHIP_REQUIRED" });
      }
      memberRole = "OWNER";
    }
  }

  if (memberRole !== "OWNER") {
    await logAudit(serviceClient, salonId, user.id, "activation.request.denied", {
      reason: "NOT_OWNER",
    });
    log("forbidden_not_owner", { uid: user.id, salon_id: salonId }, "error");
    return json(403, { ok: false, error: "FORBIDDEN" });
  }

  const currentStatus = normalizeSalonStatus(salonRes.data.status);
  if (currentStatus === "ACTIVE") {
    log("already_active", { uid: user.id, salon_id: salonId, status: currentStatus }, "error");
    return json(409, { ok: false, error: "ALREADY_ACTIVE" });
  }
  if (currentStatus === "SUSPENDED") {
    log("suspended_denied", { uid: user.id, salon_id: salonId }, "error");
    return json(409, { ok: false, error: "SALON_SUSPENDED" });
  }
  if (!["DRAFT", "PENDING_REVIEW"].includes(currentStatus)) {
    log("invalid_status", { uid: user.id, salon_id: salonId, status: currentStatus }, "error");
    return json(400, { ok: false, error: "INVALID_STATUS" });
  }

  const rateKey = `request-activation:salon:${salonId}:${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
  const rateRes = await serviceClient.rpc("consume_rate_limit", {
    p_key: rateKey,
    p_limit: 3,
    p_window_seconds: 24 * 60 * 60,
  });
  if (!rateRes.error && !rateRes.data?.ok) {
    await logAudit(serviceClient, salonId, user.id, "activation.request.denied", { reason: "RATE_LIMITED" });
    log("rate_limited", { uid: user.id, salon_id: salonId }, "error");
    return json(429, { ok: false, error: "RATE_LIMITED" });
  }
  if (rateRes.error && !missingRpc(rateRes.error, "consume_rate_limit")) {
    return json(500, { ok: false, error: "RATE_LIMIT_FAILED" });
  }

  const rawSubmitted = body.submitted_data || {};
  const addressMode = normalizeAddressMode(rawSubmitted.address_mode);
  const submittedData = {
    whatsapp: toNullableText(rawSubmitted.whatsapp, 50),
    city: toNullableText(rawSubmitted.city, 120),
    area: toNullableText(rawSubmitted.area, 120),
    address_mode: addressMode,
    address_text: toNullableText(rawSubmitted.address_text, 500),
    location_lat: toNum(rawSubmitted.location_lat, -90, 90),
    location_lng: toNum(rawSubmitted.location_lng, -180, 180),
    location_accuracy_m: toNum(rawSubmitted.location_accuracy_m, 0),
    location_label: toNullableText(rawSubmitted.location_label, 200),
    instagram: toNullableText(rawSubmitted.instagram, 200),
    photo_url: toNullableText(rawSubmitted.photo_url, 500),
    submitted_at: new Date().toISOString(),
  };

  const salonPatch: Record<string, unknown> = {
    status: "PENDING_REVIEW",
    address_mode: addressMode,
    address_text: submittedData.address_text,
    location_lat: submittedData.location_lat,
    location_lng: submittedData.location_lng,
    location_accuracy_m: submittedData.location_accuracy_m,
    location_label: submittedData.location_label,
  };
  if (submittedData.whatsapp) salonPatch.whatsapp = submittedData.whatsapp;
  if (submittedData.city) salonPatch.city = submittedData.city;
  if (submittedData.area) salonPatch.area = submittedData.area;

  const pendingReq = await serviceClient
    .from("activation_requests")
    .select("id")
    .eq("salon_id", salonId)
    .eq("status", "PENDING")
    .maybeSingle();

  if (pendingReq.error && pendingReq.error.code !== "PGRST116") {
    return json(500, { ok: false, error: "REQUEST_LOOKUP_FAILED" });
  }

  if (pendingReq.data?.id) {
    const updateReq = await serviceClient
      .from("activation_requests")
      .update({ submitted_data: submittedData, requested_by: user.id, admin_notes: null })
      .eq("id", pendingReq.data.id)
      .select("id")
      .single();
    if (updateReq.error) return json(500, { ok: false, error: "REQUEST_UPDATE_FAILED" });
  } else {
    const insertReq = await serviceClient
      .from("activation_requests")
      .insert({
        salon_id: salonId,
        requested_by: user.id,
        status: "PENDING",
        submitted_data: submittedData,
      })
      .select("id")
      .single();
    if (insertReq.error) return json(500, { ok: false, error: "REQUEST_CREATE_FAILED" });
  }

  const updateSalon = await serviceClient
    .from("salons")
    .update(salonPatch)
    .eq("id", salonId)
    .select("status")
    .single();

  if (updateSalon.error) {
    log("salon_update_failed", { uid: user.id, salon_id: salonId, error: String(updateSalon.error.message || updateSalon.error.code || "") }, "error");
    return json(500, { ok: false, error: "SALON_UPDATE_FAILED" });
  }

  await logAudit(serviceClient, salonId, user.id, "activation.requested", {
    address_mode: addressMode,
  });
  log("success", { uid: user.id, salon_id: salonId, salon_status: "PENDING_REVIEW" });

  return json(200, {
    ok: true,
    salon_id: salonId,
    salon_status: "PENDING_REVIEW",
  });
});
