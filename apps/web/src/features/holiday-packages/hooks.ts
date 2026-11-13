import { useMutation, useQuery } from '@tanstack/react-query';
import { createPackage, fetchOptions } from './api';

export function useOptions() {
  // The choices come from the catalog, which never changes while the API runs.
  return useQuery({ queryKey: ['options'], queryFn: fetchOptions, staleTime: Infinity });
}

export function useCreatePackage() {
  return useMutation({ mutationFn: createPackage });
}
