import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, User, ChevronDown } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { createNotification } from '@/lib/notify';
import type { StoryGroup, Story } from '@/hooks/use-stories';

const IMAGE_DURATION = 5000;   // ms
const MAX_VIDEO_DURATION = 30; // seconds cap

interface ViewerRecord {
  viewer_id: string;
  viewed_at: string;
  display_name: string;
  photo_url: string;
}

interface Props {
  storyGroups: StoryGroup[];
  initialGroupIdx: number;
  myUserId: string;
  myDisplayName: string;
  onClose: () => void;
}

function fmtAgo(d: string) {
  try { return formatDistanceToNow(new Date(d), { addSuffix: true, locale: tr }); }
  catch { return ''; }
}

function fmtTime(d: string) {
  try { return format(new Date(d), 'HH:mm', { locale: tr }); }
  catch { return ''; }
}

export function StoryViewer({
  storyGroups,
  initialGroupIdx,
  myUserId,
  myDisplayName,
  onClose,
}: Props) {
  const [groupIdx, setGroupIdx] = useState(initialGroupIdx);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<ViewerRecord[]>([]);
  const [loadingViewers, setLoadingViewers] = useState(false);

  const progressRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const isPausingRef = useRef(false);
  const markedViewedRef = useRef<Set<string>>(new Set());

  const currentGroup = storyGroups[groupIdx] as StoryGroup | undefined;
  const currentStory = currentGroup?.stories[storyIdx] as Story | undefined;
  const isOwnStory = currentStory?.user_id === myUserId;

  // ── Navigation ────────────────────────────────────────────────────────────
  const goNext = useCallback(() => {
    if (!currentGroup) { onClose(); return; }
    if (storyIdx < currentGroup.stories.length - 1) {
      setProgress(0);
      progressRef.current = 0;
      setStoryIdx((i) => i + 1);
    } else if (groupIdx < storyGroups.length - 1) {
      setProgress(0);
      progressRef.current = 0;
      setGroupIdx((g) => g + 1);
      setStoryIdx(0);
    } else {
      onClose();
    }
  }, [currentGroup, storyIdx, groupIdx, storyGroups.length, onClose]);

  const goPrev = useCallback(() => {
    if (storyIdx > 0) {
      setProgress(0);
      progressRef.current = 0;
      setStoryIdx((i) => i - 1);
    } else if (groupIdx > 0) {
      setProgress(0);
      progressRef.current = 0;
      const prevGroup = storyGroups[groupIdx - 1];
      setGroupIdx((g) => g - 1);
      setStoryIdx(prevGroup ? prevGroup.stories.length - 1 : 0);
    }
  }, [storyIdx, groupIdx, storyGroups]);

  // ── Mark story as viewed ──────────────────────────────────────────────────
  useEffect(() => {
    if (!currentStory || isOwnStory) return;
    const key = currentStory.id;
    if (markedViewedRef.current.has(key)) return;
    markedViewedRef.current.add(key);

    supabase
      .from('story_views')
      .upsert({ story_id: key, viewer_id: myUserId }, { onConflict: 'story_id,viewer_id' })
      .then(() => {});

    createNotification({
      userId:   currentStory.user_id,
      senderId: myUserId,
      type:     'message',
      message:  `${myDisplayName} hikayeni gördü`,
    }).catch(() => {});
  }, [currentStory?.id, isOwnStory, myUserId, myDisplayName]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Progress bar (RAF loop) ───────────────────────────────────────────────
  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (!currentStory || currentStory.media_type === 'video') return; // video drives own progress
    if (isPaused) return;

    const duration = IMAGE_DURATION;
    const startProgress = progressRef.current;
    const startTime = Date.now();
    const remaining = duration * (1 - startProgress / 100);

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const newP = Math.min(startProgress + (elapsed / remaining) * (100 - startProgress), 100);
      progressRef.current = newP;
      setProgress(newP);
      if (newP >= 100) {
        goNext();
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [groupIdx, storyIdx, isPaused, goNext]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset progress on story change ────────────────────────────────────────
  useEffect(() => {
    setProgress(0);
    progressRef.current = 0;
    setShowViewers(false);
  }, [groupIdx, storyIdx]);

  // ── Video: pause / resume + progress ─────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v || currentStory?.media_type !== 'video') return;
    if (isPaused) v.pause();
    else v.play().catch(() => {});
  }, [isPaused, currentStory?.media_type]);

  const handleVideoTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const cap = Math.min(v.duration, MAX_VIDEO_DURATION);
    const p = Math.min((v.currentTime / cap) * 100, 100);
    progressRef.current = p;
    setProgress(p);
    if (p >= 100) goNext();
  };

  // ── Touch handlers ────────────────────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent) => {
    touchStartXRef.current = e.clientX;
    touchStartYRef.current = e.clientY;
    isPausingRef.current = true;
    setIsPaused(true);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isPausingRef.current) return;
    isPausingRef.current = false;
    setIsPaused(false);

    const dx = Math.abs(e.clientX - touchStartXRef.current);
    const dy = Math.abs(e.clientY - touchStartYRef.current);

    if (dx < 12 && dy < 12) {
      // Tap
      const half = window.innerWidth / 2;
      if (e.clientX < half) goPrev();
      else goNext();
    }
  };

  const handlePointerLeave = () => {
    if (!isPausingRef.current) return;
    isPausingRef.current = false;
    setIsPaused(false);
  };

  // ── Fetch viewers for own story ───────────────────────────────────────────
  const openViewers = async () => {
    if (!currentStory) return;
    setShowViewers(true);
    setLoadingViewers(true);
    const { data: views } = await supabase
      .from('story_views')
      .select('viewer_id, viewed_at')
      .eq('story_id', currentStory.id)
      .order('viewed_at', { ascending: false });

    const viewerIds = (views ?? []).map((v: any) => v.viewer_id as string);
    if (viewerIds.length === 0) { setViewers([]); setLoadingViewers(false); return; }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, photo_url')
      .in('id', viewerIds);

    const pm: Record<string, any> = {};
    for (const p of profiles ?? []) pm[p.id] = p;

    setViewers(
      (views ?? []).map((v: any) => ({
        viewer_id:    v.viewer_id,
        viewed_at:    v.viewed_at,
        display_name: pm[v.viewer_id]?.display_name ?? 'Üye',
        photo_url:    pm[v.viewer_id]?.photo_url    ?? '',
      })),
    );
    setLoadingViewers(false);
  };

  if (!currentGroup || !currentStory) return null;

  const totalStories = currentGroup.stories.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      {/* ── Story content ────────────────────────────────────────────────── */}
      <div className="relative w-full h-full max-w-md mx-auto flex flex-col">

        {/* ── Progress bars ─────────────────────────────────────────────── */}
        <div className="absolute top-0 left-0 right-0 z-10 px-2 pt-2 flex gap-1 pointer-events-none">
          {currentGroup.stories.map((_, i) => (
            <div key={i} className="flex-1 h-[2px] bg-white/25 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-none"
                style={{
                  width:
                    i < storyIdx ? '100%' :
                    i === storyIdx ? `${progress}%` :
                    '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* ── User info header ───────────────────────────────────────────── */}
        <div className="absolute top-6 left-0 right-0 z-10 px-4 flex items-center gap-3 pointer-events-none">
          <div className="w-9 h-9 rounded-full border-2 border-white/50 overflow-hidden flex-shrink-0">
            {currentGroup.photo_url ? (
              <img src={currentGroup.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">{currentGroup.display_name}</p>
            <p className="text-[11px] text-white/70">{fmtAgo(currentStory.created_at)}</p>
          </div>
        </div>

        {/* ── Close button ──────────────────────────────────────────────── */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          className="absolute top-6 right-3 z-20 p-2 text-white/80 hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>

        {/* ── Media / Text ──────────────────────────────────────────────── */}
        <div className="w-full h-full">
          {currentStory.media_type === 'image' && currentStory.media_url && (
            <img
              src={currentStory.media_url}
              alt="Hikaye"
              className="w-full h-full object-cover select-none"
              draggable={false}
            />
          )}

          {currentStory.media_type === 'video' && currentStory.media_url && (
            <video
              key={currentStory.id}
              ref={videoRef}
              src={currentStory.media_url}
              className="w-full h-full object-cover"
              autoPlay
              muted={false}
              playsInline
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={goNext}
            />
          )}

          {currentStory.media_type === 'text' && (
            <div
              className="w-full h-full flex items-center justify-center p-8"
              style={{ background: currentStory.text_bg ?? '#0d0d0d' }}
            >
              <p
                className="text-white text-2xl font-semibold text-center leading-relaxed break-words"
                style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
              >
                {currentStory.text_content}
              </p>
            </div>
          )}
        </div>

        {/* ── Bottom bar ────────────────────────────────────────────────── */}
        {isOwnStory && (
          <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-auto">
            {/* Viewer count button */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={openViewers}
              className="w-full flex items-center justify-center gap-2 py-4 text-white/80 hover:text-white transition-colors"
            >
              <Eye className="w-4 h-4" />
              <span className="text-sm">
                {currentStory.view_count} görüntüleme
              </span>
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* ── Viewer list panel ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showViewers && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40"
              onPointerDown={(e) => { e.stopPropagation(); setShowViewers(false); }}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 max-w-md mx-auto glass rounded-t-2xl z-30 max-h-[60dvh] flex flex-col"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" />
                  <h3 className="font-serif text-sm font-bold text-foreground">Görüntüleyenler</h3>
                  <span className="text-xs text-muted-foreground">({viewers.length})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowViewers(false)}
                  className="p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-2">
                {loadingViewers ? (
                  <div className="flex justify-center py-8">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : viewers.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    Henüz kimse görmedi
                  </div>
                ) : (
                  viewers.map((v) => (
                    <div key={v.viewer_id} className="flex items-center gap-3 px-5 py-2.5">
                      <div className="w-10 h-10 rounded-full bg-primary/20 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {v.photo_url ? (
                          <img src={v.photo_url} alt={v.display_name} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{v.display_name}</p>
                        <p className="text-xs text-muted-foreground">{fmtTime(v.viewed_at)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
