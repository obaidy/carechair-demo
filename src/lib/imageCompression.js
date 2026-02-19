const TARGET_SIZE_BYTES = Math.floor(1.5 * 1024 * 1024);
const QUALITY_START = 0.9;
const QUALITY_MIN = 0.5;
const QUALITY_STEP = 0.1;
const RESIZE_TRIGGER_WIDTH = 2000;
const MAX_WIDTH_AFTER_RESIZE = 1600;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("فشل قراءة الصورة."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("تعذر تحميل الصورة للضغط."));
    img.src = dataUrl;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("فشل تحويل الصورة بعد الضغط."));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });
}

function detectTransparency(ctx, width, height) {
  try {
    const { data } = ctx.getImageData(0, 0, width, height);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) return true;
    }
  } catch (_) {
    return false;
  }
  return false;
}

function normalizeOutputType(requestedType, hasTransparency) {
  if (hasTransparency && requestedType === "image/png") return "image/png";
  if (requestedType === "image/webp") return "image/webp";
  return "image/jpeg";
}

function getExtFromType(type) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

/**
 * Integration:
 * 1) Call `compressImage(file)` right before Supabase upload.
 * 2) Use `result.blob` instead of the original file in `.upload(...)`.
 * 3) Use `result.contentType` in `contentType` option, and `result.ext` for file path suffix.
 */
export async function compressImage(file) {
  const dataUrl = await readFileAsDataUrl(file);
  const sourceImage = await loadImageFromDataUrl(dataUrl);

  const sourceWidth = sourceImage.naturalWidth || sourceImage.width;
  const sourceHeight = sourceImage.naturalHeight || sourceImage.height;

  if (!sourceWidth || !sourceHeight) {
    throw new Error("أبعاد الصورة غير صالحة.");
  }

  let targetWidth = sourceWidth;
  let targetHeight = sourceHeight;

  if (sourceWidth > RESIZE_TRIGGER_WIDTH) {
    const scale = MAX_WIDTH_AFTER_RESIZE / sourceWidth;
    targetWidth = Math.round(sourceWidth * scale);
    targetHeight = Math.round(sourceHeight * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("تعذر بدء محرّك الضغط.");

  ctx.drawImage(sourceImage, 0, 0, targetWidth, targetHeight);

  const hasTransparency = detectTransparency(ctx, targetWidth, targetHeight);
  const initialType = normalizeOutputType(file.type, hasTransparency);

  if (initialType === "image/png") {
    const pngBlob = await canvasToBlob(canvas, "image/png", 1);
    if (pngBlob.size <= TARGET_SIZE_BYTES) {
      return { blob: pngBlob, contentType: "image/png", ext: getExtFromType("image/png") };
    }

    // Transparent PNG stays transparent by converting to WEBP if PNG is still too large.
    let quality = QUALITY_START;
    let bestBlob = await canvasToBlob(canvas, "image/webp", quality);
    while (bestBlob.size > TARGET_SIZE_BYTES && quality > QUALITY_MIN) {
      quality = Math.max(QUALITY_MIN, Number((quality - QUALITY_STEP).toFixed(2)));
      bestBlob = await canvasToBlob(canvas, "image/webp", quality);
    }
    if (bestBlob.size <= TARGET_SIZE_BYTES) {
      return { blob: bestBlob, contentType: "image/webp", ext: getExtFromType("image/webp") };
    }
    throw new Error("حجم الصورة بعد الضغط ما زال أكبر من 1.5MB.");
  }

  let quality = QUALITY_START;
  let bestBlob = await canvasToBlob(canvas, initialType, quality);
  while (bestBlob.size > TARGET_SIZE_BYTES && quality > QUALITY_MIN) {
    quality = Math.max(QUALITY_MIN, Number((quality - QUALITY_STEP).toFixed(2)));
    bestBlob = await canvasToBlob(canvas, initialType, quality);
  }

  if (bestBlob.size > TARGET_SIZE_BYTES) {
    throw new Error("حجم الصورة بعد الضغط ما زال أكبر من 1.5MB.");
  }

  return {
    blob: bestBlob,
    contentType: initialType,
    ext: getExtFromType(initialType),
  };
}

