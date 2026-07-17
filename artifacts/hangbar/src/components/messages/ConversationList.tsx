import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, MessageSquarePlus, User } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { tr } from 'date-fns/locale';
import type { DMessage } from './MessageBubble';

export interface DProfile {
  id: string;
  display_name: string;
  photo_url: string;
  role: string;
}

interface Conversation {
  partner: DProfile;
  lastMessage: DMessage;
  unreadCount: number;
}

interface Props {
  myUserId: string;
  selectedUserId?: string;
  onSelectUser: (profile: DProfile) => void;
  onlineUsers: Set<string>;
  className?: string;
}

function fmtMsgTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isToday(d)) return format(d, 'HH:mm', { locale: tr });
    if (isYesterday(d)) return 'Dün';
    return format(d, 'dd.MM.yy', { locale: tr });
  } catch {
    return '';
  }
}

function Avatar({
  photoUrl,
  displayName,
  isOnline,
  size = 40,
}: {
  photoUrl: string;
  displayName: string;
  isOnline: boolean;
  size?: number;
}) {
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <div
        className="w-full h-full rounded-full bg-black/50 border border-white/10 overflow-hidden flex items-center justify-center"
      >
        {photoUrl ? (
          <img src={photoUrl} alt={displayName} className="w-full h-full object-cover" />
        ) : (
          <User className="w-5 h-5 text-muted-foreground" />
        )}
      </div>
      {/* Online indicator */}
      <span
        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${
          isOnline ? 'bg-green-500' : 'bg-gray-600'
        }`}
      />
    </div>
  );
}

function ConvItem({
  profile,
  isSelected,
  isOnline,
  onClick,
  lastMessage,
  preview,
  unreadCount,
}: {
  profile: DProfile;
  isSelected: boolean;
  isOnline: boolean;
  onClick: () => void;
  lastMessage: DMessage | null;
  preview?: string;
  unreadCount: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors border-b border-white/5 last:border-0 text-left ${
        isSelected ? 'bg-primary/10' : 'hover:bg-white/5'
      }`}
    >
      <Avatar
        photoUrl={profile.photo_url}
        displayName={profile.display_name}
        isOnline={isOnline}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span
            className={`text-sm truncate ${
              unreadCount > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'
            }`}
          >
            {profile.display_name || 'Anonim'}
          </span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {lastMessage && (
              <span className="text-[10px] text-muted-foreground">
                {fmtMsgTime(lastMessage.created_at)}
              </span>
            )}
            {unreadCount > 0 && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </div>
        {preview !== undefined && (
          <p
            className={`text-xs truncate mt-0.5 ${
              unreadCount > 0 ? 'text-foreground/70 font-medium' : 'text-muted-foreground'
            }`}
          >
            {preview}
          </p>
        )}
      </div>
    </button>
  );
}

export function ConversationList({
  myUserId,
  selectedUserId,
  onSelectUser,
  onlineUsers,
  className,
}: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [allProfiles, setAllProfiles] = useState<DProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const buildConversations = useCallback(
    (messages: DMessage[], profiles: DProfile[]): Conversation[] => {
      const profileMap = new Map(profiles.map((p) => [p.id, p]));
      const convMap = new Map<string, { lastMsg: DMessage; unread: number }>();

      for (const msg of messages) {
        const partnerId = msg.sender_id === myUserId ? msg.receiver_id : msg.sender_id;
        if (partnerId === myUserId) continue;
        if (!convMap.has(partnerId)) {
          convMap.set(partnerId, { lastMsg: msg, unread: 0 });
        }
        // Count messages sent to me that are not yet seen
        if (msg.receiver_id === myUserId && msg.status !== 'seen') {
          convMap.get(partnerId)!.unread++;
        }
      }

      return Array.from(convMap.entries())
        .map(([id, { lastMsg, unread }]) => ({
          partner: profileMap.get(id) ?? {
            id,
            display_name: 'Bilinmeyen',
            photo_url: '',
            role: 'staff',
          },
          lastMessage: lastMsg,
          unreadCount: unread,
        }))
        .sort(
          (a, b) =>
            new Date(b.lastMessage.created_at).getTime() -
            new Date(a.lastMessage.created_at).getTime(),
        );
    },
    [myUserId],
  );

  const fetchData = useCallback(async () => {
    const [{ data: messages }, { data: profiles }] = await Promise.all([
      supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${myUserId},receiver_id.eq.${myUserId}`)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('profiles')
        .select('id, display_name, photo_url, role')
        .neq('id', myUserId),
    ]);
    const profileList = (profiles ?? []) as DProfile[];
    setAllProfiles(profileList);
    setConversations(buildConversations((messages ?? []) as DMessage[], profileList));
    setLoading(false);
  }, [myUserId, buildConversations]);

  useEffect(() => {
    if (!myUserId) return;
    fetchData();

    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = supabase
      .channel(`conv-list:${myUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, fetchData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, fetchData)
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [myUserId, fetchData]);

  const lastMsgPreview = (msg: DMessage, myId: string): string => {
    const prefix = msg.sender_id === myId ? 'Sen: ' : '';
    if (msg.media_type === 'image') return `${prefix}📷 Görsel`;
    if (msg.media_type === 'voice') return `${prefix}🎤 Sesli mesaj`;
    return `${prefix}${msg.text ?? ''}`;
  };

  // Search mode: filter all profiles
  const conversationPartnerIds = new Set(conversations.map((c) => c.partner.id));
  const searchResults = searchQuery.trim()
    ? allProfiles.filter(
        (p) =>
          p.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.role?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : null;

  return (
    <div className={`w-full md:w-80 flex flex-col glass rounded-2xl overflow-hidden ${className ?? ''}`}>
      {/* Header */}
      <div className="p-4 border-b border-white/10 bg-black/20 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-xl font-bold text-foreground">Mesajlar</h2>
          <button
            type="button"
            title="Yeni mesaj"
            className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded-lg hover:bg-white/5"
          >
            <MessageSquarePlus className="w-5 h-5" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Üye ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Yükleniyor...</div>
        ) : searchResults !== null ? (
          // ── Search results ─────────────────────────────────────────────────
          searchResults.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Sonuç bulunamadı</div>
          ) : (
            searchResults.map((profile) => (
              <ConvItem
                key={profile.id}
                profile={profile}
                isSelected={selectedUserId === profile.id}
                isOnline={onlineUsers.has(profile.id)}
                onClick={() => {
                  setSearchQuery('');
                  onSelectUser(profile);
                }}
                lastMessage={null}
                unreadCount={0}
              />
            ))
          )
        ) : conversations.length === 0 ? (
          // ── Empty state ────────────────────────────────────────────────────
          <div className="p-8 text-center text-muted-foreground">
            <MessageSquarePlus className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Henüz mesaj yok</p>
            <p className="text-xs mt-1 opacity-60">Üye aramak için yukarıdaki alanı kullanın</p>
          </div>
        ) : (
          // ── Recent conversations ───────────────────────────────────────────
          conversations.map((conv) => (
            <ConvItem
              key={conv.partner.id}
              profile={conv.partner}
              isSelected={selectedUserId === conv.partner.id}
              isOnline={onlineUsers.has(conv.partner.id)}
              onClick={() => onSelectUser(conv.partner)}
              lastMessage={conv.lastMessage}
              preview={lastMsgPreview(conv.lastMessage, myUserId)}
              unreadCount={conv.unreadCount}
            />
          ))
        )}
      </div>
    </div>
  );
}
