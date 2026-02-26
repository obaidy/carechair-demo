export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function normalizePhoneForAuth(input: string): string {
  const digits = digitsOnly(input.trim());
  if (!digits) return '';
  if (digits.startsWith('964')) return digits;
  if (digits.startsWith('07') && digits.length === 11) return `964${digits.slice(1)}`;
  if (digits.startsWith('7') && digits.length === 10) return `964${digits}`;
  return digits;
}

export function isValidE164WithoutPlus(input: string): boolean {
  return /^[1-9]\d{7,14}$/.test(input);
}

export function toPhoneWithPlus(input: string): string {
  const normalized = normalizePhoneForAuth(input);
  if (!isValidE164WithoutPlus(normalized)) return '';
  return `+${normalized}`;
}
