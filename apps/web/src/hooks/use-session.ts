import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export const SESSION_KEY = ['admin-session'] as const;

export function useSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: () => api.session(),
    retry: false,
    staleTime: 60_000,
  });
}
