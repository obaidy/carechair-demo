'use client';

import {useEffect, useMemo, useState} from 'react';
import {useRouter} from 'next/navigation';

type PendingRequest = {
  id: string;
  salon_id: string;
  salon_name: string;
  salon_slug: string;
  salon_status: string;
  city: string | null;
  area: string | null;
  whatsapp: string | null;
  owner_phone: string | null;
  request_status: string;
  submitted_data: Record<string, unknown>;
  admin_notes: string | null;
  requested_by: string;
  created_at: string;
  reviewed_at: string | null;
};

type SalonStateRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  city: string | null;
  area: string | null;
  whatsapp: string | null;
  owner_phone: string | null;
  updated_at: string | null;
};

type Props = {
  locale: string;
  pending: PendingRequest[];
  active: SalonStateRow[];
  suspended: SalonStateRow[];
};

function fmtDate(value: string | null | undefined) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function mapsUrl(lat: unknown, lng: unknown) {
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return '';
  return `https://maps.google.com/?q=${a},${b}`;
}

export default function ActivationQueueClient({locale, pending, active, suspended}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<'pending' | 'active' | 'suspended'>('pending');
  const [selectedId, setSelectedId] = useState<string>(pending[0]?.id || '');
  const [decisionLoading, setDecisionLoading] = useState<'APPROVE' | 'REJECT' | ''>('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  const selected = useMemo(() => pending.find((row) => row.id === selectedId) || null, [pending, selectedId]);

  useEffect(() => {
    if (!pending.length) {
      setSelectedId('');
      return;
    }
    if (!selectedId || !pending.some((row) => row.id === selectedId)) {
      setSelectedId(pending[0].id);
      setNotes(pending[0].admin_notes || '');
    }
  }, [pending, selectedId]);

  async function review(decision: 'APPROVE' | 'REJECT') {
    if (!selected?.id) return;
    setDecisionLoading(decision);
    setMessage('');
    try {
      const res = await fetch('/api/admin/review-activation', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          activation_request_id: selected.id,
          decision,
          admin_notes: notes
        })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(String(data?.error || 'Review failed'));
      }
      setMessage(decision === 'APPROVE' ? 'Salon approved successfully.' : 'Activation request rejected.');
      router.refresh();
    } catch (error: any) {
      setMessage(String(error?.message || 'Failed to review request.'));
    } finally {
      setDecisionLoading('');
    }
  }

  return (
    <div className="cc-section" style={{gap: 16}}>
      <section className="panel hero-lite">
        <h1>Activation Queue</h1>
        <p className="muted">Review draft salons and control public activation state.</p>
      </section>

      <section className="panel">
        <div className="tabs-inline" style={{marginBottom: 12}}>
          <button className={`btn ${tab === 'pending' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('pending')}>
            Pending ({pending.length})
          </button>
          <button className={`btn ${tab === 'active' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('active')}>
            Active ({active.length})
          </button>
          <button className={`btn ${tab === 'suspended' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('suspended')}>
            Suspended ({suspended.length})
          </button>
        </div>

        {tab === 'pending' ? (
          <div className="grid two">
            <article className="booking-card" style={{maxHeight: '70vh', overflow: 'auto'}}>
              {!pending.length ? <p className="muted">No pending activation requests.</p> : null}
              {pending.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="settings-row"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: selectedId === row.id ? 'var(--panel-soft)' : 'transparent',
                    borderRadius: 12,
                    border: selectedId === row.id ? '1px solid var(--line)' : '1px solid transparent'
                  }}
                  onClick={() => {
                    setSelectedId(row.id);
                    setNotes(row.admin_notes || '');
                  }}
                >
                  <div>
                    <strong>{row.salon_name}</strong>
                    <p className="muted">
                      {row.city || row.area || '-'} • {row.owner_phone || row.whatsapp || '-'}
                    </p>
                    <p className="muted">Requested: {fmtDate(row.created_at)}</p>
                  </div>
                </button>
              ))}
            </article>

            <article className="booking-card" style={{maxHeight: '70vh', overflow: 'auto'}}>
              {!selected ? (
                <p className="muted">Select a request to review.</p>
              ) : (
                <div className="stack-sm">
                  <h3 style={{marginBottom: 0}}>{selected.salon_name}</h3>
                  <p className="muted">Owner phone: {selected.owner_phone || selected.whatsapp || '-'}</p>
                  <p className="muted">
                    City/Area: {selected.city || '-'} / {selected.area || '-'}
                  </p>
                  <p className="muted">Submitted: {fmtDate(selected.created_at)}</p>

                  <div className="panel" style={{padding: 12}}>
                    <b>Submitted Data</b>
                    <pre style={{whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 8}}>
                      {JSON.stringify(selected.submitted_data || {}, null, 2)}
                    </pre>
                  </div>

                  {mapsUrl(selected.submitted_data?.location_lat, selected.submitted_data?.location_lng) ? (
                    <a
                      className="btn btn-secondary"
                      href={mapsUrl(selected.submitted_data?.location_lat, selected.submitted_data?.location_lng)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open in Google Maps
                    </a>
                  ) : null}

                  <label className="field">
                    <span>Admin notes</span>
                    <textarea className="input" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </label>

                  <div className="row-actions">
                    <button className="btn btn-primary" disabled={Boolean(decisionLoading)} onClick={() => review('APPROVE')}>
                      {decisionLoading === 'APPROVE' ? 'Approving...' : 'Approve'}
                    </button>
                    <button className="btn btn-danger" disabled={Boolean(decisionLoading)} onClick={() => review('REJECT')}>
                      {decisionLoading === 'REJECT' ? 'Rejecting...' : 'Reject'}
                    </button>
                    <a className="btn btn-secondary" href={`/${locale}/s/${selected.salon_slug}`}>
                      Public page
                    </a>
                  </div>
                  {message ? <p className="muted">{message}</p> : null}
                </div>
              )}
            </article>
          </div>
        ) : (
          <div className="booking-card" style={{overflowX: 'auto'}}>
            <table className="superadmin-table">
              <thead>
                <tr>
                  <th>Salon</th>
                  <th>Status</th>
                  <th>City/Area</th>
                  <th>Owner phone</th>
                  <th>Updated</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {(tab === 'active' ? active : suspended).map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.status}</td>
                    <td>{row.city || row.area || '-'}</td>
                    <td>{row.owner_phone || row.whatsapp || '-'}</td>
                    <td>{fmtDate(row.updated_at)}</td>
                    <td>
                      <a className="ghost-link" href={`/${locale}/s/${row.slug}`}>
                        View
                      </a>
                    </td>
                  </tr>
                ))}
                {!(tab === 'active' ? active : suspended).length ? (
                  <tr>
                    <td colSpan={6}>No rows.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
