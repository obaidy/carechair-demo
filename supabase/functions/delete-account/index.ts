import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return "";
  return token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "ONLY_POST_ALLOWED" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { ok: false, error: "MISSING_SUPABASE_ENV" });
  }

  const accessToken = bearerToken(req);
  if (!accessToken) return json(401, { ok: false, error: "UNAUTHORIZED" });

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
    return json(401, { ok: false, error: "UNAUTHORIZED" });
  }

  const ownedSalons = await serviceClient
    .from("salons")
    .select("id")
    .eq("created_by", user.id);
  if (ownedSalons.error) {
    return json(500, { ok: false, error: "OWNED_SALONS_LOAD_FAILED" });
  }

  const ownedSalonIds = (ownedSalons.data || [])
    .map((row: Record<string, unknown>) => String(row.id || ""))
    .filter(Boolean);

  if (ownedSalonIds.length > 0) {
    const deleteSalons = await serviceClient
      .from("salons")
      .delete()
      .in("id", ownedSalonIds);
    if (deleteSalons.error) {
      return json(500, { ok: false, error: "SALON_DELETE_FAILED" });
    }
  }

  await serviceClient.from("salon_members").delete().eq("user_id", user.id);
  await serviceClient.from("device_tokens").delete().eq("user_id", user.id);
  await serviceClient.from("notification_preferences").delete().eq("user_id", user.id);
  await serviceClient.from("user_profiles").delete().eq("user_id", user.id);

  const deleted = await serviceClient.auth.admin.deleteUser(user.id);
  if (deleted.error) {
    return json(500, { ok: false, error: "USER_DELETE_FAILED" });
  }

  return json(200, { ok: true, deleted_salons: ownedSalonIds.length });
});
