'use client';

import {useEffect, useMemo, useState} from 'react';
import {readSupabaseDiag, type SupabaseDiagEntry} from '@/lib/dev/supabase-diagnostics';

type Props = {
  serverUrl: string;
};

function hostFromUrl(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

export default function ClientDiagnosticsCard({serverUrl}: Props) {
  const [entries, setEntries] = useState<SupabaseDiagEntry[]>([]);

  const clientUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const clientHost = useMemo(() => hostFromUrl(clientUrl), [clientUrl]);
  const serverHost = useMemo(() => hostFromUrl(serverUrl), [serverUrl]);
  const sameProject = Boolean(clientHost && serverHost && clientHost === serverHost);

  useEffect(() => {
    const read = () => setEntries(readSupabaseDiag(20));
    read();
    const timer = window.setInterval(read, 1500);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="panel" style={{marginTop: 12}}>
      <h3>Client Diagnostics</h3>
      <div className="settings-list">
        <div className="settings-row">
          <div>
            <p className="muted">Client Supabase URL</p>
            <code>{clientUrl || '(missing)'}</code>
          </div>
          <div>
            <p className="muted">Client host</p>
            <code>{clientHost || '(missing)'}</code>
          </div>
          <div>
            <p className="muted">Matches server host</p>
            <code>{sameProject ? 'yes' : 'no'}</code>
          </div>
        </div>

        <div>
          <p className="muted">Last 20 browser Supabase errors</p>
          <pre style={{whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.4}}>
            {JSON.stringify(entries, null, 2)}
          </pre>
        </div>
      </div>
    </section>
  );
}
