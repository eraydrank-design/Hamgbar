import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Tracks online presence of all users via Supabase Realtime Presence.
 * Each logged-in user joins the 'presence:global' channel keyed by their userId.
 * onlineUsers: Set of userIds currently online.
 * lastSeen: Record of userId → ISO timestamp of when they went offline (session-local).
 */
export function usePresence(myUserId: string | undefined) {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [lastSeen, setLastSeen] = useState<Record<string, string>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!myUserId) return;
    let mounted = true;

    const channel = supabase.channel('presence:global', {
      config: { presence: { key: myUserId } },
    });

    const syncState = () => {
      const state = channel.presenceState<{ user_id: string }>();
      if (mounted) setOnlineUsers(new Set(Object.keys(state)));
    };

    channel
      .on('presence', { event: 'sync' }, syncState)
      .on('presence', { event: 'join' }, ({ key }) => {
        if (mounted) setOnlineUsers((prev) => new Set([...prev, key as string]));
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        const id = key as string;
        if (!mounted) return;
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setLastSeen((prev) => ({ ...prev, [id]: new Date().toISOString() }));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && mounted) {
          await channel.track({ user_id: myUserId, online_at: new Date().toISOString() });
        }
      });

    channelRef.current = channel;

    return () => {
      mounted = false;
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [myUserId]);

  return { onlineUsers, lastSeen };
}
