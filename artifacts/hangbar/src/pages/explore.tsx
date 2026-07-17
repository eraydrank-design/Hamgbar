import { useAuth } from '@/lib/auth-context';
import { createNotification } from '@/lib/notify';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Martini, Plus, X, Camera, Loader2,
  Heart, MessageCircle, Send, Edit2, Trash2,
  MoreHorizontal, Bookmark, ChevronLeft, ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { useLocation } from 'wouter';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Post {
  id: string;
  author_id: string;
  author_name: string;
  author_photo: string;
  image_url: string;
  caption: string;
  cocktail_name: string;
  created_at: string;
}

interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  author_name: string;
  author_photo: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '';
  try { return format(new Date(d), 'd MMM', { locale: tr }); }
  catch { return ''; }
};

const fmtDateTime = (d: string | null | undefined) => {
  if (!d) return '';
  try { return format(new Date(d), 'd MMM HH:mm', { locale: tr }); }
  catch { return ''; }
};

/** Extracts the storage object path from a Supabase public URL */
function storagePathFromUrl(url: string, bucket = 'images'): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  return idx >= 0 ? url.slice(idx + marker.length) : null;
}

// ─── ImageCarousel ────────────────────────────────────────────────────────────

function ImageCarousel({ images, caption }: { images: string[]; caption: string }) {
  const [idx, setIdx] = useState(0);
  const touchStartX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const prev = (e: React.MouseEvent) => { e.stopPropagation(); setIdx((i) => Math.max(0, i - 1)); };
  const next = (e: React.MouseEvent) => { e.stopPropagation(); setIdx((i) => Math.min(images.length - 1, i + 1)); };

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd   = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx >  50 && idx > 0)                setIdx((i) => i - 1);
    if (dx < -50 && idx < images.length - 1) setIdx((i) => i + 1);
  };

  if (images.length === 1) {
    return (
      <div className="relative w-full" style={{ paddingBottom: '66%' }}>
        <img src={images[0]} alt={caption} className="absolute inset-0 w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden select-none"
      style={{ paddingBottom: '66%' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Slides */}
      <div
        className="absolute inset-0 flex transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${idx * 100}%)`, width: `${images.length * 100}%` }}
      >
        {images.map((url, i) => (
          <div key={i} className="relative flex-shrink-0" style={{ width: `${100 / images.length}%` }}>
            <img src={url} alt={`${caption} ${i + 1}`} className="w-full h-full object-cover absolute inset-0" />
          </div>
        ))}
      </div>

      {/* Counter badge */}
      <div className="absolute top-2 right-2 bg-black/60 text-white text-xs font-medium px-2 py-0.5 rounded-full backdrop-blur-sm z-10">
        {idx + 1}/{images.length}
      </div>

      {/* Arrow buttons */}
      {idx > 0 && (
        <button
          onClick={prev}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      {idx < images.length - 1 && (
        <button
          onClick={next}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Dot indicators */}
      <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1 z-10">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); setIdx(i); }}
            className={`rounded-full transition-all ${i === idx ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'}`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── CommentsSection ──────────────────────────────────────────────────────────

function CommentsSection({ postId, postAuthorId, user, userData }: { postId: string; postAuthorId: string; user: any; userData: any }) {
  const [comments, setComments]     = useState<Comment[]>([]);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editText, setEditText]     = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchComments = useCallback(async () => {
    const { data, error } = await supabase
      .from('post_comments').select('*').eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (!error) setComments((data ?? []) as Comment[]);
    setLoading(false);
  }, [postId]);

  useEffect(() => {
    fetchComments();
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const ch = supabase.channel(`comments-${postId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_comments', filter: `post_id=eq.${postId}` }, () => fetchComments())
      .subscribe();
    channelRef.current = ch;
    return () => { if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; } };
  }, [postId, fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('post_comments').insert({
        post_id: postId, author_id: user.id,
        author_name: userData?.display_name ?? 'Üye', author_photo: userData?.photo_url ?? '',
        content: newComment.trim(),
      });
      if (error) throw error;
      setNewComment('');
      if (postAuthorId && postAuthorId !== user.id) {
        createNotification({ userId: postAuthorId, senderId: user.id, type: 'comment', postId,
          message: `${userData?.display_name ?? 'Bir üye'} gönderinize yorum yaptı` }).catch(() => {});
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Yorum gönderilemedi.');
    } finally { setSubmitting(false); }
  };

  const saveEdit = async (commentId: string) => {
    if (!editText.trim()) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase.from('post_comments')
        .update({ content: editText.trim(), updated_at: new Date().toISOString() }).eq('id', commentId);
      if (error) throw error;
      setEditingId(null);
    } catch (err: any) { toast.error(err?.message ?? 'Yorum güncellenemedi.'); }
    finally { setSavingEdit(false); }
  };

  const deleteComment = async (commentId: string) => {
    setDeletingId(commentId);
    try {
      const { error } = await supabase.from('post_comments').delete().eq('id', commentId);
      if (error) throw error;
    } catch (err: any) { toast.error(err?.message ?? 'Yorum silinemedi.'); }
    finally { setDeletingId(null); }
  };

  return (
    <div className="border-t border-white/5 bg-black/20">
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="px-4 pt-3 pb-2 space-y-3 max-h-72 overflow-y-auto">
          {comments.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2 italic">Henüz yorum yok. İlk yorumu sen yap!</p>
          )}
          {comments.map((c) => {
            const isOwn    = c.author_id === user?.id;
            const wasEdited = c.updated_at !== c.created_at;
            return (
              <div key={c.id} className="flex items-start gap-2.5 group">
                <UserAvatar userId={c.author_id} photoUrl={c.author_photo} displayName={c.author_name} size="xs" />
                <div className="flex-1 min-w-0">
                  {editingId === c.id ? (
                    <div className="flex items-center gap-2">
                      <input autoFocus value={editText} onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(c.id); if (e.key === 'Escape') setEditingId(null); }}
                        className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/50" />
                      <button onClick={() => saveEdit(c.id)} disabled={savingEdit} className="text-primary hover:text-primary/80 disabled:opacity-50">
                        {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <div className="bg-white/5 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-medium text-foreground">{c.author_name}</span>
                        <span className="text-[10px] text-muted-foreground">{fmtDateTime(c.created_at)}</span>
                        {wasEdited && <span className="text-[10px] text-muted-foreground italic">(düzenlendi)</span>}
                      </div>
                      <p className="text-xs text-foreground/90 leading-relaxed break-words">{c.content}</p>
                    </div>
                  )}
                </div>
                {isOwn && editingId !== c.id && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1">
                    <button onClick={() => { setEditingId(c.id); setEditText(c.content); }} className="p-1 text-muted-foreground hover:text-primary transition-colors"><Edit2 className="w-3 h-3" /></button>
                    <button onClick={() => deleteComment(c.id)} disabled={deletingId === c.id} className="p-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50">
                      {deletingId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 pb-3 pt-2 border-t border-white/5">
        <UserAvatar userId={user?.id} photoUrl={userData?.photo_url} displayName={userData?.display_name} size="xs" />
        <div className="flex-1 flex items-center gap-2 bg-black/40 border border-white/10 rounded-full px-3 py-1.5 focus-within:border-primary/40 transition-colors">
          <input ref={useRef<HTMLInputElement>(null)} type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)}
            placeholder="Yorum yaz..." className="flex-1 bg-transparent text-xs text-foreground focus:outline-none placeholder:text-muted-foreground" />
          <button type="submit" disabled={!newComment.trim() || submitting} className="text-primary disabled:text-muted-foreground transition-colors disabled:opacity-50 flex-shrink-0">
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── PostCard ─────────────────────────────────────────────────────────────────

function PostCard({
  post, images, likeCount, likedByMe, commentCount, savedByMe,
  onLike, onSave, onDelete, user, userData,
}: {
  post: Post; images: string[]; likeCount: number; likedByMe: boolean;
  commentCount: number; savedByMe: boolean;
  onLike: (id: string, liked: boolean) => void;
  onSave: (id: string, saved: boolean) => void;
  onDelete: (id: string) => void;
  user: any; userData: any;
}) {
  const [commentsOpen, setCommentsOpen]     = useState(false);
  const [menuOpen, setMenuOpen]             = useState(false);
  const [deleteConfirm, setDeleteConfirm]   = useState(false);
  const [deleting, setDeleting]             = useState(false);
  const [, navigate] = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);

  const isOwnPost = post.author_id === user?.id;

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const confirmDelete = async () => {
    setDeleting(true);
    await onDelete(post.id);
    setDeleting(false);
    setDeleteConfirm(false);
  };

  // Determine display images
  const displayImages = images.length > 0 ? images : post.image_url ? [post.image_url] : [];

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl overflow-hidden border border-white/5"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3">
          <UserAvatar userId={post.author_id} photoUrl={post.author_photo} displayName={post.author_name} size="sm" />
          <div className="flex-1 min-w-0">
            <button onClick={() => post.author_id && navigate(`/profile/${post.author_id}`)}
              className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate block text-left">
              {post.author_name}
            </button>
            <p className="text-[11px] text-muted-foreground">{fmtDate(post.created_at)}</p>
          </div>
          {post.cocktail_name && (
            <div className="flex items-center gap-1 text-[10px] font-semibold text-primary uppercase tracking-widest flex-shrink-0">
              <Martini className="w-3 h-3" /> {post.cocktail_name}
            </div>
          )}
          {/* Three-dot menu (own post only) */}
          {isOwnPost && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-white/10 transition-colors"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-full mt-1 w-36 bg-[#181818] border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden"
                  >
                    <button
                      onClick={() => { setMenuOpen(false); setDeleteConfirm(true); }}
                      className="flex items-center gap-2.5 px-4 py-3 text-sm text-red-400 hover:bg-red-400/10 w-full text-left transition-colors"
                    >
                      <Trash2 className="w-4 h-4" /> Sil
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Images (single or carousel) */}
        {displayImages.length > 0 && (
          <ImageCarousel images={displayImages} caption={post.caption} />
        )}

        {/* Caption */}
        <div className="px-4 pt-3 pb-2">
          <p className="text-sm text-foreground leading-relaxed">{post.caption}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 px-3 pb-3">
          <button
            onClick={() => onLike(post.id, likedByMe)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              likedByMe ? 'text-red-400 bg-red-400/10' : 'text-muted-foreground hover:text-red-400 hover:bg-red-400/10'
            }`}
          >
            <Heart className={`w-4 h-4 transition-all ${likedByMe ? 'fill-red-400' : ''}`} />
            <span>{likeCount}</span>
          </button>
          <button
            onClick={() => setCommentsOpen((o) => !o)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              commentsOpen ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            <span>{commentCount}</span>
          </button>
          {/* Bookmark / Save */}
          <button
            onClick={() => onSave(post.id, savedByMe)}
            className={`ml-auto p-2 rounded-xl text-sm transition-all ${
              savedByMe ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
            }`}
            title={savedByMe ? 'Kaydı kaldır' : 'Kaydet'}
          >
            <Bookmark className={`w-4 h-4 transition-all ${savedByMe ? 'fill-primary' : ''}`} />
          </button>
        </div>

        {/* Comments section */}
        <AnimatePresence>
          {commentsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <CommentsSection postId={post.id} postAuthorId={post.author_id} user={user} userData={userData} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
              onClick={() => setDeleteConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }} transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center px-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="glass rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <h3 className="font-serif text-lg font-bold text-foreground">Gönderiyi Sil</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-6">Bu gönderi ve tüm yorumları kalıcı olarak silinecek. Bu işlem geri alınamaz.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl border border-white/15 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors text-sm"
                  >
                    İptal
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={deleting}
                    className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Sil
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Main Explore Page ────────────────────────────────────────────────────────

export default function Explore() {
  const { user, userData } = useAuth();

  // Posts state
  const [posts, setPosts]             = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postImages, setPostImages]   = useState<Record<string, string[]>>({}); // postId → ordered image URLs

  // Likes state
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [myLikes, setMyLikes]       = useState<Set<string>>(new Set());

  // Comment counts state
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  // Saved posts state
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());

  // UI state
  const [search, setSearch]     = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // Post creation form state
  const [caption, setCaption]         = useState('');
  const [cocktailName, setCocktailName] = useState('');
  const [imageURLs, setImageURLs]     = useState<string[]>([]);  // up to 5 images
  const [uploadProgress, setUploadProgress] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const postsChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Fetch helpers ─────────────────────────────────────────────────────────

  const fetchLikes = useCallback(async (postIds: string[]) => {
    if (!postIds.length) return;
    const { data, error } = await supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds);
    if (error) { console.error('[explore] fetchLikes:', error); return; }
    const counts: Record<string, number> = {};
    const mySet = new Set<string>();
    for (const l of (data ?? [])) {
      counts[l.post_id] = (counts[l.post_id] ?? 0) + 1;
      if (l.user_id === user?.id) mySet.add(l.post_id);
    }
    setLikeCounts(counts);
    setMyLikes(mySet);
  }, [user?.id]);

  const fetchCommentCounts = useCallback(async (postIds: string[]) => {
    if (!postIds.length) return;
    const { data, error } = await supabase.from('post_comments').select('post_id').in('post_id', postIds);
    if (error) { console.error('[explore] fetchCommentCounts:', error); return; }
    const counts: Record<string, number> = {};
    for (const c of (data ?? [])) counts[c.post_id] = (counts[c.post_id] ?? 0) + 1;
    setCommentCounts(counts);
  }, []);

  const fetchSavedPosts = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase.from('saved_posts').select('post_id').eq('user_id', user.id);
    setSavedPosts(new Set((data ?? []).map((r: any) => r.post_id as string)));
  }, [user?.id]);

  const fetchPostImages = useCallback(async (postIds: string[]) => {
    if (!postIds.length) return;
    const { data } = await supabase
      .from('post_images').select('post_id, image_url, order_index')
      .in('post_id', postIds).order('order_index', { ascending: true });
    const map: Record<string, string[]> = {};
    for (const row of (data ?? [])) {
      if (!map[row.post_id]) map[row.post_id] = [];
      map[row.post_id].push(row.image_url);
    }
    setPostImages(map);
  }, []);

  const fetchPosts = useCallback(async () => {
    setPostsLoading(true);
    const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
    if (error) { console.error('[explore] fetchPosts:', error); setPostsLoading(false); return; }
    const postsData = (data ?? []) as Post[];
    setPosts(postsData);
    setPostsLoading(false);
    const ids = postsData.map((p) => p.id);
    if (ids.length > 0) {
      await Promise.all([
        fetchLikes(ids),
        fetchCommentCounts(ids),
        fetchPostImages(ids),
      ]);
    }
    fetchSavedPosts();
  }, [fetchLikes, fetchCommentCounts, fetchPostImages, fetchSavedPosts]);

  // ── Initial load + realtime ───────────────────────────────────────────────
  useEffect(() => {
    fetchPosts();
    if (postsChannelRef.current) supabase.removeChannel(postsChannelRef.current);
    const ch = supabase.channel('explore-posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (payload) => {
        const newPost = payload.new as Post;
        setPosts((prev) => [newPost, ...prev]);
        fetchLikes([newPost.id]);
        fetchCommentCounts([newPost.id]);
        fetchPostImages([newPost.id]);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, (payload) => {
        setPosts((prev) => prev.filter((p) => p.id !== (payload.old as any).id));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_likes' }, () => {
        setPosts((prev) => { fetchLikes(prev.map((p) => p.id)); return prev; });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_comments' }, () => {
        setPosts((prev) => { fetchCommentCounts(prev.map((p) => p.id)); return prev; });
      })
      .subscribe();
    postsChannelRef.current = ch;
    return () => { if (postsChannelRef.current) { supabase.removeChannel(postsChannelRef.current); postsChannelRef.current = null; } };
  }, [fetchPosts]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Like / Unlike ─────────────────────────────────────────────────────────
  const handleLike = async (postId: string, alreadyLiked: boolean) => {
    if (!user) return;
    if (alreadyLiked) {
      setMyLikes((s) => { const n = new Set(s); n.delete(postId); return n; });
      setLikeCounts((c) => ({ ...c, [postId]: Math.max(0, (c[postId] ?? 1) - 1) }));
      const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
      if (error) {
        setMyLikes((s) => new Set([...s, postId]));
        setLikeCounts((c) => ({ ...c, [postId]: (c[postId] ?? 0) + 1 }));
        toast.error('Beğeni kaldırılamadı.');
      }
    } else {
      setMyLikes((s) => new Set([...s, postId]));
      setLikeCounts((c) => ({ ...c, [postId]: (c[postId] ?? 0) + 1 }));
      const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
      if (error) {
        setMyLikes((s) => { const n = new Set(s); n.delete(postId); return n; });
        setLikeCounts((c) => ({ ...c, [postId]: Math.max(0, (c[postId] ?? 1) - 1) }));
        toast.error('Beğeni kaydedilemedi.');
        return;
      }
      const likedPost = posts.find((p) => p.id === postId);
      if (likedPost?.author_id && likedPost.author_id !== user.id) {
        createNotification({ userId: likedPost.author_id, senderId: user.id, type: 'like', postId,
          message: `${userData?.display_name ?? 'Bir üye'} gönderinizi beğendi` }).catch(() => {});
      }
    }
  };

  // ── Save / Unsave ─────────────────────────────────────────────────────────
  const handleSave = async (postId: string, alreadySaved: boolean) => {
    if (!user) return;
    if (alreadySaved) {
      setSavedPosts((s) => { const n = new Set(s); n.delete(postId); return n; });
      await supabase.from('saved_posts').delete().eq('user_id', user.id).eq('post_id', postId);
    } else {
      setSavedPosts((s) => new Set([...s, postId]));
      const { error } = await supabase.from('saved_posts').insert({ user_id: user.id, post_id: postId });
      if (error) {
        setSavedPosts((s) => { const n = new Set(s); n.delete(postId); return n; });
        toast.error('Gönderi kaydedilemedi.');
      }
    }
  };

  // ── Delete post ───────────────────────────────────────────────────────────
  const handleDelete = async (postId: string) => {
    // Optimistic remove
    const deletedPost = posts.find((p) => p.id === postId);
    const deletedImages = postImages[postId] ?? [];
    setPosts((prev) => prev.filter((p) => p.id !== postId));

    const { error } = await supabase.from('posts').delete().eq('id', postId).eq('author_id', user!.id);
    if (error) {
      toast.error('Gönderi silinemedi: ' + error.message);
      if (deletedPost) setPosts((prev) => [deletedPost, ...prev].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      return;
    }

    // Best-effort storage cleanup
    const urlsToDelete: string[] = [];
    if (deletedPost?.image_url) { const p = storagePathFromUrl(deletedPost.image_url); if (p) urlsToDelete.push(p); }
    for (const url of deletedImages) { const p = storagePathFromUrl(url); if (p && !urlsToDelete.includes(p)) urlsToDelete.push(p); }
    if (urlsToDelete.length > 0) supabase.storage.from('images').remove(urlsToDelete).catch(() => {});

    toast.success('Gönderi silindi.');
  };

  // ── Image upload (multi) ──────────────────────────────────────────────────
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 5 - imageURLs.length);
    if (!files.length) return;
    setUploadProgress(true);
    const uploaded: string[] = [];
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name}: Dosya 10 MB'ı geçemez.`); continue; }
      try {
        const ext  = file.name.split('.').pop();
        const path = `explore-posts/${user?.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('images').upload(path, file, { upsert: true });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('images').getPublicUrl(path);
        uploaded.push(data.publicUrl);
      } catch (err: any) {
        toast.error(`Görsel yüklenemedi: ${err?.message ?? 'Bilinmeyen hata'}`);
      }
    }
    setImageURLs((prev) => [...prev, ...uploaded].slice(0, 5));
    setUploadProgress(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (idx: number) => setImageURLs((prev) => prev.filter((_, i) => i !== idx));

  // ── Submit post ───────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!imageURLs.length) { toast.error('Lütfen en az bir fotoğraf yükleyin.'); return; }
    if (!caption.trim())   { toast.error('Lütfen bir açıklama yazın.'); return; }
    setIsSubmitting(true);
    try {
      const { data: newPost, error: postError } = await supabase.from('posts').insert({
        author_id: user?.id, author_name: userData?.display_name ?? 'Üye',
        author_photo: userData?.photo_url ?? '', image_url: imageURLs[0],
        caption: caption.trim(), cocktail_name: cocktailName.trim(),
        created_at: new Date().toISOString(),
      }).select().single();
      if (postError) throw postError;

      // Save carousel images (all, including first for consistency)
      if (newPost && imageURLs.length > 1) {
        await supabase.from('post_images').insert(
          imageURLs.map((url, i) => ({ post_id: newPost.id, image_url: url, order_index: i }))
        );
      }

      if (cocktailName.trim()) {
        supabase.from('cocktail_submissions').insert({
          submitted_by: user?.id, submitted_by_name: userData?.display_name ?? 'Üye',
          submitted_by_photo: userData?.photo_url ?? '', image_url: imageURLs[0],
          cocktail_name: cocktailName.trim(), status: 'pending',
          created_at: new Date().toISOString(),
        }).then(({ error: subError }) => {
          if (subError) console.warn('[explore] cocktail submission error:', subError);
        });
      }

      toast.success('Gönderi paylaşıldı.');
      setModalOpen(false);
      setCaption('');
      setCocktailName('');
      setImageURLs([]);
    } catch (err: any) {
      toast.error(`Gönderi paylaşılamadı: ${err?.message ?? String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    if (isSubmitting || uploadProgress) return;
    setModalOpen(false);
    setCaption('');
    setCocktailName('');
    setImageURLs([]);
  };

  // ── Filter ────────────────────────────────────────────────────────────────
  const filteredPosts = posts.filter((p) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return p.caption?.toLowerCase().includes(term)
      || p.cocktail_name?.toLowerCase().includes(term)
      || p.author_name?.toLowerCase().includes(term);
  });

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-gradient-gold mb-2">Keşfet</h1>
          <p className="text-muted-foreground">Üyelerin paylaşımları.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Ara..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50" />
          </div>
          <button onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors shadow-[0_0_12px_rgba(201,168,76,0.3)] whitespace-nowrap">
            <Plus className="w-4 h-4" /> Paylaş
          </button>
        </div>
      </header>

      {/* Posts feed */}
      {postsLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass p-4 rounded-2xl animate-pulse space-y-3">
              <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-white/10" /><div className="h-3 w-32 bg-white/10 rounded" /></div>
              <div className="w-full h-52 bg-white/10 rounded-xl" />
              <div className="h-3 w-3/4 bg-white/10 rounded" />
            </div>
          ))}
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-20 glass rounded-2xl border border-dashed border-white/10">
          <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-1">{search ? 'Sonuç bulunamadı' : 'Henüz paylaşım yok'}</h3>
          <p className="text-muted-foreground text-sm">{search ? 'Arama teriminizi değiştirin.' : 'İlk paylaşımı sen yap!'}</p>
        </div>
      ) : (
        <div className="max-w-lg mx-auto space-y-4">
          {filteredPosts.map((post) => (
            <PostCard
              key={post.id} post={post}
              images={postImages[post.id] ?? []}
              likeCount={likeCounts[post.id] ?? 0}
              likedByMe={myLikes.has(post.id)}
              commentCount={commentCounts[post.id] ?? 0}
              savedByMe={savedPosts.has(post.id)}
              onLike={handleLike} onSave={handleSave} onDelete={handleDelete}
              user={user} userData={userData}
            />
          ))}
        </div>
      )}

      {/* Post creation modal */}
      <AnimatePresence>
        {modalOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={closeModal} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}
            >
              <div className="glass border border-white/10 rounded-2xl w-full max-w-md shadow-2xl max-h-[90dvh] flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-white/10 flex-shrink-0">
                  <h2 className="font-serif text-xl font-bold text-gradient-gold">Gönderi Oluştur</h2>
                  <button onClick={closeModal} disabled={isSubmitting}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {/* Multi-image upload area */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      Fotoğraflar <span className="text-destructive">*</span>
                      <span className="normal-case font-normal text-muted-foreground/60 ml-1">(en fazla 5)</span>
                    </label>

                    {/* Uploaded images grid */}
                    {imageURLs.length > 0 && (
                      <div className="flex gap-2 flex-wrap mb-3">
                        {imageURLs.map((url, i) => (
                          <div key={url} className="relative group">
                            <img src={url} alt={`Fotoğraf ${i + 1}`} className="w-20 h-20 object-cover rounded-xl border border-white/10" />
                            {i === 0 && (
                              <span className="absolute bottom-1 left-1 text-[9px] bg-primary text-primary-foreground px-1 rounded font-medium">Kapak</span>
                            )}
                            <button
                              type="button"
                              onClick={() => removeImage(i)}
                              className="absolute top-1 right-1 bg-black/80 rounded-full p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        {/* Add more button */}
                        {imageURLs.length < 5 && (
                          <button
                            type="button"
                            onClick={() => !uploadProgress && fileInputRef.current?.click()}
                            disabled={uploadProgress}
                            className="w-20 h-20 border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center text-muted-foreground hover:border-primary/50 transition-colors"
                          >
                            {uploadProgress ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <Plus className="w-5 h-5" />}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Empty state */}
                    {imageURLs.length === 0 && (
                      <div
                        onClick={() => !uploadProgress && fileInputRef.current?.click()}
                        className="relative w-full rounded-xl border-2 border-dashed border-white/20 overflow-hidden cursor-pointer hover:border-primary/40 transition-colors"
                        style={{ minHeight: 160 }}
                      >
                        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                          {uploadProgress
                            ? <><Loader2 className="w-8 h-8 animate-spin mb-2 text-primary" /><span className="text-sm">Yükleniyor...</span></>
                            : <><Camera className="w-10 h-10 mb-2 opacity-40" /><span className="text-sm">Fotoğraf seç (zorunlu)</span><span className="text-xs mt-1 opacity-60">Birden fazla seçebilirsiniz · Maks. 10 MB</span></>}
                        </div>
                      </div>
                    )}

                    <input
                      ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple
                      className="hidden" onChange={handleImageSelect}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                      Açıklama <span className="text-destructive">*</span>
                    </label>
                    <textarea placeholder="Bu gece ne hazırladınız? Paylaşın..." value={caption}
                      onChange={(e) => setCaption(e.target.value)} rows={3}
                      className="w-full bg-black/50 border border-white/10 rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 resize-none text-sm" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                      Kokteyl Adı <span className="text-muted-foreground/60 normal-case font-normal">(isteğe bağlı)</span>
                    </label>
                    <input type="text" placeholder="Örn: Dark Velvet" value={cocktailName}
                      onChange={(e) => setCocktailName(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 text-sm" />
                  </div>

                  {cocktailName.trim() && (
                    <p className="text-xs text-primary/80 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                      🍸 Bu kokteyl yönetici onayına gönderilecek ve puanlarınıza yansıyacak.
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-3 px-6 pb-6 flex-shrink-0">
                  <button onClick={closeModal} disabled={isSubmitting}
                    className="px-4 py-2 rounded-lg text-muted-foreground hover:bg-white/5 transition-colors disabled:opacity-50">
                    İptal
                  </button>
                  <button onClick={handleSubmit}
                    disabled={isSubmitting || uploadProgress || !imageURLs.length || !caption.trim()}
                    className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-[0_0_12px_rgba(201,168,76,0.2)]">
                    {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Paylaşılıyor...</> : 'Paylaş'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
