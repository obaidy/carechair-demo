import type {Locale} from '@/lib/i18n';

export type Messages = Record<string, unknown>;

export async function getMessages(locale: Locale): Promise<Messages> {
  switch (locale) {
    case 'ar':
      return (await import('@/messages/ar.json')).default;
    case 'cs':
      return (await import('@/messages/cs.json')).default;
    case 'ru':
      return (await import('@/messages/ru.json')).default;
    case 'en':
    default:
      return (await import('@/messages/en.json')).default;
  }
}

export function t(messages: Messages, key: string, fallback = ''): string {
  const path = key.split('.');
  let value: unknown = messages;

  for (const segment of path) {
    if (!value || typeof value !== 'object' || !(segment in value)) {
      return fallback || key;
    }
    value = (value as Record<string, unknown>)[segment];
  }

  const text = typeof value === 'string' ? value : fallback || key;
  return text;
}

export function interpolate(template: string, vars?: Record<string, string | number | boolean | null | undefined>): string {
  if (!vars) return template;
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, token) => {
    const value = vars[token];
    if (value == null) return '';
    return String(value);
  });
}

export function tx(
  messages: Messages,
  key: string,
  fallback = '',
  vars?: Record<string, string | number | boolean | null | undefined>
): string {
  return interpolate(t(messages, key, fallback), vars);
}
