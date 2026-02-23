import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PageShell from "../../components/PageShell";
import Toast from "../../components/Toast";
import { Badge, Button, Card, SelectInput, TextInput } from "../../components/ui";
import { DAYS } from "../../lib/utils";
import { supabase } from "../../lib/supabase";
import { compressImage } from "../../lib/imageCompression";
import { normalizeSalonSlug } from "../../lib/slug";
import { useToast } from "../../lib/useToast";
import {
  buildMapboxStaticPreviewUrl,
  hasMapboxToken,
  normalizeLatitude,
  normalizeLongitude,
  pickLatLngFromStaticMapClick,
  searchMapboxPlaces,
} from "../../lib/salonLocations";

const MEDIA_BUCKET = "carechair-media";
const DRAFT_KEY = "carechair_onboarding_draft_v1";
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAP_PICKER_ZOOM = 14;

function uid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
}

function defaultHours() {
  return DAYS.map((day) => ({
    day_of_week: day.index,
    is_closed: day.index === 5,
    open_time: "10:00",
    close_time: "20:00",
  }));
}

function createEmployee(baseHours) {
  return {
    id: uid(),
    name: "",
    role: "",
    phone: "",
    same_hours_as_salon: true,
    working_hours: (baseHours || defaultHours()).map((row) => ({ ...row })),
    avatar_url: "",
  };
}

function createService() {
  return {
    id: uid(),
    name: "",
    duration_minutes: "45",
    price: "",
    category: "",
    employee_ids: [],
  };
}

function defaultLocation(countryCode = "IQ", city = "") {
  return {
    label: "Main Branch",
    country_code: String(countryCode || "IQ").toUpperCase(),
    city: String(city || ""),
    address_line: "",
    formatted_address: "",
    lat: "",
    lng: "",
    provider: "manual",
    provider_place_id: "",
    pin_confirmed: false,
  };
}

function localizeCountryName(country, lang) {
  const l = String(lang || "en").toLowerCase();
  if (l.startsWith("ar")) return country?.name_ar || country?.name_en || country?.code;
  if (l.startsWith("cs")) return country?.name_cs || country?.name_en || country?.code;
  if (l.startsWith("ru")) return country?.name_ru || country?.name_en || country?.code;
  return country?.name_en || country?.code;
}

function isMissingColumnError(error, column) {
  const message = String(error?.message || "").toLowerCase();
  return error?.code === "42703" || (message.includes("column") && message.includes(String(column).toLowerCase()));
}

function normalizeDraft(raw) {
  const baseHours = defaultHours();
  if (!raw || typeof raw !== "object") {
    return {
      salon_id: uid(),
      step: 1,
      basic: {
        name: "",
        country_code: "IQ",
        city: "",
        whatsapp: "",
        admin_passcode: "",
      },
      location: defaultLocation("IQ", ""),
      working_hours: baseHours,
      employees: [createEmployee(baseHours)],
      services: [createService()],
    };
  }

  const working = Array.isArray(raw.working_hours) && raw.working_hours.length
    ? raw.working_hours.map((x) => ({
        day_of_week: Number(x.day_of_week),
        is_closed: Boolean(x.is_closed),
        open_time: String(x.open_time || "10:00").slice(0, 5),
        close_time: String(x.close_time || "20:00").slice(0, 5),
      }))
    : baseHours;

  const employees = Array.isArray(raw.employees) && raw.employees.length
    ? raw.employees.map((emp) => ({
        id: String(emp.id || uid()),
        name: String(emp.name || ""),
        role: String(emp.role || ""),
        phone: String(emp.phone || ""),
        same_hours_as_salon: emp.same_hours_as_salon !== false,
        working_hours: Array.isArray(emp.working_hours) && emp.working_hours.length
          ? emp.working_hours.map((x) => ({
              day_of_week: Number(x.day_of_week),
              is_closed: Boolean(x.is_closed),
              open_time: String(x.open_time || "10:00").slice(0, 5),
              close_time: String(x.close_time || "20:00").slice(0, 5),
            }))
          : working.map((x) => ({ ...x })),
        avatar_url: String(emp.avatar_url || ""),
      }))
    : [createEmployee(working)];

  const services = Array.isArray(raw.services) && raw.services.length
    ? raw.services.map((srv) => ({
        id: String(srv.id || uid()),
        name: String(srv.name || ""),
        duration_minutes: String(srv.duration_minutes || "45"),
        price: String(srv.price || ""),
        category: String(srv.category || ""),
        employee_ids: Array.isArray(srv.employee_ids) ? srv.employee_ids.map((x) => String(x)) : [],
      }))
    : [createService()];

  const fallbackCountry = String(raw?.basic?.country_code || "IQ").toUpperCase();
  const fallbackCity = String(raw?.basic?.city || "");
  const location = {
    ...defaultLocation(fallbackCountry, fallbackCity),
    ...(raw?.location && typeof raw.location === "object" ? raw.location : {}),
  };
  location.country_code = String(location.country_code || fallbackCountry || "IQ").toUpperCase();
  location.city = String(location.city || fallbackCity || "");
  location.address_line = String(location.address_line || "");
  location.formatted_address = String(location.formatted_address || "");
  location.lat = String(location.lat || "");
  location.lng = String(location.lng || "");
  location.provider = String(location.provider || "manual");
  location.provider_place_id = String(location.provider_place_id || "");
  location.pin_confirmed = Boolean(location.pin_confirmed);

  return {
    salon_id: String(raw.salon_id || uid()),
    step: Math.max(1, Math.min(6, Number(raw.step || 1))),
    basic: {
      name: String(raw?.basic?.name || ""),
      country_code: String(raw?.basic?.country_code || "IQ"),
      city: String(raw?.basic?.city || ""),
      whatsapp: String(raw?.basic?.whatsapp || ""),
      admin_passcode: String(raw?.basic?.admin_passcode || ""),
    },
    location,
    working_hours: working,
    employees,
    services,
  };
}

