'use server';

import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {readAuthSession} from '@/lib/auth/server';
import {getSuperadminCode} from '@/lib/auth/config';
import {createServerSupabaseClient} from '@/lib/supabase/server';

function missingColumn(error: unknown, columnName: string): boolean {
  const raw = String((error as {message?: string})?.message || '').toLowerCase();
  return raw.includes('column') && raw.includes(columnName.toLowerCase());
}

async function requireSalonAdminSession() {
  const session = await readAuthSession();
  if (!session || session.role !== 'salon_admin' || !session.salonId) {
    return null;
  }
  return session;
}

async function requireSuperadminSession() {
  const session = await readAuthSession();
  if (!session || session.role !== 'superadmin') {
    return null;
  }
  return session;
}

function parseCheckbox(input: FormDataEntryValue | null): boolean {
  return input === 'on' || input === 'true' || input === '1';
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
  if (!session) return;
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
  if (!session) return;
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
  if (!session) return;
  const supabase = createServerSupabaseClient();
  if (!supabase) return;

  await supabase
    .from('staff')
    .update({is_active: parsed.data.isActive !== 'true'})
    .eq('id', parsed.data.staffId)
    .eq('salon_id', session.salonId);

  revalidatePath(parsed.data.path);
}

const staffUpdateSchema = z.object({
  staffId: z.string().uuid(),
  name: z.string().trim().min(2),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  photoUrl: z.string().trim().optional(),
  path: z.string().min(1)
});

export async function updateStaffAction(formData: FormData) {
  const parsed = staffUpdateSchema.safeParse({
    staffId: formData.get('staffId'),
    name: formData.get('name'),
    sortOrder: formData.get('sortOrder'),
    photoUrl: formData.get('photoUrl'),
    path: formData.get('path')
  });
  if (!parsed.success) return;

  const session = await requireSalonAdminSession();
  if (!session) return;
  const supabase = createServerSupabaseClient();
  if (!supabase) return;

  await supabase
    .from('staff')
    .update({
      name: parsed.data.name,
      sort_order: parsed.data.sortOrder,
      photo_url: parsed.data.photoUrl || null
    })
    .eq('id', parsed.data.staffId)
    .eq('salon_id', session.salonId);

  revalidatePath(parsed.data.path);
}

const staffDeleteSchema = z.object({
  staffId: z.string().uuid(),
  path: z.string().min(1)
});

export async function deleteStaffAction(formData: FormData) {
  const parsed = staffDeleteSchema.safeParse({
    staffId: formData.get('staffId'),
    path: formData.get('path')
  });
  if (!parsed.success) return;

  const session = await requireSalonAdminSession();
  if (!session) return;
  const supabase = createServerSupabaseClient();
  if (!supabase) return;

  await supabase
    .from('staff')
    .delete()
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
  if (!session) return;
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
  if (!session) return;
  const supabase = createServerSupabaseClient();
  if (!supabase) return;

  await supabase
    .from('services')
    .update({is_active: parsed.data.isActive !== 'true'})
    .eq('id', parsed.data.serviceId)
    .eq('salon_id', session.salonId);

  revalidatePath(parsed.data.path);
}

const serviceUpdateSchema = z.object({
  serviceId: z.string().uuid(),
  name: z.string().trim().min(2),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  price: z.coerce.number().min(0).max(1000000).default(0),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.enum(['true', 'false']).optional(),
  path: z.string().min(1)
});

export async function updateServiceAction(formData: FormData) {
  const parsed = serviceUpdateSchema.safeParse({
    serviceId: formData.get('serviceId'),
    name: formData.get('name'),
    durationMinutes: formData.get('durationMinutes'),
    price: formData.get('price'),
    sortOrder: formData.get('sortOrder'),
    isActive: formData.get('isActive'),
    path: formData.get('path')
  });
  if (!parsed.success) return;

  const session = await requireSalonAdminSession();
  if (!session) return;
  const supabase = createServerSupabaseClient();
  if (!supabase) return;

  await supabase
    .from('services')
    .update({
      name: parsed.data.name,
      duration_minutes: parsed.data.durationMinutes,
      price: parsed.data.price,
      sort_order: parsed.data.sortOrder,
      is_active: parsed.data.isActive ? parsed.data.isActive === 'true' : true
    })
    .eq('id', parsed.data.serviceId)
    .eq('salon_id', session.salonId);

  revalidatePath(parsed.data.path);
}

