import { useAuth } from '@/lib/auth-context';
import { useCollection } from '@/hooks/use-firestore';
import { useState, useRef } from 'react';
import {
  Shield, Users, Martini, ShieldAlert, Trash2, User,
  Plus, Edit2, X, Loader2, Save, Upload, ImageIcon,
  Star, CheckCircle, XCircle, Award,
} from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { arrayUnion, arrayRemove, increment, where } from 'firebase/firestore';

// ─── Types ─────────────────────────────────────────────────────────────────

interface CocktailForm {
  name: string; category: string; price: string; ingredients: string;
  preparation: string; garnish: string; glassType: string; iceType: string;
  alcoholLevel: string; notes: string; available: boolean; imageURL: string;
}

const EMPTY_FORM: CocktailForm = {
  name: '', category: 'Signature', price: '', ingredients: '', preparation: '',
  garnish: '', glassType: '', iceType: 'Küp Buz', alcoholLevel: 'Orta',
  notes: '', available: true, imageURL: '',
};

const CATEGORIES = ['Signature', 'Classic', 'Mocktail', 'Shots', 'Sıcak İçecek', 'Alkolsüz', 'Mevsimlik'];
const ICE_TYPES = ['Küp Buz', 'Kırma Buz', 'Ezme Buz', 'Yok'];
const ALCOHOL_LEVELS = ['Alkolsüz', 'Düşük', 'Orta', 'Yüksek'];

const ROLE_LABELS: Record<string, string> = { member: 'Üye', staff: 'Personel', admin: 'Yönetici' };

