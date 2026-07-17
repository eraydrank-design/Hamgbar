import { useState } from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { VoiceMessage } from './VoiceMessage';

const REACTION_EMOJIS = ['❤️', '😂', '👍', '😮', '😢'] as const;

export interface DMessage {
  id: string;
  text: string | null;
  sender_id: string;
  receiver_id: string;
  status: 'sent' | 'delivered' | 'seen';
  read: boolean;
  media_url: string | null;
  media_type: 'image' | 'voice' | null;
  voice_duration: number;
  reactions: Array<{ emoji: string; userId: string }>;
  created_at: string;
}

interface Props {
  message: DMessage;
  isMine: boolean;
  myUserId: string;
  onReact: (messageId: string, emoji: string) => void;
}

function StatusIcon({ status }: { status: DMessage['status'] }) {
  if (status === 'seen') {
    return <CheckCheck className="w-3 h-3 text-primary" />;
  }
  if (status === 'delivered') {
    return <CheckCheck className="w-3 h-3 text-primary-foreground/50" />;
  }
  return <Check className="w-3 h-3 text-primary-foreground/50" />;
}

function fmtTime(d: string) {
  try { return format(new Date(d), 'HH:mm', { locale: tr }); }
  catch { return ''; }
}

export function MessageBubble({ message, isMine, myUserId, onReact }: Props) {
  const [showPicker, setShowPicker] = useState(false);

  // Group reactions by emoji
  const grouped = (message.reactions ?? []).reduce<Record<string, { count: number; mine: boolean }>>(
    (acc, r) => {
      if (!acc[r.emoji]) acc[r.emoji] = { count: 0, mine: false };
      acc[r.emoji].count++;
      if (r.userId === myUserId) acc[r.emoji].mine = true;
      return acc;
    },
    {},
  );

  const hasReactions = Object.keys(grouped).length > 0;

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} group mb-1`}>
      <div className={`max-w-[78%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>

        {/* Row: reaction trigger + bubble */}
        <div className={`flex items-end gap-1.5 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>

          {/* Reaction trigger button */}
          <button
            type="button"
            onClick={() => setShowPicker((p) => !p)}
            title="Tepki ekle"
            className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity text-base leading-none mb-1 flex-shrink-0 relative"
          >
            😊
            {showPicker && (
              <div
                className={`absolute bottom-full mb-1 ${isMine ? 'right-0' : 'left-0'} flex gap-1 bg-background/95 border border-white/15 rounded-full px-2 py-1.5 shadow-2xl z-20 whitespace-nowrap`}
                onClick={(e) => e.stopPropagation()}
              >
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => { onReact(message.id, emoji); setShowPicker(false); }}
                    className="text-xl hover:scale-125 transition-transform leading-none"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </button>

          {/* Bubble */}
          <div
            className={`relative rounded-2xl px-3 py-2 ${
              isMine
                ? 'bg-primary text-primary-foreground rounded-br-sm shadow-[0_0_18px_rgba(201,168,76,0.12)]'
                : 'bg-white/10 text-foreground rounded-bl-sm border border-white/5'
            }`}
          >
            {/* Text */}
            {message.text && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
            )}

            {/* Image */}
            {message.media_type === 'image' && message.media_url && (
              <a
                href={message.media_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-1"
              >
                <img
                  src={message.media_url}
                  alt="Görsel"
                  className="rounded-xl max-w-full max-h-60 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ minWidth: 100 }}
                  loading="lazy"
                />
              </a>
            )}

            {/* Voice */}
            {message.media_type === 'voice' && message.media_url && (
              <VoiceMessage
                url={message.media_url}
                duration={message.voice_duration}
                isMine={isMine}
              />
            )}

            {/* Time + status */}
            <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
              <span className={`text-[10px] ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                {fmtTime(message.created_at)}
              </span>
              {isMine && <StatusIcon status={message.status} />}
            </div>
          </div>
        </div>

        {/* Reactions row */}
        {hasReactions && (
          <div className={`flex gap-1 mt-0.5 flex-wrap ${isMine ? 'justify-end mr-8' : 'justify-start ml-8'}`}>
            {Object.entries(grouped).map(([emoji, { count, mine }]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(message.id, emoji)}
                className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
                  mine
                    ? 'bg-primary/20 border-primary/50 text-primary'
                    : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10'
                }`}
              >
                <span>{emoji}</span>
                {count > 1 && <span className="text-[10px] ml-0.5">{count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
