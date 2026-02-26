'use client';

import {useEffect, useMemo, useState} from 'react';
import {createPortal} from 'react-dom';
import {Button, SelectInput, TextInput} from '@/components/ui';

type StaffRow = {id: string; name: string};
type ServiceRow = {id: string; name: string; duration_minutes?: number | null};
type StaffServiceRow = {staff_id: string | null; service_id: string | null};
type DraftInput = {
  id?: string;
  customer_name?: string;
  customer_phone?: string;
  service_id?: string;
  employee_id?: string;
  staff_id?: string;
  status?: string;
  notes?: string;
  start?: Date | string;
  appointment_start?: Date | string;
  end?: Date | string;
  appointment_end?: Date | string;
  duration?: number;
};

type DraftForSave = {
  id: string;
  customer_name: string;
  customer_phone: string;
  service_id: string;
  employee_id: string;
  status: string;
  start: Date;
  end: Date;
  notes: string;
  duration: number;
};

function toLocalInputValue(date: Date | string | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function BookingDrawer({
  open,
  mode = 'edit',
  initialData,
  employees,
  services,
  staffServices = [],
  writeLocked,
  t,
  onClose,
  onSave,
  onDelete
}: {
  open: boolean;
  mode?: 'create' | 'edit';
  initialData: DraftInput | null;
  employees: StaffRow[];
  services: ServiceRow[];
  staffServices?: StaffServiceRow[];
  writeLocked: boolean;
  t: (key: string, fallback: string) => string;
  onClose: () => void;
  onSave: (draft: DraftForSave) => Promise<void>;
  onDelete: (draft: DraftForSave) => Promise<void>;
}) {
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    id: string;
    customer_name: string;
    customer_phone: string;
    service_id: string;
    employee_id: string;
    status: string;
    startInput: string;
    duration: string;
    notes: string;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const next = {
      id: String(initialData?.id || ''),
      customer_name: String(initialData?.customer_name || ''),
      customer_phone: String(initialData?.customer_phone || ''),
      service_id: String(initialData?.service_id || services?.[0]?.id || ''),
      employee_id: String(initialData?.employee_id || initialData?.staff_id || employees?.[0]?.id || ''),
      status: String(initialData?.status || 'pending'),
      startInput: toLocalInputValue(initialData?.start || initialData?.appointment_start),
      duration: String(initialData?.duration || 30),
      notes: String(initialData?.notes || '')
    };
    setForm(next);
  }, [open, initialData, employees, services]);

  useEffect(() => {
    if (!open || !mounted) return undefined;
    const original = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open, mounted]);

  const direction =
    typeof document !== 'undefined'
      ? document.querySelector('.locale-shell')?.getAttribute('dir') || document.documentElement.getAttribute('dir') || 'ltr'
      : 'ltr';
  const drawerSide = direction === 'rtl' ? 'right' : 'left';

  const selectedService = useMemo(
    () => (services || []).find((row) => String(row.id) === String(form?.service_id)),
    [services, form?.service_id]
  );

  const hasAssignments = useMemo(() => {
    return (staffServices || []).some((row) => String(row.staff_id || '') && String(row.service_id || ''));
  }, [staffServices]);

  const assignmentSet = useMemo(() => {
    return new Set(
      (staffServices || [])
        .map((row) => {
          const staffId = String(row.staff_id || '');
          const serviceId = String(row.service_id || '');
          if (!staffId || !serviceId) return '';
          return `${staffId}:${serviceId}`;
        })
        .filter(Boolean)
    );
  }, [staffServices]);

  const availableEmployees = useMemo(() => {
    const currentServiceId = String(form?.service_id || '');
    if (!currentServiceId) return employees || [];
    if (!hasAssignments) return employees || [];
    return (employees || []).filter((row) => assignmentSet.has(`${row.id}:${currentServiceId}`));
  }, [employees, form?.service_id, hasAssignments, assignmentSet]);

  useEffect(() => {
    if (!selectedService || mode !== 'create') return;
    const nextDuration = String(selectedService.duration_minutes || 30);
    setForm((prev) => {
      if (!prev) return prev;
      if (String(prev.duration || '') === nextDuration) return prev;
      return {...prev, duration: nextDuration};
    });
  }, [selectedService?.id, selectedService?.duration_minutes, mode]);

  useEffect(() => {
    if (!form) return;
    const currentEmployeeId = String(form.employee_id || '');
    const nextEmployee = availableEmployees[0]?.id ? String(availableEmployees[0].id) : '';
    const isCurrentValid = availableEmployees.some((row) => String(row.id) === currentEmployeeId);
    const resolved = isCurrentValid ? currentEmployeeId : nextEmployee;

    if (resolved === currentEmployeeId) return;
    setForm((prev) => (prev ? {...prev, employee_id: resolved} : prev));
  }, [availableEmployees, form?.employee_id]);

  if (!mounted || !open || !form) return null;

  async function save() {
    const current = form;
    if (!current) return;
    if (!current.employee_id) return;
    if (hasAssignments && !assignmentSet.has(`${current.employee_id}:${current.service_id}`)) return;

    const start = fromLocalInputValue(current.startInput);
    const duration = Number(current.duration || 30);
    if (!start || !Number.isFinite(duration) || duration <= 0) return;

    const end = new Date(start);
    end.setMinutes(end.getMinutes() + duration);

    const payload: DraftForSave = {
      id: current.id,
      customer_name: current.customer_name.trim(),
      customer_phone: current.customer_phone.trim(),
      service_id: current.service_id,
      employee_id: current.employee_id,
      status: current.status,
      start,
      end,
      notes: current.notes.trim(),
      duration
    };

    setSaving(true);
    try {
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <>
      <div className="calendar-drawer-backdrop" onClick={onClose} />
      <aside className={`calendar-drawer ${drawerSide === 'right' ? 'from-right' : 'from-left'}`} role="dialog" aria-modal="true">
        <div className="calendar-drawer-head">
          <h3>{mode === 'create' ? t('calendar.drawer.create', 'Create booking') : t('calendar.drawer.edit', 'Edit booking')}</h3>
          <button type="button" className="calendar-drawer-close" onClick={onClose} aria-label={t('common.cancel', 'Cancel')}>
            ✕
          </button>
        </div>

        <div className="calendar-drawer-body">
          <TextInput
            label={t('calendar.fields.customerName', 'Customer name')}
            value={form.customer_name}
            onChange={(event) => setForm((prev) => (prev ? {...prev, customer_name: event.target.value} : prev))}
            disabled={writeLocked || saving}
          />

          <TextInput
            label={t('calendar.fields.customerPhone', 'Customer phone')}
            value={form.customer_phone}
            onChange={(event) => setForm((prev) => (prev ? {...prev, customer_phone: event.target.value} : prev))}
            disabled={writeLocked || saving}
          />

          <SelectInput
            label={t('calendar.fields.service', 'Service')}
            value={form.service_id}
            onChange={(event) => setForm((prev) => (prev ? {...prev, service_id: event.target.value} : prev))}
            disabled={writeLocked || saving}
          >
            {(services || []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </SelectInput>

          {availableEmployees.length > 0 ? (
            <SelectInput
              label={t('calendar.fields.employee', 'Employee')}
              value={form.employee_id}
              onChange={(event) => setForm((prev) => (prev ? {...prev, employee_id: event.target.value} : prev))}
              disabled={writeLocked || saving}
            >
              {availableEmployees.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </SelectInput>
          ) : (
            <div className="empty-box">{t('calendar.errors.noAssignedStaff', 'No employees are assigned to this service.')}</div>
          )}

          <label className="field">
            <span>{t('calendar.fields.startTime', 'Start time')}</span>
            <input
              className="input"
              type="datetime-local"
              value={form.startInput}
              onChange={(event) => setForm((prev) => (prev ? {...prev, startInput: event.target.value} : prev))}
              disabled={writeLocked || saving}
            />
          </label>

          <TextInput
            label={t('calendar.fields.duration', 'Duration (minutes)')}
            type="number"
            value={form.duration}
            onChange={(event) => setForm((prev) => (prev ? {...prev, duration: event.target.value} : prev))}
            disabled={writeLocked || saving}
          />

          <SelectInput
            label={t('calendar.fields.status', 'Status')}
            value={form.status}
            onChange={(event) => setForm((prev) => (prev ? {...prev, status: event.target.value} : prev))}
            disabled={writeLocked || saving}
          >
            <option value="pending">{t('booking.status.pending', 'Pending')}</option>
            <option value="confirmed">{t('booking.status.confirmed', 'Confirmed')}</option>
            <option value="cancelled">{t('booking.status.cancelled', 'Cancelled')}</option>
            <option value="no_show">{t('calendar.status.no_show', 'No-show')}</option>
          </SelectInput>

          <label className="field">
            <span>{t('calendar.fields.notes', 'Notes')}</span>
            <textarea
              className="input textarea"
              value={form.notes}
              onChange={(event) => setForm((prev) => (prev ? {...prev, notes: event.target.value} : prev))}
              disabled={writeLocked || saving}
            />
          </label>
        </div>

        <div className="calendar-drawer-actions">
          {mode === 'edit' ? (
            <Button
              type="button"
              variant="danger"
              onClick={() =>
                onDelete({
                  id: form.id,
                  customer_name: form.customer_name,
                  customer_phone: form.customer_phone,
                  service_id: form.service_id,
                  employee_id: form.employee_id,
                  status: form.status,
                  start: fromLocalInputValue(form.startInput) || new Date(),
                  end: fromLocalInputValue(form.startInput) || new Date(),
                  notes: form.notes,
                  duration: Number(form.duration || 30)
                })
              }
              disabled={writeLocked || saving}
            >
              {t('calendar.actions.delete', 'Delete')}
            </Button>
          ) : null}

          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel', 'Cancel')}
          </Button>

          <Button
            type="button"
            onClick={() => void save()}
            disabled={writeLocked || saving || availableEmployees.length === 0 || !form.employee_id}
          >
            {saving ? t('common.processing', 'Processing...') : t('common.save', 'Save')}
          </Button>
        </div>
      </aside>
    </>,
    document.body
  );
}
