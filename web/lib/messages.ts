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

  return typeof value === 'string' ? value : fallback || key;
}
