import type { PackageResponse } from '@bh/shared/holiday-package';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { retryUnlessNotFound } from '@/lib/api-client';
import {
  createPackage,
  fetchOptions,
  fetchPackage,
  fetchPackageCheck,
  fetchPackageExport,
} from './api';

export function useOptions() {
  // The choices come from the catalog, which never changes while the API runs.
  return useQuery({ queryKey: ['options'], queryFn: fetchOptions, staleTime: Infinity });
}

/** The cache key of a saved package. Anything derived from the package (its change choices) goes under it. */
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

/**
 * The rule check of a saved package. Its key sits under the package's, so refreshing the package after a change
 * (`invalidateQueries({ queryKey: packageKey(id) })`) checks it again too.
 */
/** The rules panel's key. It sits under the package's, so refreshing the package checks it again too. */
export function packageCheckKey(id: string) {
  return [...packageKey(id), 'check'];
}

/**
 * The rule check of a saved package. A change sets the new package straight into the cache without a refetch, so
 * `useApplyChange` refreshes this key itself.
 */
export function usePackageCheck(id: string) {
  return useQuery({
    queryKey: packageCheckKey(id),
    queryFn: () => fetchPackageCheck(id),
    retry: retryUnlessNotFound,
  });
}

/** Fetches the export on click, never ahead: the file is always the package as it is at that moment. */
export function useExportPackage() {
  return useMutation({ mutationFn: fetchPackageExport });
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
