import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, User, ChevronUp, Trash2, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { createNotification } from '@/lib/notify';
import { toast } from 'sonner';
import type { StoryGroup, Story, StoryTextOverlay } from '@/hooks/use-stories';

const IMAGE_DURATION = 5000;
const MAX_VIDEO_SECS = 30;

interface ViewerRecord {
  viewer_id:    string;
  viewed_at:    string;
  display_name: string;
  photo_url:    string;
}

interface Props {
  storyGroups:     StoryGroup[];
  initialGroupIdx: number;
  myUserId:        string;
  myDisplayName:   string;
  onViewRecorded?: () => void;
  onClose:         () => void;
}

function fmtAgo(d: string) {
  try { return formatDistanceToNow(new Date(d), { addSuffix: true, locale: tr }); }
  catch { return ''; }
}
function fmtTime(d: string) {
  try { return format(new Date(d), 'HH:mm', { locale: tr }); }
  catch { return ''; }
}

/** Extract storage path from a Supabase public URL */
function storagePathFromUrl(url: string, bucket = 'images'): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  return idx >= 0 ? url.slice(idx + marker.length) : null;
}

/** Render a text overlay on top of story media */
function TextOverlay({ overlay }: { overlay: StoryTextOverlay }) {
  const sizeClass = overlay.size === 'sm' ? 'text-base' : overlay.size === 'lg' ? 'text-3xl' : 'text-xl';
  const posStyle: React.CSSProperties =
    overlay.position === 'top'
      ? { top: '20%' }
      : overlay.position === 'bottom'
      ? { bottom: '20%' }
      : { top: '50%', transform: 'translateY(-50%)' };
  return (
    <div
      className={`absolute left-4 right-4 z-10 text-center font-bold ${sizeClass} pointer-events-none`}
      style={{ color: overlay.color, textShadow: '0 2px 12px rgba(0,0,0,0.9)', ...posStyle }}
    >
      {overlay.text}
    </div>
  );
}

