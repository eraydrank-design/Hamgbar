import { useAuth } from '@/lib/auth-context';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Camera, Save, Shield, Calendar, Edit2, Loader2, X,
  MessageSquare, UserPlus, UserMinus, Heart, Martini, Pin,
  PinOff, Trophy, Star, Grid3X3, Wine, ChevronLeft,
} from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  email?: string;
  display_name: string;
  username?: string;
  photo_url?: string;
  cover_url?: string;
  bio?: string;
  role: string;
  points: number;
  cocktail_count: number;
  badges: any[];
  pinned_post_id?: string | null;
  joined_at: string;
}

interface ProfileStats {
  postCount: number;
  cocktailCount: number;
  likeCount: number;
  followerCount: number;
  followingCount: number;
  rank: number;
}

type TabKey = 'posts' | 'cocktails' | 'likes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '';
  try { return format(new Date(d), 'd MMM yyyy', { locale: tr }); }
  catch { return ''; }
};

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

async function uploadImage(userId: string, file: File, folder: string): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) throw new Error('Yalnızca JPG, PNG, WEBP veya GIF yükleyebilirsiniz.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Dosya boyutu 8 MB\'ı geçemez.');
  const ext = file.name.split('.').pop();
  const path = `${folder}/${userId}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from('images').upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('images').getPublicUrl(path);
  return data.publicUrl;
}

// ─── StatPill ─────────────────────────────────────────────────────────────────

function StatPill({ value, label, onClick }: { value: number | string; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors ${onClick ? 'hover:bg-white/10 cursor-pointer' : 'cursor-default'}`}
    >
      <span className="text-xl font-bold text-foreground font-serif">{value}</span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-widest whitespace-nowrap">{label}</span>
    </button>
  );
}

// ─── FollowListModal ──────────────────────────────────────────────────────────

function FollowListModal({ title, userIds, onClose }: { title: string; userIds: string[]; onClose: () => void }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!userIds.length) { setLoading(false); return; }
    supabase.from('profiles').select('*').in('id', userIds)
      .then(({ data }) => { setProfiles((data as Profile[]) ?? []); setLoading(false); });
  }, [userIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="bg-[#111] border border-white/10 rounded-t-3xl md:rounded-2xl w-full max-w-md max-h-[70vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 className="font-serif text-lg font-bold text-foreground">{title}</h3>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-3 space-y-1">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Henüz kimse yok.</div>
          ) : profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => { navigate(`/profile/${p.id}`); onClose(); }}
              className="flex items-center gap-3 p-3 w-full rounded-xl hover:bg-white/5 transition-colors text-left"
            >
              <div className="w-11 h-11 rounded-full bg-black border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                {p.photo_url ? <img src={p.photo_url} alt={p.display_name} className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-muted-foreground" />}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-foreground truncate">{p.display_name}</p>
                {p.username && <p className="text-xs text-primary/70 truncate">@{p.username}</p>}
              </div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{p.role === 'admin' ? 'Yönetici' : 'Personel'}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── EditProfileModal ─────────────────────────────────────────────────────────

