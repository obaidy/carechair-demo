'use client';

import SafeImage from '@/components/SafeImage';
import {Button, SelectInput} from '@/components/ui';

type EmployeeRow = {id: string; name: string; photo_url?: string | null};
type ServiceRow = {id: string; name: string};

function getInitials(name: string) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'SA';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

export default function CalendarToolbar({
  label,
  employeeScopeLabel,
  onNavigate,
  onView,
  view,
  isMobile,
  t,
  filters,
  employees,
  services,
  setFilter
}: {
  label: string;
  employeeScopeLabel: string;
  onNavigate: (action: 'TODAY' | 'PREV' | 'NEXT') => void;
  onView: (view: 'day' | 'week' | 'agenda') => void;
  view: string;
  isMobile: boolean;
  t: (key: string, fallback: string) => string;
  filters: {
    employeeIds: string[];
    employeeSingle: string;
    status: string;
    serviceId: string;
  };
  employees: EmployeeRow[];
  services: ServiceRow[];
  setFilter: (key: 'employeeIds' | 'employeeSingle' | 'status' | 'serviceId', value: string[] | string) => void;
}) {
  const isAllSelected = isMobile ? filters.employeeSingle === 'all' : filters.employeeIds.length === 0;

  return (
    <div className="calendar-toolbar">
      <div className="calendar-toolbar-top">
        <div className="calendar-nav-actions">
          <div className="calendar-nav-stepper">
            <Button
              type="button"
              variant="ghost"
              className="calendar-nav-btn calendar-nav-arrow"
              onClick={() => onNavigate('PREV')}
              aria-label={t('calendar.toolbar.prev', 'Prev')}
            >
              {'<'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="calendar-nav-btn calendar-nav-arrow"
              onClick={() => onNavigate('NEXT')}
              aria-label={t('calendar.toolbar.next', 'Next')}
            >
              {'>'}
            </Button>
          </div>
          <Button type="button" variant="ghost" className="calendar-nav-btn calendar-nav-today" onClick={() => onNavigate('TODAY')}>
            {t('calendar.toolbar.today', 'Today')}
          </Button>
        </div>

        <div className="calendar-range-label-wrap">
          <div className="calendar-range-label">{label}</div>
          <div className="calendar-scope-label">{employeeScopeLabel}</div>
        </div>

        <div className="calendar-view-actions calendar-view-segmented">
          <Button
            type="button"
            className={`calendar-view-btn${view === 'day' ? ' active' : ''}`}
            variant={view === 'day' ? 'primary' : 'ghost'}
            onClick={() => onView('day')}
          >
            {t('calendar.views.day', 'Day')}
          </Button>
          <Button
            type="button"
            className={`calendar-view-btn${view === 'week' ? ' active' : ''}`}
            variant={view === 'week' ? 'primary' : 'ghost'}
            onClick={() => onView('week')}
          >
            {t('calendar.views.week', 'Week')}
          </Button>
          <Button
            type="button"
            className={`calendar-view-btn${view === 'agenda' ? ' active' : ''}`}
            variant={view === 'agenda' ? 'primary' : 'ghost'}
            onClick={() => onView('agenda')}
          >
            {t('calendar.views.agenda', 'Agenda')}
          </Button>
        </div>
      </div>

      <div className="calendar-employee-strip-wrap">
        <span className="calendar-employee-strip-label">{t('calendar.filters.employees', 'Employees')}</span>
        <div className="calendar-employee-strip">
          <button
            type="button"
            className={`calendar-employee-pill${isAllSelected ? ' active' : ''}`}
            onClick={() => {
              if (isMobile) setFilter('employeeSingle', 'all');
              else setFilter('employeeIds', []);
            }}
          >
            <span className="calendar-employee-avatar all">All</span>
            <span className="calendar-employee-name">{t('calendar.filters.all', 'All')}</span>
          </button>

          {(employees || []).map((row) => {
            const active = isMobile
              ? filters.employeeSingle === row.id
              : filters.employeeIds.length === 1 && filters.employeeIds[0] === row.id;

            return (
              <button
                key={row.id}
                type="button"
                className={`calendar-employee-pill${active ? ' active' : ''}`}
                onClick={() => {
                  if (isMobile) setFilter('employeeSingle', row.id);
                  else setFilter('employeeIds', [row.id]);
                }}
              >
                <SafeImage
                  src={row.photo_url || ''}
                  alt={row.name}
                  className="calendar-employee-avatar"
                  fallbackText={getInitials(row.name)}
                />
                <span className="calendar-employee-name">{row.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="calendar-toolbar-filters">
        <SelectInput
          label={t('calendar.filters.status', 'Status')}
          value={filters.status}
          onChange={(event) => setFilter('status', event.target.value)}
        >
          <option value="all">{t('calendar.filters.all', 'All')}</option>
          <option value="pending">{t('booking.status.pending', 'Pending')}</option>
          <option value="confirmed">{t('booking.status.confirmed', 'Confirmed')}</option>
          <option value="cancelled">{t('booking.status.cancelled', 'Cancelled')}</option>
          <option value="no_show">{t('calendar.status.no_show', 'No-show')}</option>
        </SelectInput>

        <SelectInput
          label={t('calendar.filters.service', 'Service')}
          value={filters.serviceId}
          onChange={(event) => setFilter('serviceId', event.target.value)}
        >
          <option value="all">{t('calendar.filters.allServices', 'All services')}</option>
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
