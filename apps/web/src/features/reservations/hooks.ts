import type { ReservationResponse } from '@bh/shared/reservation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { packageCheckKey, packageKey } from '@/features/holiday-packages/hooks';
import { ApiError, retryUnlessNotFound } from '@/lib/api-client';
import { confirmPackage, fetchReservation } from './api';

function reservationKey(reference: string) {
  return ['reservations', reference];
}

export function useReservation(reference: string) {
  return useQuery({
    queryKey: reservationKey(reference),
    queryFn: () => fetchReservation(reference),
    // A wrong number won't become right on a second try, so "not found" shows at once.
    retry: retryUnlessNotFound,
  });
}

export function useConfirmPackage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: confirmPackage,
    onSuccess: ({ data }) => {
      // The reservation page opens at once, and the package page shows the number from now on.
      queryClient.setQueryData<ReservationResponse>(reservationKey(data.reference), { data });
      void queryClient.invalidateQueries({ queryKey: packageKey(data.packageId) });
    },
    onError: (error, { packageId }) => {
      // S2: someone else booked the last seats or rooms, so the rules panel now has a broken rule to show.
      if (error instanceof ApiError && error.code === 'SOLD_OUT') {
        void queryClient.invalidateQueries({ queryKey: packageCheckKey(packageId) });
      }
    },
  });
}