const serviceDeleteSchema = z.object({
  serviceId: z.string().uuid(),
  path: z.string().min(1)
});

export async function deleteServiceAction(formData: FormData) {
  const parsed = serviceDeleteSchema.safeParse({
    serviceId: formData.get('serviceId'),
    path: formData.get('path')
  });
  if (!parsed.success) return;

  const session = await requireSalonAdminSession();
  if (!session) return;
  const supabase = createServerSupabaseClient();
  if (!supabase) return;

  await supabase
    .from('services')
    .delete()
    .eq('id', parsed.data.serviceId)
    .eq('salon_id', session.salonId);

  revalidatePath(parsed.data.path);
}

const serviceAssignmentsSchema = z.object({
  serviceId: z.string().uuid(),
  path: z.string().min(1)
});

export async function saveServiceAssignmentsAction(formData: FormData) {
  const parsed = serviceAssignmentsSchema.safeParse({
    serviceId: formData.get('serviceId'),
    path: formData.get('path')
  });
  if (!parsed.success) return;

  const session = await requireSalonAdminSession();
  if (!session) return;
  const supabase = createServerSupabaseClient();
  if (!supabase) return;

  const staffIds = formData
    .getAll('staffIds')
    .map((item) => String(item))
    .filter((item) => /^[0-9a-f-]{36}$/i.test(item));

  const current = await supabase
    .from('staff_services')
    .select('staff_id')
    .eq('salon_id', session.salonId)
    .eq('service_id', parsed.data.serviceId);

  if (current.error) return;

  const currentSet = new Set((current.data || []).map((row) => String(row.staff_id)));
  const nextSet = new Set(staffIds);
  const toDelete = Array.from(currentSet).filter((id) => !nextSet.has(id));
  const toInsert = Array.from(nextSet).filter((id) => !currentSet.has(id));

  if (toDelete.length > 0) {
    await supabase
      .from('staff_services')
      .delete()
      .eq('salon_id', session.salonId)
      .eq('service_id', parsed.data.serviceId)
      .in('staff_id', toDelete);
  }

  if (toInsert.length > 0) {
    await supabase.from('staff_services').upsert(
      toInsert.map((staffId) => ({
        salon_id: session.salonId,
        service_id: parsed.data.serviceId,
        staff_id: staffId
      })),
      {onConflict: 'staff_id,service_id'}
    );
  }

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
  if (!session) return;
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

const salonSettingsSchema = z.object({
  bookingMode: z.string().trim().optional(),
  languageDefault: z.string().trim().optional(),
  path: z.string().min(1)
});

export async function updateSalonSettingsAction(formData: FormData) {
  const parsed = salonSettingsSchema.safeParse({
    bookingMode: formData.get('bookingMode'),
    languageDefault: formData.get('languageDefault'),
    path: formData.get('path')
  });
  if (!parsed.success) return;

  const session = await requireSalonAdminSession();
  if (!session) return;
  const supabase = createServerSupabaseClient();
  if (!supabase) return;

  const bookingMode = ['choose_employee', 'auto_assign'].includes(String(parsed.data.bookingMode || ''))
    ? String(parsed.data.bookingMode)
    : null;
  const languageDefault = String(parsed.data.languageDefault || '').trim() || null;

  const patch: Record<string, unknown> = {};
  if (bookingMode) patch.booking_mode = bookingMode;
  if (languageDefault) patch.language_default = languageDefault;
  if (Object.keys(patch).length === 0) return;

  let res = await supabase.from('salons').update(patch).eq('id', session.salonId);
  if (res.error && missingColumn(res.error, 'booking_mode')) {
    delete patch.booking_mode;
    if (Object.keys(patch).length === 0) {
      revalidatePath(parsed.data.path);
      return;
    }
    res = await supabase.from('salons').update(patch).eq('id', session.salonId);
  }
  if (res.error && missingColumn(res.error, 'language_default')) {
    delete patch.language_default;
    if (Object.keys(patch).length === 0) {
      revalidatePath(parsed.data.path);
      return;
    }
    res = await supabase.from('salons').update(patch).eq('id', session.salonId);
  }
  if (res.error) return;

  revalidatePath(parsed.data.path);
}

const superadminActionSchema = z.object({
  salonId: z.string().uuid(),
  action: z.enum([
    'approve_trial',
    'suspend',
    'resume',
    'toggle_visibility',
    'reject',
    'toggle_setup_paid',
    'extend_trial',
    'force_status',
    'toggle_override',
    'delete'
  ]),
  path: z.string().min(1),
  isPublic: z.enum(['true', 'false']).optional(),
  setupPaid: z.enum(['true', 'false']).optional(),
  days: z.coerce.number().int().min(1).max(90).optional(),
  status: z.string().trim().optional(),
  overrideUntil: z.string().trim().optional()
});

export async function superadminSalonAction(formData: FormData) {
  const parsed = superadminActionSchema.safeParse({
    salonId: formData.get('salonId'),
    action: formData.get('action'),
    path: formData.get('path'),
    isPublic: formData.get('isPublic'),
    setupPaid: formData.get('setupPaid'),
    days: formData.get('days'),
    status: formData.get('status'),
    overrideUntil: formData.get('overrideUntil')
  });
  if (!parsed.success) return;

  const session = await requireSuperadminSession();
  if (!session) return;
  const supabase = createServerSupabaseClient();
  if (!supabase) return;

  const nowIso = new Date().toISOString();
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 7);
  const allowedStatuses = new Set([
    'draft',
    'pending_approval',
    'pending_billing',
    'trialing',
    'active',
    'past_due',
    'suspended',
    'rejected'
  ]);

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

  if (parsed.data.action === 'reject') {
    patch = {
      status: 'rejected',
      subscription_status: 'canceled',
      billing_status: 'canceled',
      is_active: false,
      is_listed: false,
      updated_at: nowIso
    };
  }

  if (parsed.data.action === 'toggle_setup_paid') {
    const nextSetupPaid = parsed.data.setupPaid === 'true';
    patch = {
      setup_paid: nextSetupPaid,
      updated_at: nowIso
    };
  }

  if (parsed.data.action === 'extend_trial') {
    const days = Number(parsed.data.days || 7);
    const nextTrialEnd = new Date();
    nextTrialEnd.setDate(nextTrialEnd.getDate() + days);
    patch = {
      status: 'trialing',
      subscription_status: 'trialing',
      billing_status: 'trialing',
      trial_end_at: nextTrialEnd.toISOString(),
      trial_end: nextTrialEnd.toISOString(),
      is_active: true,
      suspended_reason: null,
      updated_at: nowIso
    };
  }

  if (parsed.data.action === 'force_status') {
    const nextStatus = String(parsed.data.status || 'draft');
    if (!allowedStatuses.has(nextStatus)) return;
    const billingMap: Record<string, string> = {
      trialing: 'trialing',
      active: 'active',
      past_due: 'past_due',
      suspended: 'suspended',
      rejected: 'canceled'
    };
    const nextBilling = billingMap[nextStatus] || 'inactive';
    patch = {
      status: nextStatus,
      subscription_status: nextBilling,
      billing_status: nextBilling,
      is_active: !['suspended', 'rejected'].includes(nextStatus),
      suspended_reason: nextStatus === 'suspended' ? 'Suspended by superadmin' : null,
      updated_at: nowIso
    };
  }

  if (parsed.data.action === 'toggle_override') {
    const nextUntil = String(parsed.data.overrideUntil || '').trim() || null;
    patch = {
      manual_override_until: nextUntil,
      updated_at: nowIso
    };
  }

  if (parsed.data.action === 'delete') {
    const rpcDelete = await supabase.rpc('admin_delete_salon', {
      p_admin_code: getSuperadminCode(),
      p_salon_id: parsed.data.salonId
    });

    if (rpcDelete.error) {
      const directDelete = await supabase.from('salons').delete().eq('id', parsed.data.salonId);
      if (directDelete.error) throw directDelete.error;
    }

    revalidatePath(parsed.data.path);
    return;
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

    if (res.error && missingColumn(res.error, 'setup_paid') && 'setup_paid' in nextPatch) {
      delete nextPatch.setup_paid;
      res = await supabase.from('salons').update(nextPatch).eq('id', parsed.data.salonId);
    }

    if (res.error && missingColumn(res.error, 'manual_override_until') && 'manual_override_until' in nextPatch) {
      delete nextPatch.manual_override_until;
      res = await supabase.from('salons').update(nextPatch).eq('id', parsed.data.salonId);
    }

    if (res.error && missingColumn(res.error, 'trial_end_at') && 'trial_end_at' in nextPatch) {
      nextPatch.trial_end = nextPatch.trial_end_at;
      delete nextPatch.trial_end_at;
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

const superadminCreateInviteSchema = z.object({
  countryCode: z.string().trim().min(2).max(3),
  maxUses: z.coerce.number().int().min(1).max(1000).default(1),
  expiresAt: z.string().trim().optional(),
  path: z.string().min(1)
});

export async function superadminCreateInviteAction(formData: FormData) {
  const parsed = superadminCreateInviteSchema.safeParse({
    countryCode: formData.get('countryCode'),
    maxUses: formData.get('maxUses'),
    expiresAt: formData.get('expiresAt'),
    path: formData.get('path')
  });
  if (!parsed.success) return;

  const session = await requireSuperadminSession();
  if (!session) return;
  const supabase = createServerSupabaseClient();
  if (!supabase) return;

  let expiresIso: string | null = null;
  const rawExpires = String(parsed.data.expiresAt || '').trim();
  if (rawExpires) {
    const parsedDate = new Date(rawExpires);
    if (!Number.isNaN(parsedDate.getTime())) {
      expiresIso = parsedDate.toISOString();
    }
  }

  await supabase.rpc('superadmin_create_invite', {
    p_admin_code: getSuperadminCode(),
    p_country_code: parsed.data.countryCode.toUpperCase(),
    p_expires_at: expiresIso,
    p_max_uses: parsed.data.maxUses
  });

  revalidatePath(parsed.data.path);
}

const superadminRevokeInviteSchema = z.object({
  inviteId: z.string().uuid(),
  path: z.string().min(1)
});

export async function superadminRevokeInviteAction(formData: FormData) {
  const parsed = superadminRevokeInviteSchema.safeParse({
    inviteId: formData.get('inviteId'),
    path: formData.get('path')
  });
  if (!parsed.success) return;

  const session = await requireSuperadminSession();
  if (!session) return;
  const supabase = createServerSupabaseClient();
  if (!supabase) return;

  await supabase.rpc('superadmin_revoke_invite', {
    p_admin_code: getSuperadminCode(),
    p_invite_id: parsed.data.inviteId
  });

  revalidatePath(parsed.data.path);
}

const superadminCreateSalonSchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().min(2),
  area: z.string().trim().min(2),
  whatsapp: z.string().trim().optional(),
  adminPasscode: z.string().trim().min(3),
  countryCode: z.string().trim().min(2).max(3),
  seedDefaults: z.boolean().default(true),
  path: z.string().min(1)
});

const DEFAULT_HOURS = [
  {day_of_week: 0, open_time: '10:00', close_time: '20:00', is_closed: false},
  {day_of_week: 1, open_time: '10:00', close_time: '20:00', is_closed: false},
  {day_of_week: 2, open_time: '10:00', close_time: '20:00', is_closed: false},
  {day_of_week: 3, open_time: '10:00', close_time: '20:00', is_closed: false},
  {day_of_week: 4, open_time: '10:00', close_time: '20:00', is_closed: false},
  {day_of_week: 5, open_time: '10:00', close_time: '20:00', is_closed: false},
  {day_of_week: 6, open_time: '10:00', close_time: '20:00', is_closed: false}
] as const;

const DEFAULT_STAFF = [
  {name: 'Sara', sort_order: 10},
  {name: 'Noor', sort_order: 20},
  {name: 'Maryam', sort_order: 30}
] as const;

const DEFAULT_SERVICES = [
  {name: 'Haircut', duration_minutes: 45, price: 20, sort_order: 10},
  {name: 'Hair coloring', duration_minutes: 120, price: 55, sort_order: 20},
  {name: 'Blow dry', duration_minutes: 45, price: 18, sort_order: 30}
] as const;

function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

async function seedSalonDefaults(supabase: ReturnType<typeof createServerSupabaseClient>, salonId: string) {
  if (!supabase) return;

  await supabase.from('salon_hours').upsert(
    DEFAULT_HOURS.map((row) => ({
      salon_id: salonId,
      day_of_week: row.day_of_week,
      open_time: `${row.open_time}:00`,
      close_time: `${row.close_time}:00`,
      is_closed: row.is_closed
    })),
    {onConflict: 'salon_id,day_of_week'}
  );

  const staffRes = await supabase
    .from('staff')
    .insert(DEFAULT_STAFF.map((row) => ({salon_id: salonId, name: row.name, sort_order: row.sort_order, is_active: true})))
    .select('id');
  if (staffRes.error) return;

  const servicesRes = await supabase
    .from('services')
    .insert(
      DEFAULT_SERVICES.map((row) => ({
        salon_id: salonId,
        name: row.name,
        duration_minutes: row.duration_minutes,
        price: row.price,
        sort_order: row.sort_order,
        is_active: true
      }))
    )
    .select('id');
  if (servicesRes.error) return;

  const links: Array<{salon_id: string; staff_id: string; service_id: string}> = [];
  for (const staff of staffRes.data || []) {
    for (const service of servicesRes.data || []) {
      links.push({salon_id: salonId, staff_id: staff.id, service_id: service.id});
    }
  }

  if (links.length > 0) {
    await supabase.from('staff_services').upsert(links, {onConflict: 'staff_id,service_id'});
  }
}

export async function superadminCreateSalonAction(formData: FormData) {
  const parsed = superadminCreateSalonSchema.safeParse({
    name: formData.get('name'),
    slug: normalizeSlug(String(formData.get('slug') || formData.get('name') || '')),
    area: formData.get('area'),
    whatsapp: formData.get('whatsapp'),
    adminPasscode: formData.get('adminPasscode'),
    countryCode: String(formData.get('countryCode') || 'IQ').toUpperCase(),
    seedDefaults: parseCheckbox(formData.get('seedDefaults')),
    path: formData.get('path')
  });
  if (!parsed.success) return;

  const session = await requireSuperadminSession();
  if (!session) return;
  const supabase = createServerSupabaseClient();
  if (!supabase) return;

  const payload = {
    name: parsed.data.name,
    slug: parsed.data.slug,
    area: parsed.data.area,
    whatsapp: parsed.data.whatsapp || null,
    admin_passcode: parsed.data.adminPasscode,
    country_code: parsed.data.countryCode,
    setup_required: true,
    setup_paid: false,
    status: 'pending_approval',
    subscription_status: 'inactive',
    billing_status: 'inactive',
    trial_end_at: null,
    trial_end: null,
    is_active: true,
    is_listed: false,
    is_public: false
  };

  let insertRes = await supabase.from('salons').insert(payload).select('id').single();
  if (insertRes.error && missingColumn(insertRes.error, 'is_public')) {
    const {is_public: _omitIsPublic, ...fallbackPayload} = payload;
    insertRes = await supabase.from('salons').insert(fallbackPayload).select('id').single();
  }

  if (insertRes.error && missingColumn(insertRes.error, 'subscription_status')) {
    const {
      is_public: _omitIsPublic,
      subscription_status: _omitSubscriptionStatus,
      billing_status: _omitBillingStatus,
      trial_end_at: _omitTrialEndAt,
      ...legacyPayload
    } = payload;
    insertRes = await supabase
      .from('salons')
      .insert({...legacyPayload, trial_end: null})
      .select('id')
      .single();
  }

  if (insertRes.error || !insertRes.data?.id) return;
  if (parsed.data.seedDefaults) {
    await seedSalonDefaults(supabase, insertRes.data.id);
  }

  revalidatePath(parsed.data.path);
}

const superadminUpdateSalonInfoSchema = z.object({
  salonId: z.string().uuid(),
  name: z.string().trim().min(2),
  slug: z.string().trim().min(2),
  area: z.string().trim().min(2),
  whatsapp: z.string().trim().optional(),
  countryCode: z.string().trim().min(2).max(3),
  path: z.string().min(1)
});

export async function superadminUpdateSalonInfoAction(formData: FormData) {
  const parsed = superadminUpdateSalonInfoSchema.safeParse({
    salonId: formData.get('salonId'),
    name: formData.get('name'),
    slug: normalizeSlug(String(formData.get('slug') || '')),
    area: formData.get('area'),
    whatsapp: formData.get('whatsapp'),
    countryCode: String(formData.get('countryCode') || 'IQ').toUpperCase(),
    path: formData.get('path')
  });
  if (!parsed.success) return;

  const session = await requireSuperadminSession();
  if (!session) return;
  const supabase = createServerSupabaseClient();
  if (!supabase) return;

  await supabase
    .from('salons')
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      area: parsed.data.area,
      whatsapp: parsed.data.whatsapp || null,
      country_code: parsed.data.countryCode
    })
    .eq('id', parsed.data.salonId);

  revalidatePath(parsed.data.path);
}