export function StoryViewer({
  storyGroups,
  initialGroupIdx,
  myUserId,
  myDisplayName,
  onViewRecorded,
  onClose,
}: Props) {
  const [groupIdx, setGroupIdx] = useState(initialGroupIdx);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress]   = useState(0);
  const [isPaused, setIsPaused]   = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers]         = useState<ViewerRecord[]>([]);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const recordedRef    = useRef<Set<string>>(new Set());
  const progressRef    = useRef(0);
  const rafRef         = useRef<number | null>(null);
  const videoRef       = useRef<HTMLVideoElement | null>(null);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const isPausingRef   = useRef(false);

  const currentGroup = storyGroups[groupIdx] as StoryGroup | undefined;
  const currentStory = currentGroup?.stories[storyIdx] as Story | undefined;
  const isOwnStory   = currentStory?.user_id === myUserId;

  // ── Navigation ───────────────────────────────────────────────────────────
  const cancelRaf = () => { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } };

  const goNext = useCallback(() => {
    if (!currentGroup) { onClose(); return; }
    cancelRaf();
    progressRef.current = 0;
    setProgress(0);
    setShowDeleteConfirm(false);
    if (storyIdx < currentGroup.stories.length - 1) {
      setStoryIdx((i) => i + 1);
    } else if (groupIdx < storyGroups.length - 1) {
      setGroupIdx((g) => g + 1);
      setStoryIdx(0);
    } else {
      onClose();
    }
  }, [currentGroup, storyIdx, groupIdx, storyGroups.length, onClose]); // eslint-disable-line

  const goPrev = useCallback(() => {
    cancelRaf();
    progressRef.current = 0;
    setProgress(0);
    setShowDeleteConfirm(false);
    if (storyIdx > 0) {
      setStoryIdx((i) => i - 1);
    } else if (groupIdx > 0) {
      const prevGroup = storyGroups[groupIdx - 1];
      setGroupIdx((g) => g - 1);
      setStoryIdx(prevGroup ? prevGroup.stories.length - 1 : 0);
    }
  }, [storyIdx, groupIdx, storyGroups]); // eslint-disable-line

  // ── Record view ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentStory) return;
    setShowViewers(false);
    setShowDeleteConfirm(false);
    if (isOwnStory) return;
    const id = currentStory.id;
    if (recordedRef.current.has(id)) return;
    recordedRef.current.add(id);
    supabase
      .from('story_views')
      .insert({ story_id: id, viewer_id: myUserId, viewed_at: new Date().toISOString() }, { ignoreDuplicates: true } as any)
      .then(({ error }) => {
        if (error) { console.error('[story-view] insert failed:', error.message); return; }
        onViewRecorded?.();
      });
    createNotification({
      userId: currentStory.user_id, senderId: myUserId, type: 'message',
      message: `${myDisplayName} hikayeni gördü`,
    }).catch(() => {});
  }, [currentStory?.id, isOwnStory]); // eslint-disable-line

  // ── Progress RAF (image + text) ──────────────────────────────────────────
  useEffect(() => {
    cancelRaf();
    if (!currentStory || currentStory.media_type === 'video' || isPaused || showDeleteConfirm) return;
    const startP   = progressRef.current;
    const remaining = IMAGE_DURATION * (1 - startP / 100);
    const t0        = Date.now();
    const tick = () => {
      const newP = Math.min(startP + ((Date.now() - t0) / remaining) * (100 - startP), 100);
      progressRef.current = newP;
      setProgress(newP);
      if (newP >= 100) goNext();
      else rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return cancelRaf;
  }, [groupIdx, storyIdx, isPaused, showDeleteConfirm]); // eslint-disable-line

  // ── Video sync ───────────────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v || currentStory?.media_type !== 'video') return;
    if (isPaused || showDeleteConfirm) v.pause();
    else v.play().catch(() => {});
  }, [isPaused, showDeleteConfirm, currentStory?.media_type]);

  const handleVideoTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const cap = Math.min(v.duration, MAX_VIDEO_SECS);
    const p   = Math.min((v.currentTime / cap) * 100, 100);
    progressRef.current = p;
    setProgress(p);
    if (p >= 100) goNext();
  };

  // ── Pointer handlers ─────────────────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent) => {
    if (showDeleteConfirm) return;
    touchStartXRef.current = e.clientX;
    touchStartYRef.current = e.clientY;
    isPausingRef.current   = true;
    setIsPaused(true);
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isPausingRef.current) return;
    isPausingRef.current = false;
    setIsPaused(false);
    const dx = Math.abs(e.clientX - touchStartXRef.current);
    const dy = Math.abs(e.clientY - touchStartYRef.current);
    if (dx < 12 && dy < 12) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      if (e.clientX - rect.left < rect.width / 2) goPrev();
      else goNext();
    }
  };
  const handlePointerLeave = () => {
    if (!isPausingRef.current) return;
    isPausingRef.current = false;
    setIsPaused(false);
  };

  // ── Delete story ─────────────────────────────────────────────────────────
  const handleDeleteStory = async () => {
    if (!currentStory || deleting) return;
    setDeleting(true);
    const { error } = await supabase.from('stories').delete().eq('id', currentStory.id);
    if (error) {
      toast.error('Hikaye silinemedi: ' + error.message);
      setDeleting(false);
      return;
    }
    // Try to delete media from storage
    if (currentStory.media_url) {
      const path = storagePathFromUrl(currentStory.media_url);
      if (path) supabase.storage.from('images').remove([path]).catch(() => {});
    }
    toast.success('Hikaye silindi');
    onViewRecorded?.();
    onClose();
  };

  // ── Viewer list ──────────────────────────────────────────────────────────
  const openViewers = async () => {
    if (!currentStory) return;
    setShowViewers(true);
    setLoadingViewers(true);
    setViewers([]);
    const { data: views, error } = await supabase
      .from('story_views')
      .select('viewer_id, viewed_at')
      .eq('story_id', currentStory.id)
      .order('viewed_at', { ascending: false });
    if (error) { console.error('[story-viewers]', error.message); setLoadingViewers(false); return; }
    const viewerIds = (views ?? []).map((v: any) => v.viewer_id as string);
    if (!viewerIds.length) { setViewers([]); setLoadingViewers(false); return; }
    const { data: profiles } = await supabase
      .from('profiles').select('id, display_name, photo_url').in('id', viewerIds);
    const pm: Record<string, any> = {};
    for (const p of profiles ?? []) pm[p.id] = p;
    setViewers((views ?? []).map((v: any) => ({
      viewer_id:    v.viewer_id,
      viewed_at:    v.viewed_at,
      display_name: pm[v.viewer_id]?.display_name ?? 'Üye',
      photo_url:    pm[v.viewer_id]?.photo_url    ?? '',
    })));
    setLoadingViewers(false);
  };

  if (!currentGroup || !currentStory) return null;

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
      <div className="relative w-full h-full max-w-md mx-auto flex flex-col select-none">

        {/* ── Progress bars ─────────────────────────────────────────── */}
        <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 px-2 pt-2 pointer-events-none">
          {currentGroup.stories.map((_, i) => (
            <div key={i} className="flex-1 h-[2.5px] bg-white/25 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full"
                style={{ width: i < storyIdx ? '100%' : i === storyIdx ? `${progress}%` : '0%', transition: 'none' }}
              />
            </div>
          ))}
        </div>

        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="absolute top-5 left-0 right-0 z-20 px-3 flex items-center gap-2.5 pointer-events-none">
          <div className="w-9 h-9 rounded-full border-2 border-white/50 overflow-hidden flex-shrink-0">
            {currentGroup.photo_url
              ? <img src={currentGroup.photo_url} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-primary/20 flex items-center justify-center"><User className="w-4 h-4 text-primary" /></div>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-none">{currentGroup.display_name}</p>
            <p className="text-[11px] text-white/65 mt-0.5">{fmtAgo(currentStory.created_at)}</p>
          </div>

          {/* Delete button (own story only) */}
          {isOwnStory && (
            <button
              type="button"
              className="pointer-events-auto p-2 text-white/70 hover:text-red-400 transition-colors"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); setIsPaused(true); }}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            className="pointer-events-auto p-2 text-white/80 hover:text-white transition-colors"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onClose(); }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Story content ──────────────────────────────────────────── */}
        <div className="w-full h-full relative">
          {currentStory.media_type === 'image' && currentStory.media_url && (
            <>
              <img
                src={currentStory.media_url}
                alt="Hikaye"
                className="w-full h-full object-cover"
                draggable={false}
              />
              {currentStory.text_overlay && (
                <TextOverlay overlay={currentStory.text_overlay as StoryTextOverlay} />
              )}
            </>
          )}
          {currentStory.media_type === 'video' && currentStory.media_url && (
            <video
              key={currentStory.id}
              ref={videoRef}
              src={currentStory.media_url}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={goNext}
            />
          )}
          {currentStory.media_type === 'text' && (
            <div
              className="w-full h-full flex items-center justify-center p-10"
              style={{ background: currentStory.text_bg ?? '#0d0d0d' }}
            >
              <p className="text-white text-2xl font-semibold text-center leading-relaxed break-words"
                 style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                {currentStory.text_content}
              </p>
            </div>
          )}
        </div>

        {/* ── Viewer count button (own story) ───────────────────────── */}
        {isOwnStory && !showDeleteConfirm && (
          <button
            type="button"
            className="absolute bottom-0 left-0 right-0 z-20 pointer-events-auto flex flex-col items-center pb-8 pt-4 gap-1"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)' }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); openViewers(); }}
          >
            <ChevronUp className="w-5 h-5 text-white/70" />
            <div className="flex items-center gap-1.5 text-white">
              <Eye className="w-4 h-4" />
              <span className="text-sm font-medium">
                {currentStory.view_count === 0 ? 'Henüz görüntülenmedi' : `${currentStory.view_count} görüntüleme`}
              </span>
            </div>
          </button>
        )}
      </div>

      {/* ── Delete confirmation ──────────────────────────────────────── */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 z-30"
              onPointerDown={(e) => e.stopPropagation()}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="absolute inset-0 z-40 flex items-center justify-center px-6"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="glass rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <h3 className="font-serif text-lg font-bold text-foreground">Hikayeyi Sil</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-6">Bu hikaye kalıcı olarak silinecek. Bu işlem geri alınamaz.</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowDeleteConfirm(false); setIsPaused(false); }}
                    className="flex-1 py-2.5 rounded-xl border border-white/15 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors text-sm"
                  >
                    İptal
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteStory}
                    disabled={deleting}
                    className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {deleting
                      ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      : <Trash2 className="w-4 h-4" />}
                    Sil
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Viewer list bottom sheet ─────────────────────────────────── */}
      <AnimatePresence>
        {showViewers && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 z-30"
              onPointerDown={(e) => { e.stopPropagation(); setShowViewers(false); }}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 max-w-md mx-auto z-40 glass rounded-t-2xl flex flex-col"
              style={{ maxHeight: '60dvh' }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" />
                  <span className="font-serif text-sm font-bold">Görüntüleyenler</span>
                  {!loadingViewers && <span className="text-xs text-muted-foreground">({viewers.length})</span>}
                </div>
                <button type="button" onClick={() => setShowViewers(false)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 overflow-y-auto py-2">
                {loadingViewers ? (
                  <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
                ) : viewers.length === 0 ? (
                  <div className="text-center py-10 space-y-2">
                    <Eye className="w-8 h-8 mx-auto text-muted-foreground opacity-30" />
                    <p className="text-sm text-muted-foreground">Henüz kimse görmedi</p>
                  </div>
                ) : viewers.map((v, i) => (
                  <div key={`${v.viewer_id}-${i}`} className="flex items-center gap-3 px-5 py-2.5">
                    <div className="w-10 h-10 rounded-full bg-primary/20 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {v.photo_url
                        ? <img src={v.photo_url} alt={v.display_name} className="w-full h-full object-cover" />
                        : <User className="w-5 h-5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{v.display_name}</p>
                      <p className="text-xs text-muted-foreground">{fmtTime(v.viewed_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
