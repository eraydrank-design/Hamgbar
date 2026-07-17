import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X, ImageIcon, Video, Type, Upload, Loader2, Type as TypeIcon, Palette } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { StoryTextOverlay } from '@/hooks/use-stories';

type TabType = 'image' | 'video' | 'text';

const TEXT_BG_PRESETS = [
  { label: 'Siyah',    value: '#0d0d0d' },
  { label: 'Altın',    value: 'linear-gradient(135deg,#1a1200,#4a3200,#C9A84C)' },
  { label: 'Mor',      value: 'linear-gradient(135deg,#1a0030,#4a0080,#8b00ff)' },
  { label: 'Lacivert', value: 'linear-gradient(135deg,#000820,#001a4a,#0044cc)' },
  { label: 'Kırmızı',  value: 'linear-gradient(135deg,#1a0000,#4a0000,#cc0000)' },
  { label: 'Yeşil',    value: 'linear-gradient(135deg,#001a00,#004a00,#00aa44)' },
];

const OVERLAY_COLORS = [
  { label: 'Beyaz',   value: '#FFFFFF' },
  { label: 'Siyah',   value: '#000000' },
  { label: 'Altın',   value: '#C9A84C' },
  { label: 'Pembe',   value: '#FF69B4' },
  { label: 'Kırmızı', value: '#FF4444' },
];

const OVERLAY_SIZES: Array<{ label: string; value: StoryTextOverlay['size'] }> = [
  { label: 'S', value: 'sm' },
  { label: 'M', value: 'md' },
  { label: 'L', value: 'lg' },
];

const OVERLAY_POSITIONS: Array<{ label: string; value: StoryTextOverlay['position'] }> = [
  { label: 'Üst',    value: 'top'    },
  { label: 'Orta',   value: 'center' },
  { label: 'Alt',    value: 'bottom' },
];

const DEFAULT_OVERLAY: StoryTextOverlay = {
  text:     '',
  color:    '#FFFFFF',
  size:     'md',
  position: 'center',
};

interface Props {
  myUserId:      string;
  myDisplayName: string;
  myPhoto:       string;
  onClose:       () => void;
}

function overlayPositionStyle(position: StoryTextOverlay['position']): React.CSSProperties {
  if (position === 'top')    return { top: '20%' };
  if (position === 'bottom') return { bottom: '20%' };
  return { top: '50%', transform: 'translateY(-50%)' };
}

