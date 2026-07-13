import { useAuth } from '@/lib/auth-context';
import { useLocation } from 'wouter';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute({
  children,
  adminOnly = false,
  staffOrAdminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
  staffOrAdminOnly?: boolean;
}) {
  const { user, userData, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return; // wait for auth to settle

    if (!user) {
      setLocation('/');
      return;
    }

    // Role-based guards — only run once userData is available
    if (userData) {
      if (adminOnly && userData.role !== 'admin') {
        setLocation('/dashboard');
      }
      if (
        staffOrAdminOnly &&
        !['admin', 'staff'].includes(userData.role as string)
      ) {
        setLocation('/dashboard');
      }
    }
  }, [user, userData, loading, setLocation, adminOnly, staffOrAdminOnly]);

  // Only block on auth loading or missing user — never block on userData alone.
  // userData may arrive a render cycle after user; blocking on it causes an
  // infinite spinner when Firestore is slow or the upsert was skipped.
  if (loading || !user) {
    return (
      <div
        className="min-h-[100dvh] flex items-center justify-center bg-background"
        data-testid="loading-spinner"
      >
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
