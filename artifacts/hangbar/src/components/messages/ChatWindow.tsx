import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { createNotification } from '@/lib/notify';
import { toast } from 'sonner';
import { Send, ImageIcon, Mic, MicOff, ArrowLeft, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { MessageBubble, type DMessage } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import type { DProfile } from './ConversationList';

interface Props {
  partner: DProfile;
  isOnline: boolean;
  /** ISO timestamp of when partner went offline this session */
  lastSeenAt?: string;
  onBack: () => void;
  className?: string;
}

const TYPING_TIMEOUT_MS = 3000;

export function ChatWindow({ partner, isOnline, lastSeenAt, onBack, className }: Props) {
  const { user, userData } = useAuth();
  const [messages, setMessages] = useState<DMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSecs, setRecordingSecs] = useState(0);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const msgChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const typingChannelKey = [user?.id, partner.id].sort().join('-');

  const onlineLabel = isOnline
    ? 'Çevrimiçi'
    : lastSeenAt
    ? `Son görülme: ${formatDistanceToNow(new Date(lastSeenAt), { addSuffix: true, locale: tr })}`
    : 'Çevrimdışı';

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
  }, []);

  // ── Mark all incoming messages from partner as seen ──────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase
      .from('messages')
      .update({ status: 'seen', read: true })
      .eq('receiver_id', user.id)
      .eq('sender_id', partner.id)
      .in('status', ['sent', 'delivered'])
      .then(() => {});
  }, [user?.id, partner.id]);

  // ── Fetch messages + realtime subscription ───────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${partner.id}),and(sender_id.eq.${partner.id},receiver_id.eq.${user.id})`,
        )
        .order('created_at', { ascending: true });
      if (!error) {
        setMessages((data ?? []) as DMessage[]);
        scrollToBottom();
      }
    };

    fetchMessages();

    if (msgChannelRef.current) supabase.removeChannel(msgChannelRef.current);
    msgChannelRef.current = supabase
      .channel(`chat:${[user.id, partner.id].sort().join('-')}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as DMessage;
        const relevant =
          (msg.sender_id === user.id && msg.receiver_id === partner.id) ||
          (msg.sender_id === partner.id && msg.receiver_id === user.id);
        if (!relevant) return;
        setMessages((prev) => [...prev, msg]);
        scrollToBottom();
        // Auto-mark as seen if it's incoming
        if (msg.receiver_id === user.id) {
          supabase
            .from('messages')
            .update({ status: 'seen', read: true })
            .eq('id', msg.id)
            .then(() => {});
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const updated = payload.new as DMessage;
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      })
      .subscribe();

    return () => {
      if (msgChannelRef.current) {
        supabase.removeChannel(msgChannelRef.current);
        msgChannelRef.current = null;
      }
    };
  }, [user?.id, partner.id, scrollToBottom]);

  // ── Typing indicator channel ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    if (typingChannelRef.current) supabase.removeChannel(typingChannelRef.current);
    typingChannelRef.current = supabase
      .channel(`typing:${typingChannelKey}`)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.userId === user.id) return; // own typing event
        setIsPartnerTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(
          () => setIsPartnerTyping(false),
          TYPING_TIMEOUT_MS,
        );
      })
      .subscribe();

    return () => {
      if (typingChannelRef.current) {
        supabase.removeChannel(typingChannelRef.current);
        typingChannelRef.current = null;
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [user?.id, typingChannelKey]);

  // Cleanup recording timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    };
  }, []);

  // ── Broadcast typing to partner ──────────────────────────────────────────────
  const broadcastTyping = useCallback(() => {
    typingChannelRef.current
      ?.send({ type: 'broadcast', event: 'typing', payload: { userId: user?.id } })
      .catch(() => {});
  }, [user?.id]);

  // ── Send text message ────────────────────────────────────────────────────────
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !user) return;
    const text = messageText;
    setMessageText('');

    const { error } = await supabase.from('messages').insert({
      text,
      sender_id: user.id,
      receiver_id: partner.id,
      status: 'sent',
      read: false,
    });

    if (error) {
      toast.error(`Mesaj gönderilemedi: ${error.message}`);
      setMessageText(text);
      return;
    }

    createNotification({
      userId: partner.id,
      senderId: user.id,
      type: 'message',
      message: `${userData?.display_name ?? 'Bir üye'} size mesaj gönderdi`,
    }).catch(() => {});
  };

  // ── Send image ───────────────────────────────────────────────────────────────
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = '';

    setUploadingMedia(true);
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `messages/${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from('images').upload(path, file);
    setUploadingMedia(false);
    if (uploadError) { toast.error('Görsel yüklenemedi'); return; }

    const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(path);
    const { error } = await supabase.from('messages').insert({
      text: null,
      sender_id: user.id,
      receiver_id: partner.id,
      status: 'sent',
      read: false,
      media_url: publicUrl,
      media_type: 'image',
    });
    if (error) toast.error('Görsel mesajı gönderilemedi');
  };

  // ── Voice recording ──────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (!user) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      toast.error('Tarayıcınız ses kaydını desteklemiyor');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const duration = Math.max(1, Math.floor((Date.now() - recordingStartRef.current) / 1000));
        const blob = new Blob(chunks, { type: mimeType });
        const ext = mimeType.includes('webm') ? 'webm' : 'ogg';
        const path = `messages/voice/${user!.id}/${Date.now()}.${ext}`;

        setUploadingMedia(true);
        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(path, blob, { contentType: mimeType });
        setUploadingMedia(false);
        if (uploadError) { toast.error('Ses mesajı yüklenemedi'); return; }

        const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(path);
        const { error } = await supabase.from('messages').insert({
          text: null,
          sender_id: user!.id,
          receiver_id: partner.id,
          status: 'sent',
          read: false,
          media_url: publicUrl,
          media_type: 'voice',
          voice_duration: duration,
        });
        if (error) toast.error('Ses mesajı gönderilemedi');
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      recordingStartRef.current = Date.now();
      setIsRecording(true);
      setRecordingSecs(0);
      recordingTimerRef.current = setInterval(() => setRecordingSecs((s) => s + 1), 1000);
    } catch {
      toast.error('Mikrofon erişimi reddedildi');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setRecordingSecs(0);
  };

  // ── Reactions ────────────────────────────────────────────────────────────────
  const handleReact = async (messageId: string, emoji: string) => {
    if (!user) return;
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;

    const reactions = msg.reactions ?? [];
    const idx = reactions.findIndex((r) => r.emoji === emoji && r.userId === user.id);
    const newReactions =
      idx >= 0
        ? reactions.filter((_, i) => i !== idx)
        : [...reactions, { emoji, userId: user.id }];

    await supabase.from('messages').update({ reactions: newReactions }).eq('id', messageId);
  };

  const fmtSecs = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className={`flex-1 flex flex-col glass rounded-2xl overflow-hidden min-w-0 ${className ?? ''}`}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="p-3 md:p-4 border-b border-white/10 bg-black/20 flex items-center gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="md:hidden p-1.5 -ml-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <UserAvatar
          userId={partner.id}
          photoUrl={partner.photo_url}
          displayName={partner.display_name}
          size="md"
        />

        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground truncate">{partner.display_name}</h3>
          <p className={`text-xs flex items-center gap-1.5 ${isOnline ? 'text-green-400' : 'text-muted-foreground'}`}>
            {isOnline && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0 animate-pulse" />
            )}
            {onlineLabel}
          </p>
        </div>
      </div>

      {/* ── Messages ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 opacity-30" />
            </div>
            <p className="text-sm">{partner.display_name} ile konuşmayı başlatın</p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isMine={msg.sender_id === user?.id}
              myUserId={user?.id ?? ''}
              onReact={handleReact}
            />
          ))
        )}
        {isPartnerTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input bar ───────────────────────────────────────────────────────── */}
      <div className="p-3 border-t border-white/10 bg-black/20 flex-shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />

        {isRecording ? (
          /* Recording state */
          <div className="flex items-center gap-3 bg-black/50 border border-red-500/50 rounded-2xl px-4 py-2.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            <span className="text-sm text-foreground flex-1">
              Kaydediliyor... {fmtSecs(recordingSecs)}
            </span>
            <button
              type="button"
              onClick={stopRecording}
              className="p-1.5 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-colors flex-shrink-0"
              title="Gönder"
            >
              <MicOff className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Normal input state */
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingMedia}
              className="p-2 text-muted-foreground hover:text-primary transition-colors flex-shrink-0 disabled:opacity-50"
              title="Görsel gönder"
            >
              <ImageIcon className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={startRecording}
              disabled={uploadingMedia}
              className="p-2 text-muted-foreground hover:text-primary transition-colors flex-shrink-0 disabled:opacity-50"
              title="Sesli mesaj"
            >
              <Mic className="w-5 h-5" />
            </button>

            <input
              type="text"
              value={messageText}
              onChange={(e) => { setMessageText(e.target.value); broadcastTyping(); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) handleSend(e as unknown as React.FormEvent);
              }}
              placeholder="Bir mesaj yazın..."
              className="flex-1 min-w-0 bg-black/50 border border-white/10 rounded-2xl py-2.5 px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
            />

            <button
              type="submit"
              disabled={!messageText.trim() || uploadingMedia}
              className="p-2.5 bg-primary text-primary-foreground rounded-full disabled:opacity-30 hover:bg-primary/90 transition-all flex-shrink-0"
              title="Gönder"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}

        {uploadingMedia && (
          <p className="text-[11px] text-muted-foreground text-center mt-1.5 animate-pulse">
            Yükleniyor...
          </p>
        )}
      </div>
    </div>
  );
}
