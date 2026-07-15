/**
 * Supabase-backed replacements for the original Firebase hooks.
 * API is intentionally kept compatible so pages need minimal changes.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface QueryOptions {
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  filters?: Array<{ column: string; op?: string; value: any }>;
}

// ── useCollection ─────────────────────────────────────────────────────────────
export function useCollection<T = any>(table: string, options?: QueryOptions) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const optKey = JSON.stringify(options);

  const buildQuery = useCallback(() => {
    let q = supabase.from(table).select('*') as any;
    if (options?.filters) {
      for (const f of options.filters) {
        const op = f.op ?? 'eq';
        q = q[op](f.column, f.value);
      }
    }
    if (options?.orderBy) {
      q = q.order(options.orderBy.column, {
        ascending: options.orderBy.ascending ?? true,
      });
    }
    if (options?.limit) q = q.limit(options.limit);
    return q;
  }, [table, optKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = useCallback(async () => {
    const { data: result, error } = await buildQuery();
    if (!error) setData((result ?? []) as T[]);
    setLoading(false);
  }, [buildQuery]);

  useEffect(() => {
    setLoading(true);
    fetchData();

    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const ch = supabase
      .channel(`${table}-col-${optKey}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        fetchData();
      })
      .subscribe();
    channelRef.current = ch;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, optKey, fetchData]);

  const add = async (insertData: any) => {
    const { data: result, error } = await supabase
      .from(table)
      .insert({ ...insertData, created_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return result;
  };

  const update = async (id: string, updateData: any) => {
    if (!id) throw new Error('ID eksik — güncelleme yapılamadı');
    const { error } = await supabase.from(table).update(updateData).eq('id', id);
    if (error) throw error;
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
  };

  return { data, loading, add, update, remove };
}

// ── useDocument ───────────────────────────────────────────────────────────────
export function useDocument<T = any>(table: string, id: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    const { data: result, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single();
    if (!error) setData(result as T);
    setLoading(false);
  }, [table, id]);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    fetchData();

    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const ch = supabase
      .channel(`${table}-doc-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table, filter: `id=eq.${id}` },
        (payload) => setData(payload.new as T),
      )
      .subscribe();
    channelRef.current = ch;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, id, fetchData]);

  const update = async (updateData: any) => {
    if (!id) throw new Error('ID eksik — güncelleme yapılamadı');
    const { error } = await supabase.from(table).update(updateData).eq('id', id);
    if (error) throw error;
  };

  return { data, loading, update };
}
