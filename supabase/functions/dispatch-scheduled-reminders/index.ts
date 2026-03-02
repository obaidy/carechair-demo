import {serve} from "https://deno.land/std@0.224.0/http/server.ts";
import {
  createServiceClient,
  loadExpoTokensForUsers,
  resolvePushRecipients,
  sendExpoPushBatch,
} from "../_shared/notificationTargets.ts";

type DispatchType = "booking_reminder_24h" | "booking_reminder_2h" | "daily_summary";

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

function formatDateTime(value: string, timezone: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function dayKeyInTz(date: Date, timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function localHourMinute(date: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "UTC",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value || "0");
    const minute = Number(parts.find((part) => part.type === "minute")?.value || "0");
    return {hour, minute};
  } catch {
    return {hour: date.getUTCHours(), minute: date.getUTCMinutes()};
  }
}

async function alreadyDispatched(service: any, dispatchKey: string) {
  const res = await service
    .from("notification_dispatch_log")
    .select("id")
    .eq("dispatch_key", dispatchKey)
    .maybeSingle();
  if (res.error) throw res.error;
  return Boolean(res.data?.id);
}

async function writeDispatchLog(service: any, payload: Record<string, unknown>) {
  const res = await service.from("notification_dispatch_log").insert([payload]);
  if (res.error) throw res.error;
}

