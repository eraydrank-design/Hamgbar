import { useAuth } from '@/lib/auth-context';
import { useLocation } from 'wouter';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute({ children, adminOnly = false, staffOrAdminOnly = false }: { children: React.ReactNode, adminOnly?: boolean, staffOrAdminOnly?: boolean }) {
  const { user, userData, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      setLocation('/');
    } else if (!loading && user && userData) {
      if (adminOnly && userData.role !== 'admin') {
        setLocation('/dashboard');
      }
      if (staffOrAdminOnly && !['admin', 'staff'].includes(userData.role)) {
        setLocation('/dashboard');
      }
    }
  }, [user, userData, loading, setLocation, adminOnly, staffOrAdminOnly]);

  if (loading || !user || !userData) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
