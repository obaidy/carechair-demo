export function digitsOnly(value: string | null | undefined): string {
  return String(value || '').replace(/\D/g, '');
}

export function normalizeIraqiPhone(value: string | null | undefined): string {
  const digits = digitsOnly(value);
  if (!digits) return '';
  if (digits.startsWith('964')) return digits;
  if (digits.startsWith('07') && digits.length === 11) return `964${digits.slice(1)}`;
  if (digits.startsWith('7') && digits.length === 10) return `964${digits}`;
  return digits;
}

export function isValidE164WithoutPlus(value: string | null | undefined): boolean {
  return /^[1-9]\d{7,14}$/.test(String(value || ''));
}
