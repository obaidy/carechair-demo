const TARGET_SIZE_BYTES = Math.floor(1.5 * 1024 * 1024);
const QUALITY_START = 0.9;
const QUALITY_MIN = 0.5;
const QUALITY_STEP = 0.1;
const RESIZE_TRIGGER_WIDTH = 2000;
const MAX_WIDTH_AFTER_RESIZE = 1600;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for compression.'));
    img.src = dataUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode compressed image.'));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });
}

function detectTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    const {data} = ctx.getImageData(0, 0, width, height);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) return true;
    }
  } catch {
    return false;
  }
  return false;
}

function normalizeOutputType(requestedType: string, hasTransparency: boolean): string {
  if (hasTransparency && requestedType === 'image/png') return 'image/png';
  if (requestedType === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

function getExtFromType(type: string): string {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'jpg';
}

export async function compressImage(file: File) {
  const dataUrl = await readFileAsDataUrl(file);
  const sourceImage = await loadImageFromDataUrl(dataUrl);

  const sourceWidth = sourceImage.naturalWidth || sourceImage.width;
  const sourceHeight = sourceImage.naturalHeight || sourceImage.height;

  if (!sourceWidth || !sourceHeight) {
    throw new Error('Invalid image dimensions.');
  }

  let targetWidth = sourceWidth;
  let targetHeight = sourceHeight;

  if (sourceWidth > RESIZE_TRIGGER_WIDTH) {
    const scale = MAX_WIDTH_AFTER_RESIZE / sourceWidth;
    targetWidth = Math.round(sourceWidth * scale);
    targetHeight = Math.round(sourceHeight * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', {alpha: true});
  if (!ctx) throw new Error('Failed to initialize compression canvas.');

  ctx.drawImage(sourceImage, 0, 0, targetWidth, targetHeight);

  const hasTransparency = detectTransparency(ctx, targetWidth, targetHeight);
  const initialType = normalizeOutputType(file.type, hasTransparency);

  if (initialType === 'image/png') {
    const pngBlob = await canvasToBlob(canvas, 'image/png', 1);
    if (pngBlob.size <= TARGET_SIZE_BYTES) {
      return {blob: pngBlob, contentType: 'image/png', ext: getExtFromType('image/png')};
    }

    let quality = QUALITY_START;
    let bestBlob = await canvasToBlob(canvas, 'image/webp', quality);
    while (bestBlob.size > TARGET_SIZE_BYTES && quality > QUALITY_MIN) {
      quality = Math.max(QUALITY_MIN, Number((quality - QUALITY_STEP).toFixed(2)));
      bestBlob = await canvasToBlob(canvas, 'image/webp', quality);
    }
    if (bestBlob.size <= TARGET_SIZE_BYTES) {
      return {blob: bestBlob, contentType: 'image/webp', ext: getExtFromType('image/webp')};
    }
    throw new Error('Compressed image is still larger than 1.5MB.');
  }

  let quality = QUALITY_START;
  let bestBlob = await canvasToBlob(canvas, initialType, quality);
  while (bestBlob.size > TARGET_SIZE_BYTES && quality > QUALITY_MIN) {
    quality = Math.max(QUALITY_MIN, Number((quality - QUALITY_STEP).toFixed(2)));
    bestBlob = await canvasToBlob(canvas, initialType, quality);
  }

  if (bestBlob.size > TARGET_SIZE_BYTES) {
    throw new Error('Compressed image is still larger than 1.5MB.');
  }

  return {
    blob: bestBlob,
    contentType: initialType,
    ext: getExtFromType(initialType)
  };
}
