import {useSyncExternalStore} from 'react';

export type DevLogLevel = 'info' | 'warn' | 'error';

export type DevLogEntry = {
  id: string;
  ts: string;
  level: DevLogLevel;
  scope: string;
  message: string;
  data?: unknown;
};

const CAPACITY = 200;
const entries: DevLogEntry[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function toEntry(level: DevLogLevel, scope: string, message: string, data?: unknown): DevLogEntry {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    data,
  };
}

export function pushDevLog(level: DevLogLevel, scope: string, message: string, data?: unknown) {
  if (!__DEV__) return;
  const entry = toEntry(level, scope, message, data);
  entries.unshift(entry);
  if (entries.length > CAPACITY) entries.length = CAPACITY;
  emit();

  const printable = `[Diagnostics:${scope}] ${message}`;
  if (level === 'error') console.error(printable, data ?? '');
  else if (level === 'warn') console.warn(printable, data ?? '');
  else console.log(printable, data ?? '');
}

export function getDevLogs(limit = 20): DevLogEntry[] {
  if (limit <= 0) return [];
  return entries.slice(0, limit);
}

export function clearDevLogs() {
  if (!entries.length) return;
  entries.length = 0;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDevLogs(limit = 20) {
  return useSyncExternalStore(
    subscribe,
    () => getDevLogs(limit),
    () => [],
  );
}
