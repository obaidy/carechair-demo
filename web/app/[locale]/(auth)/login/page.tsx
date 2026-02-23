import {redirect} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {z} from 'zod';
import {getSuperadminCode} from '@/lib/auth/config';
import {setSalonAdminSession, setSuperadminSession} from '@/lib/auth/server';
import {createServerSupabaseClient} from '@/lib/supabase/server';

type Props = {
  params: Promise<{locale: string}>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function sanitizeNextPath(value: string, locale: string, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith('/')) return fallback;
  if (!value.startsWith(`/${locale}/`)) return fallback;
  return value;
}

const salonLoginSchema = z.object({
  slug: z.string().trim().min(2),
  passcode: z.string().trim().min(3),
  next: z.string().trim().optional()
});

const superadminLoginSchema = z.object({
  passcode: z.string().trim().min(3),
  next: z.string().trim().optional()
});

export default async function LoginPage({params, searchParams}: Props) {
  const {locale} = await params;
  const query = await searchParams;
  const t = await getTranslations();

  async function salonLoginAction(formData: FormData) {
    'use server';

    const parsed = salonLoginSchema.safeParse({
      slug: formData.get('slug'),
      passcode: formData.get('passcode'),
      next: formData.get('next')
    });

    if (!parsed.success) {
      redirect(`/${locale}/login?error=invalid_salon`);
    }

    const nextPath = sanitizeNextPath(parsed.data.next || '', locale, `/${locale}/app`);
    const supabase = createServerSupabaseClient();
    if (!supabase) {
      redirect(`/${locale}/login?error=supabase_missing`);
    }

    const {data, error} = await supabase
      .from('salons')
      .select('id,slug,admin_passcode')
      .eq('slug', parsed.data.slug)
      .maybeSingle();

    if (error || !data) {
      redirect(`/${locale}/login?error=not_found`);
    }

    if (String(data.admin_passcode || '').trim() !== parsed.data.passcode) {
      redirect(`/${locale}/login?error=wrong_passcode`);
    }

    await setSalonAdminSession({salonId: data.id, salonSlug: data.slug});
    redirect(nextPath);
  }

  async function superadminLoginAction(formData: FormData) {
    'use server';

    const parsed = superadminLoginSchema.safeParse({
      passcode: formData.get('passcode'),
      next: formData.get('next')
    });

    if (!parsed.success) {
      redirect(`/${locale}/login?error=invalid_superadmin`);
    }

    const nextPath = sanitizeNextPath(parsed.data.next || '', locale, `/${locale}/sa`);
    if (parsed.data.passcode !== getSuperadminCode()) {
      redirect(`/${locale}/login?error=wrong_superadmin`);
    }

    await setSuperadminSession();
    redirect(nextPath);
  }

  const nextPath = String(query.next || '');
  const safeNext = sanitizeNextPath(nextPath, locale, '');
  const errorCode = String(query.error || '');

  return (
    <div className="container page-stack">
      <section className="hero-card">
        <p className="eyebrow">CareChair</p>
        <h1>{t('nav.login', {defaultValue: 'Login'})}</h1>
        <p>{t('common.loginHint', {defaultValue: 'Use salon passcode or superadmin passcode to open dashboards.'})}</p>
      </section>

      {errorCode ? <p className="error-text">{errorCode.replace(/_/g, ' ')}</p> : null}

      <section className="auth-grid">
        <article className="booking-card">
          <h2>{t('nav.dashboard', {defaultValue: 'Salon Dashboard'})}</h2>
          <form action={salonLoginAction} className="booking-card">
            <input type="hidden" name="next" value={safeNext} />

            <label className="form-field">
              <span>Salon slug</span>
              <input className="input" name="slug" placeholder="my-salon" required minLength={2} />
            </label>

            <label className="form-field">
              <span>Admin passcode</span>
              <input className="input" name="passcode" type="password" required minLength={3} />
            </label>

            <button type="submit" className="btn btn-primary">{t('nav.login', {defaultValue: 'Login'})}</button>
          </form>
        </article>

        <article className="booking-card">
          <h2>{t('nav.superadmin', {defaultValue: 'Superadmin'})}</h2>
          <form action={superadminLoginAction} className="booking-card">
            <input type="hidden" name="next" value={safeNext} />

            <label className="form-field">
              <span>Superadmin passcode</span>
              <input className="input" name="passcode" type="password" required minLength={3} />
            </label>

            <button type="submit" className="btn btn-secondary">{t('nav.login', {defaultValue: 'Login'})}</button>
          </form>
        </article>
      </section>
    </div>
  );
}
