import { useCollection } from '@/hooks/use-firestore';
import { useState } from 'react';
import { Martini, Search, Filter, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Cocktails() {
  const { data: cocktails, loading } = useCollection('cocktails');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedCocktail, setSelectedCocktail] = useState<any>(null);

  const categories = ['All', ...Array.from(new Set(cocktails.map((c: any) => c.category).filter(Boolean)))];

  const filteredCocktails = cocktails.filter((c: any) => {
    const matchesSearch = c.name?.toLowerCase().includes(search.toLowerCase()) || 
                          c.description?.toLowerCase().includes(search.toLowerCase()) ||
                          c.ingredients?.some((i: string) => i.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = activeCategory === 'All' || c.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-gradient-gold mb-2">The Menu</h1>
          <p className="text-muted-foreground">Curated libations for members.</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search cocktails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </header>

      {/* Categories */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat: any) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              activeCategory === cat 
                ? 'bg-primary text-primary-foreground shadow-[0_0_10px_rgba(201,168,76,0.3)]' 
                : 'bg-white/5 text-muted-foreground hover:bg-white/10 border border-white/10'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="glass p-6 rounded-2xl animate-pulse h-64" />
          ))}
        </div>
      ) : filteredCocktails.length === 0 ? (
        <div className="text-center py-20 glass rounded-2xl border-dashed">
          <Martini className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-1">No cocktails found</h3>
          <p className="text-muted-foreground text-sm">Try adjusting your search or filters.</p>
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
                <div className="absolute top-4 right-4 bg-destructive/20 text-destructive text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">
                  86'd
                </div>
              )}
              
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-serif text-xl font-bold text-foreground group-hover:text-primary transition-colors">{cocktail.name}</h3>
                <span className="text-primary font-medium">${cocktail.price}</span>
              </div>
              
              <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">
                {cocktail.description}
              </p>
              
              <div className="mt-auto pt-4 border-t border-white/5">
                <p className="text-xs text-muted-foreground truncate font-mono uppercase tracking-wider">
                  {cocktail.ingredients?.join(' • ')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {selectedCocktail && (
          <>
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
                className="w-full max-w-lg glass bg-card/90 rounded-2xl overflow-hidden shadow-2xl border-primary/20 relative"
              >
                <button 
                  onClick={() => setSelectedCocktail(null)}
                  className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-white/10 rounded-full text-muted-foreground hover:text-foreground transition-colors z-10"
                >
                  <X className="w-5 h-5" />
                </button>

                {selectedCocktail.imageUrl ? (
                  <div className="w-full h-64 bg-black relative">
                    <img src={selectedCocktail.imageUrl} alt={selectedCocktail.name} className="w-full h-full object-cover opacity-80" />
                    <div className="absolute inset-0 bg-gradient-to-t from-card/100 to-transparent" />
                  </div>
                ) : (
                  <div className="w-full h-32 bg-gradient-to-br from-black to-primary/10 flex items-center justify-center">
                    <Martini className="w-12 h-12 text-primary/30" />
                  </div>
                )}

                <div className="p-8">
                  <div className="flex justify-between items-start mb-2">
                    <h2 className="font-serif text-3xl font-bold text-gradient-gold">{selectedCocktail.name}</h2>
                    <span className="text-xl font-serif text-primary">${selectedCocktail.price}</span>
                  </div>
                  
                  <div className="flex gap-2 mb-6">
                    <span className="text-xs bg-white/5 px-2 py-1 rounded text-muted-foreground uppercase tracking-wider border border-white/5">
                      {selectedCocktail.category}
                    </span>
                    {!selectedCocktail.available && (
                      <span className="text-xs bg-destructive/10 px-2 py-1 rounded text-destructive uppercase tracking-wider border border-destructive/20 font-bold">
                        Unavailable
                      </span>
                    )}
                  </div>

                  <p className="text-foreground leading-relaxed mb-8">
                    {selectedCocktail.description}
                  </p>

                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b border-white/10 pb-2">Ingredients</h4>
                    <ul className="grid grid-cols-2 gap-2">
                      {selectedCocktail.ingredients?.map((ing: string, i: number) => (
                        <li key={i} className="text-sm flex items-center gap-2 text-foreground/80">
                          <div className="w-1 h-1 rounded-full bg-primary" />
                          {ing}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
