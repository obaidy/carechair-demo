import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button, SelectInput, TextInput } from "../ui";

function toLocalInputValue(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function BookingDrawer({
  open,
  mode = "edit",
  initialData,
  employees,
  services,
  writeLocked,
  t,
  onClose,
  onSave,
  onDelete,
}) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next = {
      id: initialData?.id || "",
      customer_name: initialData?.customer_name || "",
      customer_phone: initialData?.customer_phone || "",
      service_id: initialData?.service_id || services?.[0]?.id || "",
      employee_id: initialData?.employee_id || initialData?.staff_id || employees?.[0]?.id || "",
      status: initialData?.status || "pending",
      startInput: toLocalInputValue(initialData?.start || initialData?.appointment_start),
      duration: String(initialData?.duration || 30),
      notes: initialData?.notes || "",
    };
    setForm(next);
  }, [open, initialData, employees, services]);

  useEffect(() => {
    if (!open) return undefined;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  const drawerSide = typeof document !== "undefined" && document?.documentElement?.dir === "rtl" ? "right" : "left";

  const selectedService = useMemo(
    () => (services || []).find((x) => String(x.id) === String(form?.service_id)),
    [services, form?.service_id]
  );

  useEffect(() => {
    if (!form || !selectedService || mode !== "create") return;
    setForm((prev) => ({ ...prev, duration: String(selectedService.duration_minutes || prev.duration || 30) }));
  }, [selectedService, mode]);

  if (!open || !form) return null;

  const save = async () => {
    const start = fromLocalInputValue(form.startInput);
    const duration = Number(form.duration || 30);
    if (!start || !Number.isFinite(duration) || duration <= 0) return;

    const end = new Date(start);
    end.setMinutes(end.getMinutes() + duration);

    const payload = {
      id: form.id,
      customer_name: form.customer_name.trim(),
      customer_phone: form.customer_phone.trim(),
      service_id: form.service_id,
      employee_id: form.employee_id,
      status: form.status,
      start,
      end,
      notes: form.notes.trim(),
      duration,
    };

    setSaving(true);
    try {
      await onSave?.(payload);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <>
      <div className="calendar-drawer-backdrop" onClick={onClose} />
      <aside className={`calendar-drawer ${drawerSide === "right" ? "from-right" : "from-left"}`} role="dialog" aria-modal="true">
        <div className="calendar-drawer-head">
          <h3>{mode === "create" ? t("calendar.drawer.create", "Create booking") : t("calendar.drawer.edit", "Edit booking")}</h3>
          <button type="button" className="calendar-drawer-close" onClick={onClose} aria-label={t("common.cancel", "Cancel")}>✕</button>
        </div>

        <div className="calendar-drawer-body">
          <TextInput
            label={t("calendar.fields.customerName", "Customer name")}
            value={form.customer_name}
            onChange={(e) => setForm((p) => ({ ...p, customer_name: e.target.value }))}
            disabled={writeLocked || saving}
          />
          <TextInput
            label={t("calendar.fields.customerPhone", "Customer phone")}
            value={form.customer_phone}
            onChange={(e) => setForm((p) => ({ ...p, customer_phone: e.target.value }))}
            disabled={writeLocked || saving}
          />
          <SelectInput
            label={t("calendar.fields.service", "Service")}
            value={form.service_id}
            onChange={(e) => setForm((p) => ({ ...p, service_id: e.target.value }))}
            disabled={writeLocked || saving}
          >
            {(services || []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </SelectInput>

          <SelectInput
            label={t("calendar.fields.employee", "Employee")}
            value={form.employee_id}
            onChange={(e) => setForm((p) => ({ ...p, employee_id: e.target.value }))}
            disabled={writeLocked || saving}
          >
            {(employees || []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </SelectInput>

          <label className="field">
            <span>{t("calendar.fields.startTime", "Start time")}</span>
            <input
              className="input"
              type="datetime-local"
              value={form.startInput}
              onChange={(e) => setForm((p) => ({ ...p, startInput: e.target.value }))}
              disabled={writeLocked || saving}
            />
          </label>

          <TextInput
            label={t("calendar.fields.duration", "Duration (minutes)")}
            type="number"
            value={form.duration}
            onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))}
            disabled={writeLocked || saving}
          />

          <SelectInput
            label={t("calendar.fields.status", "Status")}
            value={form.status}
            onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
            disabled={writeLocked || saving}
          >
            <option value="pending">{t("booking.status.pending", "Pending")}</option>
            <option value="confirmed">{t("booking.status.confirmed", "Confirmed")}</option>
            <option value="cancelled">{t("booking.status.cancelled", "Cancelled")}</option>
            <option value="no_show">{t("calendar.status.no_show", "No-show")}</option>
          </SelectInput>

          <label className="field">
            <span>{t("calendar.fields.notes", "Notes")}</span>
            <textarea
              className="input textarea"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              disabled={writeLocked || saving}
            />
          </label>
        </div>

        <div className="calendar-drawer-actions">
          {mode === "edit" ? (
            <Button
              type="button"
              variant="danger"
              onClick={() => onDelete?.(form)}
              disabled={writeLocked || saving}
            >
              {t("calendar.actions.delete", "Delete")}
            </Button>
          ) : null}
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="button" onClick={save} disabled={writeLocked || saving}>
            {saving ? t("common.processing", "Processing...") : t("common.save", "Save")}
          </Button>
        </div>
      </aside>
    </>,
    document.body
  );
}
