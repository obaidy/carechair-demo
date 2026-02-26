import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {api} from './index';
import {qk} from './queryKeys';
import type {
  BlockTimeInput,
  Booking,
  BookingStatus,
  CreateBookingInput,
  CreateClientInput,
  CreateSalonInput,
  RequestActivationInput,
  RescheduleBookingInput,
  UpsertServiceInput,
  UpsertStaffInput
} from '../types/models';

export function useOwnerContext() {
  return useQuery({queryKey: qk.ownerContext, queryFn: () => api.owner.getContext()});
}

export function useDashboardSummary(dateIso: string) {
  return useQuery({queryKey: qk.dashboardSummary(dateIso), queryFn: () => api.dashboard.getSummary(dateIso)});
}

export function useEvents(limit = 10) {
  return useQuery({queryKey: qk.events, queryFn: () => api.dashboard.listEvents(limit)});
}

export function useBookings(dateIso: string, mode: 'day' | 'week' | 'list', staffId?: string) {
  return useQuery({queryKey: qk.bookings(dateIso, mode, staffId), queryFn: () => api.bookings.list({date: dateIso, mode, staffId})});
}

export function useClients(query?: string) {
  return useQuery({queryKey: qk.clients(query), queryFn: () => api.clients.list(query)});
}

export function useClientHistory(clientId?: string) {
  return useQuery({
    queryKey: qk.clientHistory(clientId),
    queryFn: () => api.clients.history(String(clientId)),
    enabled: Boolean(clientId)
  });
}

export function useStaff() {
  return useQuery({queryKey: qk.staff, queryFn: () => api.staff.list()});
}

export function useServices() {
  return useQuery({queryKey: qk.services, queryFn: () => api.services.list()});
}

export function useReminders() {
  return useQuery({queryKey: qk.reminders, queryFn: () => api.reminders.list()});
}

export function useCreateSalon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSalonInput) => api.owner.createOrClaimSalon(input),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: qk.ownerContext});
    }
  });
}

export function useRequestActivation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RequestActivationInput) => api.owner.requestActivation(input),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: qk.ownerContext});
    }
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateClientInput) => api.clients.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: qk.clients()});
    }
  });
}

export function useUpsertStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertStaffInput) => api.staff.upsert(input),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: qk.staff});
      queryClient.invalidateQueries({queryKey: qk.services});
    }
  });
}

export function useUpsertService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertServiceInput) => api.services.upsert(input),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: qk.services});
      queryClient.invalidateQueries({queryKey: qk.staff});
    }
  });
}

export function useCreateBooking(dateIso: string, mode: 'day' | 'week' | 'list', staffId?: string) {
  const queryClient = useQueryClient();
  const key = qk.bookings(dateIso, mode, staffId);

  return useMutation({
    mutationFn: (input: CreateBookingInput) => api.bookings.create(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({queryKey: key});
      const previous = queryClient.getQueryData<Booking[]>(key) || [];
      const optimistic: Booking = {
        id: `tmp_${Date.now()}`,
        salonId: 'optimistic',
        clientId: input.clientId || null,
        clientName: input.clientName,
        clientPhone: input.clientPhone,
        serviceId: input.serviceId,
        staffId: input.staffId,
        startAt: input.startAt,
        endAt: input.endAt,
        status: input.status || 'confirmed',
        notes: input.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      queryClient.setQueryData<Booking[]>(key, [...previous, optimistic].sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt)));
      return {previous};
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: key});
      queryClient.invalidateQueries({queryKey: qk.events});
      queryClient.invalidateQueries({queryKey: qk.dashboardSummary(dateIso)});
      queryClient.invalidateQueries({queryKey: qk.clients()});
    }
  });
}

export function useUpdateBookingStatus(dateIso: string, mode: 'day' | 'week' | 'list', staffId?: string) {
  const queryClient = useQueryClient();
  const key = qk.bookings(dateIso, mode, staffId);

  return useMutation({
    mutationFn: (payload: {bookingId: string; status: BookingStatus}) => api.bookings.updateStatus(payload.bookingId, payload.status),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({queryKey: key});
      const previous = queryClient.getQueryData<Booking[]>(key) || [];
      queryClient.setQueryData<Booking[]>(
        key,
        previous.map((row) =>
          row.id === payload.bookingId
            ? {
                ...row,
                status: payload.status,
                updatedAt: new Date().toISOString()
              }
            : row
        )
      );
      return {previous};
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: key});
      queryClient.invalidateQueries({queryKey: qk.events});
      queryClient.invalidateQueries({queryKey: qk.dashboardSummary(dateIso)});
    }
  });
}

export function useRescheduleBooking(dateIso: string, mode: 'day' | 'week' | 'list', staffId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RescheduleBookingInput) => api.bookings.reschedule(input),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: qk.bookings(dateIso, mode, staffId)});
      queryClient.invalidateQueries({queryKey: qk.events});
    }
  });
}

export function useBlockTime(dateIso: string, mode: 'day' | 'week' | 'list', staffId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BlockTimeInput) => api.bookings.blockTime(input),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: qk.bookings(dateIso, mode, staffId)});
      queryClient.invalidateQueries({queryKey: qk.events});
    }
  });
}

export function useUpdateReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {reminderId: string; enabled: boolean}) => api.reminders.update(payload.reminderId, payload.enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: qk.reminders});
    }
  });
}
