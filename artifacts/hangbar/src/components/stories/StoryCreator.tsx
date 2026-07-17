import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X, ImageIcon, Video, Type, Upload, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type TabType = 'image' | 'video' | 'text';

const TEXT_BG_PRESETS = [
  { label: 'Siyah',   value: '#0d0d0d' },
  { label: 'Altın',   value: 'linear-gradient(135deg,#1a1200,#4a3200,#C9A84C)' },
  { label: 'Mor',     value: 'linear-gradient(135deg,#1a0030,#4a0080,#8b00ff)' },
  { label: 'Lacivert',value: 'linear-gradient(135deg,#000820,#001a4a,#0044cc)' },
  { label: 'Kırmızı', value: 'linear-gradient(135deg,#1a0000,#4a0000,#cc0000)' },
  { label: 'Yeşil',   value: 'linear-gradient(135deg,#001a00,#004a00,#00aa44)' },
];

interface Props {
  myUserId: string;
  myDisplayName: string;
  myPhoto: string;
  onClose: () => void;
}

export function StoryCreator({ myUserId, myDisplayName, myPhoto, onClose }: Props) {
  const [tab, setTab] = useState<TabType>('image');
  const [textContent, setTextContent] = useState('');
  const [textBg, setTextBg] = useState(TEXT_BG_PRESETS[0].value);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    e.target.value = '';
  };

  const handlePublish = async () => {
    if (tab === 'text' && !textContent.trim()) {
      toast.error('Metin boş olamaz');
      return;
    }
    if ((tab === 'image' || tab === 'video') && !file) {
      toast.error('Lütfen bir dosya seçin');
      return;
    }

    setUploading(true);
    try {
      let mediaUrl: string | null = null;

      if (file && (tab === 'image' || tab === 'video')) {
        const ext = file.name.split('.').pop() ?? (tab === 'video' ? 'mp4' : 'jpg');
        const path = `stories/${myUserId}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('images')
          .upload(path, file, { contentType: file.type });
        if (uploadErr) throw uploadErr;
        const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(path);
        mediaUrl = publicUrl;
      }

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { error: insertErr } = await supabase.from('stories').insert({
        user_id:      myUserId,
        media_url:    mediaUrl,
        media_type:   tab,
        text_content: tab === 'text' ? textContent.trim() : null,
        text_bg:      tab === 'text' ? textBg : null,
        expires_at:   expiresAt,
      });
      if (insertErr) throw insertErr;

      toast.success('Hikaye paylaşıldı!');
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Hikaye yüklenemedi');
    } finally {
      setUploading(false);
    }
  };

  const TAB_BUTTONS: { id: TabType; icon: React.ElementType; label: string }[] = [
    { id: 'image', icon: ImageIcon, label: 'Görsel' },
    { id: 'video', icon: Video,     label: 'Video'  },
    { id: 'text',  icon: Type,      label: 'Metin'  },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-sm glass rounded-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '90dvh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="font-serif text-lg font-bold text-foreground">Hikaye Ekle</h2>
          <button type="button" onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-3 border-b border-white/10">
          {TAB_BUTTONS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => { setTab(id); setPreview(null); setFile(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                tab === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {(tab === 'image' || tab === 'video') && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={tab === 'image' ? 'image/*' : 'video/*'}
                className="hidden"
                onChange={handleFileChange}
              />
              {/* Preview */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-[9/16] rounded-xl bg-black/50 border-2 border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors overflow-hidden relative"
              >
                {preview ? (
                  tab === 'image' ? (
                    <img src={preview} alt="Önizleme" className="absolute inset-0 w-full h-full object-cover rounded-xl" />
                  ) : (
                    <video src={preview} className="absolute inset-0 w-full h-full object-cover rounded-xl" muted />
                  )
                ) : (
                  <div className="text-center text-muted-foreground p-6">
                    <Upload className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Yüklemek için tıklayın</p>
                    <p className="text-xs mt-1 opacity-60">
                      {tab === 'image' ? 'JPG, PNG, WEBP' : 'MP4, MOV, WEBM'}
                    </p>
                  </div>
                )}
              </div>
              {preview && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2 text-sm text-muted-foreground hover:text-foreground border border-white/10 rounded-xl transition-colors"
                >
                  Değiştir
                </button>
              )}
            </>
          )}

          {tab === 'text' && (
            <>
              {/* Live preview */}
              <div
                className="w-full aspect-[9/16] rounded-xl flex items-center justify-center p-6 relative overflow-hidden"
                style={{ background: textBg }}
              >
                <p
                  className="text-white text-xl font-semibold text-center leading-relaxed break-words max-w-full"
                  style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
                >
                  {textContent || 'Metin buraya gelecek...'}
                </p>
              </div>
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Hikaye metninizi yazın..."
                maxLength={200}
                rows={3}
                className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none"
              />
              {/* Background presets */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Arka Plan</p>
                <div className="flex gap-2 flex-wrap">
                  {TEXT_BG_PRESETS.map((bg) => (
                    <button
                      key={bg.value}
                      type="button"
                      onClick={() => setTextBg(bg.value)}
                      title={bg.label}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${
                        textBg === bg.value ? 'border-primary scale-110' : 'border-transparent scale-100'
                      }`}
                      style={{ background: bg.value }}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Publish button */}
        <div className="p-4 border-t border-white/10">
          <button
            type="button"
            onClick={handlePublish}
            disabled={uploading || (tab === 'text' ? !textContent.trim() : !file)}
            className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl disabled:opacity-40 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Paylaşılıyor...</>
            ) : (
              'Hikayeyi Paylaş'
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
