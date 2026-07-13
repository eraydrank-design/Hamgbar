import { useCollection } from '@/hooks/use-firestore';
import { useState } from 'react';
import { Search, Martini, Bell, Calendar } from 'lucide-react';
import { Link } from 'wouter';
import { format } from 'date-fns';

export default function Explore() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Cocktails' | 'Events'>('All');

  const { data: cocktails, loading: cocktailsLoading } = useCollection('cocktails');
  const { data: announcements, loading: announcementsLoading } = useCollection('announcements');

  const loading = cocktailsLoading || announcementsLoading;

  const combinedData = [
    ...cocktails.map((c: any) => ({ ...c, type: 'cocktail' })),
    ...announcements.map((a: any) => ({ ...a, type: 'event' }))
  ].sort((a, b) => {
    // Sort events by date if available, else just random mix
    const dateA = a.createdAt?.toDate?.() || new Date(0);
    const dateB = b.createdAt?.toDate?.() || new Date(0);
    return dateB.getTime() - dateA.getTime();
  });

  const filteredData = combinedData.filter(item => {
    const matchesSearch = 
      item.name?.toLowerCase().includes(search.toLowerCase()) || 
      item.title?.toLowerCase().includes(search.toLowerCase()) ||
      item.description?.toLowerCase().includes(search.toLowerCase()) ||
      item.body?.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;

    if (filter === 'Cocktails') return item.type === 'cocktail';
    if (filter === 'Events') return item.type === 'event';
    return true;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-gradient-gold mb-2">Explore</h1>
          <p className="text-muted-foreground">Discover what's happening at HangBar.</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search everything..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </header>

      <div className="flex gap-2">
        {['All', 'Cocktails', 'Events'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
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
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="glass p-6 rounded-2xl animate-pulse h-64" />
          ))}
        </div>
      ) : filteredData.length === 0 ? (
        <div className="text-center py-20 glass rounded-2xl border-dashed">
          <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-1">No results found</h3>
          <p className="text-muted-foreground text-sm">Try adjusting your search terms.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredData.map((item: any) => (
            item.type === 'cocktail' ? (
              <Link key={`c-${item.id}`} href="/cocktails">
                <div className="glass glass-hover p-6 rounded-2xl cursor-pointer group flex flex-col h-full">
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-widest mb-3">
                    <Martini className="w-4 h-4" /> Cocktail
                  </div>
                  <h3 className="font-serif text-xl font-bold text-foreground group-hover:text-primary transition-colors mb-2">{item.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">{item.description}</p>
                  <div className="flex justify-between items-center pt-4 border-t border-white/5">
                    <span className="text-xs text-muted-foreground uppercase">{item.category}</span>
                    <span className="text-primary font-medium">${item.price}</span>
                  </div>
                </div>
              </Link>
            ) : (
              <Link key={`e-${item.id}`} href="/announcements">
                <div className="glass glass-hover p-6 rounded-2xl cursor-pointer group flex flex-col h-full border-t-2 border-t-amber-500/50">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-500 uppercase tracking-widest mb-3">
                    {item.pinned ? <Bell className="w-4 h-4" /> : <Calendar className="w-4 h-4" />} 
                    Announcement
                  </div>
                  <h3 className="font-serif text-xl font-bold text-foreground group-hover:text-amber-500 transition-colors mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">{item.body}</p>
                  <div className="pt-4 border-t border-white/5 text-xs text-muted-foreground">
                    {item.createdAt?.toDate ? format(item.createdAt.toDate(), 'MMM d, yyyy') : 'Recently'}
                  </div>
                </div>
              </Link>
            )
          ))}
        </div>
      )}
    </div>
  );
}
