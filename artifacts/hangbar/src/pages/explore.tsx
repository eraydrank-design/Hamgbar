import { useAuth } from '@/lib/auth-context';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Martini, Plus, X, Camera, Loader2,
  Heart, MessageCircle, Send, Edit2, Trash2,
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

// ─── CommentsSection ──────────────────────────────────────────────────────────

function CommentsSection({ postId, user, userData }: { postId: string; user: any; userData: any }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch comments + subscribe to real-time
  const fetchComments = useCallback(async () => {
    const { data, error } = await supabase
      .from('post_comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (!error) setComments((data ?? []) as Comment[]);
    setLoading(false);
  }, [postId]);

  useEffect(() => {
    fetchComments();

    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const ch = supabase
      .channel(`comments-${postId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_comments', filter: `post_id=eq.${postId}` }, () => {
        fetchComments();
      })
      .subscribe();
    channelRef.current = ch;

    return () => {
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    };
  }, [postId, fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('post_comments').insert({
        post_id: postId,
        author_id: user.id,
        author_name: userData?.display_name ?? 'Üye',
        author_photo: userData?.photo_url ?? '',
        content: newComment.trim(),
      });
      if (error) throw error;
      setNewComment('');
    } catch (err: any) {
      toast.error(err?.message ?? 'Yorum gönderilemedi.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditText(comment.content);
  };

  const cancelEdit = () => { setEditingId(null); setEditText(''); };

  const saveEdit = async (commentId: string) => {
    if (!editText.trim()) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase.from('post_comments')
        .update({ content: editText.trim(), updated_at: new Date().toISOString() })
        .eq('id', commentId);
      if (error) throw error;
      setEditingId(null);
    } catch (err: any) {
      toast.error(err?.message ?? 'Yorum güncellenemedi.');
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    setDeletingId(commentId);
    try {
      const { error } = await supabase.from('post_comments').delete().eq('id', commentId);
      if (error) throw error;
    } catch (err: any) {
      toast.error(err?.message ?? 'Yorum silinemedi.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="border-t border-white/5 bg-black/20">
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="px-4 pt-3 pb-2 space-y-3 max-h-72 overflow-y-auto">
          {comments.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2 italic">Henüz yorum yok. İlk yorumu sen yap!</p>
          )}
          {comments.map((c) => {
            const isOwn = c.author_id === user?.id;
            const wasEdited = c.updated_at !== c.created_at;
            return (
              <div key={c.id} className="flex items-start gap-2.5 group">
                <UserAvatar userId={c.author_id} photoUrl={c.author_photo} displayName={c.author_name} size="xs" />
                <div className="flex-1 min-w-0">
                  {editingId === c.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(c.id); if (e.key === 'Escape') cancelEdit(); }}
                        className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/50"
                      />
                      <button onClick={() => saveEdit(c.id)} disabled={savingEdit} className="text-primary hover:text-primary/80 disabled:opacity-50">
                        {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground">
                        <X className="w-3.5 h-3.5" />
                      </button>
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
                    <button onClick={() => startEdit(c)} className="p-1 text-muted-foreground hover:text-primary transition-colors" title="Düzenle">
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => deleteComment(c.id)}
                      disabled={deletingId === c.id}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      title="Sil"
                    >
                      {deletingId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New comment input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 pb-3 pt-2 border-t border-white/5">
        <UserAvatar userId={user?.id} photoUrl={userData?.photo_url} displayName={userData?.display_name} size="xs" />
        <div className="flex-1 flex items-center gap-2 bg-black/40 border border-white/10 rounded-full px-3 py-1.5 focus-within:border-primary/40 transition-colors">
          <input
            ref={inputRef}
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Yorum yaz..."
            className="flex-1 bg-transparent text-xs text-foreground focus:outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!newComment.trim() || submitting}
            className="text-primary disabled:text-muted-foreground transition-colors disabled:opacity-50 flex-shrink-0"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── PostCard ─────────────────────────────────────────────────────────────────

function PostCard({
  post, likeCount, likedByMe, commentCount, onLike, user, userData,
}: {
  post: Post; likeCount: number; likedByMe: boolean; commentCount: number;
  onLike: (id: string, liked: boolean) => void;
  user: any; userData: any;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [, navigate] = useLocation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl overflow-hidden border border-white/5"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <UserAvatar userId={post.author_id} photoUrl={post.author_photo} displayName={post.author_name} size="sm" />
        <div className="flex-1 min-w-0">
          <button
            onClick={() => post.author_id && navigate(`/profile/${post.author_id}`)}
            className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate block text-left"
          >
            {post.author_name}
          </button>
          <p className="text-[11px] text-muted-foreground">{fmtDate(post.created_at)}</p>
        </div>
        {post.cocktail_name && (
          <div className="flex items-center gap-1 text-[10px] font-semibold text-primary uppercase tracking-widest flex-shrink-0">
            <Martini className="w-3 h-3" /> {post.cocktail_name}
          </div>
        )}
      </div>

      {/* Image */}
      {post.image_url && (
        <div className="relative w-full" style={{ paddingBottom: '66%' }}>
          <img src={post.image_url} alt={post.caption} className="absolute inset-0 w-full h-full object-cover" />
        </div>
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
            likedByMe
              ? 'text-red-400 bg-red-400/10'
              : 'text-muted-foreground hover:text-red-400 hover:bg-red-400/10'
          }`}
        >
          <Heart className={`w-4 h-4 transition-all ${likedByMe ? 'fill-red-400' : ''}`} />
          <span>{likeCount}</span>
        </button>

        <button
          onClick={() => setCommentsOpen((o) => !o)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
            commentsOpen
              ? 'text-primary bg-primary/10'
              : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <span>{commentCount}</span>
        </button>
      </div>

      {/* Comments section */}
      <AnimatePresence>
        {commentsOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <CommentsSection postId={post.id} user={user} userData={userData} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Explore Page ────────────────────────────────────────────────────────

export default function Explore() {
  const { user, userData } = useAuth();

  // Posts state
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  // Likes state
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());

  // Comment counts state
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  // UI state
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // Post creation form state
  const [caption, setCaption] = useState('');
  const [cocktailName, setCocktailName] = useState('');
  const [imageURL, setImageURL] = useState('');
  const [uploadProgress, setUploadProgress] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const postsChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Fetch likes for a set of post IDs ──────────────────────────────────────
  const fetchLikes = useCallback(async (postIds: string[]) => {
    if (!postIds.length) return;
    const { data, error } = await supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds);
    if (error) { console.error('[explore] fetchLikes error:', error); return; }
    const counts: Record<string, number> = {};
    const mySet = new Set<string>();
    for (const l of (data ?? [])) {
      counts[l.post_id] = (counts[l.post_id] ?? 0) + 1;
      if (l.user_id === user?.id) mySet.add(l.post_id);
    }
    setLikeCounts(counts);
    setMyLikes(mySet);
  }, [user?.id]);

  // ── Fetch comment counts for a set of post IDs ────────────────────────────
  const fetchCommentCounts = useCallback(async (postIds: string[]) => {
    if (!postIds.length) return;
    const { data, error } = await supabase.from('post_comments').select('post_id').in('post_id', postIds);
    if (error) { console.error('[explore] fetchCommentCounts error:', error); return; }
    const counts: Record<string, number> = {};
    for (const c of (data ?? [])) {
      counts[c.post_id] = (counts[c.post_id] ?? 0) + 1;
    }
    setCommentCounts(counts);
  }, []);

  // ── Fetch all posts ───────────────────────────────────────────────────────
  const fetchPosts = useCallback(async () => {
    setPostsLoading(true);
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.error('[explore] fetchPosts error:', error); setPostsLoading(false); return; }
    const postsData = (data ?? []) as Post[];
    setPosts(postsData);
    setPostsLoading(false);

    const ids = postsData.map((p) => p.id);
    if (ids.length > 0) {
      await Promise.all([fetchLikes(ids), fetchCommentCounts(ids)]);
    }
  }, [fetchLikes, fetchCommentCounts]);

  // ── Initial load + real-time subscription ─────────────────────────────────
  useEffect(() => {
    fetchPosts();

    if (postsChannelRef.current) supabase.removeChannel(postsChannelRef.current);
    const ch = supabase
      .channel('explore-posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (payload) => {
        const newPost = payload.new as Post;
        setPosts((prev) => [newPost, ...prev]);
        // Fetch likes/comments for the new post
        fetchLikes([newPost.id]);
        fetchCommentCounts([newPost.id]);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, (payload) => {
        setPosts((prev) => prev.filter((p) => p.id !== (payload.old as any).id));
      })
      // Re-fetch like counts when any like changes
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_likes' }, () => {
        // Batch refetch likes for all currently loaded posts
        setPosts((prev) => { fetchLikes(prev.map((p) => p.id)); return prev; });
      })
      // Re-fetch comment counts when any comment changes
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_comments' }, () => {
        setPosts((prev) => { fetchCommentCounts(prev.map((p) => p.id)); return prev; });
      })
      .subscribe();
    postsChannelRef.current = ch;

    return () => {
      if (postsChannelRef.current) { supabase.removeChannel(postsChannelRef.current); postsChannelRef.current = null; }
    };
  }, [fetchPosts]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Like / Unlike (persistent) ────────────────────────────────────────────
  const handleLike = async (postId: string, alreadyLiked: boolean) => {
    if (!user) return;
    // Optimistic update
    if (alreadyLiked) {
      setMyLikes((s) => { const n = new Set(s); n.delete(postId); return n; });
      setLikeCounts((c) => ({ ...c, [postId]: Math.max(0, (c[postId] ?? 1) - 1) }));
    } else {
      setMyLikes((s) => new Set([...s, postId]));
      setLikeCounts((c) => ({ ...c, [postId]: (c[postId] ?? 0) + 1 }));
    }
    // Persist to Supabase
    try {
      if (alreadyLiked) {
        const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
        if (error) throw error;
      }
    } catch (err: any) {
      // Roll back optimistic update on failure
      if (alreadyLiked) {
        setMyLikes((s) => new Set([...s, postId]));
        setLikeCounts((c) => ({ ...c, [postId]: (c[postId] ?? 0) + 1 }));
      } else {
        setMyLikes((s) => { const n = new Set(s); n.delete(postId); return n; });
        setLikeCounts((c) => ({ ...c, [postId]: Math.max(0, (c[postId] ?? 1) - 1) }));
      }
      toast.error(err?.message ?? 'Beğeni kaydedilemedi.');
    }
  };

  // ── Image upload ──────────────────────────────────────────────────────────
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Dosya boyutu 10 MB\'ı geçemez.'); return; }
    setUploadProgress(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `explore-posts/${user?.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('images').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('images').getPublicUrl(path);
      setImageURL(data.publicUrl);
      toast.success('Görsel yüklendi.');
    } catch (err: any) {
      toast.error(`Görsel yüklenemedi: ${err?.message ?? 'Bilinmeyen hata'}`);
    } finally {
      setUploadProgress(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Submit post ───────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!imageURL) { toast.error('Lütfen bir fotoğraf yükleyin.'); return; }
    if (!caption.trim()) { toast.error('Lütfen bir açıklama yazın.'); return; }
    setIsSubmitting(true);
    try {
      // Insert social post
      const { error: postError } = await supabase.from('posts').insert({
        author_id: user?.id,
        author_name: userData?.display_name ?? 'Üye',
        author_photo: userData?.photo_url ?? '',
        image_url: imageURL,
        caption: caption.trim(),
        cocktail_name: cocktailName.trim(),
        created_at: new Date().toISOString(),
      });
      if (postError) throw postError;

      // If cocktail name provided, also create a submission for approval
      if (cocktailName.trim()) {
        const { error: subError } = await supabase.from('cocktail_submissions').insert({
          submitted_by: user?.id,
          submitted_by_name: userData?.display_name ?? 'Üye',
          submitted_by_photo: userData?.photo_url ?? '',
          image_url: imageURL,
          cocktail_name: cocktailName.trim(),
          status: 'pending',
          created_at: new Date().toISOString(),
        });
        if (subError) console.warn('[explore] cocktail submission error (non-fatal):', subError);
      }

      toast.success('Gönderi paylaşıldı.');
      setModalOpen(false);
      setCaption('');
      setCocktailName('');
      setImageURL('');
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
    setImageURL('');
  };

  // ── Filter by search ──────────────────────────────────────────────────────
  const filteredPosts = posts.filter((p) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      p.caption?.toLowerCase().includes(term) ||
      p.cocktail_name?.toLowerCase().includes(term) ||
      p.author_name?.toLowerCase().includes(term)
    );
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
            <input
              type="text"
              placeholder="Ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors shadow-[0_0_12px_rgba(201,168,76,0.3)] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Paylaş
          </button>
        </div>
      </header>

      {/* Posts feed */}
      {postsLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass p-4 rounded-2xl animate-pulse space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/10" />
                <div className="h-3 w-32 bg-white/10 rounded" />
              </div>
              <div className="w-full h-52 bg-white/10 rounded-xl" />
              <div className="h-3 w-3/4 bg-white/10 rounded" />
            </div>
          ))}
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-20 glass rounded-2xl border border-dashed border-white/10">
          <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-1">
            {search ? 'Sonuç bulunamadı' : 'Henüz paylaşım yok'}
          </h3>
          <p className="text-muted-foreground text-sm">
            {search ? 'Arama teriminizi değiştirin.' : 'İlk paylaşımı sen yap!'}
          </p>
        </div>
      ) : (
        <div className="max-w-lg mx-auto space-y-4">
          {filteredPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              likeCount={likeCounts[post.id] ?? 0}
              likedByMe={myLikes.has(post.id)}
              commentCount={commentCounts[post.id] ?? 0}
              onLike={handleLike}
              user={user}
              userData={userData}
            />
          ))}
        </div>
      )}

      {/* Post creation modal */}
      <AnimatePresence>
        {modalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
              onClick={closeModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="glass border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                  <h2 className="font-serif text-xl font-bold text-gradient-gold">Gönderi Oluştur</h2>
                  <button onClick={closeModal} disabled={isSubmitting} className="p-2 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  {/* Image picker */}
                  <div
                    onClick={() => !uploadProgress && fileInputRef.current?.click()}
                    className="relative w-full rounded-xl border-2 border-dashed border-white/20 overflow-hidden cursor-pointer hover:border-primary/40 transition-colors"
                    style={{ minHeight: 180 }}
                  >
                    {imageURL ? (
                      <>
                        <img src={imageURL} alt="Önizleme" className="w-full h-48 object-cover" />
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setImageURL(''); }}
                          className="absolute top-2 right-2 bg-black/70 rounded-full p-1 text-white hover:bg-destructive/80"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                        {uploadProgress ? (
                          <><Loader2 className="w-8 h-8 animate-spin mb-2 text-primary" /><span className="text-sm">Yükleniyor...</span></>
                        ) : (
                          <><Camera className="w-10 h-10 mb-2 opacity-40" /><span className="text-sm">Fotoğraf seç (zorunlu)</span><span className="text-xs mt-1 opacity-60">JPG, PNG, WEBP · Maks. 10 MB</span></>
                        )}
                      </div>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageSelect} />

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                      Açıklama <span className="text-destructive">*</span>
                    </label>
                    <textarea
                      placeholder="Bu gece ne hazırladınız? Paylaşın..."
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      rows={3}
                      className="w-full bg-black/50 border border-white/10 rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 resize-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                      Kokteyl Adı <span className="text-muted-foreground/60 normal-case font-normal">(isteğe bağlı — onay kuyruğuna gönderilir)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Örn: Dark Velvet"
                      value={cocktailName}
                      onChange={(e) => setCocktailName(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 text-sm"
                    />
                  </div>

                  {cocktailName.trim() && (
                    <p className="text-xs text-primary/80 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                      🍸 Bu kokteyl yönetici onayına gönderilecek ve puanlarınıza yansıyacak.
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-3 px-6 pb-6">
                  <button onClick={closeModal} disabled={isSubmitting} className="px-4 py-2 rounded-lg text-muted-foreground hover:bg-white/5 transition-colors disabled:opacity-50">
                    İptal
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || uploadProgress || !imageURL || !caption.trim()}
                    className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-[0_0_12px_rgba(201,168,76,0.2)]"
                  >
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
