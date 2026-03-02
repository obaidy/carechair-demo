export const qk = {
  ownerContext: ['owner-context'] as const,
  availability: (dateIso: string) => ['availability', dateIso] as const,
  dashboardSummary: (dateIso: string) => ['dashboard-summary', dateIso] as const,
  events: ['events'] as const,
  bookings: (dateIso: string, mode: string, staffId?: string) => ['bookings', dateIso, mode, staffId || 'all'] as const,
  clients: (query?: string) => ['clients', query || ''] as const,
  clientHistory: (clientId?: string) => ['client-history', clientId || 'none'] as const,
  staff: ['staff'] as const,
  services: ['services'] as const,
  reminders: ['reminders'] as const
};
