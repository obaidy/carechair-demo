'use client';

import {useMemo, useState} from 'react';
import {createBrowserSupabaseClient} from '@/lib/supabase/browser';
import {isValidE164WithoutPlus, normalizeIraqiPhone} from '@/lib/phone';
import {useTx} from '@/lib/messages-client';

type Props = {
  locale: string;
  nextPath: string;
  defaultRole: 'salon_admin' | 'superadmin';
};

function toE164WithPlus(input: string) {
  const normalized = normalizeIraqiPhone(input);
  if (!isValidE164WithoutPlus(normalized)) return '';
  return `+${normalized}`;
}

export default function IdentityLoginCard({locale, nextPath, defaultRole}: Props) {
  const tx = useTx();
  const t = (
    key: string,
    fallback: string,
    vars?: Record<string, string | number | boolean | null | undefined>
  ) => tx(key, fallback, vars);
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const [method, setMethod] = useState<'phone' | 'email'>('phone');
  const [role, setRole] = useState<'salon_admin' | 'superadmin'>(defaultRole);
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function finalizeLogin(accessToken: string) {
    const res = await fetch('/api/auth/identity-session', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({
        accessToken,
        role,
        next: nextPath,
        locale
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      throw new Error(String(data?.error || 'Unable to resolve account access for this user.'));
    }

    window.location.href = String(data?.nextPath || `/${locale}/app`);
  }

  async function sendOtp() {
    if (!supabase) {
      setError(t('errors.supabaseConfigMissing', 'Supabase configuration is missing.'));
      return;
    }

    const phoneWithPlus = toE164WithPlus(phone);
    if (!phoneWithPlus) {
      setError(t('auth.phone.invalid', 'Enter a valid phone number.'));
      return;
    }

    setBusy(true);
    setError('');
    setInfo('');
    try {
      const shouldCreateUser = role === 'salon_admin';

      const {error: waError} = await supabase.auth.signInWithOtp({
        phone: phoneWithPlus,
        options: {
          shouldCreateUser,
          channel: 'whatsapp'
        }
      });

      if (!waError) {
        setOtpSent(true);
        setInfo(
          t(
            'auth.phone.sentWhatsapp',
            'Verification code sent to WhatsApp. Enter the code to continue.'
          )
        );
        return;
      }

      const {error: smsError} = await supabase.auth.signInWithOtp({
        phone: phoneWithPlus,
        options: {
          shouldCreateUser,
          channel: 'sms'
        }
      });
      if (smsError) {
        throw smsError;
      }

      setOtpSent(true);
      setInfo(
        t(
          'auth.phone.sentSmsFallback',
          'WhatsApp is unavailable right now, so we sent the code by SMS.'
        )
      );
    } catch (err) {
      setError(String((err as Error)?.message || t('common.error', 'Error')));
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    if (!supabase) {
      setError(t('errors.supabaseConfigMissing', 'Supabase configuration is missing.'));
      return;
    }

    const phoneWithPlus = toE164WithPlus(phone);
    if (!phoneWithPlus) {
      setError(t('auth.phone.invalid', 'Enter a valid phone number.'));
      return;
    }

    if (!String(otpCode || '').trim()) {
      setError(t('auth.phone.codeRequired', 'Enter verification code.'));
      return;
    }

    setBusy(true);
    setError('');
    setInfo('');
    try {
      const {data, error: verifyError} = await supabase.auth.verifyOtp({
        phone: phoneWithPlus,
        token: String(otpCode).trim(),
        type: 'sms'
      });
      if (verifyError) throw verifyError;
      const accessToken = data?.session?.access_token;
      if (!accessToken) throw new Error(t('auth.errors.noSession', 'No active session returned by auth.'));
      await finalizeLogin(accessToken);
    } catch (err) {
      setError(String((err as Error)?.message || t('common.error', 'Error')));
    } finally {
      setBusy(false);
    }
  }

  async function signInEmail() {
    if (!supabase) {
      setError(t('errors.supabaseConfigMissing', 'Supabase configuration is missing.'));
      return;
    }
    if (!String(email).trim() || !String(password).trim()) {
      setError(t('auth.email.required', 'Email and password are required.'));
      return;
    }

    setBusy(true);
    setError('');
    setInfo('');
    try {
      const {data, error: signInError} = await supabase.auth.signInWithPassword({
        email: String(email).trim(),
        password
      });
      if (signInError) throw signInError;
      const accessToken = data?.session?.access_token;
      if (!accessToken) throw new Error(t('auth.errors.noSession', 'No active session returned by auth.'));
      await finalizeLogin(accessToken);
    } catch (err) {
      setError(String((err as Error)?.message || t('common.error', 'Error')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="booking-card">
      <h2>{t('auth.pro.title', 'CareChair Professionals (beta)')}</h2>
      <p className="muted">{t('auth.pro.subtitle', 'Sign in with phone OTP or email to open your dashboard session.')}</p>

      <div className="tabs-inline" style={{marginBottom: 10}}>
        <button
          type="button"
          className={`btn ${method === 'phone' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setMethod('phone')}
          disabled={busy}
        >
          {t('auth.phone.tab', 'Phone OTP')}
        </button>
        <button
          type="button"
          className={`btn ${method === 'email' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setMethod('email')}
          disabled={busy}
        >
          {t('auth.email.tab', 'Email')}
        </button>
      </div>

      <label className="field">
        <span>{t('auth.role.label', 'Access role')}</span>
        <select
          className="input"
          value={role}
          onChange={(e) => setRole(e.target.value === 'superadmin' ? 'superadmin' : 'salon_admin')}
          disabled={busy}
        >
          <option value="salon_admin">{t('auth.role.salon', 'Salon dashboard')}</option>
          <option value="superadmin">{t('auth.role.superadmin', 'Superadmin')}</option>
        </select>
      </label>

      {method === 'phone' ? (
        <div className="stack-sm">
          <label className="field">
            <span>{t('auth.phone.label', 'Phone number')}</span>
            <input
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07xxxxxxxxx"
              inputMode="tel"
              disabled={busy}
            />
          </label>
          {otpSent ? (
            <label className="field">
              <span>{t('auth.phone.code', 'Verification code')}</span>
              <input
                className="input"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                inputMode="numeric"
                disabled={busy}
              />
            </label>
          ) : null}
          <div className="row-actions">
            {!otpSent ? (
              <button type="button" className="btn btn-primary" onClick={() => void sendOtp()} disabled={busy}>
                {busy ? t('common.processing', 'Processing...') : t('auth.phone.send', 'Send code')}
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => void verifyOtp()} disabled={busy}>
                {busy ? t('common.processing', 'Processing...') : t('auth.phone.verify', 'Verify and login')}
              </button>
            )}
            {otpSent ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setOtpSent(false);
                  setOtpCode('');
                  setError('');
                  setInfo('');
                }}
                disabled={busy}
              >
                {t('common.reset', 'Reset')}
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <form
          className="stack-sm"
          onSubmit={(e) => {
            e.preventDefault();
            void signInEmail();
          }}
        >
          <label className="field">
            <span>{t('auth.email.label', 'Email')}</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="field">
            <span>{t('auth.email.password', 'Password')}</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? t('common.processing', 'Processing...') : t('nav.login', 'Login')}
          </button>
        </form>
      )}

      {info ? <p className="muted" style={{color: 'var(--success)'}}>{info}</p> : null}
      {error ? <p className="muted" style={{color: 'var(--danger)'}}>{error}</p> : null}
    </article>
  );
}