export function StoryCreator({ myUserId, onClose }: Props) {
  const [tab,       setTab]      = useState<TabType>('image');
  const [textContent, setTextContent] = useState('');
  const [textBg,    setTextBg]   = useState(TEXT_BG_PRESETS[0].value);
  const [preview,   setPreview]  = useState<string | null>(null);
  const [file,      setFile]     = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Text overlay state (for image tab)
  const [showOverlayEditor, setShowOverlayEditor] = useState(false);
  const [overlay, setOverlay] = useState<StoryTextOverlay>(DEFAULT_OVERLAY);

  const resetTab = (newTab: TabType) => {
    setTab(newTab);
    setPreview(null);
    setFile(null);
    setShowOverlayEditor(false);
    setOverlay(DEFAULT_OVERLAY);
    setTextContent('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    e.target.value = '';
  };

  const handlePublish = async () => {
    if (tab === 'text' && !textContent.trim())         { toast.error('Metin boş olamaz'); return; }
    if ((tab === 'image' || tab === 'video') && !file) { toast.error('Lütfen bir dosya seçin'); return; }
    setUploading(true);
    try {
      let mediaUrl: string | null = null;
      if (file && (tab === 'image' || tab === 'video')) {
        const ext  = file.name.split('.').pop() ?? (tab === 'video' ? 'mp4' : 'jpg');
        const path = `stories/${myUserId}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('images').upload(path, file, { contentType: file.type });
        if (uploadErr) throw uploadErr;
        const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(path);
        mediaUrl = publicUrl;
      }

      const hasOverlay = tab === 'image' && overlay.text.trim() && showOverlayEditor;

      const { error: insertErr } = await supabase.from('stories').insert({
        user_id:      myUserId,
        media_url:    mediaUrl,
        media_type:   tab,
        text_content: tab === 'text' ? textContent.trim() : null,
        text_bg:      tab === 'text' ? textBg : null,
        text_overlay: hasOverlay ? { ...overlay, text: overlay.text.trim() } : null,
        expires_at:   new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
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

  const sizeFontClass = overlay.size === 'sm' ? 'text-base' : overlay.size === 'lg' ? 'text-3xl' : 'text-xl';

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
        style={{ maxHeight: '92dvh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
          <h2 className="font-serif text-lg font-bold text-foreground">Hikaye Ekle</h2>
          <button type="button" onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-3 border-b border-white/10 flex-shrink-0">
          {TAB_BUTTONS.map(({ id, icon: Icon, label }) => (
            <button
              key={id} type="button"
              onClick={() => resetTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                tab === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* ── Image tab ─────────────────────────────────────────────── */}
          {tab === 'image' && (
            <>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              <div
                onClick={() => !preview && fileInputRef.current?.click()}
                className={`relative w-full rounded-xl overflow-hidden ${preview ? '' : 'border-2 border-dashed border-white/20 cursor-pointer hover:border-primary/50 transition-colors'}`}
                style={{ aspectRatio: '9/16' }}
              >
                {preview ? (
                  <>
                    <img src={preview} alt="Önizleme" className="w-full h-full object-cover" />
                    {/* Text overlay live preview */}
                    {showOverlayEditor && overlay.text && (
                      <div
                        className={`absolute left-3 right-3 z-10 text-center font-bold ${sizeFontClass} pointer-events-none`}
                        style={{ color: overlay.color, textShadow: '0 2px 10px rgba(0,0,0,0.9)', ...overlayPositionStyle(overlay.position) }}
                      >
                        {overlay.text}
                      </div>
                    )}
                    {/* Change image button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full hover:bg-black/80 z-20"
                    >
                      Değiştir
                    </button>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                    <Upload className="w-10 h-10 mb-3 opacity-40" />
                    <p className="text-sm">Yüklemek için tıklayın</p>
                    <p className="text-xs mt-1 opacity-60">JPG, PNG, WEBP</p>
                  </div>
                )}
              </div>

              {/* Text overlay button */}
              {preview && (
                <button
                  type="button"
                  onClick={() => setShowOverlayEditor((o) => !o)}
                  className={`w-full py-2.5 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                    showOverlayEditor ? 'bg-primary/10 border-primary/40 text-primary' : 'border-white/15 text-muted-foreground hover:text-foreground hover:bg-white/5'
                  }`}
                >
                  <TypeIcon className="w-4 h-4" /> Metin Ekle
                </button>
              )}

              {/* Overlay editor */}
              {showOverlayEditor && preview && (
                <div className="space-y-3 bg-white/5 rounded-xl p-3 border border-white/10">
                  <textarea
                    value={overlay.text}
                    onChange={(e) => setOverlay((o) => ({ ...o, text: e.target.value }))}
                    placeholder="Hikayeye metin ekle..."
                    rows={2}
                    maxLength={120}
                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none"
                  />
                  {/* Color */}
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1.5 uppercase tracking-wider">Renk</p>
                    <div className="flex gap-2">
                      {OVERLAY_COLORS.map((c) => (
                        <button
                          key={c.value} type="button" title={c.label}
                          onClick={() => setOverlay((o) => ({ ...o, color: c.value }))}
                          className={`w-7 h-7 rounded-full border-2 transition-transform ${overlay.color === c.value ? 'border-primary scale-110' : 'border-white/20 scale-100'}`}
                          style={{ background: c.value === '#FFFFFF' ? '#fff' : c.value === '#000000' ? '#111' : c.value }}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Size */}
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1.5 uppercase tracking-wider">Boyut</p>
                    <div className="flex gap-2">
                      {OVERLAY_SIZES.map((s) => (
                        <button
                          key={s.value} type="button"
                          onClick={() => setOverlay((o) => ({ ...o, size: s.value }))}
                          className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${overlay.size === s.value ? 'bg-primary text-primary-foreground' : 'bg-white/5 text-muted-foreground hover:bg-white/10'}`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Position */}
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1.5 uppercase tracking-wider">Konum</p>
                    <div className="flex gap-2">
                      {OVERLAY_POSITIONS.map((p) => (
                        <button
                          key={p.value} type="button"
                          onClick={() => setOverlay((o) => ({ ...o, position: p.value }))}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${overlay.position === p.value ? 'bg-primary text-primary-foreground' : 'bg-white/5 text-muted-foreground hover:bg-white/10'}`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Video tab ─────────────────────────────────────────────── */}
          {tab === 'video' && (
            <>
              <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative w-full rounded-xl border-2 border-dashed border-white/20 cursor-pointer hover:border-primary/50 transition-colors overflow-hidden"
                style={{ aspectRatio: '9/16' }}
              >
                {preview ? (
                  <video src={preview} className="w-full h-full object-cover" muted />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                    <Upload className="w-10 h-10 mb-3 opacity-40" />
                    <p className="text-sm">Video seçin</p>
                    <p className="text-xs mt-1 opacity-60">MP4, MOV, WEBM</p>
                  </div>
                )}
              </div>
              {preview && (
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2 text-sm text-muted-foreground hover:text-foreground border border-white/10 rounded-xl transition-colors">
                  Değiştir
                </button>
              )}
            </>
          )}

          {/* ── Text tab ──────────────────────────────────────────────── */}
          {tab === 'text' && (
            <>
              <div
                className="w-full rounded-xl flex items-center justify-center p-6 relative overflow-hidden"
                style={{ aspectRatio: '9/16', background: textBg }}
              >
                <p className="text-white text-xl font-semibold text-center leading-relaxed break-words max-w-full"
                   style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
                  {textContent || 'Metin buraya gelecek...'}
                </p>
              </div>
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Hikaye metninizi yazın..."
                maxLength={200} rows={3}
                className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none"
              />
              <div>
                <p className="text-xs text-muted-foreground mb-2">Arka Plan</p>
                <div className="flex gap-2 flex-wrap">
                  {TEXT_BG_PRESETS.map((bg) => (
                    <button key={bg.value} type="button" title={bg.label}
                      onClick={() => setTextBg(bg.value)}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${textBg === bg.value ? 'border-primary scale-110' : 'border-transparent scale-100'}`}
                      style={{ background: bg.value }}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Publish button */}
        <div className="p-4 border-t border-white/10 flex-shrink-0">
          <button
            type="button" onClick={handlePublish}
            disabled={uploading || (tab === 'text' ? !textContent.trim() : !file)}
            className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl disabled:opacity-40 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            {uploading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Paylaşılıyor...</>
              : 'Hikayeyi Paylaş'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
