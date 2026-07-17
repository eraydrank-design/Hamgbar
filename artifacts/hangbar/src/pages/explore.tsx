import { useAuth } from '@/lib/auth-context';
import { useCollection } from '@/hooks/use-firestore';
import { useState, useRef } from 'react';
import { Search, Martini, Bell, Calendar, Plus, X, Camera, Loader2, Heart } from 'lucide-react';
import { Link } from 'wouter';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { useLocation } from 'wouter';

type FilterType = 'Tümü' | 'Gönderiler' | 'Kokteyller' | 'Etkinlikler';

export default function Explore() {
  const { user, userData } = useAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('Tümü');
  const [modalOpen, setModalOpen] = useState(false);

  // Form state
  const [caption, setCaption] = useState('');
  const [cocktailName, setCocktailName] = useState('');
  const [imageURL, setImageURL] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: cocktails, loading: cocktailsLoading } = useCollection('cocktails');
  const { data: announcements, loading: announcementsLoading } = useCollection('announcements');
  const { data: posts, loading: postsLoading, add: addPost } = useCollection('posts', {
    orderBy: { column: 'created_at', ascending: false },
  });
  const { add: addSubmission } = useCollection('cocktail_submissions');

  const loading = cocktailsLoading || announcementsLoading || postsLoading;

  // ── Image upload ─────────────────────────────────────────────────────────
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Dosya boyutu 10 MB\'ı geçemez.'); return; }

    setUploadProgress(1);
    try {
      const ext = file.name.split('.').pop();
      const path = `explore-posts/${user?.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('images').getPublicUrl(path);
      setImageURL(data.publicUrl);
      toast.success('Görsel yüklendi.');
    } catch (err: any) {
      toast.error(`Görsel yüklenemedi: ${err?.message ?? 'Bilinmeyen hata'}`);
    } finally {
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Submit post ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!imageURL) { toast.error('Lütfen bir fotoğraf yükleyin.'); return; }
    if (!caption.trim()) { toast.error('Lütfen bir açıklama yazın.'); return; }

    setIsSubmitting(true);
    try {
      await addPost({
        author_id: user?.id,
        author_name: userData?.display_name,
        author_photo: userData?.photo_url ?? '',
        image_url: imageURL,
        caption: caption.trim(),
        cocktail_name: cocktailName.trim(),
      });

      if (cocktailName.trim()) {
        await addSubmission({
          submitted_by: user?.id,
          submitted_by_name: userData?.display_name,
          submitted_by_photo: userData?.photo_url ?? '',
          image_url: imageURL,
          cocktail_name: cocktailName.trim(),
          status: 'pending',
        });
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
    if (isSubmitting || uploadProgress !== null) return;
    setModalOpen(false);
    setCaption('');
    setCocktailName('');
    setImageURL('');
  };

  // ── Combine feeds ────────────────────────────────────────────────────────
  const fmtDate = (d: string | null | undefined, fmt: string) => {
    if (!d) return null;
    try { return format(new Date(d), fmt, { locale: tr }); }
    catch { return null; }
  };

  const combinedData = [
    ...posts.map((p: any) => ({ ...p, _type: 'post' })),
    ...cocktails.map((c: any) => ({ ...c, _type: 'cocktail' })),
    ...announcements.map((a: any) => ({ ...a, _type: 'event' })),
  ].sort((a, b) => {
    const dA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dB - dA;
  });

  const filteredData = combinedData.filter((item) => {
    const text = [item.name, item.title, item.description, item.body, item.caption, item.cocktail_name]
      .join(' ')
      .toLowerCase();
    if (!text.includes(search.toLowerCase())) return false;
    if (filter === 'Gönderiler') return item._type === 'post';
    if (filter === 'Kokteyller') return item._type === 'cocktail';
    if (filter === 'Etkinlikler') return item._type === 'event';
    return true;
  });

  const filterOptions: FilterType[] = ['Tümü', 'Gönderiler', 'Kokteyller', 'Etkinlikler'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-gradient-gold mb-2">Keşfet</h1>
          <p className="text-muted-foreground">HangBar'da neler oluyor, keşfedin.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Her şeyi ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors shadow-[0_0_12px_rgba(201,168,76,0.3)] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Gönderi Oluştur
          </button>
        </div>
      </header>

      <div className="flex gap-2 flex-wrap">
        {filterOptions.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              filter === f
                ? 'bg-primary text-primary-foreground shadow-[0_0_10px_rgba(201,168,76,0.3)]'
                : 'bg-white/5 text-muted-foreground hover:bg-white/10 border border-white/10'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="glass p-6 rounded-2xl animate-pulse h-64" />)}
        </div>
      ) : filteredData.length === 0 ? (
        <div className="text-center py-20 glass rounded-2xl border border-dashed border-white/10">
          <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-1">Sonuç bulunamadı</h3>
          <p className="text-muted-foreground text-sm">Arama terimlerinizi değiştirmeyi deneyin.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredData.map((item: any) => {
            if (item._type === 'post') {
              return (
                <div key={`p-${item.id}`} className="glass rounded-2xl overflow-hidden flex flex-col border border-white/5">
                  {item.image_url && (
                    <div className="relative w-full" style={{ paddingBottom: '66%' }}>
                      <img src={item.image_url} alt={item.cocktail_name || 'Gönderi'} className="absolute inset-0 w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-4 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      {/* Clickable author avatar */}
                      <UserAvatar
                        userId={item.author_id}
                        photoUrl={item.author_photo}
                        displayName={item.author_name}
                        size="xs"
                      />
                      <button
                        type="button"
                        onClick={() => item.author_id && navigate(`/profile/${item.author_id}`)}
                        className="text-xs font-medium text-foreground hover:text-primary transition-colors"
                      >
                        {item.author_name}
                      </button>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {fmtDate(item.created_at, 'd MMM') ?? 'Yeni'}
                      </span>
                    </div>
                    {item.cocktail_name && (
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-widest mb-2">
                        <Martini className="w-3.5 h-3.5" /> {item.cocktail_name}
                      </div>
                    )}
                    <p className="text-sm text-foreground line-clamp-3 flex-1">{item.caption}</p>
                    <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Heart className="w-3.5 h-3.5" />
                      <span>Beğen</span>
                    </div>
                  </div>
                </div>
              );
            }
            if (item._type === 'cocktail') {
              return (
                <Link key={`c-${item.id}`} href="/cocktails">
                  <div className="glass glass-hover p-6 rounded-2xl cursor-pointer group flex flex-col h-full">
                    <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-widest mb-3">
                      <Martini className="w-4 h-4" /> Kokteyl
                    </div>
                    {item.image_url && (
                      <img src={item.image_url} alt={item.name} className="w-full h-32 object-cover rounded-xl mb-3" />
                    )}
                    <h3 className="font-serif text-xl font-bold text-foreground group-hover:text-primary transition-colors mb-2">{item.name}</h3>
                    <div className="flex justify-between items-center pt-4 border-t border-white/5 mt-auto">
                      <span className="text-xs text-muted-foreground uppercase">{item.category}</span>
                      <span className="text-primary font-medium">{item.price} ₺</span>
                    </div>
                  </div>
                </Link>
              );
            }
            return (
              <Link key={`e-${item.id}`} href="/announcements">
                <div className="glass glass-hover p-6 rounded-2xl cursor-pointer group flex flex-col h-full border-t-2 border-t-amber-500/50">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-500 uppercase tracking-widest mb-3">
                    {item.pinned ? <Bell className="w-4 h-4" /> : <Calendar className="w-4 h-4" />} Duyuru
                  </div>
                  <h3 className="font-serif text-xl font-bold text-foreground group-hover:text-amber-500 transition-colors mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">{item.body}</p>
                  <div className="pt-4 border-t border-white/5 text-xs text-muted-foreground">
                    {fmtDate(item.created_at, 'd MMM yyyy') ?? 'Yakın zamanda'}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Post Creation Modal ─────────────────────────────────────────────── */}
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
                        {uploadProgress !== null ? (
                          <>
                            <Loader2 className="w-8 h-8 animate-spin mb-2 text-primary" />
                            <span className="text-sm">Yükleniyor...</span>
                          </>
                        ) : (
                          <>
                            <Camera className="w-10 h-10 mb-2 opacity-40" />
                            <span className="text-sm">Fotoğraf seç (zorunlu)</span>
                            <span className="text-xs mt-1 opacity-60">JPG, PNG, WEBP · Maks. 10 MB</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageSelect} />

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                      Kokteyl Adı <span className="text-muted-foreground/60 normal-case">(istatistiklere gönderilir)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Örn: Dark Velvet"
                      value={cocktailName}
                      onChange={(e) => setCocktailName(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 text-sm"
                    />
                  </div>

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

                  {cocktailName.trim() && (
                    <p className="text-xs text-primary/80 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                      🍸 Bu kokteyl istatistik onayı için yöneticiye gönderilecek.
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-3 px-6 pb-6">
                  <button onClick={closeModal} disabled={isSubmitting} className="px-4 py-2 rounded-lg text-muted-foreground hover:bg-white/5 transition-colors disabled:opacity-50">
                    İptal
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || uploadProgress !== null || !imageURL || !caption.trim()}
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
