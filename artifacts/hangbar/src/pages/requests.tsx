import { useAuth } from '@/lib/auth-context';
import { useCollection } from '@/hooks/use-firestore';
import { useState } from 'react';
import { orderBy } from 'firebase/firestore';
import { ClipboardList, Plus, CheckCircle, XCircle, ShieldAlert, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const REQUEST_TYPES = [
  { value: 'Table Service', label: 'Masa Servisi' },
  { value: 'Special Event', label: 'Özel Etkinlik' },
  { value: 'Guest Pass', label: 'Misafir Geçişi' },
  { value: 'Complaint', label: 'Şikayet' },
  { value: 'Other', label: 'Diğer' },
];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Beklemede',
  approved: 'Onaylandı',
  denied: 'Reddedildi',
};

export default function Requests() {
  const { userData, user } = useAuth();
  const isAdminOrStaff = userData?.role === 'admin' || userData?.role === 'staff';

  const { data: requests, loading, add, update } = useCollection('requests', [
    orderBy('createdAt', 'desc'),
  ]);

  const [isAdding, setIsAdding] = useState(false);
  const [formType, setFormType] = useState('Table Service');
  const [formDescription, setFormDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!formDescription.trim()) {
      toast.error('Lütfen talep detaylarını girin.');
      return;
    }
    setIsSubmitting(true);
    try {
      await add({
        type: formType,
        description: formDescription.trim(),
        status: 'pending',
        requestedBy: user?.uid,
        requestedByName: userData?.displayName,
        notes: '',
      });
      setFormDescription('');
      setFormType('Table Service');
      setIsAdding(false);
      toast.success('Talebiniz başarıyla gönderildi.');
    } catch (err) {
      console.error('Talep gönderilemedi:', err);
      toast.error('Talep gönderilemedi. Lütfen tekrar deneyin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      await update(id, { status });
      toast.success(status === 'approved' ? 'Talep onaylandı.' : 'Talep reddedildi.');
    } catch (err) {
      console.error('Durum güncellenemedi:', err);
      toast.error('İşlem gerçekleştirilemedi. Lütfen tekrar deneyin.');
    } finally {
      setUpdatingId(null);
    }
  };

  const visibleRequests = isAdminOrStaff
    ? requests
    : requests.filter((r: any) => r.requestedBy === user?.uid);

  const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      approved: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      denied: 'bg-destructive/10 text-destructive border-destructive/20',
    };
    return (
      <span
        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
          styles[status] ?? 'bg-white/10 text-foreground border-white/20'
        }`}
      >
        {STATUS_LABELS[status] ?? status}
      </span>
    );
  };

  const getTypeLabel = (value: string) =>
    REQUEST_TYPES.find((t) => t.value === value)?.label ?? value;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex items-end justify-between border-b border-white/10 pb-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-gradient-gold mb-2">
            {isAdminOrStaff ? 'Üye Talepleri' : 'Taleplerim'}
          </h1>
          <p className="text-muted-foreground">
            {isAdminOrStaff
              ? 'Üyelerden gelen talepleri yönetin.'
              : 'HangBar personeline talep gönderin.'}
          </p>
        </div>
        {!isAdminOrStaff && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg transition-all hover:bg-primary/90 font-medium shadow-[0_0_15px_rgba(201,168,76,0.3)]"
          >
            <Plus className="w-4 h-4" /> Yeni Talep
          </button>
        )}
      </header>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass p-6 rounded-2xl border border-primary/30 relative overflow-hidden"
          >
            <h3 className="font-serif text-xl font-bold text-foreground mb-4">Talep Gönder</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Talep Türü
                </label>
                <div className="flex flex-wrap gap-2">
                  {REQUEST_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormType(type.value)}
                      className={`px-4 py-2 rounded-xl text-sm transition-all border ${
                        formType === type.value
                          ? 'bg-primary/20 border-primary text-primary'
                          : 'bg-black/50 border-white/10 text-muted-foreground hover:border-white/30'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Detaylar
                </label>
                <textarea
                  placeholder="Talebinizle ilgili detayları belirtin..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={4}
                  className="w-full bg-black/50 border border-white/10 rounded-xl py-3 px-4 text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setFormDescription('');
                    setFormType('Table Service');
                  }}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg text-muted-foreground hover:bg-white/5 disabled:opacity-50 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !formDescription.trim()}
                  className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Gönderiliyor...</>
                  ) : (
                    'Talebi Gönder'
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {loading ? (
          [1, 2, 3].map((i) => <div key={i} className="glass p-6 rounded-2xl animate-pulse h-32" />)
        ) : visibleRequests.length === 0 ? (
          <div className="text-center py-20 glass rounded-2xl border border-dashed border-white/10">
            <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground mb-1">Talep yok</h3>
            <p className="text-muted-foreground text-sm">
              {isAdminOrStaff
                ? 'Tüm talepler işlendi.'
                : 'Henüz bir talep oluşturmadınız.'}
            </p>
            {!isAdminOrStaff && (
              <button
                onClick={() => setIsAdding(true)}
                className="mt-4 px-4 py-2 bg-primary/10 border border-primary/20 text-primary rounded-lg text-sm hover:bg-primary/20 transition-colors"
              >
                İlk talebini oluştur
              </button>
            )}
          </div>
        ) : (
          visibleRequests.map((req: any) => (
            <div
              key={req.id}
              className="glass p-6 rounded-2xl flex flex-col md:flex-row gap-6 justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className="text-sm font-semibold text-primary border border-primary/20 bg-primary/10 px-3 py-1 rounded-full">
                    {getTypeLabel(req.type)}
                  </span>
                  <StatusBadge status={req.status} />
                </div>
                <p className="text-foreground mt-3 leading-relaxed">{req.description}</p>
                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground uppercase tracking-wider flex-wrap">
                  {isAdminOrStaff && (
                    <span className="flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> Gönderen: {req.requestedByName}
                    </span>
                  )}
                  <span>
                    {req.createdAt?.toDate
                      ? format(req.createdAt.toDate(), 'd MMM yyyy • HH:mm', { locale: tr })
                      : 'Az önce'}
                  </span>
                </div>
              </div>

              {isAdminOrStaff && req.status === 'pending' && (
                <div className="flex md:flex-col gap-2 md:justify-center border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6">
                  <button
                    onClick={() => updateStatus(req.id, 'approved')}
                    disabled={updatingId === req.id}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {updatingId === req.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Onayla
                  </button>
                  <button
                    onClick={() => updateStatus(req.id, 'denied')}
                    disabled={updatingId === req.id}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" /> Reddet
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
