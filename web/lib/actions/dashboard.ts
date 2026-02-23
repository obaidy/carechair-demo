'use server';

import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {readAuthSession} from '@/lib/auth/server';
import {createServerSupabaseClient} from '@/lib/supabase/server';

function missingColumn(error: unknown, columnName: string): boolean {
  const raw = String((error as {message?: string})?.message || '').toLowerCase();
  return raw.includes('column') && raw.includes(columnName.toLowerCase());
}

async function requireSalonAdminSession() {
  const session = await readAuthSession();
  if (!session || session.role !== 'salon_admin' || !session.salonId) {
    throw new Error('forbidden');
  }
  return session;
}

async function requireSuperadminSession() {
  const session = await readAuthSession();
  if (!session || session.role !== 'superadmin') {
    throw new Error('forbidden');
  }
  return session;
}

const bookingStatusSchema = z.object({
  bookingId: z.string().uuid(),
  status: z.enum(['pending', 'confirmed', 'cancelled']),
  path: z.string().min(1)
});

export async function updateBookingStatusAction(formData: FormData) {
  const parsed = bookingStatusSchema.safeParse({
    bookingId: formData.get('bookingId'),
    status: formData.get('status'),
    path: formData.get('path')
  });
  if (!parsed.success) return;

  const session = await requireSalonAdminSession();
  const supabase = createServerSupabaseClient();
  if (!supabase) return;

  await supabase
    .from('bookings')
    .update({status: parsed.data.status})
    .eq('id', parsed.data.bookingId)
    .eq('salon_id', session.salonId);

  revalidatePath(parsed.data.path);
}

const staffCreateSchema = z.object({
  name: z.string().trim().min(2),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  path: z.string().min(1)
});

export async function createStaffAction(formData: FormData) {
  const parsed = staffCreateSchema.safeParse({
    name: formData.get('name'),
    sortOrder: formData.get('sortOrder'),
    path: formData.get('path')
  });
  if (!parsed.success) return;

  const session = await requireSalonAdminSession();
  const supabase = createServerSupabaseClient();
  if (!supabase) return;

  await supabase.from('staff').insert({
    salon_id: session.salonId,
    name: parsed.data.name,
    sort_order: parsed.data.sortOrder,
    is_active: true
  });

  revalidatePath(parsed.data.path);
}

const staffToggleSchema = z.object({
  staffId: z.string().uuid(),
  isActive: z.enum(['true', 'false']),
  path: z.string().min(1)
});

export async function toggleStaffAction(formData: FormData) {
  const parsed = staffToggleSchema.safeParse({
    staffId: formData.get('staffId'),
    isActive: formData.get('isActive'),
    path: formData.get('path')
  });
  if (!parsed.success) return;

  const session = await requireSalonAdminSession();
  const supabase = createServerSupabaseClient();
  if (!supabase) return;

  await supabase
    .from('staff')
    .update({is_active: parsed.data.isActive !== 'true'})
    .eq('id', parsed.data.staffId)
    .eq('salon_id', session.salonId);

  revalidatePath(parsed.data.path);
}

const serviceCreateSchema = z.object({
  name: z.string().trim().min(2),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  price: z.coerce.number().min(0).max(1000000).default(0),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  path: z.string().min(1)
});

export async function createServiceAction(formData: FormData) {
  const parsed = serviceCreateSchema.safeParse({
    name: formData.get('name'),
    durationMinutes: formData.get('durationMinutes'),
    price: formData.get('price'),
    sortOrder: formData.get('sortOrder'),
    path: formData.get('path')
  });
  if (!parsed.success) return;

  const session = await requireSalonAdminSession();
  const supabase = createServerSupabaseClient();
  if (!supabase) return;

  await supabase.from('services').insert({
    salon_id: session.salonId,
    name: parsed.data.name,
    duration_minutes: parsed.data.durationMinutes,
    price: parsed.data.price,
    sort_order: parsed.data.sortOrder,
    is_active: true
  });

  revalidatePath(parsed.data.path);
}

const serviceToggleSchema = z.object({
  serviceId: z.string().uuid(),
  isActive: z.enum(['true', 'false']),
  path: z.string().min(1)
});

