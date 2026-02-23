import { createClient } from "@supabase/supabase-js";

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function buildGoogleUrl(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

function buildAppleUrl(lat, lng, address) {
  const q = encodeURIComponent(String(address || `${lat},${lng}`));
  return `https://maps.apple.com/?q=${q}&ll=${lat},${lng}`;
}

async function main() {
  const url = required("VITE_SUPABASE_URL");
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const salonSlug = String(process.env.SANITY_SALON_SLUG || "").trim();
  const salonIdEnv = String(process.env.SANITY_SALON_ID || "").trim();

  if (!salonSlug && !salonIdEnv) {
    throw new Error("Set SANITY_SALON_SLUG or SANITY_SALON_ID to target a salon.");
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let salonQuery = supabase.from("salons").select("id,slug,name,country_code").limit(1);
  if (salonIdEnv) salonQuery = salonQuery.eq("id", salonIdEnv);
  if (salonSlug) salonQuery = salonQuery.eq("slug", salonSlug);

  const salonRes = await salonQuery.maybeSingle();
  if (salonRes.error) throw salonRes.error;
  if (!salonRes.data) throw new Error("Salon not found for sanity check.");

  const salon = salonRes.data;
  const testLat = Number(process.env.SANITY_LAT || 33.3152);
  const testLng = Number(process.env.SANITY_LNG || 44.3661);

  const upsertRes = await supabase.rpc("upsert_primary_salon_location", {
    p_salon_id: salon.id,
    p_label: "Main Branch",
    p_country_code: String(salon.country_code || "IQ").toUpperCase(),
    p_city: "Sanity City",
    p_address_line: "Sanity Street 1",
    p_formatted_address: "Sanity Street 1, Sanity City",
    p_lat: testLat,
    p_lng: testLng,
    p_provider: "manual",
    p_provider_place_id: null,
  });

  if (upsertRes.error) throw upsertRes.error;

  const row = upsertRes.data;
  if (!row || !row.id) {
    throw new Error("Location upsert returned empty payload.");
  }

  const invalidRes = await supabase.rpc("upsert_primary_salon_location", {
    p_salon_id: salon.id,
    p_label: "Main Branch",
    p_country_code: String(salon.country_code || "IQ").toUpperCase(),
    p_city: "Sanity City",
    p_address_line: "Sanity Street 1",
    p_formatted_address: "Sanity Street 1, Sanity City",
    p_lat: 999,
    p_lng: testLng,
    p_provider: "manual",
    p_provider_place_id: null,
  });

  if (!invalidRes.error) {
    throw new Error("Expected lat constraint validation error, but request succeeded.");
  }

  const address = row.formatted_address || row.address_line || `${row.lat},${row.lng}`;
  console.log("[OK] Admin save simulation (RPC upsert) succeeded.");
  console.log(`Salon: ${salon.slug} (${salon.id})`);
  console.log(`Address: ${address}`);
  console.log(`Google Maps: ${buildGoogleUrl(row.lat, row.lng)}`);
  console.log(`Apple Maps: ${buildAppleUrl(row.lat, row.lng, address)}`);
  console.log("[OK] Lat/Lng constraint enforcement verified (invalid latitude rejected).");
}

main().catch((error) => {
  console.error("[FAIL] location sanity check:", error?.message || error);
  process.exit(1);
});
