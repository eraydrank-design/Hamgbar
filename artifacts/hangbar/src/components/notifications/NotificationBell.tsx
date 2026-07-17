import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, User, Heart, MessageCircle, UserPlus, MessageSquare, X, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useNotifications, type Notification } from '@/lib/notification-context';

// ── Icon per notification type ────────────────────────────────────────────────

const TYPE_META: Record<string, { icon: React.ElementType; color: string }> = {
  follow:  { icon: UserPlus,       color: 'text-blue-400' },
  like:    { icon: Heart,          color: 'text-red-400' },
  comment: { icon: MessageCircle,  color: 'text-green-400' },
  message: { icon: MessageSquare,  color: 'text-primary' },
};

// ── Time formatter ─────────────────────────────────────────────────────────────

function fmtAgo(d: string) {
  try {
    return formatDistanceToNow(new Date(d), { addSuffix: true, locale: tr });
  } catch {
    return '';
  }
}

// ── Single notification row ────────────────────────────────────────────────────

function NotifRow({ n, onRead }: { n: Notification; onRead: (id: string) => void }) {
  const meta = TYPE_META[n.type] ?? { icon: Bell, color: 'text-primary' };
  const TypeIcon = meta.icon;

  return (
    <div
      onClick={() => !n.is_read && onRead(n.id)}
      className={`flex items-start gap-3 px-4 py-3 border-b border-white/5 transition-colors last:border-b-0 ${
        n.is_read
          ? 'opacity-50'
          : 'bg-primary/5 hover:bg-primary/10 cursor-pointer'
      }`}
    >
      {/* Avatar + type badge */}
      <div className="relative flex-shrink-0 mt-0.5">
        <div className="w-9 h-9 rounded-full bg-white/10 border border-white/10 overflow-hidden flex items-center justify-center">
          {n.sender_photo ? (
            <img src={n.sender_photo} alt={n.sender_name ?? ''} className="w-full h-full object-cover" />
          ) : (
            <User className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-background border border-white/10 flex items-center justify-center">
          <TypeIcon className={`w-2.5 h-2.5 ${meta.color}`} />
        </div>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground leading-snug">{n.message}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{fmtAgo(n.created_at)}</p>
      </div>

      {/* Unread dot */}
      {!n.is_read && (
        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
      )}
    </div>
  );
}

// ── Notification panel (shared slide-in) ──────────────────────────────────────

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { notifications, unreadCount, markAllRead, markOneRead, loading } = useNotifications();

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        className="fixed top-0 right-0 bottom-0 z-50 w-80 max-w-[90vw] flex flex-col glass border-l border-white/10 shadow-2xl"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 240 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <h3 className="font-serif text-sm font-bold text-foreground">Bildirimler</h3>
            {unreadCount > 0 && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded-lg hover:bg-primary/10"
                title="Tümünü okundu işaretle"
              >
                <Check className="w-3 h-3" />
                Tümünü oku
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Bell className="w-8 h-8 mb-3 opacity-30 animate-pulse" />
              <p className="text-sm">Yükleniyor...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Bell className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm font-medium">Henüz bildirim yok</p>
              <p className="text-xs mt-1 opacity-70">Yeni bildirimler burada görünür</p>
            </div>
          ) : (
            notifications.map((n) => (
              <NotifRow key={n.id} n={n} onRead={markOneRead} />
            ))
          )}
        </div>
      </motion.div>
    </>
  );
}

// ── Desktop sidebar variant (full nav-item) ────────────────────────────────────

export function NotificationBell() {
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 px-4 py-3 w-full rounded-lg transition-all duration-300 text-muted-foreground hover:bg-white/5 hover:text-foreground"
      >
        <Bell className="w-5 h-5 flex-shrink-0" />
        <span>Bildirimler</span>
        {unreadCount > 0 && (
          <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && <NotificationPanel onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
}

// ── Mobile header variant (icon only) ────────────────────────────────────────

export function NotificationBellMobile() {
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative p-2 text-foreground"
        aria-label="Bildirimler"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && <NotificationPanel onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
