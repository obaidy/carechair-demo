import {recordSupabaseDiag} from '@/lib/dev/supabase-diagnostics';

const baseFetch: typeof fetch = fetch;

export function createSupabaseFetch(source: string): typeof fetch {
  return async (input, init) => {
    const method = String(init?.method || 'GET').toUpperCase();
    const url = String(input);
    const requestBody = typeof init?.body === 'string' ? init.body.slice(0, 2000) : undefined;

    try {
      const response = await baseFetch(input, init);
      if (process.env.NODE_ENV !== 'production' && !response.ok) {
        let responseBody = '';
        try {
          responseBody = (await response.clone().text()).slice(0, 4000);
        } catch {
          responseBody = '';
        }
        recordSupabaseDiag({
          source,
          method,
          url,
          status: response.status,
          message: `Supabase ${source} non-2xx response`,
          requestBody,
          responseBody,
        });
        // eslint-disable-next-line no-console
        console.error(`[Supabase:${source}] ${method} ${url} -> ${response.status}`, responseBody);
      }
      return response;
    } catch (error: any) {
      recordSupabaseDiag({
        source,
        method,
        url,
        message: String(error?.message || error || 'fetch_failed'),
        requestBody,
      });
      // eslint-disable-next-line no-console
      console.error(`[Supabase:${source}] ${method} ${url} threw`, error);
      throw error;
    }
  };
}