const PRESET_BADGES = [
  { emoji: '🥇', name: 'En Hızlı Barmen' },
  { emoji: '🍸', name: 'Kokteyl Ustası' },
  { emoji: '⭐', name: 'Ayın Personeli' },
  { emoji: '🔥', name: 'MVP' },
  { emoji: '💎', name: 'Elit Üye' },
  { emoji: '🏆', name: 'Şampiyon' },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function Admin() {
  const { userData } = useAuth();
  const [activeTab, setActiveTab] = useState('Genel Bakış');

  const { data: users, update: updateUser } = useCollection('users');
  const { data: requests } = useCollection('requests');
  const { data: tasks } = useCollection('tasks');
  const { data: cocktails, add: addCocktail, update: updateCocktail, remove: removeCocktail } = useCollection('cocktails');
  const { data: badges, add: addBadge, remove: removeBadge } = useCollection('badges');
  const { data: submissions, update: updateSubmission } = useCollection('cocktailSubmissions', [
    where('status', '==', 'pending'),
  ]);

  // ── Cocktail modal state ──
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CocktailForm>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Badge state ──
  const [badgeEmoji, setBadgeEmoji] = useState('⭐');
  const [badgeName, setBadgeName] = useState('');
  const [isSavingBadge, setIsSavingBadge] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignBadgeId, setAssignBadgeId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // ── Approval state ──
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Stats
  const memberCount = users.filter((u: any) => u.role === 'member').length;
  const staffCount = users.filter((u: any) => u.role === 'staff').length;
  const adminCount = users.filter((u: any) => u.role === 'admin').length;
  const pendingRequests = requests.filter((r: any) => r.status === 'pending').length;
  const activeTasks = tasks.filter((t: any) => t.status !== 'done').length;

  // ── Cocktail helpers ──────────────────────────────────────────

  const openAdd = () => { setEditingId(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      name: c.name ?? '', category: c.category ?? 'Signature', price: c.price?.toString() ?? '',
      ingredients: Array.isArray(c.ingredients) ? c.ingredients.join('\n') : (c.ingredients ?? ''),
      preparation: c.preparation ?? '', garnish: c.garnish ?? '', glassType: c.glassType ?? '',
      iceType: c.iceType ?? 'Küp Buz', alcoholLevel: c.alcoholLevel ?? 'Orta',
      notes: c.notes ?? '', available: c.available ?? true, imageURL: c.imageURL ?? '',
    });
    setModalOpen(true);
  };
  const closeModal = () => { if (isSaving || uploadProgress !== null) return; setModalOpen(false); setEditingId(null); setForm(EMPTY_FORM); };
  const setF = (field: keyof CocktailForm, value: any) => setForm((f) => ({ ...f, [field]: value }));

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast.error('Dosya boyutu 8 MB\'ı geçemez.'); return; }
    setUploadProgress(0);
    const task = uploadBytesResumable(ref(storage, `cocktail-images/${Date.now()}_${file.name}`), file);
    task.on('state_changed',
      (snap) => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => { console.error(err); toast.error('Görsel yüklenemedi.'); setUploadProgress(null); },
      async () => {
        try { const url = await getDownloadURL(task.snapshot.ref); setF('imageURL', url); toast.success('Görsel yüklendi.'); }
        catch { toast.error('Görsel URL alınamadı.'); }
        finally { setUploadProgress(null); if (fileInputRef.current) fileInputRef.current.value = ''; }
      },
    );
  };

  const handleSaveCocktail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Kokteyl adı gereklidir.'); return; }
    if (!form.price || isNaN(Number(form.price))) { toast.error('Geçerli bir fiyat girin.'); return; }
    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(), category: form.category, price: Number(form.price),
        ingredients: form.ingredients.split('\n').map((s) => s.trim()).filter(Boolean),
        preparation: form.preparation.trim(), garnish: form.garnish.trim(),
        glassType: form.glassType.trim(), iceType: form.iceType, alcoholLevel: form.alcoholLevel,
        notes: form.notes.trim(), available: form.available, imageURL: form.imageURL,
      };
      if (editingId) { await updateCocktail(editingId, payload); toast.success('Kokteyl güncellendi.'); }
      else { await addCocktail(payload); toast.success('Kokteyl eklendi.'); }
      closeModal();
    } catch (err) { console.error(err); toast.error('Kokteyl kaydedilemedi.'); }
    finally { setIsSaving(false); }
  };

  const handleDeleteCocktail = async (id: string, name: string) => {
    if (!window.confirm(`"${name}" adlı kokteyli silmek istediğinizden emin misiniz?`)) return;
    setDeletingId(id);
    try { await removeCocktail(id); toast.success('Kokteyl silindi.'); }
    catch { toast.error('Kokteyl silinemedi.'); }
    finally { setDeletingId(null); }
  };

  const toggleAvailability = async (id: string, current: boolean) => {
    try { await updateCocktail(id, { available: !current }); }
    catch { toast.error('Durum güncellenemedi.'); }
  };

  // ── User helpers ──────────────────────────────────────────────

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (userId === userData?.uid) return;
    try { await updateUser(userId, { role: newRole }); toast.success('Rol güncellendi.'); }
    catch { toast.error('Rol güncellenemedi.'); }
  };

  // ── Badge helpers ─────────────────────────────────────────────

  const handleCreateBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!badgeName.trim()) { toast.error('Rozet adı gereklidir.'); return; }
    setIsSavingBadge(true);
    try {
      await addBadge({ emoji: badgeEmoji, name: badgeName.trim() });
      setBadgeName('');
      toast.success('Rozet oluşturuldu.');
    } catch { toast.error('Rozet oluşturulamadı.'); }
    finally { setIsSavingBadge(false); }
  };

  const handleAssignBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignUserId || !assignBadgeId) { toast.error('Kullanıcı ve rozet seçin.'); return; }
    const badge = badges.find((b: any) => b.id === assignBadgeId) as any;
    if (!badge) return;
    setIsAssigning(true);
    try {
      await updateUser(assignUserId, {
        badges: arrayUnion({ id: badge.id, emoji: badge.emoji, name: badge.name }),
      });
      toast.success('Rozet atandı.');
    } catch { toast.error('Rozet atanamadı.'); }
    finally { setIsAssigning(false); }
  };

  const handleRemoveBadge = async (userId: string, badge: any) => {
    try {
      await updateUser(userId, { badges: arrayRemove({ id: badge.id, emoji: badge.emoji, name: badge.name }) });
      toast.success('Rozet kaldırıldı.');
    } catch { toast.error('Rozet kaldırılamadı.'); }
  };

  // ── Submission helpers ────────────────────────────────────────

  const handleApprove = async (sub: any) => {
    setProcessingId(sub.id);
    try {
      await updateSubmission(sub.id, { status: 'approved' });
      await updateUser(sub.submittedBy, { cocktailCount: increment(1) });
      toast.success(`${sub.submittedByName} onaylandı! Sayaç artırıldı.`);
    } catch (err) { console.error(err); toast.error('Onaylama başarısız.'); }
    finally { setProcessingId(null); }
  };

  const handleReject = async (sub: any) => {
    setProcessingId(sub.id);
    try {
      await updateSubmission(sub.id, { status: 'rejected' });
      toast.success('Gönderim reddedildi.');
    } catch { toast.error('Reddetme başarısız.'); }
    finally { setProcessingId(null); }
  };

  // ── Shared input style ────────────────────────────────────────

  const inputCls = 'w-full bg-black/50 border border-white/10 rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 text-sm';
  const labelCls = 'block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5';

  const tabs = ['Genel Bakış', 'Kullanıcılar', 'Kokteyller', 'Rozetler', 'Onaylar'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="border-b border-white/10 pb-6">
        <h1 className="font-serif text-3xl font-bold text-gradient-gold mb-2 flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-primary" /> Yönetim Paneli
        </h1>
        <p className="text-muted-foreground">Sistem yapılandırması ve kullanıcı yönetimi.</p>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-4 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all relative ${
              activeTab === tab
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'text-muted-foreground hover:bg-white/5 border border-transparent'
            }`}
          >
            {tab}
            {tab === 'Onaylar' && submissions.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-black text-[9px] font-bold rounded-full flex items-center justify-center">
                {submissions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="pt-2">

        {/* ── Genel Bakış ── */}
        {activeTab === 'Genel Bakış' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="glass p-6 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-blue-500/20 rounded-xl text-blue-500"><Users className="w-6 h-6" /></div>
                <h3 className="font-serif text-xl font-bold">Kullanıcı Tabanı</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Üyeler</span><span className="font-mono">{memberCount}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Personel</span><span className="font-mono">{staffCount}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Yöneticiler</span><span className="font-mono">{adminCount}</span></div>
                <div className="pt-3 border-t border-white/10 flex justify-between font-bold">
                  <span>Toplam</span><span className="font-mono text-primary">{users.length}</span>
                </div>
              </div>
            </div>
            <div className="glass p-6 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-amber-500/20 rounded-xl text-amber-500"><Shield className="w-6 h-6" /></div>
                <h3 className="font-serif text-xl font-bold">Operasyonlar</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Bekleyen Talepler</span><span className="font-mono text-amber-500">{pendingRequests}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Aktif Görevler</span><span className="font-mono">{activeTasks}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Bekleyen Onaylar</span><span className="font-mono text-primary">{submissions.length}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Toplam Kokteyl</span><span className="font-mono">{cocktails.length}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* ── Kullanıcılar ── */}
        {activeTab === 'Kullanıcılar' && (
          <div className="glass rounded-2xl overflow-hidden border border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-black/40 text-muted-foreground uppercase tracking-wider text-[10px] border-b border-white/10">
                  <tr>
                    <th className="px-6 py-4">Kullanıcı</th>
                    <th className="px-6 py-4">E-posta</th>
                    <th className="px-6 py-4">Katılım</th>
                    <th className="px-6 py-4">Kokteyl</th>
                    <th className="px-6 py-4">Rol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((u: any) => (
                    <tr key={u.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 overflow-hidden flex items-center justify-center">
                            {u.photoURL ? <img src={u.photoURL} alt="" className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-primary" />}
                          </div>
                          <div>
                            <p className="font-medium">{u.displayName || 'İsimsiz'}</p>
                            {u.username && <p className="text-xs text-muted-foreground">@{u.username}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{u.email}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {u.joinedAt?.toDate ? new Date(u.joinedAt.toDate()).toLocaleDateString('tr-TR') : 'Yok'}
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-primary">{u.cocktailCount ?? 0}</td>
                      <td className="px-6 py-4">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          disabled={u.id === userData?.uid}
                          className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs uppercase tracking-wider focus:border-primary/50 disabled:opacity-50 cursor-pointer"
                        >
                          {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Kokteyller ── */}
        {activeTab === 'Kokteyller' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button onClick={openAdd} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg hover:bg-primary/90 transition-colors font-medium shadow-[0_0_15px_rgba(201,168,76,0.3)]">
                <Plus className="w-4 h-4" /> Kokteyl Ekle
              </button>
            </div>
            {cocktails.length === 0 ? (
              <div className="text-center py-20 glass rounded-2xl border border-dashed border-white/10">
                <Martini className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground text-sm">Henüz kokteyl yok. Eklemek için butonu kullanın.</p>
              </div>
            ) : (
              <div className="glass rounded-2xl overflow-hidden border border-white/10">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-black/40 text-muted-foreground uppercase tracking-wider text-[10px] border-b border-white/10">
                      <tr>
                        <th className="px-6 py-4">Görsel</th><th className="px-6 py-4">İsim</th>
                        <th className="px-6 py-4">Kategori</th><th className="px-6 py-4">Fiyat</th>
                        <th className="px-6 py-4">Alkol</th><th className="px-6 py-4 text-center">Durum</th>
                        <th className="px-6 py-4 text-right">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {cocktails.map((c: any) => (
                        <tr key={c.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 overflow-hidden flex items-center justify-center border border-white/10">
                              {c.imageURL ? <img src={c.imageURL} alt={c.name} className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 text-muted-foreground" />}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-serif font-bold text-base">{c.name}</td>
                          <td className="px-6 py-4 text-muted-foreground text-xs uppercase">{c.category}</td>
                          <td className="px-6 py-4 text-primary font-medium">{c.price} ₺</td>
                          <td className="px-6 py-4 text-muted-foreground text-xs">{c.alcoholLevel}</td>
                          <td className="px-6 py-4 text-center">
                            <button onClick={() => toggleAvailability(c.id, c.available)} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-colors ${c.available ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20'}`}>
                              {c.available ? 'Mevcut' : 'Mevcut Değil'}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => openEdit(c)} className="p-2 text-muted-foreground hover:text-primary bg-white/5 rounded-lg transition-colors" title="Düzenle"><Edit2 className="w-4 h-4" /></button>
                              <button onClick={() => handleDeleteCocktail(c.id, c.name)} disabled={deletingId === c.id} className="p-2 text-muted-foreground hover:text-destructive bg-white/5 rounded-lg transition-colors disabled:opacity-50" title="Sil">
                                {deletingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Rozetler ── */}
        {activeTab === 'Rozetler' && (
          <div className="space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Create badge */}
              <div className="glass p-6 rounded-2xl border border-white/10 space-y-5">
                <h3 className="font-serif text-xl font-bold flex items-center gap-2">
                  <Star className="w-5 h-5 text-primary" /> Yeni Rozet Oluştur
                </h3>
                <form onSubmit={handleCreateBadge} className="space-y-4">
                  <div>
                    <label className={labelCls}>Hızlı Seç</label>
                    <div className="flex flex-wrap gap-2">
                      {PRESET_BADGES.map((p) => (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => { setBadgeEmoji(p.emoji); setBadgeName(p.name); }}
                          className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm hover:border-primary/40 transition-colors"
                        >
                          {p.emoji} {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelCls}>Emoji</label>
                      <input className={inputCls + ' text-center text-xl'} value={badgeEmoji} onChange={(e) => setBadgeEmoji(e.target.value)} maxLength={4} />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Rozet Adı</label>
                      <input className={inputCls} placeholder="Örn: Kokteyl Ustası" value={badgeName} onChange={(e) => setBadgeName(e.target.value)} required />
                    </div>
                  </div>
                  <button type="submit" disabled={isSavingBadge} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-60">
                    {isSavingBadge ? <><Loader2 className="w-4 h-4 animate-spin" /> Oluşturuluyor...</> : <><Plus className="w-4 h-4" /> Rozet Oluştur</>}
                  </button>
                </form>
              </div>

              {/* Badge list */}
              <div className="glass p-6 rounded-2xl border border-white/10">
                <h3 className="font-serif text-xl font-bold mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" /> Mevcut Rozetler
                </h3>
                {badges.length === 0 ? (
                  <p className="text-muted-foreground text-sm italic">Henüz rozet oluşturulmadı.</p>
                ) : (
                  <div className="space-y-2">
                    {badges.map((b: any) => (
                      <div key={b.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                        <span className="text-base">{b.emoji} <span className="text-sm font-medium ml-1">{b.name}</span></span>
                        <button onClick={() => removeBadge(b.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Assign badge to user */}
            <div className="glass p-6 rounded-2xl border border-white/10">
              <h3 className="font-serif text-xl font-bold mb-5 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" /> Kullanıcıya Rozet Ata
              </h3>
              <form onSubmit={handleAssignBadge} className="flex flex-col sm:flex-row gap-3">
                <select value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} className={inputCls + ' flex-1'}>
                  <option value="">Kullanıcı seçin...</option>
                  {users.map((u: any) => <option key={u.id} value={u.id}>{u.displayName || u.email}</option>)}
                </select>
                <select value={assignBadgeId} onChange={(e) => setAssignBadgeId(e.target.value)} className={inputCls + ' flex-1'}>
                  <option value="">Rozet seçin...</option>
                  {badges.map((b: any) => <option key={b.id} value={b.id}>{b.emoji} {b.name}</option>)}
                </select>
                <button type="submit" disabled={isAssigning || !assignUserId || !assignBadgeId} className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 whitespace-nowrap">
                  {isAssigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Ata
                </button>
              </form>

              {/* Users with badges */}
              <div className="mt-6 space-y-3">
                {users.filter((u: any) => Array.isArray(u.badges) && u.badges.length > 0).map((u: any) => (
                  <div key={u.id} className="flex items-start justify-between p-4 bg-white/5 rounded-xl">
                    <div>
                      <p className="font-medium text-sm mb-2">{u.displayName || u.email}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {u.badges.map((b: any, i: number) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs text-primary">
                            {b.emoji} {b.name}
                            <button onClick={() => handleRemoveBadge(u.id, b)} className="ml-1 hover:text-destructive transition-colors"><X className="w-3 h-3" /></button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Onaylar ── */}
        {activeTab === 'Onaylar' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-serif text-xl font-bold mb-1">Bekleyen Kokteyl Onayları</h3>
              <p className="text-sm text-muted-foreground">Personelin paylaştığı kokteyl fotoğraflarını onaylayın. Onaylanan her kokteyl, personelin sayacını artırır.</p>
            </div>
            {submissions.length === 0 ? (
              <div className="text-center py-20 glass rounded-2xl border border-dashed border-white/10">
                <CheckCircle className="w-12 h-12 text-emerald-500/40 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-1">Bekleyen onay yok</h3>
                <p className="text-muted-foreground text-sm">Tüm gönderimler işlendi.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {submissions.map((sub: any) => (
                  <div key={sub.id} className="glass p-6 rounded-2xl flex flex-col md:flex-row gap-6">
                    {/* Photo */}
                    {sub.imageURL && (
                      <div className="w-full md:w-40 h-40 rounded-xl overflow-hidden border border-white/10 flex-shrink-0">
                        <img src={sub.imageURL} alt={sub.cocktailName} className="w-full h-full object-cover" />
                      </div>
                    )}
                    {/* Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 overflow-hidden flex items-center justify-center">
                          {sub.submittedByPhoto
                            ? <img src={sub.submittedByPhoto} alt="" className="w-full h-full object-cover" />
                            : <User className="w-4 h-4 text-primary" />}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{sub.submittedByName}</p>
                          <p className="text-xs text-muted-foreground">
                            {sub.createdAt?.toDate
                              ? new Date(sub.createdAt.toDate()).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
                              : 'Az önce'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Martini className="w-4 h-4 text-primary" />
                        <span className="font-serif font-bold text-lg">{sub.cocktailName}</span>
                      </div>
                      <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border bg-amber-500/10 text-amber-500 border-amber-500/20">
                        Beklemede
                      </span>
                    </div>
                    {/* Actions */}
                    <div className="flex md:flex-col gap-2 md:justify-center border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6">
                      <button
                        onClick={() => handleApprove(sub)}
                        disabled={processingId === sub.id}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {processingId === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Onayla
                      </button>
                      <button
                        onClick={() => handleReject(sub)}
                        disabled={processingId === sub.id}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" /> Reddet
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Cocktail Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modalOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={closeModal} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
              <div className="glass border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-black/80 backdrop-blur-sm rounded-t-2xl z-10">
                  <h2 className="font-serif text-2xl font-bold text-gradient-gold">{editingId ? 'Kokteyli Düzenle' : 'Yeni Kokteyl Ekle'}</h2>
                  <button type="button" onClick={closeModal} disabled={isSaving} className="p-2 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSaveCocktail} className="p-6 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Kokteyl Adı <span className="text-destructive">*</span></label>
                      <input className={inputCls} placeholder="Örn: Dark Velvet" value={form.name} onChange={(e) => setF('name', e.target.value)} required />
                    </div>
                    <div>
                      <label className={labelCls}>Kategori</label>
                      <select className={inputCls} value={form.category} onChange={(e) => setF('category', e.target.value)}>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Fiyat (₺) <span className="text-destructive">*</span></label>
                      <input className={inputCls} type="number" min="0" step="0.5" placeholder="0" value={form.price} onChange={(e) => setF('price', e.target.value)} required />
                    </div>
                    <div>
                      <label className={labelCls}>Alkol Seviyesi</label>
                      <select className={inputCls} value={form.alcoholLevel} onChange={(e) => setF('alcoholLevel', e.target.value)}>
                        {ALCOHOL_LEVELS.map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Buz Türü</label>
                      <select className={inputCls} value={form.iceType} onChange={(e) => setF('iceType', e.target.value)}>
                        {ICE_TYPES.map((i) => <option key={i} value={i}>{i}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Bardak Türü</label>
                      <input className={inputCls} placeholder="Örn: Rocks, Coupe, Highball" value={form.glassType} onChange={(e) => setF('glassType', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Garnitür</label>
                      <input className={inputCls} placeholder="Örn: Lime dilimleri, Kiraz" value={form.garnish} onChange={(e) => setF('garnish', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>İçindekiler (her satıra bir malzeme)</label>
                    <textarea className={inputCls + ' resize-none'} rows={4} placeholder={'60 ml Bourbon\n20 ml Taze limon suyu'} value={form.ingredients} onChange={(e) => setF('ingredients', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Hazırlık</label>
                    <textarea className={inputCls + ' resize-none'} rows={3} placeholder="Yapılış adımları..." value={form.preparation} onChange={(e) => setF('preparation', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Notlar</label>
                    <textarea className={inputCls + ' resize-none'} rows={2} placeholder="Özel notlar, alerjen uyarıları..." value={form.notes} onChange={(e) => setF('notes', e.target.value)} />
                  </div>
                  {/* Image upload */}
                  <div>
                    <label className={labelCls}>Kokteyl Görseli</label>
                    <div className="flex items-start gap-4">
                      {form.imageURL ? (
                        <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/10 flex-shrink-0">
                          <img src={form.imageURL} alt="Önizleme" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => setF('imageURL', '')} className="absolute top-1 right-1 bg-black/70 rounded-full p-0.5 text-white hover:bg-destructive/80"><X className="w-3 h-3" /></button>
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-xl border border-dashed border-white/20 flex items-center justify-center flex-shrink-0 bg-white/5"><ImageIcon className="w-6 h-6 text-muted-foreground" /></div>
                      )}
                      <div className="flex-1">
                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadProgress !== null} className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm hover:bg-white/10 transition-colors disabled:opacity-60">
                          {uploadProgress !== null ? <><Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor %{uploadProgress}</> : <><Upload className="w-4 h-4" /> Görsel Yükle</>}
                        </button>
                        <p className="text-xs text-muted-foreground mt-2">JPG, PNG veya WEBP · Maks. 8 MB</p>
                        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageUpload} />
                      </div>
                    </div>
                  </div>
                  {/* Availability */}
                  <div className="flex items-center gap-3 pt-2">
                    <button type="button" onClick={() => setF('available', !form.available)} className={`relative w-12 h-6 rounded-full transition-colors ${form.available ? 'bg-primary' : 'bg-white/20'}`}>
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.available ? 'translate-x-7' : 'translate-x-1'}`} />
                    </button>
                    <span className="text-sm">{form.available ? 'Menüde Mevcut' : 'Menüde Mevcut Değil'}</span>
                  </div>
                  <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                    <button type="button" onClick={closeModal} disabled={isSaving} className="px-4 py-2 rounded-lg text-muted-foreground hover:bg-white/5 transition-colors disabled:opacity-50">İptal</button>
                    <button type="submit" disabled={isSaving || uploadProgress !== null} className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-60 shadow-[0_0_15px_rgba(201,168,76,0.2)]">
                      {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor...</> : <><Save className="w-4 h-4" /> {editingId ? 'Güncelle' : 'Ekle'}</>}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
