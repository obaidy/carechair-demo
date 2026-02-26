'use client';

import {useMemo, useState} from 'react';
import {supabase} from '@/lib/supabase';

type Props = {
  salonId: string;
  locale: string;
  defaultValues: {
    whatsapp?: string | null;
    city?: string | null;
    area?: string | null;
    address_mode?: string | null;
    address_text?: string | null;
    location_lat?: number | null;
    location_lng?: number | null;
    location_accuracy_m?: number | null;
    location_label?: string | null;
  };
};

export default function ActivationRequestCard({salonId, defaultValues}: Props) {
  const [addressMode, setAddressMode] = useState<'MANUAL' | 'LOCATION'>(
    String(defaultValues.address_mode || '').toUpperCase() === 'LOCATION' ? 'LOCATION' : 'MANUAL'
  );
  const [form, setForm] = useState({
    whatsapp: String(defaultValues.whatsapp || ''),
    city: String(defaultValues.city || ''),
    area: String(defaultValues.area || ''),
    address_text: String(defaultValues.address_text || ''),
    location_lat: defaultValues.location_lat == null ? '' : String(defaultValues.location_lat),
    location_lng: defaultValues.location_lng == null ? '' : String(defaultValues.location_lng),
    location_accuracy_m: defaultValues.location_accuracy_m == null ? '' : String(defaultValues.location_accuracy_m),
    location_label: String(defaultValues.location_label || ''),
    instagram: '',
    photo_url: ''
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const submittedData = useMemo(
    () => ({
      ...form,
      address_mode: addressMode,
      location_lat: form.location_lat ? Number(form.location_lat) : null,
      location_lng: form.location_lng ? Number(form.location_lng) : null,
      location_accuracy_m: form.location_accuracy_m ? Number(form.location_accuracy_m) : null
    }),
    [addressMode, form]
  );

  async function submit() {
    if (!supabase) {
      setMessage('Supabase client is missing.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const {data, error} = await supabase.functions.invoke('request-activation', {
        body: {
          salon_id: salonId,
          submitted_data: submittedData
        }
      });
      if (error || !data?.ok) throw error || new Error(String(data?.error || 'Failed to submit request'));
      setMessage('Activation request submitted.');
      window.location.reload();
    } catch (error: any) {
      setMessage(String(error?.message || 'Failed to submit activation request.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel settings-list" id="activation">
      <h2>Request Activation</h2>
      <p className="muted">Submit verification details for super admin review.</p>

      <div className="row-actions" style={{marginBottom: 8}}>
        <button type="button" className={`btn ${addressMode === 'MANUAL' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setAddressMode('MANUAL')}>
          Manual Address
        </button>
        <button type="button" className={`btn ${addressMode === 'LOCATION' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setAddressMode('LOCATION')}>
          Location (lat/lng)
        </button>
      </div>

      <div className="settings-row">
        <label className="field">
          <span>WhatsApp</span>
          <input className="input" value={form.whatsapp} onChange={(e) => setForm((p) => ({...p, whatsapp: e.target.value}))} />
        </label>
        <label className="field">
          <span>City</span>
          <input className="input" value={form.city} onChange={(e) => setForm((p) => ({...p, city: e.target.value}))} />
        </label>
        <label className="field">
          <span>Area</span>
          <input className="input" value={form.area} onChange={(e) => setForm((p) => ({...p, area: e.target.value}))} />
        </label>

        {addressMode === 'MANUAL' ? (
          <label className="field">
            <span>Address</span>
            <input className="input" value={form.address_text} onChange={(e) => setForm((p) => ({...p, address_text: e.target.value}))} />
          </label>
        ) : (
          <>
            <label className="field">
              <span>Latitude</span>
              <input className="input" value={form.location_lat} onChange={(e) => setForm((p) => ({...p, location_lat: e.target.value}))} />
            </label>
            <label className="field">
              <span>Longitude</span>
              <input className="input" value={form.location_lng} onChange={(e) => setForm((p) => ({...p, location_lng: e.target.value}))} />
            </label>
            <label className="field">
              <span>Accuracy (m)</span>
              <input className="input" value={form.location_accuracy_m} onChange={(e) => setForm((p) => ({...p, location_accuracy_m: e.target.value}))} />
            </label>
            <label className="field">
              <span>Location label</span>
              <input className="input" value={form.location_label} onChange={(e) => setForm((p) => ({...p, location_label: e.target.value}))} />
            </label>
          </>
        )}

        <label className="field">
          <span>Instagram (optional)</span>
          <input className="input" value={form.instagram} onChange={(e) => setForm((p) => ({...p, instagram: e.target.value}))} />
        </label>

        <label className="field">
          <span>Storefront photo URL (optional)</span>
          <input className="input" value={form.photo_url} onChange={(e) => setForm((p) => ({...p, photo_url: e.target.value}))} />
        </label>
      </div>

      <div className="row-actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void submit()}>
          {busy ? 'Submitting...' : 'Request Activation'}
        </button>
      </div>

      {message ? <p className="muted">{message}</p> : null}
    </section>
  );
}
