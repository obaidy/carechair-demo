export const DEFAULT_HERO_IMAGES = [
  "/images/default/hero-1.jpg",
  "/images/default/hero-2.jpg",
  "/images/default/hero-3.jpg",
];

export const DEFAULT_GALLERY_IMAGES = [
  "/images/default/gallery-1.jpg",
  "/images/default/gallery-2.jpg",
  "/images/default/gallery-3.jpg",
  "/images/default/gallery-4.jpg",
  "/images/default/gallery-5.jpg",
  "/images/default/gallery-6.jpg",
];

export const DEFAULT_AVATARS = Array.from({ length: 12 }, (_, i) => `/images/avatars/avatar-${i + 1}.png`);

export function hashStringToIndex(str, max) {
  const m = Number(max || 0);
  if (m <= 0) return 0;
  const text = String(str || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % m;
}

function parseGalleryValue(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((x) => String(x || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return [];

    if (raw.startsWith("[") && raw.endsWith("]")) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((x) => String(x || "").trim()).filter(Boolean);
        }
      } catch {
        // Fallback to split below.
      }
    }

    return raw
      .split(/[\n,]/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

export function getDefaultSalonImages(slug) {
  const seed = String(slug || "salon");
  const heroIndex = hashStringToIndex(seed, DEFAULT_HERO_IMAGES.length);

  const gallery = [];
  for (let i = 0; i < 4; i += 1) {
    const idx = (heroIndex + i) % DEFAULT_GALLERY_IMAGES.length;
    gallery.push(DEFAULT_GALLERY_IMAGES[idx]);
  }

  return {
    cover: DEFAULT_HERO_IMAGES[heroIndex],
    gallery,
  };
}

export function getDefaultCover(slug) {
  return getDefaultSalonImages(slug).cover;
}

export function getDefaultGallery(slug) {
  return getDefaultSalonImages(slug).gallery;
}

export function getDefaultAvatar(staffNameOrId) {
  const idx = hashStringToIndex(staffNameOrId || "staff", DEFAULT_AVATARS.length);
  return DEFAULT_AVATARS[idx];
}

export function getSalonMedia(salon) {
  const defaults = getDefaultSalonImages(salon?.slug || salon?.name || "salon");
  const providedGallery = parseGalleryValue(salon?.gallery_image_urls);
  const cover = String(salon?.cover_image_url || "").trim() || providedGallery[0] || defaults.cover;

  const mixed = [...providedGallery, ...defaults.gallery].filter(Boolean);
  const unique = [];
  for (const item of mixed) {
    if (!unique.includes(item)) unique.push(item);
    if (unique.length >= 4) break;
  }

  while (unique.length < 4) {
    unique.push(defaults.gallery[unique.length % defaults.gallery.length]);
  }

  return {
    cover,
    gallery: unique.slice(0, 4),
  };
}

export function getServiceImage(serviceName = "") {
  const name = String(serviceName).toLowerCase();
  if (name.includes("شعر") || name.includes("صبغ") || name.includes("تسشوار")) {
    return "/images/default/service-hair.jpg";
  }
  if (name.includes("اظافر") || name.includes("أظافر") || name.includes("مانيكير") || name.includes("باديكير")) {
    return "/images/default/service-nails.jpg";
  }
  if (name.includes("بشرة") || name.includes("تنظيف")) {
    return "/images/default/service-facial.jpg";
  }
  if (name.includes("مكياج") || name.includes("ميكاب")) {
    return "/images/default/service-makeup.jpg";
  }
  return "/images/default/service-facial.jpg";
}

export function getInitials(name = "") {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "؟";
  if (parts.length === 1) return parts[0].slice(0, 1);

  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`;
}

export function galleryToTextareaValue(value) {
  return parseGalleryValue(value).join("\n");
}

export function textareaToGalleryArray(text) {
  return String(text || "")
    .split(/\n|,/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 8);
}
