import React from "react";
import { Button, SelectInput } from "../ui";

export default function CalendarToolbar({
  label,
  onNavigate,
  onView,
  view,
  isMobile,
  t,
  filters,
  employees,
  services,
  setFilter,
}) {
  return (
    <div className="calendar-toolbar">
      <div className="calendar-toolbar-top">
        <div className="calendar-nav-actions">
          <Button type="button" variant="ghost" onClick={() => onNavigate("TODAY")}>
            {t("calendar.toolbar.today", "Today")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => onNavigate("PREV")}>
            {t("calendar.toolbar.prev", "Prev")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => onNavigate("NEXT")}>
            {t("calendar.toolbar.next", "Next")}
          </Button>
        </div>

        <div className="calendar-range-label">{label}</div>

        <div className="calendar-view-actions">
          <Button type="button" variant={view === "day" ? "primary" : "ghost"} onClick={() => onView("day")}>
            {t("calendar.views.day", "Day")}
          </Button>
          <Button type="button" variant={view === "week" ? "primary" : "ghost"} onClick={() => onView("week")}>
            {t("calendar.views.week", "Week")}
          </Button>
          <Button type="button" variant={view === "agenda" ? "primary" : "ghost"} onClick={() => onView("agenda")}>
            {t("calendar.views.agenda", "Agenda")}
          </Button>
        </div>
      </div>

      <div className="calendar-toolbar-filters">
        {isMobile ? (
          <SelectInput
            label={t("calendar.filters.employee", "Employee")}
            value={filters.employeeSingle}
            onChange={(e) => setFilter("employeeSingle", e.target.value)}
          >
            <option value="all">{t("calendar.filters.allEmployees", "All employees")}</option>
            {(employees || []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </SelectInput>
        ) : (
          <label className="field">
            <span>{t("calendar.filters.employees", "Employees")}</span>
            <select
              multiple
              className="input"
              value={filters.employeeIds}
              onChange={(e) => {
                const vals = Array.from(e.target.selectedOptions).map((x) => x.value);
                setFilter("employeeIds", vals);
              }}
            >
              {(employees || []).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <SelectInput
          label={t("calendar.filters.status", "Status")}
          value={filters.status}
          onChange={(e) => setFilter("status", e.target.value)}
        >
          <option value="all">{t("calendar.filters.all", "All")}</option>
          <option value="pending">{t("booking.status.pending", "Pending")}</option>
          <option value="confirmed">{t("booking.status.confirmed", "Confirmed")}</option>
          <option value="cancelled">{t("booking.status.cancelled", "Cancelled")}</option>
          <option value="no_show">{t("calendar.status.no_show", "No-show")}</option>
        </SelectInput>

        <SelectInput
          label={t("calendar.filters.service", "Service")}
          value={filters.serviceId}
          onChange={(e) => setFilter("serviceId", e.target.value)}
        >
          <option value="all">{t("calendar.filters.allServices", "All services")}</option>
          {(services || []).map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </SelectInput>
      </div>
    </div>
  );
}
