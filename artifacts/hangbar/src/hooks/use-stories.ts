import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface Story {
  id: string;
  user_id: string;
  media_url: string | null;
  media_type: 'image' | 'video' | 'text';
  text_content: string | null;
  text_bg: string | null;
  created_at: string;
  expires_at: string;
  viewed: boolean;
  view_count: number;
}

export interface StoryGroup {
  userId: string;
  display_name: string;
  photo_url: string;
  stories: Story[];
  hasUnseen: boolean;
}

export function useStories(myUserId: string | undefined) {
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchStories = useCallback(async () => {
    if (!myUserId) { setLoading(false); return; }

    const now = new Date().toISOString();

    // 1. Fetch active (non-expired) stories
    const { data: rawStories, error } = await supabase
      .from('stories')
      .select('*')
      .gt('expires_at', now)
      .order('created_at', { ascending: true });

    if (error || !rawStories || rawStories.length === 0) {
      setStoryGroups([]);
      setLoading(false);
      return;
    }

    const storyIds = rawStories.map((s: any) => s.id) as string[];
    const userIds  = [...new Set(rawStories.map((s: any) => s.user_id as string))];

    // 2. Parallel: my views + all view counts + user profiles
    const [{ data: myViews }, { data: allViews }, { data: profiles }] = await Promise.all([
      supabase
        .from('story_views')
        .select('story_id')
        .eq('viewer_id', myUserId)
        .in('story_id', storyIds),
      supabase
        .from('story_views')
        .select('story_id')
        .in('story_id', storyIds),
      supabase
        .from('profiles')
        .select('id, display_name, photo_url')
        .in('id', userIds),
    ]);

    const viewedSet = new Set((myViews ?? []).map((v: any) => v.story_id as string));
    const countMap: Record<string, number> = {};
    for (const v of allViews ?? []) {
      countMap[v.story_id] = (countMap[v.story_id] ?? 0) + 1;
    }

    const profileMap: Record<string, { display_name: string; photo_url: string }> = {};
    for (const p of profiles ?? []) profileMap[p.id] = p;

    // 3. Group stories by user
    const groupMap: Record<string, Story[]> = {};
    for (const s of rawStories) {
      if (!groupMap[s.user_id]) groupMap[s.user_id] = [];
      groupMap[s.user_id].push({
        ...(s as any),
        viewed: viewedSet.has(s.id),
        view_count: countMap[s.id] ?? 0,
      });
    }

    // 4. Build sorted groups: own first, then unseen, then seen
    const groups: StoryGroup[] = Object.entries(groupMap).map(([uid, stories]) => ({
      userId: uid,
      display_name: profileMap[uid]?.display_name ?? 'Üye',
      photo_url: profileMap[uid]?.photo_url ?? '',
      stories,
      hasUnseen: stories.some((s) => !s.viewed),
    }));

    groups.sort((a, b) => {
      if (a.userId === myUserId) return -1;
      if (b.userId === myUserId) return 1;
      if (a.hasUnseen && !b.hasUnseen) return -1;
      if (!a.hasUnseen && b.hasUnseen) return 1;
      return 0;
    });

    setStoryGroups(groups);
    setLoading(false);
  }, [myUserId]);

  useEffect(() => {
    fetchStories();

    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = supabase
      .channel('stories-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, fetchStories)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'story_views' }, fetchStories)
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [myUserId, fetchStories]);

  return { storyGroups, loading, refetch: fetchStories };
}
