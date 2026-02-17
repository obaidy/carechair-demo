import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type TemplateName = "booking_created" | "booking_confirmed" | "booking_cancelled";

type BookingData = {
  id?: string | number;
  salon_slug?: string;
  customer_name?: string;
  customer_phone?: string;
  salon_whatsapp?: string;
  service?: string;
  staff?: string;
  appointment_at?: string;
  status?: string;
  notes?: string | null;
};

type SendWhatsappRequest = {
  to: string;
  template: TemplateName;
  data: BookingData;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
const WHATSAPP_API_VERSION = Deno.env.get("WHATSAPP_API_VERSION") ?? "v20.0";
const WHATSAPP_TEMPLATE_LANG = Deno.env.get("WHATSAPP_TEMPLATE_LANG") ?? "ar";

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

function asString(value: unknown, fallback = "-") {
  if (value === null || value === undefined) return fallback;
  const s = String(value).trim();
  return s || fallback;
}

function normalizePhone(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function formatAppointment(value: unknown) {
  try {
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return asString(value);
    return d.toLocaleString("ar-IQ", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return asString(value);
  }
}

function buildTemplateParameters(template: TemplateName, data: BookingData): string[] {
  const appointment = formatAppointment(data.appointment_at);

  if (template === "booking_created") {
    return [
      asString(data.id),
      asString(data.customer_name),
      asString(data.customer_phone),
      asString(data.service),
      asString(data.staff),
      appointment,
      asString(data.salon_slug),
    ];
  }

  return [
    asString(data.customer_name),
    asString(data.service),
    appointment,
    asString(data.staff),
    asString(data.id),
  ];
}

function buildFallbackText(template: TemplateName, data: BookingData): string {
  const appointment = formatAppointment(data.appointment_at);

  if (template === "booking_created") {
    return [
      "طلب حجز جديد",
      `رقم الحجز: ${asString(data.id)}`,
      `اسم العميلة: ${asString(data.customer_name)}`,
      `هاتف العميلة: ${asString(data.customer_phone)}`,
      `الخدمة: ${asString(data.service)}`,
      `الموظفة: ${asString(data.staff)}`,
      `الموعد: ${appointment}`,
      `الصالون: ${asString(data.salon_slug)}`,
    ].join("\n");
  }

  if (template === "booking_confirmed") {
    return [
      `مرحباً ${asString(data.customer_name)}، تم تأكيد حجزك بنجاح.`,
      `الخدمة: ${asString(data.service)}`,
      `الموظفة: ${asString(data.staff)}`,
      `الموعد: ${appointment}`,
      `رقم الحجز: ${asString(data.id)}`,
    ].join("\n");
  }

  return [
    `مرحباً ${asString(data.customer_name)}، نعتذر تم إلغاء الحجز.`,
    `الخدمة: ${asString(data.service)}`,
    `الموظفة: ${asString(data.staff)}`,
    `الموعد: ${appointment}`,
    `رقم الحجز: ${asString(data.id)}`,
  ].join("\n");
}

async function parseJsonSafe(response: Response) {
  const raw = await response.text();
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

async function sendViaWhatsappApi(payload: Record<string, unknown>) {
  const endpoint = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  return fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { success: false, error: "Only POST is allowed." });
  }

  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return jsonResponse(500, {
      success: false,
      error: "Missing WhatsApp secrets. Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID.",
    });
  }

  let body: SendWhatsappRequest;
  try {
    body = (await req.json()) as SendWhatsappRequest;
  } catch {
    return jsonResponse(400, { success: false, error: "Invalid JSON body." });
  }

  if (!body || !body.template || !body.to || !body.data) {
    return jsonResponse(400, {
      success: false,
      error: "Payload must contain to, template, data.",
    });
  }

  const allowedTemplates: TemplateName[] = [
    "booking_created",
    "booking_confirmed",
    "booking_cancelled",
  ];

  if (!allowedTemplates.includes(body.template)) {
    return jsonResponse(400, { success: false, error: "Unsupported template value." });
  }

  const to = normalizePhone(body.to);
  if (!/^[1-9]\d{7,14}$/.test(to)) {
    return jsonResponse(400, { success: false, error: "Invalid destination phone number." });
  }

  const templateParameters = buildTemplateParameters(body.template, body.data);
  const templatePayload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: body.template,
      language: { code: WHATSAPP_TEMPLATE_LANG },
      components: [
        {
          type: "body",
          parameters: templateParameters.map((value) => ({ type: "text", text: value })),
        },
      ],
    },
  };

  const templateResponse = await sendViaWhatsappApi(templatePayload);
  const templateResponseJson = await parseJsonSafe(templateResponse);

  if (templateResponse.ok) {
    return jsonResponse(200, {
      success: true,
      sent_with: "template",
      template: body.template,
      to,
      provider_response: templateResponseJson,
    });
  }

  const fallbackText = buildFallbackText(body.template, body.data);
  const textPayload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: {
      preview_url: false,
      body: fallbackText,
    },
  };

  const textResponse = await sendViaWhatsappApi(textPayload);
  const textResponseJson = await parseJsonSafe(textResponse);

  if (textResponse.ok) {
    return jsonResponse(200, {
      success: true,
      sent_with: "text_fallback",
      template: body.template,
      to,
      template_error: templateResponseJson,
      provider_response: textResponseJson,
    });
  }

  return jsonResponse(502, {
    success: false,
    error: "Failed to send WhatsApp template and text fallback.",
    template_error: templateResponseJson,
    text_error: textResponseJson,
    template: body.template,
    to,
  });
});
