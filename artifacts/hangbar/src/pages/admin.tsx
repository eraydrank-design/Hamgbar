import { useAuth } from '@/lib/auth-context';
import { useCollection } from '@/hooks/use-firestore';
import { useState, useRef } from 'react';
import {
  Shield, Users, Martini, ShieldAlert, Trash2, User,
  Plus, Edit2, X, Loader2, Save, Upload, ImageIcon,
} from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ─────────────────────────────────────────────────────────────────

interface CocktailForm {
  name: string;
  category: string;
  price: string;
  ingredients: string;
  preparation: string;
  garnish: string;
  glassType: string;
  iceType: string;
  alcoholLevel: string;
  notes: string;
  available: boolean;
  imageURL: string;
}

const EMPTY_FORM: CocktailForm = {
  name: '',
  category: 'Signature',
  price: '',
  ingredients: '',
  preparation: '',
  garnish: '',
  glassType: '',
  iceType: 'Küp Buz',
  alcoholLevel: 'Orta',
  notes: '',
  available: true,
  imageURL: '',
};

const CATEGORIES = ['Signature', 'Classic', 'Mocktail', 'Shots', 'Sıcak İçecek', 'Alkolsüz', 'Mevsimlik'];
const ICE_TYPES = ['Küp Buz', 'Kırma Buz', 'Ezme Buz', 'Yok'];
const ALCOHOL_LEVELS = ['Alkolsüz', 'Düşük', 'Orta', 'Yüksek'];

