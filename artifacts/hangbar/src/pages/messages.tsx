import { useAuth } from '@/lib/auth-context';
import { useCollection } from '@/hooks/use-firestore';
import { useState, useRef, useEffect } from 'react';
import { orderBy, addDoc, collection, serverTimestamp, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Send, User, Search, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function Messages() {
  const { userData, user } = useAuth();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: users, loading: usersLoading } = useCollection('users');
  
  const [messages, setMessages] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !selectedUser) return;

    const q = query(
      collection(db, 'messages'),
      orderBy('createdAt', 'asc')
    );
    
    import('firebase/firestore').then(({ onSnapshot }) => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const result = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const conversationMessages = result.filter((m: any) =>
          (m.senderId === user.uid && m.receiverId === selectedUser.id) ||
          (m.senderId === selectedUser.id && m.receiverId === user.uid)
        );
        setMessages(conversationMessages);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      });
      return () => unsubscribe();
    });
  }, [user, selectedUser]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedUser || !user) return;

    const text = messageText;
    setMessageText('');

    try {
      await addDoc(collection(db, 'messages'), {
        text,
        senderId: user.uid,
        receiverId: selectedUser.id,
        createdAt: serverTimestamp(),
        read: false,
      });
    } catch (error: any) {
      console.error('[MESSAGES] ❌ addDoc messages failed');
      console.error('[MESSAGES]    code   :', error?.code    ?? 'no-code');
      console.error('[MESSAGES]    message:', error?.message ?? String(error));
      console.error('[MESSAGES]    stack  :', error?.stack);
      toast.error(`Mesaj gönderilemedi: [${error?.code ?? 'hata'}] ${error?.message ?? String(error)}`);
    }
  };

  const filteredUsers = users.filter((u: any) =>
    u.id !== user?.uid &&
    (u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     u.role?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="h-[calc(100dvh-2rem)] md:h-[calc(100dvh-6rem)] animate-in fade-in duration-500 flex flex-col md:flex-row gap-6">
      {/* Üye Listesi Paneli */}
      <div className={`w-full md:w-80 flex flex-col glass rounded-2xl overflow-hidden ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-white/10 bg-black/20">
          <h2 className="font-serif text-xl font-bold text-foreground mb-4">Üyeler</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Üye ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {usersLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Üyeler yükleniyor...</div>
          ) : filteredUsers.map((u: any) => (
            <div
              key={u.id}
              onClick={() => setSelectedUser(u)}
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                selectedUser?.id === u.id
                  ? 'bg-primary/20 border border-primary/30'
                  : 'hover:bg-white/5 border border-transparent'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                {u.photoURL ? (
                  <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-sm text-foreground truncate">{u.displayName || 'Anonim'}</h4>
                  <span className="text-[10px] text-primary uppercase tracking-wider">{u.role}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sohbet Paneli */}
      <div className={`flex-1 flex flex-col glass rounded-2xl overflow-hidden ${!selectedUser ? 'hidden md:flex' : 'flex'}`}>
        {selectedUser ? (
          <>
            <div className="p-4 border-b border-white/10 bg-black/20 flex items-center gap-3">
              <button
                onClick={() => setSelectedUser(null)}
                className="md:hidden p-2 text-muted-foreground hover:text-foreground"
              >
                ←
              </button>
              <div className="w-10 h-10 rounded-full bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden">
                {selectedUser.photoURL ? (
                  <img src={selectedUser.photoURL} alt={selectedUser.displayName} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <h3 className="font-medium text-foreground">{selectedUser.displayName}</h3>
                <p className="text-xs text-muted-foreground uppercase">{selectedUser.role}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <MessageSquare className="w-8 h-8 opacity-50" />
                  </div>
                  <p>{selectedUser.displayName} ile konuşmayı başlatın</p>
                </div>
              ) : (
                messages.map((msg: any) => {
                  const isMine = msg.senderId === user?.uid;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                        isMine
                          ? 'bg-primary text-primary-foreground rounded-br-sm shadow-[0_0_15px_rgba(201,168,76,0.15)]'
                          : 'bg-white/10 text-foreground rounded-bl-sm border border-white/5'
                      }`}>
                        <p className="text-sm">{msg.text}</p>
                        <span className={`text-[10px] mt-1 block ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {msg.createdAt?.toDate
                            ? format(msg.createdAt.toDate(), 'HH:mm', { locale: tr })
                            : 'Şimdi'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="p-4 border-t border-white/10 bg-black/20">
              <div className="flex gap-2 relative">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Bir mesaj yazın..."
                  className="flex-1 bg-black/50 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
                />
                <button
                  type="submit"
                  disabled={!messageText.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-8">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
              <MessageSquare className="w-10 h-10 opacity-50" />
            </div>
            <h3 className="text-xl font-serif text-foreground mb-2">Üye Mesajları</h3>
            <p className="max-w-xs text-sm">Özel konuşma başlatmak için listeden bir üye seçin.</p>
          </div>
        )}
      </div>
    </div>
  );
}
