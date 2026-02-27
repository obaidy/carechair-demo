import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

type ReviewActivationBody = {
  activation_request_id?: string;
  decision?: "APPROVE" | "REJECT" | string;
  admin_notes?: string;
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
    fn: "review-activation",
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

function toText(input: unknown, max = 1000) {
  return String(input ?? "").trim().slice(0, max);
}

function normalizeDecision(input: unknown): "APPROVE" | "REJECT" | "" {
  const value = String(input || "").trim().toUpperCase();
  if (value === "APPROVE") return "APPROVE";
  if (value === "REJECT") return "REJECT";
  return "";
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
  log("start", { uid: user.id });

  const isAdminRes = await serviceClient.rpc("is_super_admin", { p_uid: user.id });
  const isAdmin = Boolean(isAdminRes.data);
  if (!isAdmin) {
    log("forbidden_not_super_admin", { uid: user.id }, "error");
    return json(403, { ok: false, error: "FORBIDDEN" });
  }

  let body: ReviewActivationBody = {};
  try {
    body = (await req.json()) as ReviewActivationBody;
  } catch {
    return json(400, { ok: false, error: "INVALID_JSON" });
  }

  const requestId = toText(body.activation_request_id, 80);
  const decision = normalizeDecision(body.decision);
  const adminNotes = toText(body.admin_notes, 2000) || null;

  if (!requestId) {
    log("request_id_missing", { uid: user.id }, "error");
    return json(400, { ok: false, error: "ACTIVATION_REQUEST_ID_REQUIRED" });
  }
  if (!decision) {
    log("decision_missing", { uid: user.id, activation_request_id: requestId }, "error");
    return json(400, { ok: false, error: "DECISION_REQUIRED" });
  }

  const reqRes = await serviceClient
    .from("activation_requests")
    .select("id,salon_id,status,submitted_data")
    .eq("id", requestId)
    .maybeSingle();

  if (reqRes.error || !reqRes.data?.id) {
    log("request_not_found", { uid: user.id, activation_request_id: requestId }, "error");
    return json(404, { ok: false, error: "REQUEST_NOT_FOUND" });
  }

  const salonId = String(reqRes.data.salon_id);
  const currentRequestStatus = String(reqRes.data.status || "").toUpperCase();
  if (currentRequestStatus !== "PENDING") {
    log("request_not_pending", { uid: user.id, activation_request_id: requestId, status: currentRequestStatus }, "error");
    return json(400, { ok: false, error: "REQUEST_NOT_PENDING" });
  }

  const reviewPatch = {
    status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
    admin_notes: adminNotes,
  };

  const reviewReq = await serviceClient
    .from("activation_requests")
    .update(reviewPatch)
    .eq("id", requestId)
    .select("id,salon_id,status")
    .single();
  if (reviewReq.error) {
    log("request_update_failed", { uid: user.id, activation_request_id: requestId, error: String(reviewReq.error.message || reviewReq.error.code || "") }, "error");
    return json(500, { ok: false, error: "REQUEST_REVIEW_UPDATE_FAILED" });
  }

  const salonStatus = decision === "APPROVE" ? "ACTIVE" : "DRAFT";
  const salonPatch: Record<string, unknown> = {
    status: salonStatus,
    is_active: decision === "APPROVE",
  };
  if (decision === "APPROVE") {
    salonPatch.is_public = true;
    salonPatch.suspended_reason = null;
  } else {
    salonPatch.is_public = false;
  }

  const updateSalon = await serviceClient
    .from("salons")
    .update(salonPatch)
    .eq("id", salonId)
    .select("id,status")
    .single();
  if (updateSalon.error) {
    log("salon_update_failed", { uid: user.id, salon_id: salonId, error: String(updateSalon.error.message || updateSalon.error.code || "") }, "error");
    return json(500, { ok: false, error: "SALON_UPDATE_FAILED" });
  }

  await logAudit(serviceClient, salonId, user.id, decision === "APPROVE" ? "activation.approved" : "activation.rejected", {
    activation_request_id: requestId,
    notes: adminNotes,
  });
  log("success", {
    uid: user.id,
    salon_id: salonId,
    activation_request_id: requestId,
    decision,
    salon_status: salonStatus,
  });

  return json(200, {
    ok: true,
    salon_id: salonId,
    salon_status: decision === "APPROVE" ? "ACTIVE" : "DRAFT",
    activation_request_status: reviewPatch.status,
  });
});
