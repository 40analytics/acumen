import { Navigate } from 'react-router-dom';
import { useSession } from '@/lib/auth-client';
import type { ReactNode } from 'react';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();
  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted">Loading…</div>
    );
  }
  if (!session) return <Navigate to="/signin" replace />;
  return <>{children}</>;
}
