import { useCollection } from '@/hooks/use-firestore';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useState } from 'react';
import { Martini, Search, X, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function Cocktails() {
  const { user, userData } = useAuth();
  const { data: cocktails, loading } = useCollection('cocktails');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tümü');
  const [selectedCocktail, setSelectedCocktail] = useState<any>(null);
  const [favLoading, setFavLoading] = useState<string | null>(null);

  // Current user's favorite cocktail IDs
  const favorites: string[] = Array.isArray(userData?.favorites) ? userData.favorites : [];
  const isFav = (id: string) => favorites.includes(id);

  const toggleFavorite = async (e: React.MouseEvent, cocktail: any) => {
    e.stopPropagation();
    if (!user || !userData) return;
    setFavLoading(cocktail.id);
    try {
      const current: string[] = Array.isArray(userData.favorites) ? userData.favorites : [];
      const next = current.includes(cocktail.id)
        ? current.filter((id) => id !== cocktail.id)
        : [...current, cocktail.id];

      const { error } = await supabase
        .from('profiles')
        .update({ favorites: next })
        .eq('id', user.id);

      if (error) throw error;
      toast.success(next.includes(cocktail.id) ? '❤️ Favorilere eklendi.' : '💔 Favorilerden çıkarıldı.');
    } catch (err: any) {
      toast.error(`Favori güncellenemedi: ${err.message ?? String(err)}`);
    } finally {
      setFavLoading(null);
    }
  };

  const rawCategories: string[] = Array.from(new Set(cocktails.map((c: any) => c.category).filter(Boolean)));
  const categories = ['Tümü', 'Favoriler', ...rawCategories];

  const filteredCocktails = cocktails.filter((c: any) => {
    const term = search.toLowerCase();
    const matchesSearch =
      c.name?.toLowerCase().includes(term) ||
      c.notes?.toLowerCase().includes(term) ||
      c.preparation?.toLowerCase().includes(term) ||
      c.ingredients?.some((i: string) => i.toLowerCase().includes(term));
    const matchesCategory =
      activeCategory === 'Tümü'
        ? true
        : activeCategory === 'Favoriler'
        ? isFav(c.id)
        : c.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-gradient-gold mb-2">Menü</h1>
          <p className="text-muted-foreground">Üyeler için özenle seçilmiş içkiler.</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Kokteyl ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </header>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              activeCategory === cat
                ? 'bg-primary text-primary-foreground shadow-[0_0_10px_rgba(201,168,76,0.3)]'
                : 'bg-white/5 text-muted-foreground hover:bg-white/10 border border-white/10'
            }`}
          >
            {cat === 'Favoriler' ? `❤️ ${cat}` : cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="glass p-6 rounded-2xl animate-pulse h-64" />)}
        </div>
      ) : filteredCocktails.length === 0 ? (
        <div className="text-center py-20 glass rounded-2xl border border-dashed border-white/10">
          <Martini className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-1">Kokteyl bulunamadı</h3>
          <p className="text-muted-foreground text-sm">
            {activeCategory === 'Favoriler'
              ? 'Henüz favori eklemediniz. Bir kokteyl kartındaki ❤️ butonuna tıklayın.'
              : 'Arama veya filtrelerinizi değiştirmeyi deneyin.'}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCocktails.map((cocktail: any) => (
            <div
              key={cocktail.id}
              onClick={() => setSelectedCocktail(cocktail)}
              className="glass glass-hover p-6 rounded-2xl cursor-pointer group relative overflow-hidden flex flex-col h-full"
            >
              {!cocktail.available && (
                <div className="absolute top-4 left-4 bg-destructive/20 text-destructive text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded z-10">
                  Mevcut Değil
                </div>
              )}

              {/* Favorite button */}
              <button
                onClick={(e) => toggleFavorite(e, cocktail)}
                disabled={favLoading === cocktail.id}
                className={`absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-all z-10 ${
                  isFav(cocktail.id)
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-black/40 text-muted-foreground border border-white/10 opacity-0 group-hover:opacity-100'
                }`}
                title={isFav(cocktail.id) ? 'Favorilerden çıkar' : 'Favorilere ekle'}
              >
                <Heart className={`w-4 h-4 ${isFav(cocktail.id) ? 'fill-rose-400' : ''}`} />
              </button>

              {cocktail.image_url ? (
                <img
                  src={cocktail.image_url}
                  alt={cocktail.name}
                  className="w-full h-36 object-cover rounded-xl mb-4 border border-white/10"
                />
              ) : null}

              <div className="flex justify-between items-start mb-3">
                <h3 className="font-serif text-xl font-bold text-foreground group-hover:text-primary transition-colors flex-1 pr-2">
                  {cocktail.name}
                </h3>
                <span className="text-primary font-medium whitespace-nowrap">{cocktail.price} ₺</span>
              </div>

              {cocktail.notes ? (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">{cocktail.notes}</p>
              ) : cocktail.preparation ? (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">{cocktail.preparation}</p>
              ) : null}

              <div className="mt-auto pt-4 border-t border-white/5">
                <p className="text-xs text-muted-foreground truncate font-mono uppercase tracking-wider">
                  {cocktail.ingredients?.slice(0, 4).join(' · ')}
                  {cocktail.ingredients?.length > 4 ? ' …' : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Detail Modal ── */}
      <AnimatePresence>
        {selectedCocktail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedCocktail(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg glass bg-card/90 rounded-2xl overflow-hidden shadow-2xl border border-primary/20 relative max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setSelectedCocktail(null)}
                className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-white/10 rounded-full text-muted-foreground hover:text-foreground transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>

              {selectedCocktail.image_url ? (
                <div className="w-full h-64 bg-black relative flex-shrink-0">
                  <img src={selectedCocktail.image_url} alt={selectedCocktail.name} className="w-full h-full object-cover opacity-80" />
                  <div className="absolute inset-0 bg-gradient-to-t from-card/100 to-transparent" />
                </div>
              ) : (
                <div className="w-full h-24 bg-gradient-to-br from-black to-primary/10 flex items-center justify-center flex-shrink-0">
                  <Martini className="w-10 h-10 text-primary/30" />
                </div>
              )}

              <div className="p-8">
                <div className="flex justify-between items-start mb-2">
                  <h2 className="font-serif text-3xl font-bold text-gradient-gold">{selectedCocktail.name}</h2>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    <button
                      onClick={(e) => toggleFavorite(e, selectedCocktail)}
                      disabled={favLoading === selectedCocktail.id}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all border ${
                        isFav(selectedCocktail.id)
                          ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                          : 'bg-white/5 text-muted-foreground border-white/10 hover:border-rose-500/30 hover:text-rose-400'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${isFav(selectedCocktail.id) ? 'fill-rose-400' : ''}`} />
                    </button>
                    <span className="text-xl font-serif text-primary">{selectedCocktail.price} ₺</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                  <span className="text-xs bg-white/5 px-2 py-1 rounded text-muted-foreground uppercase tracking-wider border border-white/5">
                    {selectedCocktail.category}
                  </span>
                  {selectedCocktail.alcohol_level && (
                    <span className="text-xs bg-primary/5 px-2 py-1 rounded text-primary/70 uppercase tracking-wider border border-primary/10">
                      {selectedCocktail.alcohol_level}
                    </span>
                  )}
                  {!selectedCocktail.available && (
                    <span className="text-xs bg-destructive/10 px-2 py-1 rounded text-destructive uppercase tracking-wider border border-destructive/20 font-bold">
                      Mevcut Değil
                    </span>
                  )}
                </div>

                {selectedCocktail.notes && (
                  <p className="text-foreground leading-relaxed mb-6">{selectedCocktail.notes}</p>
                )}

                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b border-white/10 pb-2 mb-3">
                      İçindekiler
                    </h4>
                    <ul className="grid grid-cols-2 gap-2">
                      {selectedCocktail.ingredients?.map((ing: string, i: number) => (
                        <li key={i} className="text-sm flex items-center gap-2 text-foreground/80">
                          <div className="w-1 h-1 rounded-full bg-primary flex-shrink-0" />
                          {ing}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {selectedCocktail.preparation && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b border-white/10 pb-2 mb-3">
                        Hazırlanış
                      </h4>
                      <p className="text-sm text-foreground/80 leading-relaxed">{selectedCocktail.preparation}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3 pt-2">
                    {selectedCocktail.glass_type && (
                      <div className="text-center p-3 bg-white/5 rounded-xl">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Bardak</p>
                        <p className="text-xs text-foreground">{selectedCocktail.glass_type}</p>
                      </div>
                    )}
                    {selectedCocktail.ice_type && (
                      <div className="text-center p-3 bg-white/5 rounded-xl">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Buz</p>
                        <p className="text-xs text-foreground">{selectedCocktail.ice_type}</p>
                      </div>
                    )}
                    {selectedCocktail.garnish && (
                      <div className="text-center p-3 bg-white/5 rounded-xl">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Garnitür</p>
                        <p className="text-xs text-foreground">{selectedCocktail.garnish}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
