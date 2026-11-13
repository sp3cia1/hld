import type { PackageResponse } from '@bh/shared/holiday-package';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { retryUnlessNotFound } from '@/lib/api-client';
import { createPackage, fetchOptions, fetchPackage } from './api';

export function useOptions() {
  // The choices come from the catalog, which never changes while the API runs.
  return useQuery({ queryKey: ['options'], queryFn: fetchOptions, staleTime: Infinity });
}

export function packageKey(id: string) {
  return ['packages', id];
}

export function usePackage(id: string) {
  return useQuery({
    queryKey: packageKey(id),
    queryFn: () => fetchPackage(id),
    // A package that doesn't exist won't appear on a second try, so "not found" shows at once.
    retry: retryUnlessNotFound,
  });
}

export function useCreatePackage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPackage,
    onSuccess: ({ data }) => {
      // The new package is already here, so its page opens at once instead of fetching it again.
      // A package just built has no reservation yet.
      if (data.status !== 'NO_PACKAGE') {
        queryClient.setQueryData<PackageResponse>(packageKey(data.packageId), {
          data: { ...data, reference: null },
        });
      }
    },
  });
}