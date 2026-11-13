import type { PackageResponse } from '@bh/shared/holiday-package';
import type { ChangeRequest, FlightDirection } from '@bh/shared/package-change';
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { packageKey } from '@/features/holiday-packages/hooks';
import { applyChange, fetchFlightChoices, fetchHotelChoices } from './api';

/** The choices sit under the package's key: they describe that package as it is now. */
function choicesKey(packageId: string) {
  return [...packageKey(packageId), 'choices'];
}

/** Every change to one package shares this key, so the page knows while one is on its way. */
function changeKey(packageId: string) {
  return [...packageKey(packageId), 'change'];
}

export function useHotelChoices(packageId: string, city: string) {
  return useQuery({
    queryKey: [...choicesKey(packageId), 'hotel', city],
    queryFn: () => fetchHotelChoices(packageId, city),
  });
}

export function useFlightChoices(packageId: string, direction: FlightDirection) {
  return useQuery({
    queryKey: [...choicesKey(packageId), 'flight', direction],
    queryFn: () => fetchFlightChoices(packageId, direction),
  });
}

export function useApplyChange(packageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: changeKey(packageId),
    mutationFn: (change: ChangeRequest) => applyChange(packageId, change),
    onSuccess: ({ data }) => {
      if (data.result !== 'APPLIED') return;
      // The saved package comes back with the answer, so the page shows it at once.
      queryClient.setQueryData<PackageResponse>(packageKey(packageId), { data: data.package });
      // Every preview was worked out against the old package. Drop them rather than show stale totals.
      queryClient.removeQueries({ queryKey: choicesKey(packageId) });
    },
  });
}

/** True while a change to this package is being applied. */
export function useChangePending(packageId: string) {
  return useIsMutating({ mutationKey: changeKey(packageId) }) > 0;
}
