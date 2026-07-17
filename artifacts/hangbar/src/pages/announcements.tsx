import { useAuth } from '@/lib/auth-context';
import { useCollection } from '@/hooks/use-firestore';
import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pin, Bell as BellIcon, Trash2, X, Check } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

export default function Announcements() {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin';

  const { data: announcements, loading, add, remove, update } = useCollection('announcements', {
    orderBy: { column: 'created_at', ascending: false },
  });

  const [isAdding, setIsAdding] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formPinned, setFormPinned] = useState(false);

  const handleAdd = async () => {
    if (!formTitle || !formBody) return;
    try {
      await add({
        title: formTitle,
        body: formBody,
        pinned: formPinned,
        author: userData?.display_name || 'Yönetici',
      });
      setFormTitle('');
      setFormBody('');
      setFormPinned(false);
      setIsAdding(false);
    } catch (err: any) {
      toast.error(`Duyuru yayınlanamadı: ${err?.message ?? String(err)}`);
    }
  };

  const togglePin = async (id: string, currentPinned: boolean) => {
    try {
      await update(id, { pinned: !currentPinned });
    } catch (err: any) {
      toast.error(`Sabitleme güncellenemedi: ${err?.message ?? String(err)}`);
    }
  };

  const sortedAnnouncements = [...announcements].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  const fmtDate = (d: string | null | undefined) => {
    if (!d) return 'Az önce';
    try { return format(new Date(d), 'd MMMM yyyy', { locale: tr }); }
    catch { return 'Az önce'; }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex items-end justify-between border-b border-white/10 pb-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-gradient-gold mb-2">Duyurular</h1>
          <p className="text-muted-foreground">HangBar ekibinden haberler, etkinlikler ve güncellemeler.</p>
        </div>
        {isAdmin && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg transition-all hover:bg-primary/90 font-medium shadow-[0_0_15px_rgba(201,168,76,0.3)]"
          >
            <Plus className="w-4 h-4" /> Duyuru Ekle
          </button>
        )}
      </header>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass p-6 rounded-2xl border-primary/30 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[40px]" />
            <h3 className="font-serif text-xl font-bold text-foreground mb-4">Yeni Duyuru</h3>
            <div className="space-y-4 relative z-10">
              <input
                type="text"
                placeholder="Duyuru Başlığı"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl py-3 px-4 text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
              />
              <textarea
                placeholder="Üyelerle ne paylaşmak istiyorsunuz?"
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                rows={5}
                className="w-full bg-black/50 border border-white/10 rounded-xl py-3 px-4 text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 resize-none"
              />
              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${formPinned ? 'bg-primary border-primary' : 'border-white/20 group-hover:border-primary/50 bg-black/50'}`}
                    onClick={() => setFormPinned(!formPinned)}
                  >
                    {formPinned && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  <span className="text-sm text-muted-foreground group-hover:text-foreground flex items-center gap-1">
                    <Pin className="w-4 h-4" /> Üste Sabitle
                  </span>
                </label>
                <div className="flex gap-3">
                  <button onClick={() => setIsAdding(false)} className="px-4 py-2 rounded-lg text-muted-foreground hover:bg-white/5 flex items-center gap-2">
                    <X className="w-4 h-4" /> İptal
                  </button>
                  <button onClick={handleAdd} className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium flex items-center gap-2 hover:bg-primary/90">
                    Yayınla
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        {loading ? (
          [1, 2, 3].map((i) => <div key={i} className="glass p-6 rounded-2xl animate-pulse h-40" />)
        ) : sortedAnnouncements.length === 0 ? (
          <div className="text-center py-20 glass rounded-2xl border-dashed">
            <BellIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground mb-1">Duyuru yok</h3>
            <p className="text-muted-foreground text-sm">Henüz duyuru yok. Daha sonra tekrar kontrol edin.</p>
          </div>
        ) : (
          sortedAnnouncements.map((ann: any) => (
            <div
              key={ann.id}
              className={`glass p-6 rounded-2xl relative ${ann.pinned ? 'border-primary/30 shadow-[0_0_20px_rgba(201,168,76,0.05)]' : ''}`}
            >
              {ann.pinned && (
                <div className="absolute top-0 right-8 transform -translate-y-1/2">
                  <div className="bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                    <Pin className="w-3 h-3" /> Sabitlenmiş
                  </div>
                </div>
              )}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-serif text-2xl font-bold text-foreground mb-1">{ann.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase tracking-wider">
                    <span>{ann.author}</span>
                    <span>•</span>
                    <span>{fmtDate(ann.created_at)}</span>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => togglePin(ann.id, ann.pinned)}
                      className={`p-2 rounded-lg transition-colors ${ann.pinned ? 'bg-primary/20 text-primary' : 'bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground'}`}
                      title={ann.pinned ? 'Sabitlemeyi Kaldır' : 'Sabitle'}
                    >
                      <Pin className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => remove(ann.id)}
                      className="p-2 bg-white/5 hover:bg-destructive/20 text-muted-foreground hover:text-destructive rounded-lg transition-colors"
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">{ann.body}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
