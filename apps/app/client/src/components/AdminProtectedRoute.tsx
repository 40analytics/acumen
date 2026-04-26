import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { ReactNode } from 'react';

/**
 * Route guard for the admin portal.
 * Calls /api/admin/auth/me — if the admin cookie is absent or expired,
 * redirects to /admin/login. Completely separate from the customer
 * Better Auth session.
 */
export function AdminProtectedRoute({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-auth-me'],
    queryFn: () => apiClient.get<{ username: string; email: string }>('/api/admin/auth/me'),
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!isLoading && isError) {
      navigate('/admin/login', { replace: true });
    }
  }, [isLoading, isError, navigate]);

  if (isLoading) return null;
  if (!data) return null;

  return <>{children}</>;
}