// ─── Role labels ────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  member: 'Üye',
  staff: 'Personel',
  admin: 'Yönetici',
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function Admin() {
  const { userData } = useAuth();
  const [activeTab, setActiveTab] = useState('Genel Bakış');

  const { data: users, update: updateUser } = useCollection('users');
  const { data: requests } = useCollection('requests');
  const { data: tasks } = useCollection('tasks');
  const { data: cocktails, add: addCocktail, update: updateCocktail, remove: removeCocktail } =
    useCollection('cocktails');

  // Cocktail modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CocktailForm>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stats
  const memberCount = users.filter((u: any) => u.role === 'member').length;
  const staffCount = users.filter((u: any) => u.role === 'staff').length;
  const adminCount = users.filter((u: any) => u.role === 'admin').length;
  const pendingRequests = requests.filter((r: any) => r.status === 'pending').length;
  const activeTasks = tasks.filter((t: any) => t.status !== 'done').length;

  // ── Helpers ──────────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      name: c.name ?? '',
      category: c.category ?? 'Signature',
      price: c.price?.toString() ?? '',
      ingredients: Array.isArray(c.ingredients) ? c.ingredients.join('\n') : (c.ingredients ?? ''),
      preparation: c.preparation ?? '',
      garnish: c.garnish ?? '',
      glassType: c.glassType ?? '',
      iceType: c.iceType ?? 'Küp Buz',
      alcoholLevel: c.alcoholLevel ?? 'Orta',
      notes: c.notes ?? '',
      available: c.available ?? true,
      imageURL: c.imageURL ?? '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (isSaving || uploadProgress !== null) return;
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const set = (field: keyof CocktailForm, value: any) =>
    setForm((f) => ({ ...f, [field]: value }));

  // ── Image upload ──────────────────────────────────────────────

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      toast.error('Dosya boyutu 8 MB\'ı geçemez.');
      return;
    }

    setUploadProgress(0);
    const storageRef = ref(storage, `cocktail-images/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(storageRef, file);

    task.on(
      'state_changed',
      (snap) => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => {
        console.error('Görsel yükleme hatası:', err);
        toast.error('Görsel yüklenemedi.');
        setUploadProgress(null);
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          set('imageURL', url);
          toast.success('Görsel yüklendi.');
        } catch {
          toast.error('Görsel URL alınamadı.');
        } finally {
          setUploadProgress(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
    );
  };

  // ── Save cocktail ─────────────────────────────────────────────

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Kokteyl adı gereklidir.'); return; }
    if (!form.price || isNaN(Number(form.price))) { toast.error('Geçerli bir fiyat girin.'); return; }

    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        price: Number(form.price),
        ingredients: form.ingredients.split('\n').map((s) => s.trim()).filter(Boolean),
        preparation: form.preparation.trim(),
        garnish: form.garnish.trim(),
        glassType: form.glassType.trim(),
        iceType: form.iceType,
        alcoholLevel: form.alcoholLevel,
        notes: form.notes.trim(),
        available: form.available,
        imageURL: form.imageURL,
      };

      if (editingId) {
        await updateCocktail(editingId, payload);
        toast.success('Kokteyl güncellendi.');
      } else {
        await addCocktail(payload);
        toast.success('Kokteyl eklendi.');
      }
      closeModal();
    } catch (err) {
      console.error('Kokteyl kaydedilemedi:', err);
      toast.error('Kokteyl kaydedilemedi. Lütfen tekrar deneyin.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete cocktail ───────────────────────────────────────────

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`"${name}" adlı kokteyli silmek istediğinizden emin misiniz?`)) return;
    setDeletingId(id);
    try {
      await removeCocktail(id);
      toast.success('Kokteyl silindi.');
    } catch (err) {
      console.error('Kokteyl silinemedi:', err);
      toast.error('Kokteyl silinemedi.');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Toggle availability ───────────────────────────────────────

  const toggleAvailability = async (id: string, current: boolean) => {
    try {
      await updateCocktail(id, { available: !current });
    } catch {
      toast.error('Durum güncellenemedi.');
    }
  };

  // ── Role change ───────────────────────────────────────────────

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (userId === userData?.uid) return;
    try {
      await updateUser(userId, { role: newRole });
      toast.success('Kullanıcı rolü güncellendi.');
    } catch {
      toast.error('Rol güncellenemedi.');
    }
  };

  const tabs = ['Genel Bakış', 'Kullanıcılar', 'Kokteyller'];

  // ── Input helper ──────────────────────────────────────────────

  const inputCls =
    'w-full bg-black/50 border border-white/10 rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 text-sm';
  const labelCls = 'block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="border-b border-white/10 pb-6">
        <h1 className="font-serif text-3xl font-bold text-gradient-gold mb-2 flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-primary" /> Yönetim Paneli
        </h1>
        <p className="text-muted-foreground">Sistem yapılandırması ve kullanıcı yönetimi.</p>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-4">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'text-muted-foreground hover:bg-white/5 border border-transparent'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="pt-2">
        {/* ── Genel Bakış ── */}
        {activeTab === 'Genel Bakış' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="glass p-6 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-blue-500/20 rounded-xl text-blue-500">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="font-serif text-xl font-bold">Kullanıcı Tabanı</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Üyeler</span><span className="font-mono">{memberCount}</span></div>
                <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Personel</span><span className="font-mono">{staffCount}</span></div>
                <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Yöneticiler</span><span className="font-mono">{adminCount}</span></div>
                <div className="pt-3 border-t border-white/10 flex justify-between items-center font-bold">
                  <span className="text-foreground">Toplam</span>
                  <span className="font-mono text-primary">{users.length}</span>
                </div>
              </div>
            </div>

            <div className="glass p-6 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-amber-500/20 rounded-xl text-amber-500">
                  <Shield className="w-6 h-6" />
                </div>
                <h3 className="font-serif text-xl font-bold">Operasyonlar</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Bekleyen Talepler</span><span className="font-mono text-amber-500">{pendingRequests}</span></div>
                <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Aktif Görevler</span><span className="font-mono">{activeTasks}</span></div>
                <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Toplam Kokteyl</span><span className="font-mono text-primary">{cocktails.length}</span></div>
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
                    <th className="px-6 py-4 font-medium">Kullanıcı</th>
                    <th className="px-6 py-4 font-medium">E-posta</th>
                    <th className="px-6 py-4 font-medium">Katılım</th>
                    <th className="px-6 py-4 font-medium">Rol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((u: any) => (
                    <tr key={u.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 overflow-hidden flex items-center justify-center">
                            {u.photoURL
                              ? <img src={u.photoURL} alt="" className="w-full h-full object-cover" />
                              : <User className="w-4 h-4 text-primary" />}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{u.displayName || 'İsimsiz'}</p>
                            {u.username && <p className="text-xs text-muted-foreground">@{u.username}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{u.email}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {u.joinedAt?.toDate
                          ? new Date(u.joinedAt.toDate()).toLocaleDateString('tr-TR')
                          : 'Yok'}
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          disabled={u.id === userData?.uid}
                          className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-foreground uppercase tracking-wider focus:border-primary/50 disabled:opacity-50 cursor-pointer"
                        >
                          {Object.entries(ROLE_LABELS).map(([val, lbl]) => (
                            <option key={val} value={val}>{lbl}</option>
                          ))}
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
              <button
                onClick={openAdd}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg hover:bg-primary/90 transition-colors font-medium shadow-[0_0_15px_rgba(201,168,76,0.3)]"
              >
                <Plus className="w-4 h-4" /> Kokteyl Ekle
              </button>
            </div>

            {cocktails.length === 0 ? (
              <div className="text-center py-20 glass rounded-2xl border border-dashed border-white/10">
                <Martini className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-1">Henüz kokteyl yok</h3>
                <p className="text-muted-foreground text-sm mb-4">Menüye ilk kokteyli eklemek için yukarıdaki butonu kullanın.</p>
              </div>
            ) : (
              <div className="glass rounded-2xl overflow-hidden border border-white/10">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-black/40 text-muted-foreground uppercase tracking-wider text-[10px] border-b border-white/10">
                      <tr>
                        <th className="px-6 py-4 font-medium">Görsel</th>
                        <th className="px-6 py-4 font-medium">İsim</th>
                        <th className="px-6 py-4 font-medium">Kategori</th>
                        <th className="px-6 py-4 font-medium">Fiyat</th>
                        <th className="px-6 py-4 font-medium">Alkol</th>
                        <th className="px-6 py-4 font-medium text-center">Durum</th>
                        <th className="px-6 py-4 font-medium text-right">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {cocktails.map((c: any) => (
                        <tr key={c.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 overflow-hidden flex items-center justify-center border border-white/10">
                              {c.imageURL
                                ? <img src={c.imageURL} alt={c.name} className="w-full h-full object-cover" />
                                : <ImageIcon className="w-5 h-5 text-muted-foreground" />}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-serif font-bold text-foreground text-base">{c.name}</td>
                          <td className="px-6 py-4 text-muted-foreground text-xs uppercase">{c.category}</td>
                          <td className="px-6 py-4 text-primary font-medium">{c.price} ₺</td>
                          <td className="px-6 py-4 text-muted-foreground text-xs">{c.alcoholLevel}</td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => toggleAvailability(c.id, c.available)}
                              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-colors ${
                                c.available
                                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
                                  : 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20'
                              }`}
                            >
                              {c.available ? 'Mevcut' : 'Mevcut Değil'}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openEdit(c)}
                                className="p-2 text-muted-foreground hover:text-primary bg-white/5 rounded-lg transition-colors"
                                title="Düzenle"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(c.id, c.name)}
                                disabled={deletingId === c.id}
                                className="p-2 text-muted-foreground hover:text-destructive bg-white/5 rounded-lg transition-colors disabled:opacity-50"
                                title="Sil"
                              >
                                {deletingId === c.id
                                  ? <Loader2 className="w-4 h-4 animate-spin" />
                                  : <Trash2 className="w-4 h-4" />}
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
      </div>

      {/* ── Cocktail Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
              onClick={closeModal}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="glass border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                {/* Modal header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-black/80 backdrop-blur-sm rounded-t-2xl z-10">
                  <h2 className="font-serif text-2xl font-bold text-gradient-gold">
                    {editingId ? 'Kokteyli Düzenle' : 'Yeni Kokteyl Ekle'}
                  </h2>
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={isSaving}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal form */}
                <form onSubmit={handleSave} className="p-6 space-y-5">
                  {/* Row 1: Name + Category */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Kokteyl Adı <span className="text-destructive">*</span></label>
                      <input
                        className={inputCls}
                        placeholder="Örn: Dark Velvet"
                        value={form.name}
                        onChange={(e) => set('name', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Kategori</label>
                      <select
                        className={inputCls}
                        value={form.category}
                        onChange={(e) => set('category', e.target.value)}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Price + Alcohol + Ice */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Fiyat (₺) <span className="text-destructive">*</span></label>
                      <input
                        className={inputCls}
                        type="number"
                        min="0"
                        step="0.5"
                        placeholder="0"
                        value={form.price}
                        onChange={(e) => set('price', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Alkol Seviyesi</label>
                      <select className={inputCls} value={form.alcoholLevel} onChange={(e) => set('alcoholLevel', e.target.value)}>
                        {ALCOHOL_LEVELS.map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Buz Türü</label>
                      <select className={inputCls} value={form.iceType} onChange={(e) => set('iceType', e.target.value)}>
                        {ICE_TYPES.map((i) => <option key={i} value={i}>{i}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Row 3: Glass + Garnish */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Bardak Türü</label>
                      <input
                        className={inputCls}
                        placeholder="Örn: Rocks, Coupe, Highball"
                        value={form.glassType}
                        onChange={(e) => set('glassType', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Garnitür</label>
                      <input
                        className={inputCls}
                        placeholder="Örn: Lime dilimleri, Kiraz"
                        value={form.garnish}
                        onChange={(e) => set('garnish', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Ingredients */}
                  <div>
                    <label className={labelCls}>İçindekiler (her satıra bir malzeme)</label>
                    <textarea
                      className={inputCls + ' resize-none'}
                      rows={4}
                      placeholder={'60 ml Bourbon\n20 ml Taze limon suyu\n15 ml Şeker şurubu'}
                      value={form.ingredients}
                      onChange={(e) => set('ingredients', e.target.value)}
                    />
                  </div>

                  {/* Preparation */}
                  <div>
                    <label className={labelCls}>Hazırlık</label>
                    <textarea
                      className={inputCls + ' resize-none'}
                      rows={3}
                      placeholder="Yapılış adımlarını girin..."
                      value={form.preparation}
                      onChange={(e) => set('preparation', e.target.value)}
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className={labelCls}>Notlar</label>
                    <textarea
                      className={inputCls + ' resize-none'}
                      rows={2}
                      placeholder="Özel notlar, vegan seçeneği, alerjen uyarıları..."
                      value={form.notes}
                      onChange={(e) => set('notes', e.target.value)}
                    />
                  </div>

                  {/* Image upload */}
                  <div>
                    <label className={labelCls}>Kokteyl Görseli</label>
                    <div className="flex items-start gap-4">
                      {form.imageURL ? (
                        <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/10 flex-shrink-0">
                          <img src={form.imageURL} alt="Önizleme" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => set('imageURL', '')}
                            className="absolute top-1 right-1 bg-black/70 rounded-full p-0.5 text-white hover:bg-destructive/80"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-xl border border-dashed border-white/20 flex items-center justify-center flex-shrink-0 bg-white/5">
                          <ImageIcon className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadProgress !== null}
                          className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-foreground hover:bg-white/10 transition-colors disabled:opacity-60"
                        >
                          {uploadProgress !== null ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor %{uploadProgress}</>
                          ) : (
                            <><Upload className="w-4 h-4" /> Görsel Yükle</>
                          )}
                        </button>
                        <p className="text-xs text-muted-foreground mt-2">JPG, PNG veya WEBP · Maks. 8 MB</p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={handleImageUpload}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Availability toggle */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => set('available', !form.available)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${form.available ? 'bg-primary' : 'bg-white/20'}`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.available ? 'translate-x-7' : 'translate-x-1'}`}
                      />
                    </button>
                    <span className="text-sm text-foreground">
                      {form.available ? 'Menüde Mevcut' : 'Menüde Mevcut Değil'}
                    </span>
                  </div>

                  {/* Form actions */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                    <button
                      type="button"
                      onClick={closeModal}
                      disabled={isSaving}
                      className="px-4 py-2 rounded-lg text-muted-foreground hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                      İptal
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving || uploadProgress !== null}
                      className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-60 shadow-[0_0_15px_rgba(201,168,76,0.2)]"
                    >
                      {isSaving ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor...</>
                      ) : (
                        <><Save className="w-4 h-4" /> {editingId ? 'Güncelle' : 'Ekle'}</>
                      )}
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