async function invokeWhatsappReminder(params: {
  template: DispatchType;
  to: string;
  serviceName: string;
  appointmentStart: string;
  timezone: string;
}) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  if (!SUPABASE_URL) throw new Error("MISSING_SUPABASE_URL");

  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp`, {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({
      to: params.to,
      template: params.template,
      params: [
        params.serviceName,
        formatDateTime(params.appointmentStart, params.timezone, "ar-IQ-u-nu-arab"),
      ],
    }),
  });

  const text = await response.text().catch(() => "");
  if (!response.ok) throw new Error(text || `WHATSAPP_${response.status}`);
  return text;
}

async function dispatchBookingReminders(service: any, now: Date, windowMinutes: number) {
  const rulesRes = await service
    .from("salon_reminders")
    .select("salon_id,channel,type,enabled")
    .eq("enabled", true)
    .in("type", ["booking_reminder_24h", "booking_reminder_2h"]);
  if (rulesRes.error) throw rulesRes.error;

  let processed = 0;
  let delivered = 0;

  for (const rule of rulesRes.data || []) {
    const type = String(rule.type) as DispatchType;
    const offsetHours = type === "booking_reminder_24h" ? 24 : 2;
    const lower = new Date(now.getTime() + (offsetHours * 60 - windowMinutes) * 60_000).toISOString();
    const upper = new Date(now.getTime() + (offsetHours * 60 + windowMinutes) * 60_000).toISOString();

    const bookingsRes = await service
      .from("bookings")
      .select("id,salon_id,staff_id,customer_name,customer_phone,appointment_start,status,service_id,services(name),salons(timezone)")
      .eq("salon_id", String(rule.salon_id))
      .in("status", ["pending", "confirmed"])
      .gte("appointment_start", lower)
      .lt("appointment_start", upper);
    if (bookingsRes.error) throw bookingsRes.error;

    for (const booking of bookingsRes.data || []) {
      processed += 1;
      const scheduledFor = String((booking as any).appointment_start || "");
      const dispatchKey = `${type}:${String(rule.channel)}:${String((booking as any).id)}:${scheduledFor}`;
      if (await alreadyDispatched(service, dispatchKey)) continue;

      try {
        if (String(rule.channel) === "whatsapp") {
          await invokeWhatsappReminder({
            template: type,
            to: String((booking as any).customer_phone || ""),
            serviceName: String((booking as any).services?.name || "Service"),
            appointmentStart: scheduledFor,
            timezone: String((booking as any).salons?.timezone || "Asia/Baghdad"),
          });
          delivered += 1;
        } else if (String(rule.channel) === "push") {
          const recipientUserIds = await resolvePushRecipients({
            service,
            salonId: String((booking as any).salon_id || ""),
            bookingStaffId: String((booking as any).staff_id || ""),
            preferenceType: "booking_status_changed",
          });
          const tokens = await loadExpoTokensForUsers({
            service,
            salonId: String((booking as any).salon_id || ""),
            userIds: recipientUserIds,
          });
          const result = await sendExpoPushBatch({
            tokens,
            title: type === "booking_reminder_24h" ? "Tomorrow's booking" : "Upcoming booking",
            body: `${String((booking as any).customer_name || "Client")} • ${formatDateTime(scheduledFor, String((booking as any).salons?.timezone || "Asia/Baghdad"), "en-US")}`,
            data: {
              salonId: String((booking as any).salon_id || ""),
              bookingId: String((booking as any).id || ""),
              event: type,
            },
          });
          delivered += Number(result.delivered || 0) > 0 ? 1 : 0;
        }

        await writeDispatchLog(service, {
          dispatch_key: dispatchKey,
          salon_id: String((booking as any).salon_id || ""),
          booking_id: String((booking as any).id || ""),
          channel: String(rule.channel),
          type,
          scheduled_for: scheduledFor,
          status: "sent",
          delivered_at: new Date().toISOString(),
          response: {ok: true},
        });
      } catch (error) {
        await writeDispatchLog(service, {
          dispatch_key: dispatchKey,
          salon_id: String((booking as any).salon_id || ""),
          booking_id: String((booking as any).id || ""),
          channel: String(rule.channel),
          type,
          scheduled_for: scheduledFor,
          status: "failed",
          error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
          response: {},
        });
      }
    }
  }

  return {processed, delivered};
}

async function dispatchDailySummaries(service: any, now: Date, windowMinutes: number) {
  const salonsRes = await service
    .from("salons")
    .select("id,name,timezone,status")
    .eq("status", "ACTIVE");
  if (salonsRes.error) throw salonsRes.error;

  let processed = 0;
  let delivered = 0;

  for (const salon of salonsRes.data || []) {
    const timezone = String((salon as any).timezone || "Asia/Baghdad");
    const {hour, minute} = localHourMinute(now, timezone);
    if (hour !== 8 || minute >= windowMinutes) continue;

    const localDay = dayKeyInTz(now, timezone);
    const bookingsRes = await service
      .from("bookings")
      .select("id")
      .eq("salon_id", String((salon as any).id || ""))
      .in("status", ["pending", "confirmed"])
      .gte("appointment_start", `${localDay}T00:00:00`)
      .lt("appointment_start", `${localDay}T23:59:59.999`);
    if (bookingsRes.error) throw bookingsRes.error;

    const recipientUserIds = await resolvePushRecipients({
      service,
      salonId: String((salon as any).id || ""),
      preferenceType: "daily_summary",
    });

    for (const userId of recipientUserIds) {
      processed += 1;
      const dispatchKey = `daily_summary:push:${String((salon as any).id || "")}:${localDay}:${userId}`;
      if (await alreadyDispatched(service, dispatchKey)) continue;

      try {
        const tokens = await loadExpoTokensForUsers({
          service,
          salonId: String((salon as any).id || ""),
          userIds: [userId],
        });
        if (!tokens.length) continue;

        const result = await sendExpoPushBatch({
          tokens,
          title: `${String((salon as any).name || "Salon")} today`,
          body: `You have ${Number((bookingsRes.data || []).length)} bookings scheduled today.`,
          data: {
            salonId: String((salon as any).id || ""),
            event: "daily_summary",
            date: localDay,
          },
        });
        delivered += Number(result.delivered || 0) > 0 ? 1 : 0;

        await writeDispatchLog(service, {
          dispatch_key: dispatchKey,
          salon_id: String((salon as any).id || ""),
          user_id: userId,
          channel: "push",
          type: "daily_summary",
          scheduled_for: now.toISOString(),
          status: "sent",
          delivered_at: new Date().toISOString(),
          response: {count: Number((bookingsRes.data || []).length)},
        });
      } catch (error) {
        await writeDispatchLog(service, {
          dispatch_key: dispatchKey,
          salon_id: String((salon as any).id || ""),
          user_id: userId,
          channel: "push",
          type: "daily_summary",
          scheduled_for: now.toISOString(),
          status: "failed",
          error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
          response: {},
        });
      }
    }
  }

  return {processed, delivered};
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers: corsHeaders});
  if (req.method !== "POST") return json(405, {ok: false, error: "ONLY_POST_ALLOWED"});

  const body = await req.json().catch(() => ({}));
  const now = body?.nowIso ? new Date(String(body.nowIso)) : new Date();
  const windowMinutes = Math.max(5, Math.min(30, Number(body?.windowMinutes || 10)));
  if (Number.isNaN(now.getTime())) {
    return json(400, {ok: false, error: "INVALID_NOW"});
  }

  try {
    const service = createServiceClient();
    const [bookingReminders, dailySummaries] = await Promise.all([
      dispatchBookingReminders(service, now, windowMinutes),
      dispatchDailySummaries(service, now, windowMinutes),
    ]);

    return json(200, {
      ok: true,
      bookingReminders,
      dailySummaries,
    });
  } catch (error) {
    return json(500, {ok: false, error: error instanceof Error ? error.message : "UNKNOWN_ERROR"});
  }
});
