import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type TemplateName =
  | "booking_created"
  | "booking_confirmed"
  | "booking_reminder_24h"
  | "booking_reminder_2h"
  | "booking_cancelled"
  | "salon_approved"
  | "salon_rejected";

type SendWhatsappRequest = {
  to: string;
  template: TemplateName;
  template_lang?: string;
  params?: string[];
  data?: Record<string, unknown>;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_TEMPLATES = new Set<TemplateName>([
  "booking_created",
  "booking_confirmed",
  "booking_reminder_24h",
  "booking_reminder_2h",
  "booking_cancelled",
  "salon_approved",
  "salon_rejected",
]);

// Deploy:
// supabase functions deploy send-whatsapp
// Secrets:
// supabase secrets set WHATSAPP_TOKEN=xxx WHATSAPP_PHONE_NUMBER_ID=xxx WHATSAPP_API_VERSION=v20.0 WHATSAPP_TEMPLATE_LANG=ar
// Logs:
// supabase functions logs send-whatsapp

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

function normalizePhone(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeParams(params: unknown) {
  if (!Array.isArray(params)) return [];
  return params.map((p) => String(p ?? ""));
}

function asText(value: unknown, fallback = "-") {
  const str = String(value ?? "").trim();
  return str || fallback;
}

function toParamsFromLegacyData(template: TemplateName, data: Record<string, unknown> = {}) {
  const appointment = asText(data.appointment_at ?? data.appointment_start, "-");
  if (template === "booking_created") {
    return [
      asText(data.customer_name),
      asText(data.service),
      appointment,
      asText(data.customer_phone),
    ];
  }
  if (template === "salon_approved") {
    return [asText(data.salon_name, "CareChair"), asText(data.dashboard_url, "-")];
  }
  if (template === "salon_rejected") {
    return [asText(data.salon_name, "CareChair"), asText(data.reason, "-")];
  }
  return [asText(data.service), appointment];
}

function normalizeTemplateLanguage(value: unknown, fallback: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  if (!/^[a-z]{2}(?:[_-][A-Za-z]{2})?$/.test(raw)) return fallback;
  return raw.replace("-", "_");
}

async function parseJsonSafe(res: Response) {
  const raw = await res.text();
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Only POST is allowed." });
  }

  const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
  const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const WHATSAPP_API_VERSION = Deno.env.get("WHATSAPP_API_VERSION") || "v20.0";
  const WHATSAPP_TEMPLATE_LANG = Deno.env.get("WHATSAPP_TEMPLATE_LANG") || "ar";

  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return jsonResponse(500, {
      ok: false,
      error: "Missing WhatsApp secrets: WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID.",
    });
  }

  let body: SendWhatsappRequest;
  try {
    body = (await req.json()) as SendWhatsappRequest;
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON body." });
  }

  const to = normalizePhone(body?.to);
  const template = body?.template;
  const templateLang = normalizeTemplateLanguage(body?.template_lang, WHATSAPP_TEMPLATE_LANG);
  const params = normalizeParams(body?.params);

  if (!to) {
    return jsonResponse(400, { ok: false, error: "Missing `to`." });
  }
  if (!/^[1-9]\d{7,14}$/.test(to)) {
    return jsonResponse(400, { ok: false, error: "Invalid `to` phone format." });
  }
  if (!template || !ALLOWED_TEMPLATES.has(template)) {
    return jsonResponse(400, { ok: false, error: "Invalid `template`." });
  }

  const finalParams = params.length > 0 ? params : toParamsFromLegacyData(template, body?.data || {});

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: template,
      language: {
        code: templateLang,
      },
      components: [
        {
          type: "body",
          parameters: finalParams.map((value) => ({
            type: "text",
            text: value,
          })),
        },
      ],
    },
  };

  try {
    const endpoint = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const waRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const waJson = await parseJsonSafe(waRes);
    if (!waRes.ok) {
      return jsonResponse(502, {
        ok: false,
        error: "WhatsApp API error.",
        provider_error: waJson,
      });
    }

    return jsonResponse(200, { ok: true, provider_response: waJson });
  } catch (err) {
    return jsonResponse(500, {
      ok: false,
      error: err instanceof Error ? err.message : "Unexpected server error.",
    });
  }
});
