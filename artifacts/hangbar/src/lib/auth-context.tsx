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

  const profileChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const initializingRef   = useRef(false); // prevent double-init on rapid auth events

  // ── Fetch profile row ──────────────────────────────────────────────────────
  const fetchProfile = async (uid: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single();
    if (!error && data) setUserData(data);
  };

  // ── Upsert profile on sign-in ──────────────────────────────────────────────
  const ensureProfile = async (u: User) => {
    const role = ADMIN_EMAILS.includes((u.email ?? '').toLowerCase()) ? 'admin' : 'staff';

    const { data: existing, error: fetchErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', u.id)
      .single();

    if (!existing && fetchErr?.code === 'PGRST116') {
      // Profile does not exist — create it
      const { error: insertErr } = await supabase.from('profiles').insert({
        id:            u.id,
        email:         u.email ?? null,
        display_name:
          u.user_metadata?.full_name ||
          u.user_metadata?.name ||
          u.email?.split('@')[0] ||
          'Misafir',
        photo_url:     u.user_metadata?.avatar_url ?? '',
        username:      '',
        role,
        cocktail_count: 0,
        badges:        [],
        favorites:     [],
      });
      if (insertErr) console.error('[auth] profile insert:', insertErr.message);
    } else if (existing) {
      // Profile exists — sync immutable fields only
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ email: u.email ?? null, role })
        .eq('id', u.id);
      if (updateErr) console.error('[auth] profile update:', updateErr.message);
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
        (payload) => setUserData(payload.new as Record<string, any>),
      )
      .subscribe();
    profileChannelRef.current = ch;
  };

  // ── Core init handler (called once per auth event) ─────────────────────────
  const handleAuthChange = async (_event: AuthChangeEvent, session: Session | null) => {
    if (initializingRef.current) return;
    initializingRef.current = true;

    try {
      const u = session?.user ?? null;
      setUser(u);

      if (u) {
        await ensureProfile(u);
        await fetchProfile(u.id);
        subscribeToProfile(u.id);
      } else {
        setUserData(null);
        if (profileChannelRef.current) {
          supabase.removeChannel(profileChannelRef.current);
          profileChannelRef.current = null;
        }
      }
    } finally {
      setLoading(false);
      initializingRef.current = false;
    }
  };

  useEffect(() => {
    // `onAuthStateChange` fires INITIAL_SESSION immediately on subscribe —
    // this replaces a separate getSession() call and avoids double-init.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthChange);

    return () => {
      subscription.unsubscribe();
      if (profileChannelRef.current) supabase.removeChannel(profileChannelRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = async () => {
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