export async function toggleServiceAction(formData: FormData) {
  const parsed = serviceToggleSchema.safeParse({
    serviceId: formData.get('serviceId'),
    isActive: formData.get('isActive'),
    path: formData.get('path')
  });
  if (!parsed.success) return;

  const session = await requireSalonAdminSession();
  const supabase = createServerSupabaseClient();
  if (!supabase) return;

  await supabase
    .from('services')
    .update({is_active: parsed.data.isActive !== 'true'})
    .eq('id', parsed.data.serviceId)
    .eq('salon_id', session.salonId);

  revalidatePath(parsed.data.path);
}

const salonVisibilitySchema = z.object({
  isPublic: z.enum(['true', 'false']),
  path: z.string().min(1)
});

export async function updateSalonVisibilityAction(formData: FormData) {
  const parsed = salonVisibilitySchema.safeParse({
    isPublic: formData.get('isPublic'),
    path: formData.get('path')
  });
  if (!parsed.success) return;

  const session = await requireSalonAdminSession();
  const supabase = createServerSupabaseClient();
  if (!supabase) return;

  const nextPublic = parsed.data.isPublic === 'true';

  let res = await supabase
    .from('salons')
    .update({is_public: nextPublic, is_listed: nextPublic})
    .eq('id', session.salonId);

  if (res.error && missingColumn(res.error, 'is_public')) {
    res = await supabase.from('salons').update({is_listed: nextPublic}).eq('id', session.salonId);
  }

  if (res.error) throw res.error;
  revalidatePath(parsed.data.path);
}

const superadminActionSchema = z.object({
  salonId: z.string().uuid(),
  action: z.enum(['approve_trial', 'suspend', 'resume', 'toggle_visibility']),
  path: z.string().min(1),
  isPublic: z.enum(['true', 'false']).optional()
});

export async function superadminSalonAction(formData: FormData) {
  const parsed = superadminActionSchema.safeParse({
    salonId: formData.get('salonId'),
    action: formData.get('action'),
    path: formData.get('path'),
    isPublic: formData.get('isPublic')
  });
  if (!parsed.success) return;

  await requireSuperadminSession();
  const supabase = createServerSupabaseClient();
  if (!supabase) return;

  const nowIso = new Date().toISOString();
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 7);

  let patch: Record<string, unknown> = {};
  if (parsed.data.action === 'approve_trial') {
    patch = {
      status: 'trialing',
      subscription_status: 'trialing',
      billing_status: 'trialing',
      trial_end_at: trialEnd.toISOString(),
      trial_end: trialEnd.toISOString(),
      is_active: true,
      suspended_reason: null,
      updated_at: nowIso
    };
  }

  if (parsed.data.action === 'suspend') {
    patch = {
      status: 'suspended',
      subscription_status: 'suspended',
      billing_status: 'suspended',
      is_active: false,
      suspended_reason: 'Suspended by superadmin',
      updated_at: nowIso
    };
  }

  if (parsed.data.action === 'resume') {
    patch = {
      status: 'active',
      subscription_status: 'active',
      billing_status: 'active',
      is_active: true,
      suspended_reason: null,
      updated_at: nowIso
    };
  }

  if (parsed.data.action === 'toggle_visibility') {
    const nextVisibility = parsed.data.isPublic === 'true';
    patch = {
      is_public: nextVisibility,
      is_listed: nextVisibility,
      updated_at: nowIso
    };
  }

  let res = await supabase.from('salons').update(patch).eq('id', parsed.data.salonId);

  if (res.error) {
    const nextPatch = {...patch};
    if (missingColumn(res.error, 'is_public') && 'is_public' in nextPatch) {
      delete nextPatch.is_public;
      if (!('is_listed' in nextPatch)) {
        nextPatch.is_listed = parsed.data.isPublic === 'true';
      }
      res = await supabase.from('salons').update(nextPatch).eq('id', parsed.data.salonId);
    }

    if (res.error && missingColumn(res.error, 'subscription_status')) {
      const legacyPatch = {...nextPatch};
      delete legacyPatch.subscription_status;
      delete legacyPatch.billing_status;
      if ('trial_end_at' in legacyPatch) {
        legacyPatch.trial_end = legacyPatch.trial_end_at;
        delete legacyPatch.trial_end_at;
      }
      res = await supabase.from('salons').update(legacyPatch).eq('id', parsed.data.salonId);
    }
  }

  if (res.error) throw res.error;
  revalidatePath(parsed.data.path);
}
