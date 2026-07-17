import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth-context';

export interface Notification {
  id: string;
  user_id: string;
  sender_id: string | null;
  type: 'follow' | 'like' | 'comment' | 'message';
  post_id: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
  // enriched from profiles
  sender_photo?: string;
  sender_name?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  unreadMessagesCount: number;
  markAllRead: () => Promise<void>;
  markOneRead: (id: string) => Promise<void>;
  loading: boolean;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  unreadMessagesCount: 0,
  markAllRead: async () => {},
  markOneRead: async () => {},
  loading: false,
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const notifChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const msgChannelRef   = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Enrich notifications with sender profile data ────────────────────────
  const enrich = useCallback(async (rows: any[]): Promise<Notification[]> => {
    const ids = [...new Set(rows.map((n) => n.sender_id).filter(Boolean))] as string[];
    const profileMap: Record<string, { display_name: string; photo_url: string }> = {};
    if (ids.length) {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, photo_url')
        .in('id', ids);
      for (const p of data ?? []) profileMap[p.id] = p;
    }
    return rows.map((n) => ({
      ...n,
      sender_name:  n.sender_id ? profileMap[n.sender_id]?.display_name  : undefined,
      sender_photo: n.sender_id ? profileMap[n.sender_id]?.photo_url     : undefined,
    }));
  }, []);

  // ── Fetch notifications ───────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error) {
      const enriched = await enrich(data ?? []);
      setNotifications(enriched);
    }
    setLoading(false);
  }, [user?.id, enrich]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch unread message count ────────────────────────────────────────────
  const fetchUnreadMessages = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('read', false);
    setUnreadMessagesCount(count ?? 0);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Subscribe when user logs in ───────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadMessagesCount(0);
      return;
    }

    fetchNotifications();
    fetchUnreadMessages();

    // Notifications realtime
    if (notifChannelRef.current) supabase.removeChannel(notifChannelRef.current);
    notifChannelRef.current = supabase
      .channel(`notif:${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => fetchNotifications())
      .subscribe();

    // Messages realtime (for unread badge)
    if (msgChannelRef.current) supabase.removeChannel(msgChannelRef.current);
    msgChannelRef.current = supabase
      .channel(`msg-read:${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${user.id}`,
      }, () => fetchUnreadMessages())
      .subscribe();

    return () => {
      if (notifChannelRef.current) supabase.removeChannel(notifChannelRef.current);
      if (msgChannelRef.current)   supabase.removeChannel(msgChannelRef.current);
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAllRead = async () => {
    if (!user || unreadCount === 0) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const markOneRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, unreadMessagesCount, markAllRead, markOneRead, loading }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