const superadminUpdatePasscodeSchema = z.object({
  salonId: z.string().uuid(),
  passcode: z.string().trim().min(3),
  path: z.string().min(1)
});

export async function superadminUpdateSalonPasscodeAction(formData: FormData) {
  const parsed = superadminUpdatePasscodeSchema.safeParse({
    salonId: formData.get('salonId'),
    passcode: formData.get('passcode'),
    path: formData.get('path')
  });
  if (!parsed.success) return;

  const session = await requireSuperadminSession();
  if (!session) return;
  const supabase = createServerSupabaseClient();
  if (!supabase) return;

  await supabase
    .from('salons')
    .update({admin_passcode: parsed.data.passcode})
    .eq('id', parsed.data.salonId);

  revalidatePath(parsed.data.path);
}

const superadminCountryConfigSchema = z.object({
  countryCode: z.string().trim().min(2).max(3),
  stripePriceIdBasic: z.string().trim().optional(),
  stripePriceIdPro: z.string().trim().optional(),
  trialDaysDefault: z.coerce.number().int().min(0).max(365).default(7),
  vatPercent: z.coerce.number().min(0).max(100).default(0),
  isEnabled: z.boolean().default(true),
  isPublic: z.boolean().default(false),
  requiresManualBilling: z.boolean().default(false),
  path: z.string().min(1)
});

