export type SupabaseDiagEntry = {
  id: string;
  ts: string;
  source: string;
  method: string;
  url: string;
  status?: number;
  message: string;
  requestBody?: string;
  responseBody?: string;
};

const LIMIT = 200;

function globalStore() {
  const g = globalThis as any;
  if (!g.__carechairSupabaseDiag) g.__carechairSupabaseDiag = [] as SupabaseDiagEntry[];
  return g.__carechairSupabaseDiag as SupabaseDiagEntry[];
}

function push(entry: SupabaseDiagEntry) {
  const store = globalStore();
  store.unshift(entry);
  if (store.length > LIMIT) store.length = LIMIT;
}

export function recordSupabaseDiag(entry: Omit<SupabaseDiagEntry, 'id' | 'ts'>) {
  if (process.env.NODE_ENV === 'production') return;
  push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    ...entry,
  });
}

export function readSupabaseDiag(limit = 20): SupabaseDiagEntry[] {
  if (limit <= 0) return [];
  return globalStore().slice(0, limit);
}
