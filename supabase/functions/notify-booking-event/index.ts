import {serve} from "https://deno.land/std@0.224.0/http/server.ts";
import {
  createServiceClient,
  loadExpoTokensForUsers,
  resolvePushRecipients,
  sendExpoPushBatch,
  type ImmediateNotificationType,
} from "../_shared/notificationTargets.ts";

type Body = {
  salonId?: string;
  bookingId?: string;
  event?: ImmediateNotificationType;
  title?: string;
  body?: string;
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

function toPreferenceType(event: string): ImmediateNotificationType {
  if (event === "booking_created") return "booking_created";
  if (event === "booking_updated") return "booking_updated";
  return "booking_status_changed";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers: corsHeaders});
  if (req.method !== "POST") return json(405, {ok: false, error: "ONLY_POST_ALLOWED"});

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
  const event = toPreferenceType(String(body.event || "booking_status_changed").trim());
  if (!salonId || !bookingId || !message) {
    return json(400, {ok: false, error: "MISSING_FIELDS"});
  }

  try {
    const service = createServiceClient();
    const bookingRes = await service
      .from("bookings")
      .select("id,salon_id,staff_id")
      .eq("id", bookingId)
      .eq("salon_id", salonId)
      .maybeSingle();

    if (bookingRes.error) return json(500, {ok: false, error: bookingRes.error.message});
    if (!bookingRes.data?.id) return json(404, {ok: false, error: "BOOKING_NOT_FOUND"});

    const recipientUserIds = await resolvePushRecipients({
      service,
      salonId,
      bookingStaffId: String((bookingRes.data as any)?.staff_id || ""),
      preferenceType: event,
    });

    if (!recipientUserIds.length) {
      return json(200, {ok: true, skipped: "no_recipients"});
    }

    const tokens = await loadExpoTokensForUsers({
      service,
      salonId,
      userIds: recipientUserIds,
    });

    if (!tokens.length) return json(200, {ok: true, skipped: "no_tokens"});

    const result = await sendExpoPushBatch({
      tokens,
      title,
      body: message,
      data: {salonId, bookingId, event},
    });

    return json(200, {ok: true, delivered: result.delivered, recipients: recipientUserIds.length});
  } catch (error) {
    return json(500, {ok: false, error: error instanceof Error ? error.message : "UNKNOWN_ERROR"});
  }
});
