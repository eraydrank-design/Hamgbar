import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

const ADMIN_EMAILS = ['eraydrank@gmail.com'];

interface AuthContextType {
  user: User | null;
  userData: Record<string, any> | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]         = useState<User | null>(null);
  const [userData, setUserData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading]   = useState(true);

  const profileChannelRef  = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Track the last session ID we processed so rapid duplicate events don't double-fire.
  // We intentionally do NOT block on this — we let every distinct session through.
  const lastSessionIdRef   = useRef<string | null>(undefined as any);

  // ── Fetch profile row ──────────────────────────────────────────────────────
  const fetchProfile = async (uid: string): Promise<Record<string, any> | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();           // returns null (not error) when 0 rows

    if (error) {
      console.error('[auth] fetchProfile error — table may not exist or RLS blocked:', error);
      return null;
    }
    if (data) {
      setUserData(data);
      return data;
    }
    // Row not found yet (insert may not be visible yet) — not an error
    console.warn('[auth] fetchProfile: no row returned for uid', uid);
    return null;
  };

  // ── Create or sync profile on sign-in ─────────────────────────────────────
  const ensureProfile = async (u: User): Promise<void> => {
    const role = ADMIN_EMAILS.includes((u.email ?? '').toLowerCase()) ? 'admin' : 'staff';

    // maybeSingle() returns (data: null, error: null) when 0 rows — no PGRST116 check needed.
    const { data: existing, error: selectErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', u.id)
      .maybeSingle();

    if (selectErr) {
      console.error('[auth] ensureProfile — SELECT failed (profiles table missing or RLS issue):', selectErr);
      // Try insert anyway — if the table is missing this will also fail, but we'll surface the error.
    }

    if (!existing) {
      // No profile row — create it.
      const { error: insertErr } = await supabase.from('profiles').insert({
        id:             u.id,
        email:          u.email ?? null,
        display_name:
          u.user_metadata?.full_name ||
          u.user_metadata?.name ||
          u.email?.split('@')[0] ||
          'Misafir',
        photo_url:      u.user_metadata?.avatar_url ?? '',
        username:       '',
        role,
        cocktail_count: 0,
        badges:         [],
        favorites:      [],
      });
      if (insertErr) {
        console.error('[auth] ensureProfile — INSERT failed:', insertErr);
      } else {
        console.log('[auth] profile created for', u.email);
      }
    } else {
      // Profile exists — keep email and role in sync.
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ email: u.email ?? null, role })
        .eq('id', u.id);
      if (updateErr) {
        console.error('[auth] ensureProfile — UPDATE failed:', updateErr);
      }
    }
  };

  // ── Real-time profile subscription ─────────────────────────────────────────
  const subscribeToProfile = (uid: string) => {
    if (profileChannelRef.current) supabase.removeChannel(profileChannelRef.current);
    const ch = supabase
      .channel(`profile:${uid}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` },
        (payload) => {
          console.log('[auth] realtime profile update received');
          setUserData(payload.new as Record<string, any>);
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log('[auth] profile channel subscribed');
        if (status === 'CHANNEL_ERROR') console.error('[auth] profile channel error');
      });
    profileChannelRef.current = ch;
  };

  // ── Core auth-change handler ───────────────────────────────────────────────
  // Called by onAuthStateChange for every event. We deduplicate by session id
  // so rapid duplicate SIGNED_IN/INITIAL_SESSION pairs (React StrictMode, etc.)
  // don't fire two simultaneous DB round-trips.
  const handleAuthChange = async (event: AuthChangeEvent, session: Session | null) => {
    const sessionId = session?.access_token ?? null;

    console.log(`[auth] event=${event} sessionId=${sessionId ? sessionId.slice(0, 16) + '…' : 'null'}`);

    // Deduplicate: skip if this exact session was already fully processed.
    // We still allow null→null (INITIAL_SESSION with no user) through once.
    if (sessionId !== null && sessionId === lastSessionIdRef.current) {
      console.log('[auth] duplicate session — skipping');
      return;
    }
    lastSessionIdRef.current = sessionId;

    const u = session?.user ?? null;
    setUser(u);

    if (u) {
      try {
        await ensureProfile(u);
        const profile = await fetchProfile(u.id);
        if (!profile) {
          // Profile fetch failed (table missing?). We still set loading=false and
          // let the redirect happen — pages handle missing userData gracefully.
          console.error('[auth] userData is null after fetchProfile — check if SQL migration has been run');
        }
        subscribeToProfile(u.id);
      } catch (err) {
        console.error('[auth] unexpected error during profile init:', err);
      }
    } else {
      setUserData(null);
      if (profileChannelRef.current) {
        supabase.removeChannel(profileChannelRef.current);
        profileChannelRef.current = null;
      }
    }

    // Always clear loading, even on failure — never leave the UI in a spinner forever.
    setLoading(false);
    console.log(`[auth] loading cleared. user=${u?.email ?? 'none'}`);
  };

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION synchronously on subscribe.
    // This is our single source of truth — no separate getSession() call needed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthChange);

    return () => {
      subscription.unsubscribe();
      if (profileChannelRef.current) supabase.removeChannel(profileChannelRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = async () => {
    console.log('[auth] signing out');
    await supabase.auth.signOut();
    setUser(null);
    setUserData(null);
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
