import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { usePresence } from '@/hooks/use-presence';
import { ConversationList, type DProfile } from '@/components/messages/ConversationList';
import { ChatWindow } from '@/components/messages/ChatWindow';
import { MessageSquare } from 'lucide-react';

export default function Messages() {
  const { user } = useAuth();
  const [selectedUser, setSelectedUser] = useState<DProfile | null>(null);
  const { onlineUsers, lastSeen } = usePresence(user?.id);

  // Mark all incoming 'sent' messages as 'delivered' when the Messages page is open.
  // This signals to senders that their message reached the recipient's device.
  useEffect(() => {
    if (!user) return;
    supabase
      .from('messages')
      .update({ status: 'delivered' })
      .eq('receiver_id', user.id)
      .eq('status', 'sent')
      .then(() => {});
  }, [user?.id]);

  return (
    <div className="h-[calc(100dvh-2rem)] md:h-[calc(100dvh-6rem)] animate-in fade-in duration-500 flex flex-col md:flex-row gap-4">
      {/* ── Conversation list (left panel) ─────────────────────────────── */}
      <ConversationList
        myUserId={user?.id ?? ''}
        selectedUserId={selectedUser?.id}
        onSelectUser={setSelectedUser}
        onlineUsers={onlineUsers}
        className={selectedUser ? 'hidden md:flex' : 'flex'}
      />

      {/* ── Chat window (right panel) ───────────────────────────────────── */}
      {selectedUser ? (
        <ChatWindow
          partner={selectedUser}
          isOnline={onlineUsers.has(selectedUser.id)}
          lastSeenAt={lastSeen[selectedUser.id]}
          onBack={() => setSelectedUser(null)}
        />
      ) : (
        <div className="hidden md:flex flex-1 glass rounded-2xl items-center justify-center">
          <div className="text-center p-8 text-muted-foreground">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6 mx-auto">
              <MessageSquare className="w-10 h-10 opacity-20" />
            </div>
            <h3 className="text-xl font-serif text-foreground mb-2">Üye Mesajları</h3>
            <p className="max-w-xs text-sm opacity-70">
              Özel konuşma başlatmak için listeden bir üye seçin.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
