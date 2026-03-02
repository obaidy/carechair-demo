import {serve} from "https://deno.land/std@0.224.0/http/server.ts";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2.49.4";

type Body = {
  salonId?: string;
  bookingId?: string;
  event?: string;
  title?: string;
  body?: string;
  audienceStaffIds?: string[];
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

function isExpoPushToken(value: string) {
  return value.startsWith("ExponentPushToken[") || value.startsWith("ExpoPushToken[");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers: corsHeaders});
  if (req.method !== "POST") return json(405, {ok: false, error: "ONLY_POST_ALLOWED"});

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, {ok: false, error: "MISSING_SUPABASE_ENV"});
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json(400, {ok: false, error: "INVALID_JSON"});
  }

  const salonId = String(body.salonId || "").trim();
  const bookingId = String(body.bookingId || "").trim();
  const title = String(body.title || "Booking update").trim();
  const message = String(body.body || "").trim();
  const event = String(body.event || "booking_updated").trim();
  if (!salonId || !bookingId || !message) {
    return json(400, {ok: false, error: "MISSING_FIELDS"});
  }

  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {persistSession: false, autoRefreshToken: false},
  });

  const [bookingRes, reminderRes, tokenRes] = await Promise.all([
    service
      .from("bookings")
      .select("id,salon_id,staff_id")
      .eq("id", bookingId)
      .eq("salon_id", salonId)
      .maybeSingle(),
    service
      .from("salon_reminders")
      .select("enabled")
      .eq("salon_id", salonId)
      .eq("channel", "push")
      .eq("type", "booking_confirmed")
      .maybeSingle(),
    service
      .from("device_tokens")
      .select("token,user_id")
      .eq("salon_id", salonId)
      .is("disabled_at", null),
  ]);

  if (bookingRes.error) return json(500, {ok: false, error: bookingRes.error.message});
  if (!bookingRes.data?.id) return json(404, {ok: false, error: "BOOKING_NOT_FOUND"});
  if (reminderRes.error) return json(500, {ok: false, error: reminderRes.error.message});
  if (!reminderRes.data?.enabled) return json(200, {ok: true, skipped: "push_disabled"});
  if (tokenRes.error) return json(500, {ok: false, error: tokenRes.error.message});

  const staffFilter = new Set((body.audienceStaffIds || []).map((value) => String(value || "")));
  const tokens = Array.from(
    new Set(
      (tokenRes.data || [])
        .filter(() => staffFilter.size === 0 || staffFilter.has(String((bookingRes.data as any)?.staff_id || "")))
        .map((row: any) => String(row?.token || "").trim())
        .filter((value) => value && isExpoPushToken(value))
    )
  );

  if (!tokens.length) return json(200, {ok: true, skipped: "no_tokens"});

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify(
      tokens.map((token) => ({
        to: token,
        title,
        body: message,
        sound: "default",
        data: {salonId, bookingId, event},
      })),
    ),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return json(500, {ok: false, error: text || `EXPO_PUSH_${response.status}`});
  }

  return json(200, {ok: true, delivered: tokens.length});
});
