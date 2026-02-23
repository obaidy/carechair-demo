export function formatCurrency(value: number | string | null | undefined, currencyCode = 'USD', locale = 'en-US'): string {
  const amount = Number(value || 0);
  const code = String(currencyCode || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0
    }).format(amount);
  } catch {
    return `${Math.round(amount).toLocaleString('en-US')} ${code}`;
  }
}

export function getSalonOperationalCurrencyCode(salon: {country_code?: string | null; currency_code?: string | null}) {
  const country = String(salon?.country_code || '').toUpperCase();
  if (country === 'IQ') return 'IQD';
  return String(salon?.currency_code || 'USD').toUpperCase();
}

export function formatSalonOperationalCurrency(
  value: number | string | null | undefined,
  salon: {country_code?: string | null; currency_code?: string | null},
  locale = 'en-US'
) {
  const code = getSalonOperationalCurrencyCode(salon);
  const lang = String(locale || 'en-US');
  const safeLocale = lang.startsWith('ar') ? 'ar-IQ-u-nu-latn' : lang;

  if (code === 'IQD') {
    const amount = Number(value || 0);
    try {
      const numberPart = new Intl.NumberFormat(safeLocale, {maximumFractionDigits: 0}).format(amount);
      const suffix = lang.startsWith('ar') ? 'د.ع' : 'IQD';
      return `${numberPart} ${suffix}`;
    } catch {
      return `${Math.round(amount).toLocaleString('en-US')} IQD`;
    }
  }

  return formatCurrency(value, code, safeLocale);
}