function EditProfileModal({ profile, onClose, onSaved }: { profile: Profile; onClose: () => void; onSaved: () => void }) {
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [username, setUsername] = useState(profile.username ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      const url = await uploadImage(profile.id, file, 'profile-photos');
      const { error } = await supabase.from('profiles').update({ photo_url: url }).eq('id', profile.id);
      if (error) throw error;
      toast.success('Profil fotoğrafı güncellendi.');
      onSaved();
    } catch (err: any) {
      toast.error(err?.message ?? 'Fotoğraf yüklenemedi.');
    } finally {
      setIsUploadingAvatar(false);
      if (avatarRef.current) avatarRef.current.value = '';
    }
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingCover(true);
    try {
      const url = await uploadImage(profile.id, file, 'cover-photos');
      const { error } = await supabase.from('profiles').update({ cover_url: url }).eq('id', profile.id);
      if (error) throw error;
      toast.success('Kapak fotoğrafı güncellendi.');
      onSaved();
    } catch (err: any) {
      toast.error(err?.message ?? 'Fotoğraf yüklenemedi.');
    } finally {
      setIsUploadingCover(false);
      if (coverRef.current) coverRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) { toast.error('Görünen ad boş bırakılamaz.'); return; }
    setIsSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        display_name: displayName.trim(),
        username: username.trim().toLowerCase().replace(/\s/g, ''),
        bio: bio.trim(),
      }).eq('id', profile.id);
      if (error) throw error;
      toast.success('Profil kaydedildi.');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="bg-[#111] border border-white/10 rounded-t-3xl md:rounded-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 className="font-serif text-xl font-bold text-gradient-gold">Profili Düzenle</h3>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Photo uploads */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Profil Fotoğrafı</p>
              <button
                type="button"
                onClick={() => avatarRef.current?.click()}
                disabled={isUploadingAvatar}
                className="relative w-20 h-20 rounded-full bg-black border-2 border-white/10 overflow-hidden hover:border-primary/50 transition-colors group"
              >
                {profile.photo_url
                  ? <img src={profile.photo_url} alt="" className="w-full h-full object-cover" />
                  : <User className="w-8 h-8 text-muted-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {isUploadingAvatar ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
                </div>
              </button>
              <input ref={avatarRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleAvatarChange} />
            </div>

            <div className="flex flex-col items-center gap-2 flex-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Kapak Fotoğrafı</p>
              <button
                type="button"
                onClick={() => coverRef.current?.click()}
                disabled={isUploadingCover}
                className="relative w-full h-20 rounded-xl bg-black border-2 border-white/10 overflow-hidden hover:border-primary/50 transition-colors group"
              >
                {profile.cover_url
                  ? <img src={profile.cover_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-gradient-to-br from-primary/20 to-black" />}
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {isUploadingCover ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
                </div>
              </button>
              <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleCoverChange} />
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Görünen Ad <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
                placeholder="Adınız Soyadınız"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Kullanıcı Adı</label>
              <div className="flex items-center bg-black/50 border border-white/10 rounded-xl overflow-hidden focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50">
                <span className="pl-4 text-muted-foreground">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/\s/g, '').toLowerCase())}
                  className="flex-1 bg-transparent py-2.5 px-2 text-foreground focus:outline-none"
                  placeholder="kullaniciadi"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Hakkımda</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                className="w-full bg-black/50 border border-white/10 rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 resize-none"
                placeholder="Kendinizi diğer üyelere anlatın..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-muted-foreground hover:bg-white/5 transition-colors">
                İptal
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-[0_0_15px_rgba(201,168,76,0.2)] disabled:opacity-60"
              >
                {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor...</> : <><Save className="w-4 h-4" /> Kaydet</>}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── PostCard ─────────────────────────────────────────────────────────────────