export default function SalonSetupPage() {
  const { t, i18n } = useTranslation();
  const { toast, showToast } = useToast();
  const [searchParams] = useSearchParams();
  const inviteToken = useMemo(() => String(searchParams.get("invite") || "").trim(), [searchParams]);

  const [countries, setCountries] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [validatingInvite, setValidatingInvite] = useState(false);
  const [inviteValid, setInviteValid] = useState(false);
  const [inviteCountryCode, setInviteCountryCode] = useState("");
  const [inviteError, setInviteError] = useState("");

  const [logoFile, setLogoFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [avatarFiles, setAvatarFiles] = useState({});

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState("");
  const [successData, setSuccessData] = useState(null);
  const [locationSearch, setLocationSearch] = useState("");
  const [locationSearchResults, setLocationSearchResults] = useState([]);
  const [locationSearchLoading, setLocationSearchLoading] = useState(false);
  const locationMapRef = useRef(null);

  const [draft, setDraft] = useState(() => {
    try {
      const raw = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "null");
      return normalizeDraft(raw);
    } catch {
      return normalizeDraft(null);
    }
  });

  const step = draft.step;
  const basic = draft.basic;
  const location = draft.location;
  const workingHours = draft.working_hours;
  const employees = draft.employees;
  const services = draft.services;
  const mapboxAvailable = hasMapboxToken();
  const isInviteFlow = inviteValid && !!inviteCountryCode;
  const hasInviteParam = !!inviteToken;
  const shouldHideCountryField = hasInviteParam && (validatingInvite || isInviteFlow);
  const normalizedLocationLat = normalizeLatitude(location?.lat);
  const normalizedLocationLng = normalizeLongitude(location?.lng);
  const hasLocationPin = normalizedLocationLat != null && normalizedLocationLng != null;
  const locationAddressPreview = String(location?.formatted_address || location?.address_line || "").trim();

  const localizedDays = useMemo(() => {
    const locale = String(i18n.language || "en");
    return DAYS.map((day) => {
      const ref = new Date("2024-01-07T00:00:00Z");
      ref.setUTCDate(ref.getUTCDate() + day.index);
      let label = day.label;
      try {
        const safeLocale = locale.startsWith("ar") ? "ar-IQ" : locale;
        label = new Intl.DateTimeFormat(safeLocale, { weekday: "long" }).format(ref);
      } catch {
        // keep fallback
      }
      return { ...day, label };
    });
  }, [i18n.language]);

  useEffect(() => {
    if (!supabase) {
      setLoadingCountries(false);
      showToast("error", t("onboarding.errors.supabaseMissing", "Supabase is not configured."));
      return;
    }

    let active = true;
    async function loadCountries() {
      setLoadingCountries(true);
      let result = await supabase
        .from("countries")
        .select("code,name_en,name_ar,name_cs,name_ru,is_enabled,is_public")
        .eq("is_enabled", true)
        .eq("is_public", true)
        .order("code", { ascending: true });

      if (!active) return;

      if (result.error) {
        showToast(
          "error",
          isMissingColumnError(result.error, "is_public")
            ? t("onboarding.errors.publicCountriesMigrationMissing", "Public countries migration is missing. Please run latest DB migrations.")
            : t("onboarding.errors.loadCountries", "Failed to load countries: {{message}}", { message: result.error.message })
        );
        setCountries([]);
      } else {
        setCountries(result.data || []);
      }
      setLoadingCountries(false);
    }

    loadCountries();
    return () => {
      active = false;
    };
  }, [showToast, t]);

  useEffect(() => {
    if (!supabase) return;
    if (!inviteToken) {
      setInviteValid(false);
      setInviteCountryCode("");
      setInviteError("");
      return;
    }

    let active = true;
    async function validateInvite() {
      setValidatingInvite(true);
      setInviteError("");
      const { data, error } = await supabase.rpc("validate_salon_invite", { p_token: inviteToken });
      if (!active) return;

      if (error || !data?.ok || !data?.country_code) {
        setInviteValid(false);
        setInviteCountryCode("");
        setInviteError(t("onboarding.errors.inviteInvalid", "This invite is invalid or expired."));
        if (error) {
          showToast(
            "error",
            t("onboarding.errors.inviteValidationFailed", "Failed to validate invite: {{message}}", {
              message: error.message,
            })
          );
        } else {
          showToast("error", t("onboarding.errors.inviteInvalid", "This invite is invalid or expired."));
        }
      } else {
        const countryCode = String(data.country_code || "").toUpperCase();
        setInviteValid(true);
        setInviteCountryCode(countryCode);
        setDraft((prev) => ({
          ...prev,
          basic: {
            ...prev.basic,
            country_code: countryCode,
          },
          location: {
            ...prev.location,
            country_code: countryCode,
          },
        }));
      }
      setValidatingInvite(false);
    }

    void validateInvite();
    return () => {
      active = false;
    };
  }, [inviteToken, showToast, t]);

  useEffect(() => {
    if (!countries.length) return;

    const fallbackCountry = isInviteFlow && inviteCountryCode ? inviteCountryCode : countries[0].code;
    const hasBasicCountry = countries.some((country) => country.code === basic.country_code);
    const hasLocationCountry = countries.some((country) => country.code === location.country_code);

    if (!hasBasicCountry || (isInviteFlow && basic.country_code !== fallbackCountry)) {
      patchBasic("country_code", fallbackCountry);
    }

    if (!hasLocationCountry || (isInviteFlow && location.country_code !== fallbackCountry)) {
      patchLocation("country_code", fallbackCountry);
    }
  }, [countries, isInviteFlow, inviteCountryCode, basic.country_code, location.country_code]);

  useEffect(() => {
    if (!String(location.city || "").trim() && String(basic.city || "").trim()) {
      patchLocation("city", basic.city);
    }
  }, [basic.city, location.city]);

  useEffect(() => {
    if (!mapboxAvailable) {
      setLocationSearchLoading(false);
      setLocationSearchResults([]);
      return;
    }

    const query = String(locationSearch || "").trim();
    if (query.length < 2) {
      setLocationSearchLoading(false);
      setLocationSearchResults([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLocationSearchLoading(true);
      const res = await searchMapboxPlaces(query, {
        countryCode: location.country_code || basic.country_code,
        language: i18n.language,
      });

      if (cancelled) return;

      setLocationSearchLoading(false);
      setLocationSearchResults(res.data || []);
      if (res.error) {
        showToast("error", t("onboarding.errors.locationSearchFailed", "Failed to search location. You can still enter coordinates manually."));
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [locationSearch, mapboxAvailable, location.country_code, basic.country_code, i18n.language, showToast, t]);

  useEffect(() => {
    const safeDraft = {
      ...draft,
      employees: draft.employees.map((emp) => ({ ...emp, avatar_url: "" })),
    };
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(safeDraft));
  }, [draft]);

  const stepItems = useMemo(
    () => [
      { id: 1, label: t("onboarding.steps.basic", "Basic information") },
      { id: 2, label: t("onboarding.steps.location", "Location") },
      { id: 3, label: t("onboarding.steps.hours", "Working hours") },
      { id: 4, label: t("onboarding.steps.employees", "Employees") },
      { id: 5, label: t("onboarding.steps.services", "Services") },
      { id: 6, label: t("onboarding.steps.submit", "Submit") },
    ],
    [t]
  );

  function patchDraft(patch) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function patchBasic(field, value) {
    setDraft((prev) => ({ ...prev, basic: { ...prev.basic, [field]: value } }));
  }

  function patchLocation(field, value) {
    setDraft((prev) => {
      const nextLocation = {
        ...prev.location,
        [field]: value,
      };

      if (field === "lat" || field === "lng") {
        nextLocation.provider = "manual";
        nextLocation.provider_place_id = "";
        if (mapboxAvailable) nextLocation.pin_confirmed = false;
      }

      return { ...prev, location: nextLocation };
    });
  }

  function applyMapLocation(place) {
    const lat = normalizeLatitude(place?.lat);
    const lng = normalizeLongitude(place?.lng);
    if (lat == null || lng == null) return;

    setDraft((prev) => ({
      ...prev,
      location: {
        ...prev.location,
        country_code: String(place?.country_code || prev.location.country_code || basic.country_code || "IQ").toUpperCase(),
        city: String(place?.city || prev.location.city || ""),
        address_line: String(place?.address_line || prev.location.address_line || ""),
        formatted_address: String(place?.formatted_address || prev.location.formatted_address || ""),
        lat: String(lat),
        lng: String(lng),
        provider: String(place?.provider || "mapbox"),
        provider_place_id: String(place?.provider_place_id || place?.place_id || ""),
        pin_confirmed: true,
      },
    }));
  }

  function confirmCurrentPin() {
    const lat = normalizeLatitude(location.lat);
    const lng = normalizeLongitude(location.lng);
    if (lat == null || lng == null) {
      showToast("error", t("onboarding.errors.locationCoordinatesRequired", "Location pin is required. Select or confirm coordinates."));
      return;
    }

    setDraft((prev) => ({
      ...prev,
      location: {
        ...prev.location,
        lat: String(lat),
        lng: String(lng),
        pin_confirmed: true,
      },
    }));
  }

  function onLocationMapClick(event) {
    if (!mapboxAvailable || !hasLocationPin || !locationMapRef.current) return;
    const rect = locationMapRef.current.getBoundingClientRect();
    const point = pickLatLngFromStaticMapClick({
      clickX: event.clientX - rect.left,
      clickY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      centerLat: normalizedLocationLat,
      centerLng: normalizedLocationLng,
      zoom: MAP_PICKER_ZOOM,
    });
    if (!point || point.lat == null || point.lng == null) return;

    setDraft((prev) => ({
      ...prev,
      location: {
        ...prev.location,
        lat: String(point.lat),
        lng: String(point.lng),
        provider: mapboxAvailable ? "mapbox" : "manual",
        pin_confirmed: true,
      },
    }));
  }

  function patchWorkingHour(dayIndex, patch) {
    setDraft((prev) => ({
      ...prev,
      working_hours: prev.working_hours.map((row) =>
        row.day_of_week === dayIndex ? { ...row, ...patch } : row
      ),
      employees: prev.employees.map((emp) =>
        emp.same_hours_as_salon
          ? {
              ...emp,
              working_hours: prev.working_hours.map((row) =>
                row.day_of_week === dayIndex ? { ...row, ...patch } : { ...row }
              ),
            }
          : emp
      ),
    }));
  }

  function patchEmployee(empId, patch) {
    setDraft((prev) => ({
      ...prev,
      employees: prev.employees.map((emp) => {
        if (emp.id !== empId) return emp;
        const next = { ...emp, ...patch };
        if (patch.same_hours_as_salon === true) {
          next.working_hours = prev.working_hours.map((row) => ({ ...row }));
        }
        return next;
      }),
    }));
  }

  function patchEmployeeHour(empId, dayIndex, patch) {
    setDraft((prev) => ({
      ...prev,
      employees: prev.employees.map((emp) => {
        if (emp.id !== empId) return emp;
        return {
          ...emp,
          working_hours: emp.working_hours.map((row) =>
            row.day_of_week === dayIndex ? { ...row, ...patch } : row
          ),
        };
      }),
    }));
  }

  function addEmployee() {
    setDraft((prev) => ({
      ...prev,
      employees: [...prev.employees, createEmployee(prev.working_hours)],
    }));
  }

  function removeEmployee(empId) {
    setDraft((prev) => ({
      ...prev,
      employees: prev.employees.length <= 1 ? prev.employees : prev.employees.filter((emp) => emp.id !== empId),
      services: prev.services.map((srv) => ({
        ...srv,
        employee_ids: srv.employee_ids.filter((id) => id !== empId),
      })),
    }));
    setAvatarFiles((prev) => {
      const next = { ...prev };
      delete next[empId];
      return next;
    });
  }

  function patchService(serviceId, patch) {
    setDraft((prev) => ({
      ...prev,
      services: prev.services.map((srv) => (srv.id === serviceId ? { ...srv, ...patch } : srv)),
    }));
  }

  function toggleServiceEmployee(serviceId, employeeId) {
    setDraft((prev) => ({
      ...prev,
      services: prev.services.map((srv) => {
        if (srv.id !== serviceId) return srv;
        const set = new Set(srv.employee_ids || []);
        if (set.has(employeeId)) set.delete(employeeId);
        else set.add(employeeId);
        return { ...srv, employee_ids: Array.from(set) };
      }),
    }));
  }

  function addService() {
    setDraft((prev) => ({ ...prev, services: [...prev.services, createService()] }));
  }

  function removeService(serviceId) {
    setDraft((prev) => ({
      ...prev,
      services: prev.services.length <= 1 ? prev.services : prev.services.filter((srv) => srv.id !== serviceId),
    }));
  }

  function validateStep(targetStep = step) {
    if (targetStep >= 1) {
      if (!String(basic.name || "").trim()) {
        showToast("error", t("onboarding.errors.nameRequired", "Salon name is required."));
        return false;
      }
      if (!String(basic.country_code || "").trim()) {
        showToast("error", t("onboarding.errors.countryRequired", "Please select country."));
        return false;
      }
    }

    if (targetStep >= 2) {
      const locationCountry = String(location.country_code || basic.country_code || "").trim();
      if (!locationCountry) {
        showToast("error", t("onboarding.errors.locationCountryRequired", "Location country is required."));
        return false;
      }

      const hasAddress = Boolean(
        String(location.formatted_address || "").trim() ||
        String(location.address_line || "").trim()
      );
      if (!hasAddress) {
        showToast("error", t("onboarding.errors.locationAddressRequired", "Address details are required."));
        return false;
      }

      const lat = normalizeLatitude(location.lat);
      const lng = normalizeLongitude(location.lng);
      if (lat == null || lng == null) {
        showToast("error", t("onboarding.errors.locationCoordinatesRequired", "Location pin is required. Select or confirm coordinates."));
        return false;
      }

      if (mapboxAvailable && !location.pin_confirmed) {
        showToast("error", t("onboarding.errors.locationPinConfirmRequired", "Please confirm the pin on map to continue."));
        return false;
      }
    }

    if (targetStep >= 3) {
      for (const row of workingHours) {
        if (!row.is_closed && (!row.open_time || !row.close_time || row.close_time <= row.open_time)) {
          showToast(
            "error",
            t("onboarding.errors.invalidSalonHours", "Please fix salon working hours for {{day}}.", {
              day: localizedDays.find((d) => d.index === row.day_of_week)?.label || row.day_of_week,
            })
          );
          return false;
        }
      }
    }

    if (targetStep >= 4) {
      if (!employees.length) {
        showToast("error", t("onboarding.errors.employeeRequired", "Add at least one employee."));
        return false;
      }
      for (const emp of employees) {
        if (!String(emp.name || "").trim()) {
          showToast("error", t("onboarding.errors.employeeNameRequired", "Employee name is required."));
          return false;
        }
        if (!emp.same_hours_as_salon) {
          for (const row of emp.working_hours || []) {
            if (!row.is_closed && (!row.open_time || !row.close_time || row.close_time <= row.open_time)) {
              showToast(
                "error",
                t("onboarding.errors.invalidEmployeeHours", "Please fix custom hours for {{name}}.", {
                  name: emp.name,
                })
              );
              return false;
            }
          }
        }
      }
    }

    if (targetStep >= 5) {
      if (!services.length) {
        showToast("error", t("onboarding.errors.serviceRequired", "Add at least one service."));
        return false;
      }
      for (const srv of services) {
        if (!String(srv.name || "").trim()) {
          showToast("error", t("onboarding.errors.serviceNameRequired", "Service name is required."));
          return false;
        }
        const duration = Number(srv.duration_minutes || 0);
        if (!Number.isFinite(duration) || duration < 5) {
          showToast("error", t("onboarding.errors.serviceDurationRequired", "Service duration must be at least 5 minutes."));
          return false;
        }
        const price = Number(srv.price || 0);
        if (!Number.isFinite(price) || price < 0) {
          showToast("error", t("onboarding.errors.servicePriceRequired", "Service price is invalid."));
          return false;
        }
        if (!Array.isArray(srv.employee_ids) || srv.employee_ids.length === 0) {
          showToast("error", t("onboarding.errors.serviceAssignmentsRequired", "Assign at least one employee to every service."));
          return false;
        }
      }
    }

    return true;
  }

  function nextStep() {
    if (!validateStep(step)) return;
    patchDraft({ step: Math.min(6, step + 1) });
  }

  function prevStep() {
    patchDraft({ step: Math.max(1, step - 1) });
  }

  function validateImageFile(file) {
    if (!file) return true;
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      showToast("error", t("onboarding.errors.invalidImageType", "Image must be JPG, PNG or WEBP."));
      return false;
    }
    return true;
  }

  async function uploadImage(path, file) {
    if (!file) return { url: "", path: "" };
    if (!validateImageFile(file)) {
      throw new Error(t("onboarding.errors.invalidImageType", "Image must be JPG, PNG or WEBP."));
    }

    const compressed = await compressImage(file);
    const ext = compressed.ext || "jpg";
    const fullPath = path.endsWith(`.${ext}`) ? path : `${path}.${ext}`;

    const bucket = supabase.storage.from(MEDIA_BUCKET);
    const up = await bucket.upload(fullPath, compressed.blob, {
      upsert: true,
      contentType: compressed.contentType || "image/jpeg",
    });
    if (up.error) throw up.error;

    const pub = bucket.getPublicUrl(fullPath);
    return {
      path: fullPath,
      url: pub?.data?.publicUrl || "",
    };
  }

  async function handleSubmit() {
    if (!supabase) {
      showToast("error", t("onboarding.errors.supabaseMissing", "Supabase is not configured."));
      return;
    }

    if (!validateStep(5)) return;

    setSaving(true);
    setUploading(false);
    setUploadStage("");

    const uploadedPaths = [];

    try {
      const salonId = draft.salon_id || uid();

      setUploading(true);
      setUploadStage(t("onboarding.upload.logo", "Uploading logo..."));
      const logoRes = logoFile ? await uploadImage(`salons/${salonId}/logo`, logoFile) : { url: "", path: "" };
      if (logoRes.path) uploadedPaths.push(logoRes.path);

      setUploadStage(t("onboarding.upload.cover", "Uploading cover image..."));
      const coverRes = coverFile ? await uploadImage(`salons/${salonId}/cover`, coverFile) : { url: "", path: "" };
      if (coverRes.path) uploadedPaths.push(coverRes.path);

      const employeeAvatarUrls = {};
      for (const emp of employees) {
        const file = avatarFiles[emp.id];
        if (!file) continue;
        setUploadStage(t("onboarding.upload.avatarFor", "Uploading avatar for {{name}}...", { name: emp.name || "-" }));
        const avatarRes = await uploadImage(`staff/${emp.id}/avatar`, file);
        if (avatarRes.path) uploadedPaths.push(avatarRes.path);
        employeeAvatarUrls[emp.id] = avatarRes.url;
      }

      setUploadStage(t("onboarding.upload.finalizing", "Finalizing setup..."));

      const locationLat = normalizeLatitude(location.lat);
      const locationLng = normalizeLongitude(location.lng);
      if (locationLat == null || locationLng == null) {
        throw new Error(t("onboarding.errors.locationCoordinatesRequired", "Location pin is required. Select or confirm coordinates."));
      }

      const payload = {
        invite_token: isInviteFlow ? inviteToken : null,
        salon: {
          id: salonId,
          name: basic.name.trim(),
          slug: normalizeSalonSlug(basic.name.trim()),
          country_code: isInviteFlow ? inviteCountryCode : basic.country_code,
          city: basic.city.trim(),
          whatsapp: basic.whatsapp.trim(),
          admin_passcode: basic.admin_passcode.trim(),
          language_default: i18n.language,
          logo_url: logoRes.url || null,
          cover_image_url: coverRes.url || null,
        },
        location: {
          label: String(location.label || "Main Branch").trim() || "Main Branch",
          country_code: String(location.country_code || basic.country_code || "IQ").toUpperCase(),
          city: String(location.city || "").trim() || null,
          address_line: String(location.address_line || "").trim() || null,
          formatted_address: String(location.formatted_address || "").trim() || null,
          lat: locationLat,
          lng: locationLng,
          provider: mapboxAvailable ? String(location.provider || "mapbox") : "manual",
          provider_place_id: String(location.provider_place_id || "").trim() || null,
          is_primary: true,
        },
        working_hours: workingHours.map((row) => ({
          day_of_week: Number(row.day_of_week),
          is_closed: Boolean(row.is_closed),
          open_time: String(row.open_time || "10:00").slice(0, 5),
          close_time: String(row.close_time || "20:00").slice(0, 5),
        })),
        employees: employees.map((emp, idx) => ({
          id: emp.id,
          name: emp.name.trim(),
          role: emp.role.trim(),
          phone: emp.phone.trim(),
          avatar_url: employeeAvatarUrls[emp.id] || null,
          same_hours_as_salon: Boolean(emp.same_hours_as_salon),
          sort_order: (idx + 1) * 10,
          working_hours: (emp.working_hours || []).map((row) => ({
            day_of_week: Number(row.day_of_week),
            is_closed: Boolean(row.is_closed),
            open_time: String(row.open_time || "10:00").slice(0, 5),
            close_time: String(row.close_time || "20:00").slice(0, 5),
          })),
        })),
        services: services.map((srv, idx) => ({
          id: srv.id,
          name: srv.name.trim(),
          duration_minutes: Number(srv.duration_minutes || 45),
          price: Number(srv.price || 0),
          category: srv.category.trim(),
          sort_order: (idx + 1) * 10,
          employee_ids: srv.employee_ids,
        })),
      };

      const { data, error } = await supabase.rpc("create_salon_onboarding", { payload });
      if (error) throw error;

      const createdSalonId = String(data?.salon_id || payload?.salon?.id || "");
      if (createdSalonId) {
        // Hybrid onboarding: newly submitted salons enter approval queue.
        const pendingPatch = {
          status: "pending_approval",
          subscription_status: "inactive",
          billing_status: "inactive",
          trial_end_at: null,
          trial_end: null,
          is_active: true,
        };
        await supabase.from("salons").update(pendingPatch).eq("id", createdSalonId);
      }

      setSuccessData(data || null);
      window.localStorage.removeItem(DRAFT_KEY);
      showToast("success", t("onboarding.messages.success", "Salon setup completed successfully."));
    } catch (err) {
      if (uploadedPaths.length && supabase) {
        try {
          await supabase.storage.from(MEDIA_BUCKET).remove(uploadedPaths);
        } catch {
          // Best effort cleanup.
        }
      }

      showToast(
        "error",
        t("onboarding.errors.submitFailed", "Failed to complete setup: {{message}}", {
          message: err?.message || String(err),
        })
      );
    } finally {
      setUploading(false);
      setUploadStage("");
      setSaving(false);
    }
  }

  function restartWizard() {
    const reset = normalizeDraft(null);
    setDraft(reset);
    setLogoFile(null);
    setCoverFile(null);
    setAvatarFiles({});
    setSuccessData(null);
    setLocationSearch("");
    setLocationSearchResults([]);
    window.localStorage.removeItem(DRAFT_KEY);
  }

  if (successData) {
    const bookingPath = String(successData?.booking_path || "");
    const adminPath = String(successData?.admin_path || "");
    const bookingLink = bookingPath ? `${window.location.origin}${bookingPath}` : "";
    const adminLink = adminPath ? `${window.location.origin}${adminPath}` : "";

    return (
      <PageShell
        title={t("onboarding.title", "Salon setup wizard")}
        subtitle={t("onboarding.subtitle", "Create the full salon structure in one flow.")}
      >
        <div className="cc-container onboarding-page">
          <Card className="onboarding-success-card">
            <Badge variant="success">{t("onboarding.success.badge", "Setup completed")}</Badge>
            <h2>{t("onboarding.success.title", "Salon is ready ✅")}</h2>
            <p>{t("onboarding.success.text", "Your setup was submitted successfully and is now waiting for superadmin approval.")}</p>
            <div className="onboarding-success-links">
              <a href={bookingLink} target="_blank" rel="noreferrer" className="ui-btn ui-btn-primary">
                {t("onboarding.success.openBooking", "Open booking page")}
              </a>
              <a href={adminLink} target="_blank" rel="noreferrer" className="ui-btn ui-btn-secondary">
                {t("onboarding.success.openAdmin", "Open admin dashboard")}
              </a>
            </div>
            <div className="onboarding-success-meta">
              <div>
                <strong>{t("onboarding.success.bookingLink", "Booking link")}</strong>
                <span>{bookingLink}</span>
              </div>
              <div>
                <strong>{t("onboarding.success.adminLink", "Admin link")}</strong>
                <span>{adminLink}</span>
              </div>
              <div>
                <strong>{t("onboarding.success.passcode", "Admin passcode")}</strong>
                <span>{String(successData?.admin_passcode || basic.admin_passcode || "-")}</span>
              </div>
            </div>
            <div className="onboarding-success-actions">
              <Button onClick={restartWizard} variant="ghost">{t("onboarding.success.createAnother", "Create another salon")}</Button>
              <Button as={Link} to="/admin" variant="secondary">{t("onboarding.success.backSuperadmin", "Back to superadmin")}</Button>
            </div>
          </Card>
        </div>
        <Toast show={toast.show} type={toast.type} text={toast.text} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={t("onboarding.title", "Salon setup wizard")}
      subtitle={t("onboarding.subtitle", "Create the full salon structure in one flow.")}
      right={<Button as={Link} to="/admin" variant="ghost">{t("onboarding.backAdmin", "Back to superadmin")}</Button>}
    >
      <div className="cc-container onboarding-page">
        <Card className="onboarding-progress-card">
          <div className="onboarding-progress-head">
            <h2>{t("onboarding.progressTitle", "Setup progress")}</h2>
            <span>{t("onboarding.stepCount", "Step {{step}} of {{total}}", { step, total: stepItems.length })}</span>
          </div>
          <div className="onboarding-progress-track" role="list">
            {stepItems.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`onboarding-step-chip${item.id === step ? " active" : ""}${item.id < step ? " done" : ""}`}
                onClick={() => {
                  if (item.id <= step) patchDraft({ step: item.id });
                }}
              >
                <span>{item.id}</span>
                <small>{item.label}</small>
              </button>
            ))}
          </div>
        </Card>

        <Card className="onboarding-form-card">
          {step === 1 ? (
            <section className="onboarding-step-section">
              <h3>{t("onboarding.steps.basic", "Basic information")}</h3>
              <div className="onboarding-grid-2">
                <TextInput
                  label={t("onboarding.fields.salonName", "Salon name")}
                  value={basic.name}
                  onChange={(e) => patchBasic("name", e.target.value)}
                  placeholder={t("onboarding.placeholders.salonName", "Example: Queen Beauty Center")}
                />
                {shouldHideCountryField ? (
                  <div className="onboarding-file-field">
                    <span>{t("onboarding.invite.label", "Private invite")}</span>
                    <small>
                      {validatingInvite
                        ? t("onboarding.invite.validating", "Validating invite...")
                        : t("onboarding.invite.active", "Your country is set automatically through a private invite.")}
                    </small>
                  </div>
                ) : (
                  <SelectInput
                    label={t("onboarding.fields.country", "Country")}
                    value={basic.country_code}
                    onChange={(e) => patchBasic("country_code", e.target.value)}
                    disabled={loadingCountries || validatingInvite}
                  >
                    {countries.map((country) => (
                      <option key={country.code} value={country.code}>
                        {localizeCountryName(country, i18n.language)}
                      </option>
                    ))}
                  </SelectInput>
                )}
                <TextInput
                  label={t("onboarding.fields.city", "City")}
                  value={basic.city}
                  onChange={(e) => patchBasic("city", e.target.value)}
                  placeholder={t("onboarding.placeholders.city", "Example: Baghdad")}
                />
                <TextInput
                  label={t("onboarding.fields.whatsapp", "WhatsApp number")}
                  value={basic.whatsapp}
                  onChange={(e) => patchBasic("whatsapp", e.target.value)}
                  placeholder={t("onboarding.placeholders.whatsapp", "9647XXXXXXXX")}
                />
                <TextInput
                  label={t("onboarding.fields.adminPasscode", "Admin passcode")}
                  value={basic.admin_passcode}
                  onChange={(e) => patchBasic("admin_passcode", e.target.value)}
                  placeholder={t("onboarding.placeholders.adminPasscode", "Example: 1234")}
                />
              </div>
              {inviteError ? <p className="onboarding-upload-stage onboarding-upload-stage-error">{inviteError}</p> : null}

              <div className="onboarding-grid-2 onboarding-upload-grid">
                <label className="onboarding-file-field">
                  <span>{t("onboarding.fields.logoUpload", "Logo upload")}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      if (file && !validateImageFile(file)) return;
                      setLogoFile(file);
                    }}
                  />
                  <small>{logoFile?.name || t("onboarding.placeholders.noFile", "No file selected")}</small>
                </label>

                <label className="onboarding-file-field">
                  <span>{t("onboarding.fields.coverUpload", "Cover image upload")}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      if (file && !validateImageFile(file)) return;
                      setCoverFile(file);
                    }}
                  />
                  <small>{coverFile?.name || t("onboarding.placeholders.noFile", "No file selected")}</small>
                </label>
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="onboarding-step-section">
              <h3>{t("onboarding.steps.location", "Location")}</h3>
              <p className="onboarding-review-text">
                {mapboxAvailable
                  ? t("onboarding.location.mapHint", "Search address, then confirm your pin on map. You can still edit coordinates manually.")
                  : t("onboarding.location.noMapboxHint", "Map search is unavailable. Enter address + coordinates manually.")}
              </p>

              {mapboxAvailable ? (
                <div className="onboarding-location-search">
                  <TextInput
                    label={t("onboarding.location.search", "Search address on map")}
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                    placeholder={t("onboarding.location.searchPlaceholder", "Search street, area or city")}
                  />
                  {locationSearchLoading ? (
                    <small className="muted">{t("onboarding.location.searching", "Searching...")}</small>
                  ) : null}
                  {locationSearchResults.length ? (
                    <div className="onboarding-location-results">
                      {locationSearchResults.map((result) => (
                        <button
                          type="button"
                          key={`${result.place_id || result.formatted_address}-${result.lat}-${result.lng}`}
                          className="onboarding-location-result"
                          onClick={() => {
                            applyMapLocation(result);
                            setLocationSearch(result.formatted_address || result.name || "");
                            setLocationSearchResults([]);
                          }}
                        >
                          <b>{result.formatted_address || result.name || t("onboarding.location.unnamed", "Selected place")}</b>
                          <small>
                            {result.lat}, {result.lng}
                          </small>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="onboarding-grid-2">
                <SelectInput
                  label={t("onboarding.location.country", "Location country")}
                  value={location.country_code}
                  onChange={(e) => patchLocation("country_code", e.target.value)}
                  disabled={loadingCountries || validatingInvite || (isInviteFlow && !!inviteCountryCode)}
                >
                  {countries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {localizeCountryName(country, i18n.language)}
                    </option>
                  ))}
                </SelectInput>
                <TextInput
                  label={t("onboarding.location.city", "Location city")}
                  value={location.city}
                  onChange={(e) => patchLocation("city", e.target.value)}
                  placeholder={t("onboarding.location.cityPlaceholder", "City")}
                />
                <TextInput
                  label={t("onboarding.location.addressLine", "Address line")}
                  value={location.address_line}
                  onChange={(e) => patchLocation("address_line", e.target.value)}
                  placeholder={t("onboarding.location.addressLinePlaceholder", "Street, building, landmark")}
                />
                <TextInput
                  label={t("onboarding.location.formattedAddress", "Formatted address")}
                  value={location.formatted_address}
                  onChange={(e) => patchLocation("formatted_address", e.target.value)}
                  placeholder={t("onboarding.location.formattedAddressPlaceholder", "Full formatted address (optional)")}
                />
              </div>

              <div className="onboarding-location-pin-row">
                <TextInput
                  label={t("onboarding.location.latitude", "Latitude")}
                  value={location.lat}
                  onChange={(e) => patchLocation("lat", e.target.value)}
                  placeholder="33.3152"
                  inputMode="decimal"
                />
                <TextInput
                  label={t("onboarding.location.longitude", "Longitude")}
                  value={location.lng}
                  onChange={(e) => patchLocation("lng", e.target.value)}
                  placeholder="44.3661"
                  inputMode="decimal"
                />
              </div>

              {mapboxAvailable ? (
                <div className="onboarding-location-map-wrap">
                  <div className="onboarding-step-head-row">
                    <h4>{t("onboarding.location.pinTitle", "Pin confirmation")}</h4>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        confirmCurrentPin();
                        locationMapRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
                      }}
                      disabled={!hasLocationPin}
                    >
                      {t("onboarding.location.confirmPin", "Confirm on map")}
                    </Button>
                  </div>

                  {hasLocationPin ? (
                    <button
                      type="button"
                      className={`onboarding-location-map${location.pin_confirmed ? " is-confirmed" : ""}`}
                      ref={locationMapRef}
                      onClick={onLocationMapClick}
                    >
                      <img
                        src={buildMapboxStaticPreviewUrl({
                          lat: normalizedLocationLat,
                          lng: normalizedLocationLng,
                          zoom: MAP_PICKER_ZOOM,
                          width: 900,
                          height: 420,
                        })}
                        alt={locationAddressPreview || t("onboarding.location.mapPreviewAlt", "Salon location map preview")}
                      />
                      <span className="onboarding-location-crosshair" aria-hidden="true">
                        +
                      </span>
                    </button>
                  ) : (
                    <div className="onboarding-location-map-placeholder">
                      {t("onboarding.location.mapNeedsCoordinates", "Enter coordinates first, then tap on map to move the pin.")}
                    </div>
                  )}

                  <small className="muted">
                    {t("onboarding.location.mapClickHint", "Tap/click map to move the pin. The center marker is your saved location.")}
                  </small>
                </div>
              ) : (
                <div className="onboarding-location-map-placeholder">
                  {t("onboarding.location.mapUnavailable", "Map preview unavailable (missing Mapbox token). Directions links will still work with coordinates.")}
                </div>
              )}
            </section>
          ) : null}

          {step === 3 ? (
            <section className="onboarding-step-section">
              <h3>{t("onboarding.steps.hours", "Working hours")}</h3>
              <div className="onboarding-hours-list">
                {localizedDays.map((day) => {
                  const row = workingHours.find((x) => x.day_of_week === day.index) || {};
                  return (
                    <div key={day.index} className="onboarding-hours-row">
                      <strong>{day.label}</strong>
                      <label className="onboarding-toggle">
                        <input
                          type="checkbox"
                          checked={!row.is_closed}
                          onChange={(e) => patchWorkingHour(day.index, { is_closed: !e.target.checked })}
                        />
                        <span>{t("onboarding.fields.openDay", "Open")}</span>
                      </label>
                      <input
                        className="input"
                        type="time"
                        value={row.open_time || "10:00"}
                        onChange={(e) => patchWorkingHour(day.index, { open_time: e.target.value })}
                        disabled={row.is_closed}
                      />
                      <input
                        className="input"
                        type="time"
                        value={row.close_time || "20:00"}
                        onChange={(e) => patchWorkingHour(day.index, { close_time: e.target.value })}
                        disabled={row.is_closed}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {step === 4 ? (
            <section className="onboarding-step-section">
              <div className="onboarding-step-head-row">
                <h3>{t("onboarding.steps.employees", "Employees")}</h3>
                <Button variant="secondary" onClick={addEmployee}>{t("onboarding.actions.addEmployee", "Add employee")}</Button>
              </div>
              <div className="onboarding-stack">
                {employees.map((emp, idx) => (
                  <Card className="onboarding-nested-card" key={emp.id}>
                    <div className="onboarding-step-head-row">
                      <h4>{t("onboarding.labels.employeeNumber", "Employee #{{n}}", { n: idx + 1 })}</h4>
                      <Button
                        variant="ghost"
                        onClick={() => removeEmployee(emp.id)}
                        disabled={employees.length <= 1}
                      >
                        {t("onboarding.actions.remove", "Remove")}
                      </Button>
                    </div>

                    <div className="onboarding-grid-2">
                      <TextInput
                        label={t("onboarding.fields.employeeName", "Employee name")}
                        value={emp.name}
                        onChange={(e) => patchEmployee(emp.id, { name: e.target.value })}
                        placeholder={t("onboarding.placeholders.employeeName", "Example: Sara")}
                      />
                      <TextInput
                        label={t("onboarding.fields.employeeRole", "Role")}
                        value={emp.role}
                        onChange={(e) => patchEmployee(emp.id, { role: e.target.value })}
                        placeholder={t("onboarding.placeholders.employeeRole", "Example: Senior stylist")}
                      />
                      <TextInput
                        label={t("onboarding.fields.employeePhoneOptional", "Phone (optional)")}
                        value={emp.phone}
                        onChange={(e) => patchEmployee(emp.id, { phone: e.target.value })}
                        placeholder={t("onboarding.placeholders.employeePhone", "07XXXXXXXXX")}
                      />
                      <label className="onboarding-file-field">
                        <span>{t("onboarding.fields.avatarUpload", "Avatar upload")}</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            if (file && !validateImageFile(file)) return;
                            setAvatarFiles((prev) => ({ ...prev, [emp.id]: file }));
                          }}
                        />
                        <small>{avatarFiles[emp.id]?.name || t("onboarding.placeholders.noFile", "No file selected")}</small>
                      </label>
                    </div>

                    <label className="onboarding-toggle large">
                      <input
                        type="checkbox"
                        checked={Boolean(emp.same_hours_as_salon)}
                        onChange={(e) => patchEmployee(emp.id, { same_hours_as_salon: e.target.checked })}
                      />
                      <span>{t("onboarding.fields.sameHoursAsSalon", "Same hours as salon")}</span>
                    </label>

                    {!emp.same_hours_as_salon ? (
                      <div className="onboarding-hours-list nested">
                        {(emp.working_hours || []).map((row) => {
                          const dayLabel = localizedDays.find((d) => d.index === row.day_of_week)?.label || row.day_of_week;
                          return (
                            <div className="onboarding-hours-row" key={`${emp.id}-${row.day_of_week}`}>
                              <strong>{dayLabel}</strong>
                              <label className="onboarding-toggle">
                                <input
                                  type="checkbox"
                                  checked={!row.is_closed}
                                  onChange={(e) => patchEmployeeHour(emp.id, row.day_of_week, { is_closed: !e.target.checked })}
                                />
                                <span>{t("onboarding.fields.openDay", "Open")}</span>
                              </label>
                              <input
                                className="input"
                                type="time"
                                value={row.open_time || "10:00"}
                                onChange={(e) => patchEmployeeHour(emp.id, row.day_of_week, { open_time: e.target.value })}
                                disabled={row.is_closed}
                              />
                              <input
                                className="input"
                                type="time"
                                value={row.close_time || "20:00"}
                                onChange={(e) => patchEmployeeHour(emp.id, row.day_of_week, { close_time: e.target.value })}
                                disabled={row.is_closed}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </Card>
                ))}
              </div>
            </section>
          ) : null}

          {step === 5 ? (
            <section className="onboarding-step-section">
              <div className="onboarding-step-head-row">
                <h3>{t("onboarding.steps.services", "Services")}</h3>
                <Button variant="secondary" onClick={addService}>{t("onboarding.actions.addService", "Add service")}</Button>
              </div>
              <div className="onboarding-stack">
                {services.map((srv, idx) => (
                  <Card className="onboarding-nested-card" key={srv.id}>
                    <div className="onboarding-step-head-row">
                      <h4>{t("onboarding.labels.serviceNumber", "Service #{{n}}", { n: idx + 1 })}</h4>
                      <Button variant="ghost" onClick={() => removeService(srv.id)} disabled={services.length <= 1}>
                        {t("onboarding.actions.remove", "Remove")}
                      </Button>
                    </div>

                    <div className="onboarding-grid-2">
                      <TextInput
                        label={t("onboarding.fields.serviceName", "Service name")}
                        value={srv.name}
                        onChange={(e) => patchService(srv.id, { name: e.target.value })}
                        placeholder={t("onboarding.placeholders.serviceName", "Example: Haircut")}
                      />
                      <TextInput
                        label={t("onboarding.fields.durationMinutes", "Duration (minutes)")}
                        type="number"
                        min={5}
                        value={srv.duration_minutes}
                        onChange={(e) => patchService(srv.id, { duration_minutes: e.target.value })}
                        placeholder={t("onboarding.placeholders.duration", "Duration: 45")}
                      />
                      <TextInput
                        label={t("onboarding.fields.price", "Price")}
                        type="number"
                        min={0}
                        value={srv.price}
                        onChange={(e) => patchService(srv.id, { price: e.target.value })}
                        placeholder={t("onboarding.placeholders.price", "Price: 20000")}
                      />
                      <TextInput
                        label={t("onboarding.fields.category", "Category")}
                        value={srv.category}
                        onChange={(e) => patchService(srv.id, { category: e.target.value })}
                        placeholder={t("onboarding.placeholders.category", "Example: Hair")}
                      />
                    </div>

                    <div className="onboarding-assignment-block">
                      <strong>{t("onboarding.fields.assignEmployees", "Assign to employees")}</strong>
                      <div className="onboarding-checkbox-grid">
                        {employees.map((emp) => (
                          <label className="onboarding-checkbox-row" key={`${srv.id}-${emp.id}`}>
                            <input
                              type="checkbox"
                              checked={srv.employee_ids.includes(emp.id)}
                              onChange={() => toggleServiceEmployee(srv.id, emp.id)}
                            />
                            <span>{emp.name || t("onboarding.labels.unnamedEmployee", "Unnamed employee")}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}

          {step === 6 ? (
            <section className="onboarding-step-section">
              <h3>{t("onboarding.steps.submit", "Submit")}</h3>
              <p className="onboarding-review-text">{t("onboarding.reviewText", "Review your setup and submit to create the full salon structure.")}</p>

              <div className="onboarding-review-grid">
                <Card className="onboarding-review-card">
                  <h4>{t("onboarding.review.basic", "Basic information")}</h4>
                  <ul>
                    <li>{t("onboarding.fields.salonName", "Salon name")}: {basic.name || "-"}</li>
                    {!isInviteFlow ? <li>{t("onboarding.fields.country", "Country")}: {basic.country_code || "-"}</li> : null}
                    <li>{t("onboarding.fields.city", "City")}: {basic.city || "-"}</li>
                    <li>{t("onboarding.fields.whatsapp", "WhatsApp")}: {basic.whatsapp || "-"}</li>
                    <li>
                      {t("onboarding.steps.location", "Location")}: {locationAddressPreview || "-"}
                    </li>
                    <li>
                      {t("onboarding.location.latitude", "Latitude")}/{t("onboarding.location.longitude", "Longitude")}:{" "}
                      {hasLocationPin ? `${normalizedLocationLat}, ${normalizedLocationLng}` : "-"}
                    </li>
                  </ul>
                </Card>
                <Card className="onboarding-review-card">
                  <h4>{t("onboarding.review.resources", "Resources")}</h4>
                  <ul>
                    <li>{t("onboarding.review.employees", "Employees")}: {employees.length}</li>
                    <li>{t("onboarding.review.services", "Services")}: {services.length}</li>
                    <li>{t("onboarding.review.hours", "Working days")}: {workingHours.filter((x) => !x.is_closed).length}</li>
                  </ul>
                </Card>
              </div>

              {uploading ? <p className="onboarding-upload-stage">{uploadStage}</p> : null}
            </section>
          ) : null}

          <div className="onboarding-actions">
            <Button variant="ghost" onClick={prevStep} disabled={step === 1 || saving}>
              {t("onboarding.actions.back", "Back")}
            </Button>
            {step < 6 ? (
              <Button variant="primary" onClick={nextStep} disabled={saving}>
                {t("onboarding.actions.next", "Next")}
              </Button>
            ) : (
              <Button variant="primary" onClick={handleSubmit} disabled={saving}>
                {saving
                  ? t("onboarding.actions.submitting", "Submitting...")
                  : t("onboarding.actions.submit", "Create salon setup")}
              </Button>
            )}
          </div>
        </Card>
      </div>
      <Toast show={toast.show} type={toast.type} text={toast.text} />
    </PageShell>
  );
}