export async function superadminUpdateCountryConfigAction(formData: FormData) {
  const parsed = superadminCountryConfigSchema.safeParse({
    countryCode: String(formData.get('countryCode') || '').toUpperCase(),
    stripePriceIdBasic: formData.get('stripePriceIdBasic'),
    stripePriceIdPro: formData.get('stripePriceIdPro'),
    trialDaysDefault: formData.get('trialDaysDefault'),
    vatPercent: formData.get('vatPercent'),
    isEnabled: parseCheckbox(formData.get('isEnabled')),
    isPublic: parseCheckbox(formData.get('isPublic')),
    requiresManualBilling: parseCheckbox(formData.get('requiresManualBilling')),
    path: formData.get('path')
  });
  if (!parsed.success) return;

  const session = await requireSuperadminSession();
  if (!session) return;
  const supabase = createServerSupabaseClient();
  if (!supabase) return;

  const res = await supabase
    .from('countries')
    .update({
      stripe_price_id_basic: parsed.data.stripePriceIdBasic || null,
      stripe_price_id_pro: parsed.data.stripePriceIdPro || null,
      trial_days_default: parsed.data.trialDaysDefault,
      vat_percent: parsed.data.vatPercent,
      is_enabled: parsed.data.isEnabled,
      is_public: parsed.data.isPublic,
      requires_manual_billing: parsed.data.requiresManualBilling
    })
    .eq('code', parsed.data.countryCode);

  if (res.error) return;
  revalidatePath(parsed.data.path);
}
