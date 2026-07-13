import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AuthProvider } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/layout/protected-route';
import { AppShell } from '@/components/layout/app-shell';
import { Toaster } from 'sonner';

// Pages
import Login from '@/pages/login';
import Dashboard from '@/pages/dashboard';
import Explore from '@/pages/explore';
import Messages from '@/pages/messages';
import Profile from '@/pages/profile';
import Cocktails from '@/pages/cocktails';
import Rules from '@/pages/rules';
import Tasks from '@/pages/tasks';
import Announcements from '@/pages/announcements';
import Requests from '@/pages/requests';
import Admin from '@/pages/admin';

const queryClient = new QueryClient();

function NotFound() {
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background text-foreground">
      <div className="text-center space-y-4">
        <h1 className="font-serif text-6xl font-bold text-primary">404</h1>
        <p className="text-muted-foreground uppercase tracking-widest">Page not found</p>
      </div>
    </div>
  );
}

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      {children}
    </AppShell>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      
      <Route path="/dashboard">
        <ProtectedRoute>
          <ProtectedLayout><Dashboard /></ProtectedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/explore">
        <ProtectedRoute>
          <ProtectedLayout><Explore /></ProtectedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/messages">
        <ProtectedRoute>
          <ProtectedLayout><Messages /></ProtectedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/profile">
        <ProtectedRoute>
          <ProtectedLayout><Profile /></ProtectedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/cocktails">
        <ProtectedRoute>
          <ProtectedLayout><Cocktails /></ProtectedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/rules">
        <ProtectedRoute>
          <ProtectedLayout><Rules /></ProtectedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/announcements">
        <ProtectedRoute>
          <ProtectedLayout><Announcements /></ProtectedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/requests">
        <ProtectedRoute>
          <ProtectedLayout><Requests /></ProtectedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/tasks">
        <ProtectedRoute staffOrAdminOnly>
          <ProtectedLayout><Tasks /></ProtectedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin">
        <ProtectedRoute adminOnly>
          <ProtectedLayout><Admin /></ProtectedLayout>
        </ProtectedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1a1a1a',
              border: '1px solid rgba(212,175,55,0.2)',
              color: '#f5f5f5',
            },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
