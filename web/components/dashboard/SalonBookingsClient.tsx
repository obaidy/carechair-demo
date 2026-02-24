'use client';

import {useMemo, useState} from 'react';
import {useLocale} from 'next-intl';
import {createBrowserSupabaseClient} from '@/lib/supabase/browser';
import {Button, Card} from '@/components/ui';
import {useTx} from '@/lib/messages-client';

type BookingRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  appointment_start: string;
  appointment_end: string;
  service_id: string | null;
  staff_id: string | null;
};

type ServiceRow = {id: string; name: string};
type StaffRow = {id: string; name: string};

type BookingStatus = 'all' | 'pending' | 'confirmed' | 'cancelled';
type DateFilter = 'all' | 'today' | 'this_week';

function dateKey(iso: string): string {
  return String(iso || '').slice(0, 10);
}

function formatTime(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString(locale, {hour: '2-digit', minute: '2-digit'});
}

export default function SalonBookingsClient({
  salonId,
  initialBookings,
  services,
  staff
}: {
  salonId: string;
  initialBookings: BookingRow[];
  services: ServiceRow[];
  staff: StaffRow[];
}) {
  const locale = useLocale();
  const t = useTx();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [bookings, setBookings] = useState<BookingRow[]>(initialBookings || []);
  const [statusFilter, setStatusFilter] = useState<BookingStatus>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [updating, setUpdating] = useState<Record<string, 'confirmed' | 'cancelled' | null>>({});
  const [error, setError] = useState('');
  const [visibleCount, setVisibleCount] = useState(40);

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const weekStart = new Date(today);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const query = searchText.trim().toLowerCase();

  const serviceById = useMemo(() => Object.fromEntries(services.map((row) => [row.id, row])), [services]);
  const staffById = useMemo(() => Object.fromEntries(staff.map((row) => [row.id, row])), [staff]);

  const filtered = useMemo(
    () =>
      bookings.filter((row) => {
        const status = String(row.status || 'pending');
        const appointment = new Date(row.appointment_start);
        const name = String(row.customer_name || '').toLowerCase();
        const phone = String(row.customer_phone || '').toLowerCase();

        if (statusFilter !== 'all' && status !== statusFilter) return false;
        if (dateFilter === 'today' && dateKey(row.appointment_start) !== todayKey) return false;
        if (dateFilter === 'this_week' && (appointment < weekStart || appointment >= weekEnd)) return false;
        if (query && !name.includes(query) && !phone.includes(query)) return false;

        return true;
      }),
    [bookings, statusFilter, dateFilter, query, todayKey, weekStart, weekEnd]
  );

  const kpis = useMemo(() => {
    const todayCount = bookings.filter((row) => dateKey(row.appointment_start) === todayKey).length;
    const pending = bookings.filter((row) => String(row.status || 'pending') === 'pending').length;
    const confirmed = bookings.filter((row) => String(row.status || 'pending') === 'confirmed').length;
    const cancelled = bookings.filter((row) => String(row.status || 'pending') === 'cancelled').length;
    return {todayCount, pending, confirmed, cancelled};
  }, [bookings, todayKey]);

  const groups = useMemo(() => {
    const map = new Map<string, BookingRow[]>();
    for (const row of filtered) {
      const key = dateKey(row.appointment_start);
      const list = map.get(key) || [];
      list.push(row);
      map.set(key, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, items]) => ({day, items}));
  }, [filtered]);

  const visibleGroups = useMemo(() => {
    let consumed = 0;
    const list: Array<{day: string; items: BookingRow[]}> = [];
    for (const group of groups) {
      if (consumed >= visibleCount) break;
      const remaining = Math.max(0, visibleCount - consumed);
      const slice = group.items.slice(0, remaining);
      if (slice.length > 0) {
        list.push({day: group.day, items: slice});
        consumed += slice.length;
      }
    }
    return list;
  }, [groups, visibleCount]);

  const hasMore = filtered.length > visibleCount;

  async function updateStatus(bookingId: string, nextStatus: 'confirmed' | 'cancelled') {
    if (!supabase || !salonId) return;
    if (updating[bookingId]) return;

    const previous = bookings.find((row) => row.id === bookingId) || null;
    setUpdating((prev) => ({...prev, [bookingId]: nextStatus}));
    setError('');
    setBookings((prev) => prev.map((row) => (row.id === bookingId ? {...row, status: nextStatus} : row)));

    const res = await supabase.from('bookings').update({status: nextStatus}).eq('id', bookingId).eq('salon_id', salonId);
    if (res.error) {
      setBookings((prev) => prev.map((row) => (row.id === bookingId ? (previous || row) : row)));
      setError(`${t('admin.errors.updateBookingStatusFailed', 'Failed to update booking status')}: ${res.error.message}`);
    }
    setUpdating((prev) => ({...prev, [bookingId]: null}));
  }

  return (
    <div className="cc-section">
      <section className="panel hero-lite">
        <h1>{t('dashboard.bookings', 'Bookings')}</h1>
        <p className="muted">{t('dashboard.bookingsHint', 'Recent appointments and status updates.')}</p>
      </section>

      <section className="settings-grid four">
        <Card className="kpi-card">
          <span>{t('admin.kpis.todayBookings', 'Total bookings today')}</span>
          <strong>{kpis.todayCount}</strong>
        </Card>
        <Card className="kpi-card">
          <span>{t('admin.kpis.pending', 'Pending confirmation')}</span>
          <strong>{kpis.pending}</strong>
        </Card>
        <Card className="kpi-card">
          <span>{t('admin.kpis.confirmed', 'Confirmed')}</span>
          <strong>{kpis.confirmed}</strong>
        </Card>
        <Card className="kpi-card">
          <span>{t('admin.kpis.cancelled', 'Cancelled')}</span>
          <strong>{kpis.cancelled}</strong>
        </Card>
      </section>

      <section className="panel">
        <div className="bookings-filters-grid">
          <div className="bookings-filter-group">
            <b>{t('admin.filters.status', 'Status')}</b>
            <div className="tabs-inline">
              <Button type="button" variant={statusFilter === 'all' ? 'primary' : 'ghost'} onClick={() => setStatusFilter('all')}>
                {t('admin.filters.all', 'All')}
              </Button>
              <Button type="button" variant={statusFilter === 'pending' ? 'primary' : 'ghost'} onClick={() => setStatusFilter('pending')}>
                {t('booking.status.pending', 'Pending')}
              </Button>
              <Button type="button" variant={statusFilter === 'confirmed' ? 'primary' : 'ghost'} onClick={() => setStatusFilter('confirmed')}>
                {t('booking.status.confirmed', 'Confirmed')}
              </Button>
              <Button type="button" variant={statusFilter === 'cancelled' ? 'primary' : 'ghost'} onClick={() => setStatusFilter('cancelled')}>
                {t('booking.status.cancelled', 'Cancelled')}
              </Button>
            </div>
          </div>

          <div className="bookings-filter-group">
            <b>{t('admin.filters.date', 'Date')}</b>
            <div className="tabs-inline">
              <Button type="button" variant={dateFilter === 'all' ? 'primary' : 'ghost'} onClick={() => setDateFilter('all')}>
                {t('admin.filters.all', 'All')}
              </Button>
              <Button type="button" variant={dateFilter === 'today' ? 'primary' : 'ghost'} onClick={() => setDateFilter('today')}>
                {t('admin.filters.today', 'Today')}
              </Button>
              <Button type="button" variant={dateFilter === 'this_week' ? 'primary' : 'ghost'} onClick={() => setDateFilter('this_week')}>
                {t('admin.filters.thisWeek', 'This week')}
              </Button>
            </div>
          </div>

          <label className="field full">
            <span>{t('admin.filters.searchByNamePhone', 'Search by name or phone')}</span>
            <input
              className="input"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={t('admin.filters.searchPlaceholder', 'Example: 07xxxxxxxxx')}
            />
          </label>
        </div>
      </section>

      {error ? <p className="muted" style={{color: 'var(--danger)'}}>{error}</p> : null}

      <section className="calendar-list">
        {visibleGroups.length === 0 ? (
          <div className="empty-box">{t('admin.bookings.noFilteredBookings', 'No bookings match current filters.')}</div>
        ) : (
          visibleGroups.map((group) => (
            <section key={group.day} className="date-group">
              <div className="date-header">
                <h5>{new Date(`${group.day}T00:00:00`).toLocaleDateString(locale)}</h5>
                <span>{t('admin.bookings.bookingsCount', '{{count}} bookings', {count: group.items.length})}</span>
              </div>

              <div className="bookings-stack">
                {group.items.map((row) => {
                  const status = String(row.status || 'pending');
                  const target = updating[row.id];
                  return (
                    <article key={row.id} className="booking-card">
                      <div className="booking-top">
                        <div>
                          <h6>{row.customer_name || t('admin.common.customer', 'Customer')}</h6>
                          <p>{row.customer_phone || '-'}</p>
                        </div>
                        <span className={`status-badge status-${status}`}>{status}</span>
                      </div>

                      <div className="booking-info">
                        <p><b>{t('admin.bookings.service', 'Service')}:</b> {serviceById[String(row.service_id || '')]?.name || '-'}</p>
                        <p><b>{t('admin.bookings.employee', 'Employee')}:</b> {staffById[String(row.staff_id || '')]?.name || '-'}</p>
                        <p><b>{t('admin.bookings.time', 'Time')}:</b> {formatTime(row.appointment_start, locale)}</p>
                      </div>

                      {status === 'pending' ? (
                        <div className="booking-actions">
                          <Button type="button" variant="secondary" disabled={Boolean(target)} onClick={() => void updateStatus(row.id, 'confirmed')}>
                            {target === 'confirmed' ? t('admin.bookings.accepting', 'Accepting...') : t('admin.bookings.accept', 'Accept')}
                          </Button>
                          <Button type="button" variant="secondary" disabled={Boolean(target)} onClick={() => void updateStatus(row.id, 'cancelled')}>
                            {target === 'cancelled' ? t('admin.bookings.rejecting', 'Rejecting...') : t('admin.bookings.reject', 'Reject')}
                          </Button>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </section>

      {hasMore ? (
        <div className="row-actions center">
          <Button type="button" variant="ghost" onClick={() => setVisibleCount((prev) => prev + 40)}>
            {t('admin.bookings.loadMore', 'Load more')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
