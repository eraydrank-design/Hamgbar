import { Link, useLocation } from 'wouter';
import { useAuth } from '@/lib/auth-context';
import { 
  Home, 
  Compass, 
  MessageSquare, 
  User, 
  Martini, 
  BookOpen, 
  CheckSquare, 
  Bell, 
  ClipboardList, 
  ShieldAlert,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { userData, signOut } = useAuth();
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = userData?.role === 'admin';
  const isStaffOrAdmin = isAdmin || userData?.role === 'staff';

  const mainLinks = [
    { href: '/dashboard', label: 'Ana Sayfa', icon: Home },
    { href: '/explore', label: 'Keşfet', icon: Compass },
    { href: '/messages', label: 'Mesajlar', icon: MessageSquare },
    { href: '/cocktails', label: 'Kokteyller', icon: Martini },
    { href: '/profile', label: 'Profil', icon: User },
  ];

  const secondaryLinks = [
    { href: '/announcements', label: 'Duyurular', icon: Bell },
    { href: '/requests', label: 'Talepler', icon: ClipboardList },
    { href: '/rules', label: 'Kurallar', icon: BookOpen },
    ...(isStaffOrAdmin ? [{ href: '/tasks', label: 'Görevler', icon: CheckSquare }] : []),
    ...(isAdmin ? [{ href: '/admin', label: 'Yönetim', icon: ShieldAlert }] : []),
  ];

  const NavItem = ({ href, label, icon: Icon, onClick }: any) => {
    const isActive = location === href;
    return (
      <Link href={href} className="w-full block">
        <div 
          onClick={onClick}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
            isActive 
              ? 'bg-primary/10 text-primary font-medium border border-primary/20' 
              : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
          }`}
          data-testid={`nav-${label.toLowerCase().replace(/\s/g, '-')}`}
        >
          <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
          <span>{label}</span>
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col glass border-r border-white/5 z-20">
        <div className="p-6">
          <h1 className="font-serif text-2xl font-bold text-gradient-gold tracking-wider uppercase">HangBar</h1>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
          <div className="space-y-1">
            {mainLinks.map((link) => (
              <NavItem key={link.href} {...link} />
            ))}
          </div>

          <div>
            <h3 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Daha Fazla</h3>
            <div className="space-y-1">
              {secondaryLinks.map((link) => (
                <NavItem key={link.href} {...link} />
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 overflow-hidden">
              {userData?.photo_url ? (
                <img src={userData.photo_url as string} alt={userData.display_name as string} className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-primary" />
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{userData?.display_name as string}</p>
              <p className="text-xs text-muted-foreground capitalize">{userData?.role as string}</p>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
            data-testid="button-signout"
          >
            <LogOut className="w-4 h-4" />
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 glass sticky top-0 z-30">
        <h1 className="font-serif text-xl font-bold text-gradient-gold tracking-wider uppercase">HangBar</h1>
        <button 
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 text-foreground"
          data-testid="button-mobile-menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass pb-safe z-30">
        <div className="flex justify-around p-2">
          {mainLinks.slice(0, 5).map((link) => {
            const Icon = link.icon;
            const isActive = location === link.href;
            return (
              <Link key={link.href} href={link.href} className="w-full">
                <div className={`flex flex-col items-center justify-center p-2 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                  <Icon className="w-6 h-6 mb-1" />
                  <span className="text-[10px] font-medium">{link.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="md:hidden fixed top-0 right-0 bottom-0 w-64 glass z-50 flex flex-col"
            >
              <div className="p-4 flex justify-end">
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-muted-foreground">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 space-y-6">
                <div>
                  <h3 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Daha Fazla</h3>
                  <div className="space-y-1">
                    {secondaryLinks.map((link) => (
                      <NavItem key={link.href} {...link} onClick={() => setMobileMenuOpen(false)} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-white/10 pb-safe">
                <button
                  onClick={() => signOut()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm text-destructive bg-destructive/10 rounded-lg"
                >
                  <LogOut className="w-4 h-4" />
                  Çıkış Yap
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden pb-20 md:pb-0 relative">
        <div className="max-w-5xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
