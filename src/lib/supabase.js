import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

function isConfigured() {
  return Boolean(url && key) && !String(url).includes("YOUR_") && !String(key).includes("YOUR_");
}

export const supabase = isConfigured() ? createClient(url, key) : null;

export function assertSupabase() {
  if (!supabase) {
    throw new Error("إعدادات Supabase غير مكتملة");
  }
  return supabase;
}