function PostCard({
  post, isPinned, isOwnProfile, onPin, onUnpin, likeCount, likedByMe, onLike,
}: {
  post: any; isPinned: boolean; isOwnProfile: boolean;
  onPin: (id: string) => void; onUnpin: () => void;
  likeCount: number; likedByMe: boolean; onLike: (id: string, liked: boolean) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl overflow-hidden border ${isPinned ? 'border-primary/40 shadow-[0_0_20px_rgba(201,168,76,0.1)]' : 'border-white/5'} bg-white/[0.02]`}
    >
      {isPinned && (
        <div className="flex items-center gap-1.5 px-4 py-2 bg-primary/10 border-b border-primary/20">
          <Pin className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium text-primary uppercase tracking-widest">Sabitlenmiş Gönderi</span>
        </div>
      )}
      {post.image_url && (
        <div className="relative w-full" style={{ paddingBottom: '60%' }}>
          <img src={post.image_url} alt={post.cocktail_name || 'Gönderi'} className="absolute inset-0 w-full h-full object-cover" />
        </div>
      )}
      <div className="p-4">
        {post.cocktail_name && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-widest mb-2">
            <Martini className="w-3.5 h-3.5" /> {post.cocktail_name}
          </div>
        )}
        <p className="text-sm text-foreground leading-relaxed mb-3">{post.caption}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{fmtDate(post.created_at)}</span>
          <div className="flex items-center gap-3">
            {isOwnProfile && (
              <button
                onClick={() => isPinned ? onUnpin() : onPin(post.id)}
                className={`p-1.5 rounded-lg transition-colors ${isPinned ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:text-primary hover:bg-white/10'}`}
                title={isPinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}
              >
                {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={() => onLike(post.id, likedByMe)}
              className={`flex items-center gap-1.5 text-sm px-2 py-1 rounded-lg transition-all ${likedByMe ? 'text-red-400 bg-red-400/10' : 'text-muted-foreground hover:text-red-400 hover:bg-red-400/10'}`}
            >
              <Heart className={`w-4 h-4 transition-all ${likedByMe ? 'fill-red-400' : ''}`} />
              <span>{likeCount}</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="text-center py-16 glass rounded-2xl border border-dashed border-white/10">
      <Icon className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}

// ─── Main Profile Page ────────────────────────────────────────────────────────

export default function Profile() {
  const { user } = useAuth();
  const params = useParams<{ userId?: string }>();
  const [, navigate] = useLocation();
  const goBack = () => window.history.back();

  const profileId = params?.userId ?? user?.id ?? '';
  const isOwnProfile = profileId === user?.id;

  // Profile state
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<ProfileStats>({ postCount: 0, cocktailCount: 0, likeCount: 0, followerCount: 0, followingCount: 0, rank: 1 });
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabKey>('posts');
  const [posts, setPosts] = useState<any[]>([]);
  const [cocktails, setCocktails] = useState<any[]>([]);
  const [likedPosts, setLikedPosts] = useState<any[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  // Likes state (for posts tab)
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());

  // Modal state
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [followerIds, setFollowerIds] = useState<string[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);

  // ── Fetch profile ────────────────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    if (!profileId) return;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', profileId).single();
    if (error) { console.error('[profile] fetchProfile error:', error); return; }
    if (data) setProfile(data as Profile);
    setLoading(false);
  }, [profileId]);

  // ── Fetch stats ──────────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    if (!profileId) return;

    const [
      { count: postCount },
      { count: followerCount },
      { count: followingCount },
      { data: userPostsData },
      { data: profileData },
    ] = await Promise.all([
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', profileId),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profileId),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profileId),
      supabase.from('posts').select('id').eq('author_id', profileId),
      supabase.from('profiles').select('points, cocktail_count').eq('id', profileId).single(),
    ]);

    const postIds = (userPostsData ?? []).map((p: any) => p.id);
    let likeCount = 0;
    if (postIds.length > 0) {
      const { count } = await supabase.from('post_likes').select('*', { count: 'exact', head: true }).in('post_id', postIds);
      likeCount = count ?? 0;
    }

    const userPoints = (profileData as any)?.points ?? 0;
    const { count: higherCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('points', userPoints);

    setStats({
      postCount: postCount ?? 0,
      cocktailCount: (profileData as any)?.cocktail_count ?? 0,
      likeCount,
      followerCount: followerCount ?? 0,
      followingCount: followingCount ?? 0,
      rank: (higherCount ?? 0) + 1,
    });
  }, [profileId]);

  // ── Fetch follow status ──────────────────────────────────────────────────────
  const fetchFollowStatus = useCallback(async () => {
    if (!user || !profileId || isOwnProfile) return;
    const { data } = await supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', profileId).maybeSingle();
    setIsFollowing(!!data);
  }, [user?.id, profileId, isOwnProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch follow lists ───────────────────────────────────────────────────────
  const fetchFollowLists = useCallback(async () => {
    if (!profileId) return;
    const [{ data: fwrs }, { data: fwing }] = await Promise.all([
      supabase.from('follows').select('follower_id').eq('following_id', profileId),
      supabase.from('follows').select('following_id').eq('follower_id', profileId),
    ]);
    setFollowerIds((fwrs ?? []).map((r: any) => r.follower_id));
    setFollowingIds((fwing ?? []).map((r: any) => r.following_id));
  }, [profileId]);

  // ── Fetch tab content ────────────────────────────────────────────────────────
  const fetchTabContent = useCallback(async () => {
    if (!profileId) return;
    setTabLoading(true);
    try {
      if (activeTab === 'posts') {
        const { data, error } = await supabase.from('posts').select('*').eq('author_id', profileId).order('created_at', { ascending: false });
        if (error) throw error;
        const postsData = (data ?? []) as any[];
        setPosts(postsData);

        if (postsData.length > 0) {
          const postIds = postsData.map((p) => p.id);
          const { data: likesData } = await supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds);
          const counts: Record<string, number> = {};
          const mySet = new Set<string>();
          for (const l of (likesData ?? [])) {
            counts[l.post_id] = (counts[l.post_id] ?? 0) + 1;
            if (l.user_id === user?.id) mySet.add(l.post_id);
          }
          setLikeCounts(counts);
          setMyLikes(mySet);
        } else {
          setLikeCounts({});
          setMyLikes(new Set());
        }
      } else if (activeTab === 'cocktails') {
        const { data, error } = await supabase.from('cocktail_submissions').select('*').eq('submitted_by', profileId).order('created_at', { ascending: false });
        if (error) throw error;
        setCocktails((data ?? []) as any[]);
      } else if (activeTab === 'likes') {
        const targetUserId = isOwnProfile ? user?.id : profileId;
        if (!targetUserId) return;
        const { data: likeRows } = await supabase.from('post_likes').select('post_id').eq('user_id', targetUserId);
        const likedIds = (likeRows ?? []).map((r: any) => r.post_id);
        if (likedIds.length > 0) {
          const { data: likedPostsData } = await supabase.from('posts').select('*').in('id', likedIds).order('created_at', { ascending: false });
          setLikedPosts((likedPostsData ?? []) as any[]);
        } else {
          setLikedPosts([]);
        }
      }
    } catch (err) {
      console.error('[profile] fetchTabContent error:', err);
    } finally {
      setTabLoading(false);
    }
  }, [profileId, activeTab, user?.id, isOwnProfile]);

  // ── Initial load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setProfile(null);
    fetchProfile();
    fetchStats();
    fetchFollowStatus();
    fetchFollowLists();
  }, [profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchTabContent();
  }, [activeTab, profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Follow / Unfollow ────────────────────────────────────────────────────────
  const handleFollow = async () => {
    if (!user || !profileId || followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        const { error } = await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', profileId);
        if (error) throw error;
        setIsFollowing(false);
        setStats((s) => ({ ...s, followerCount: Math.max(0, s.followerCount - 1) }));
        setFollowerIds((ids) => ids.filter((id) => id !== user.id));
      } else {
        const { error } = await supabase.from('follows').insert({ follower_id: user.id, following_id: profileId });
        if (error) throw error;
        setIsFollowing(true);
        setStats((s) => ({ ...s, followerCount: s.followerCount + 1 }));
        setFollowerIds((ids) => [...ids, user.id]);
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'İşlem başarısız.');
    } finally {
      setFollowLoading(false);
    }
  };

  // ── Like / Unlike ────────────────────────────────────────────────────────────
  const handleLike = async (postId: string, alreadyLiked: boolean) => {
    if (!user) return;
    try {
      if (alreadyLiked) {
        const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
        if (error) throw error;
        setMyLikes((s) => { const n = new Set(s); n.delete(postId); return n; });
        setLikeCounts((c) => ({ ...c, [postId]: Math.max(0, (c[postId] ?? 1) - 1) }));
      } else {
        const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
        if (error) throw error;
        setMyLikes((s) => new Set([...s, postId]));
        setLikeCounts((c) => ({ ...c, [postId]: (c[postId] ?? 0) + 1 }));
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Beğeni işlemi başarısız.');
    }
  };

  // ── Pin / Unpin post ─────────────────────────────────────────────────────────
  const handlePin = async (postId: string) => {
    const { error } = await supabase.from('profiles').update({ pinned_post_id: postId }).eq('id', profileId);
    if (error) { toast.error(error.message); return; }
    setProfile((p) => p ? { ...p, pinned_post_id: postId } : p);
    toast.success('Gönderi sabitlendi.');
  };

  const handleUnpin = async () => {
    const { error } = await supabase.from('profiles').update({ pinned_post_id: null }).eq('id', profileId);
    if (error) { toast.error(error.message); return; }
    setProfile((p) => p ? { ...p, pinned_post_id: null } : p);
    toast.success('Sabitleme kaldırıldı.');
  };

  const handleMessage = () => navigate('/messages');

  const handleEditSaved = () => {
    fetchProfile();
    fetchStats();
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <User className="w-16 h-16 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground">Profil bulunamadı.</p>
        <button onClick={goBack} className="text-primary text-sm hover:underline flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> Geri Dön
        </button>
      </div>
    );
  }

  const roleName = profile.role === 'admin' ? 'Yönetici' : profile.role === 'staff' ? 'Personel' : profile.role;

  const sortedPosts = [...posts].sort((a, b) => {
    if (a.id === profile.pinned_post_id) return -1;
    if (b.id === profile.pinned_post_id) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto pb-12">
      {!isOwnProfile && (
        <button onClick={goBack} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground mb-4 transition-colors text-sm">
          <ChevronLeft className="w-4 h-4" /> Geri
        </button>
      )}

      {/* Cover */}
      <div className="relative rounded-2xl overflow-hidden mb-0">
        <div className="w-full h-44 md:h-56 relative">
          {profile.cover_url
            ? <img src={profile.cover_url} alt="Kapak" className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gradient-to-br from-black via-primary/20 to-black" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        </div>

        {/* Avatar */}
        <div className="absolute -bottom-14 left-5 md:left-8">
          <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-black border-4 border-background overflow-hidden flex items-center justify-center shadow-xl">
            {profile.photo_url
              ? <img src={profile.photo_url} alt={profile.display_name} className="w-full h-full object-cover" />
              : <User className="w-10 h-10 text-muted-foreground" />}
          </div>
        </div>

        {/* Action buttons */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {isOwnProfile ? (
            <button
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/70 backdrop-blur-sm border border-white/20 text-sm font-medium text-foreground hover:bg-black/90 transition-colors"
            >
              <Edit2 className="w-4 h-4" /> Düzenle
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleMessage}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/70 backdrop-blur-sm border border-white/20 text-sm font-medium text-foreground hover:bg-black/90 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">Mesaj</span>
              </button>
              <button
                onClick={handleFollow}
                disabled={followLoading}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg disabled:opacity-60 ${
                  isFollowing
                    ? 'bg-black/70 backdrop-blur-sm border border-white/20 text-foreground hover:border-destructive/50 hover:text-destructive'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_15px_rgba(201,168,76,0.3)]'
                }`}
              >
                {followLoading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : isFollowing
                    ? <><UserMinus className="w-4 h-4" /><span className="hidden sm:inline">Takibi Bırak</span></>
                    : <><UserPlus className="w-4 h-4" /><span className="hidden sm:inline">Takip Et</span></>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Profile info */}
      <div className="pt-16 px-5 md:px-8 pb-5 glass rounded-b-2xl border border-t-0 border-white/5">
        <div className="mb-3">
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-foreground">{profile.display_name}</h1>
          {profile.username && <p className="text-sm text-primary/70 mt-0.5">@{profile.username}</p>}
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
            <Calendar className="w-3.5 h-3.5" /> {fmtDate(profile.joined_at)} tarihinden beri üye
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium uppercase tracking-wider">
            <Shield className="w-3 h-3" /> {roleName}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
            <Trophy className="w-3 h-3" /> #{stats.rank} Sıra
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-foreground text-xs font-medium">
            <Star className="w-3 h-3 text-primary" /> {profile.points} Puan
          </span>
          {Array.isArray(profile.badges) && profile.badges.map((b: any, i: number) => (
            <span key={i} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-foreground text-xs font-medium">
              {b.emoji} {b.name}
            </span>
          ))}
        </div>

        {profile.bio ? (
          <p className="text-sm text-foreground/80 leading-relaxed mb-4 whitespace-pre-wrap">{profile.bio}</p>
        ) : isOwnProfile ? (
          <button onClick={() => setShowEdit(true)} className="text-sm text-muted-foreground hover:text-primary italic transition-colors mb-4 block">
            + Biyografi ekle...
          </button>
        ) : (
          <p className="text-sm text-muted-foreground italic mb-4">Biyografi yok.</p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-1 flex-wrap border-t border-white/5 pt-4 -mx-2">
          <StatPill value={stats.postCount} label="Gönderi" />
          <div className="w-px h-8 bg-white/10" />
          <StatPill value={stats.cocktailCount} label="Kokteyl" />
          <div className="w-px h-8 bg-white/10" />
          <StatPill value={stats.likeCount} label="Beğeni" />
          <div className="w-px h-8 bg-white/10" />
          <StatPill value={stats.followerCount} label="Takipçi" onClick={() => { fetchFollowLists(); setShowFollowers(true); }} />
          <div className="w-px h-8 bg-white/10" />
          <StatPill value={stats.followingCount} label="Takip" onClick={() => { fetchFollowLists(); setShowFollowing(true); }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6">
        <div className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-2xl mb-5">
          {([
            { key: 'posts' as TabKey, label: 'Gönderiler', icon: Grid3X3 },
            { key: 'cocktails' as TabKey, label: 'Kokteyller', icon: Wine },
            { key: 'likes' as TabKey, label: 'Beğeniler', icon: Heart },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === key
                  ? 'bg-primary text-primary-foreground shadow-[0_0_10px_rgba(201,168,76,0.2)]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {tabLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
            ) : activeTab === 'posts' ? (
              sortedPosts.length === 0 ? (
                <EmptyState icon={Grid3X3} message="Henüz gönderi yok." />
              ) : (
                <div className="space-y-4">
                  {sortedPosts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      isPinned={post.id === profile.pinned_post_id}
                      isOwnProfile={isOwnProfile}
                      onPin={handlePin}
                      onUnpin={handleUnpin}
                      likeCount={likeCounts[post.id] ?? 0}
                      likedByMe={myLikes.has(post.id)}
                      onLike={handleLike}
                    />
                  ))}
                </div>
              )
            ) : activeTab === 'cocktails' ? (
              cocktails.length === 0 ? (
                <EmptyState icon={Wine} message="Henüz kokteyl gönderisi yok." />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {cocktails.map((c) => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-2xl overflow-hidden border border-white/5 bg-white/[0.02] group"
                    >
                      {c.image_url ? (
                        <div className="relative w-full" style={{ paddingBottom: '75%' }}>
                          <img src={c.image_url} alt={c.cocktail_name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                          <div className="absolute bottom-2 left-3 right-3">
                            <p className="text-sm font-semibold text-foreground truncate">{c.cocktail_name}</p>
                            <span className={`text-[10px] uppercase tracking-wider mt-0.5 inline-block px-2 py-0.5 rounded-full ${
                              c.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                              c.status === 'rejected' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                              'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}>
                              {c.status === 'approved' ? 'Onaylandı' : c.status === 'rejected' ? 'Reddedildi' : 'Beklemede'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4">
                          <div className="w-full h-20 bg-primary/5 rounded-xl flex items-center justify-center mb-3">
                            <Martini className="w-8 h-8 text-primary/40" />
                          </div>
                          <p className="text-sm font-semibold text-foreground truncate">{c.cocktail_name}</p>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )
            ) : (
              likedPosts.length === 0 ? (
                <EmptyState icon={Heart} message="Henüz beğenilen gönderi yok." />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {likedPosts.map((post) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-2xl overflow-hidden border border-white/5 bg-white/[0.02] group relative"
                    >
                      {post.image_url ? (
                        <div className="relative w-full" style={{ paddingBottom: '100%' }}>
                          <img src={post.image_url} alt={post.caption} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-xs text-foreground line-clamp-2">{post.caption}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 min-h-[120px] flex flex-col justify-between">
                          <p className="text-sm text-foreground line-clamp-4">{post.caption}</p>
                          <Heart className="w-4 h-4 text-red-400 fill-red-400 mt-2" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2">
                        <Heart className="w-4 h-4 text-red-400 fill-red-400 drop-shadow" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              )
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showFollowers && (
          <FollowListModal
            title={`Takipçiler · ${stats.followerCount}`}
            userIds={followerIds}
            onClose={() => setShowFollowers(false)}
          />
        )}
        {showFollowing && (
          <FollowListModal
            title={`Takip Edilenler · ${stats.followingCount}`}
            userIds={followingIds}
            onClose={() => setShowFollowing(false)}
          />
        )}
        {showEdit && isOwnProfile && profile && (
          <EditProfileModal
            profile={profile}
            onClose={() => setShowEdit(false)}
            onSaved={handleEditSaved}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
