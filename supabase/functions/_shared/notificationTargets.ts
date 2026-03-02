import {createClient, type SupabaseClient} from "https://esm.sh/@supabase/supabase-js@2.49.4";

export type ImmediateNotificationType =
  | "booking_created"
  | "booking_updated"
  | "booking_status_changed";

export type PreferenceType =
  | ImmediateNotificationType
  | "daily_summary";

export function normalizePhoneDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

export function isExpoPushToken(value: string) {
  return value.startsWith("ExponentPushToken[") || value.startsWith("ExpoPushToken[");
}

function defaultImmediateEnabled() {
  return true;
}

function normalizePreferenceRows(rows: Array<any> = []) {
  const map = new Map<string, boolean>();
  for (const row of rows) {
    const key = `${String(row.user_id || "")}:${String(row.type || "")}`;
    map.set(key, Boolean(row.enabled));
  }
  return map;
}

export async function resolvePushRecipients(params: {
  service: SupabaseClient;
  salonId: string;
  bookingStaffId?: string | null;
  preferenceType: PreferenceType;
}) {
  const {service, salonId, bookingStaffId, preferenceType} = params;
  const [membersRes, profilesRes, staffRes, prefRes] = await Promise.all([
    service
      .from("salon_members")
      .select("user_id,role,status")
      .eq("salon_id", salonId)
      .eq("status", "ACTIVE"),
    service
      .from("user_profiles")
      .select("user_id,phone"),
    service
      .from("staff")
      .select("id,phone,is_active")
      .eq("salon_id", salonId)
      .eq("is_active", true),
    service
      .from("notification_preferences")
      .select("user_id,type,enabled")
      .eq("salon_id", salonId)
      .eq("channel", "push")
      .in("type", [preferenceType]),
  ]);

  if (membersRes.error) throw membersRes.error;
  if (profilesRes.error) throw profilesRes.error;
  if (staffRes.error) throw staffRes.error;
  if (prefRes.error) throw prefRes.error;

  const phoneByUser = new Map<string, string>();
  for (const row of profilesRes.data || []) {
    phoneByUser.set(String(row.user_id), normalizePhoneDigits(row.phone));
  }

  const activeStaffByPhone = new Map<string, string>();
  for (const row of staffRes.data || []) {
    const phone = normalizePhoneDigits(row.phone);
    if (phone) activeStaffByPhone.set(phone, String(row.id));
  }

  const prefMap = normalizePreferenceRows(prefRes.data || []);
  const recipients = new Set<string>();

  for (const member of membersRes.data || []) {
    const userId = String(member.user_id || "");
    const role = String(member.role || "");
    if (!userId) continue;

    const prefKey = `${userId}:${preferenceType}`;
    const enabled = prefMap.has(prefKey) ? prefMap.get(prefKey) : defaultImmediateEnabled();
    if (!enabled) continue;

    if (role === "OWNER" || role === "MANAGER") {
      recipients.add(userId);
      continue;
    }

    if (role === "STAFF" && bookingStaffId) {
      const staffId = activeStaffByPhone.get(phoneByUser.get(userId) || "");
      if (staffId && staffId === bookingStaffId) {
        recipients.add(userId);
      }
    }
  }

  return Array.from(recipients);
}

export async function loadExpoTokensForUsers(params: {
  service: SupabaseClient;
  salonId: string;
  userIds: string[];
}) {
  if (!params.userIds.length) return [];
  const tokenRes = await params.service
    .from("device_tokens")
    .select("token,user_id")
    .eq("salon_id", params.salonId)
    .in("user_id", params.userIds)
    .is("disabled_at", null);
  if (tokenRes.error) throw tokenRes.error;

  return Array.from(
    new Set(
      (tokenRes.data || [])
        .map((row: any) => String(row?.token || "").trim())
        .filter((value) => value && isExpoPushToken(value))
    ),
  );
}

export async function sendExpoPushBatch(params: {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) {
  if (!params.tokens.length) return {ok: true, delivered: 0};
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify(
      params.tokens.map((token) => ({
        to: token,
        title: params.title,
        body: params.body,
        sound: "default",
        data: params.data || {},
      })),
    ),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `EXPO_PUSH_${response.status}`);
  }

  return {ok: true, delivered: params.tokens.length};
}

export function createServiceClient() {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("MISSING_SUPABASE_ENV");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {persistSession: false, autoRefreshToken: false},
  });
}
