import { useAuth } from '@/lib/auth-context';
import { useDocument } from '@/hooks/use-firestore';
import { useState, useEffect, useRef } from 'react';
import { User, Camera, Save, Shield, Calendar, Edit2, Loader2, X } from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { toast } from 'sonner';

export default function Profile() {
  const { user, userData } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { update } = useDocument('users', user?.uid || '');

  useEffect(() => {
    if (userData) {
      setDisplayName((userData.displayName as string) || '');
      setUsername((userData.username as string) || '');
      setBio((userData.bio as string) || '');
    }
  }, [userData]);

  // ── Photo upload ──────────────────────────────────────────────
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Yalnızca JPG, PNG, WEBP veya GIF yükleyebilirsiniz.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Dosya boyutu 5 MB\'ı geçemez.');
      return;
    }

    setUploadProgress(0);
    const storageRef = ref(storage, `profile-photos/${user.uid}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setUploadProgress(pct);
      },
      (err) => {
        console.error('Fotoğraf yükleme hatası:', err);
        toast.error('Fotoğraf yüklenemedi. Lütfen tekrar deneyin.');
        setUploadProgress(null);
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          await update({ photoURL: url });
          toast.success('Profil fotoğrafı güncellendi.');
        } catch (err) {
          console.error('Fotoğraf URL kaydedilemedi:', err);
          toast.error('Fotoğraf kaydedilemedi.');
        } finally {
          setUploadProgress(null);
          // Reset file input so the same file can be re-selected if needed
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
    );
  };

  // ── Profile save ──────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error('Görünen ad boş bırakılamaz.');
      return;
    }
    setIsSaving(true);
    try {
      await update({
        displayName: displayName.trim(),
        username: username.trim(),
        bio: bio.trim(),
      });
      setIsEditing(false);
      toast.success('Profil başarıyla kaydedildi.');
    } catch (err) {
      console.error('Profil güncellenemedi:', err);
      toast.error('Profil kaydedilemedi. Lütfen tekrar deneyin.');
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEdit = () => {
    // Revert to saved values
    setDisplayName((userData?.displayName as string) || '');
    setUsername((userData?.username as string) || '');
    setBio((userData?.bio as string) || '');
    setIsEditing(false);
  };

  const joinDate = (() => {
    const raw = userData?.joinedAt as any;
    const d = raw?.toDate?.();
    return d ? new Date(d).toLocaleDateString('tr-TR') : 'Bilinmiyor';
  })();

  const photoURL = userData?.photoURL as string | undefined;
  const roleName = userData?.role as string | undefined;

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="border-b border-white/10 pb-6">
        <h1 className="font-serif text-3xl font-bold text-gradient-gold">Üye Profili</h1>
      </header>

      <div className="glass rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />

        <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
          {/* Avatar + photo upload */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative group">
              <div className="w-32 h-32 rounded-full bg-black border-2 border-primary/30 flex items-center justify-center overflow-hidden">
                {photoURL ? (
                  <img src={photoURL} alt={userData?.displayName as string} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-12 h-12 text-primary/50" />
                )}
              </div>

              {/* Upload overlay — always shown so user can change photo without entering edit mode */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadProgress !== null}
                className="absolute inset-0 rounded-full bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                title="Fotoğrafı değiştir"
              >
                {uploadProgress !== null ? (
                  <>
                    <Loader2 className="w-7 h-7 text-white animate-spin" />
                    <span className="text-white text-[10px] mt-1">{uploadProgress}%</span>
                  </>
                ) : (
                  <Camera className="w-8 h-8 text-white" />
                )}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>

            <span className="text-xs text-muted-foreground">Fotoğrafın üzerine gelip tıkla</span>

            <div className="flex gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium uppercase tracking-wider">
                <Shield className="w-3.5 h-3.5" />
                {roleName === 'admin' ? 'Yönetici' : roleName === 'staff' ? 'Personel' : (roleName ?? 'Üye')}
              </span>
            </div>
          </div>

          {/* Info / Edit form */}
          <div className="flex-1 w-full">
            {isEditing ? (
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
                  <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Kullanıcı Adı
                  </label>
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

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={isSaving}
                    className="px-4 py-2 rounded-lg text-muted-foreground hover:bg-white/5 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <X className="w-4 h-4" /> İptal
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-[0_0_15px_rgba(201,168,76,0.2)] disabled:opacity-60"
                  >
                    {isSaving ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor...</>
                    ) : (
                      <><Save className="w-4 h-4" /> Değişiklikleri Kaydet</>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-serif font-bold text-foreground mb-1">
                      {(userData?.displayName as string) || 'İsimsiz'}
                    </h2>
                    {userData?.username && (
                      <p className="text-sm text-primary/70 mb-1">@{userData.username as string}</p>
                    )}
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" /> {joinDate} tarihinden beri üye
                    </p>
                  </div>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 text-muted-foreground hover:text-primary bg-white/5 rounded-lg border border-white/10 transition-colors"
                    title="Profili Düzenle"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Hakkında</h3>
                  {userData?.bio ? (
                    <p className="text-foreground leading-relaxed whitespace-pre-wrap">{userData.bio as string}</p>
                  ) : (
                    <p className="text-muted-foreground italic text-sm">
                      Henüz bir biyografi eklenmemiş.{' '}
                      <button onClick={() => setIsEditing(true)} className="text-primary hover:underline">
                        Ekle
                      </button>
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-white/5">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Hesap Bilgileri</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">E-posta</span>
                      <span className="text-foreground">{userData?.email as string}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Kullanıcı Kimliği</span>
                      <span className="text-muted-foreground font-mono text-xs truncate max-w-[180px]">{user?.uid}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
