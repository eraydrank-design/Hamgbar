import { useAuth } from '@/lib/auth-context';
import { useCollection } from '@/hooks/use-firestore';
import { limit, orderBy } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { Bell, MessageSquare, ClipboardList, CheckSquare, Martini, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';

export default function Dashboard() {
  const { userData } = useAuth();
  
  const { data: announcements, loading: announcementsLoading } = useCollection('announcements', [
    orderBy('createdAt', 'desc'),
    limit(3)
  ]);
  
  const { data: requests, loading: requestsLoading } = useCollection('requests', [
    orderBy('createdAt', 'desc')
  ]);

  const { data: tasks, loading: tasksLoading } = useCollection('tasks', [
    orderBy('dueDate', 'asc')
  ]);

  const { data: messages, loading: messagesLoading } = useCollection('messages', [
    orderBy('createdAt', 'desc'),
    limit(3)
  ]);

  const pendingRequestsCount = requests.filter((r: any) => r.status === 'pending' && (userData?.role !== 'member' || r.requestedBy === userData?.uid)).length;
  const activeTasksCount = tasks.filter((t: any) => t.status !== 'done' && (t.assignedTo === userData?.uid || userData?.role === 'admin')).length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex items-end justify-between border-b border-white/10 pb-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-gradient-gold mb-2">
            Hoş geldin, {userData?.displayName as string}
          </h1>
          <p className="text-muted-foreground">Bar açık. Bu gece ne yapmak istersiniz?</p>
        </div>
      </header>

      {/* İstatistikler */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4 flex flex-col items-center justify-center text-center">
          <Bell className="w-6 h-6 text-primary mb-2" />
          <span className="text-2xl font-serif font-bold">{announcements.length}</span>
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Duyurular</span>
        </div>
        <div className="glass rounded-xl p-4 flex flex-col items-center justify-center text-center">
          <ClipboardList className="w-6 h-6 text-amber-500 mb-2" />
          <span className="text-2xl font-serif font-bold">{pendingRequestsCount}</span>
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Bekleyen Talepler</span>
        </div>
        <div className="glass rounded-xl p-4 flex flex-col items-center justify-center text-center">
          <CheckSquare className="w-6 h-6 text-emerald-500 mb-2" />
          <span className="text-2xl font-serif font-bold">{activeTasksCount}</span>
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Aktif Görevler</span>
        </div>
        <div className="glass rounded-xl p-4 flex flex-col items-center justify-center text-center">
          <Martini className="w-6 h-6 text-purple-400 mb-2" />
          <span className="text-2xl font-serif font-bold">12</span>
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Kokteyller</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Son Duyurular */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" /> Son Duyurular
            </h2>
            <Link href="/announcements" className="text-sm text-primary hover:text-primary/80 flex items-center gap-1">
              Tümünü Gör <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {announcementsLoading ? (
              <div className="glass p-6 rounded-xl animate-pulse h-24" />
            ) : announcements.length === 0 ? (
              <div className="glass p-6 rounded-xl text-center text-muted-foreground text-sm">
                Henüz duyuru yok
              </div>
            ) : (
              announcements.map((ann: any) => (
                <div key={ann.id} className="glass glass-hover p-4 rounded-xl">
                  <h3 className="font-medium text-foreground mb-1">{ann.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{ann.body}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Hızlı İşlemler */}
        <div className="space-y-4">
          <h2 className="font-serif text-xl font-semibold flex items-center gap-2">
            <Martini className="w-5 h-5 text-primary" /> Hızlı İşlemler
          </h2>
          <div className="grid gap-3">
            <Link href="/cocktails">
              <div className="glass glass-hover p-4 rounded-xl flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <Martini className="w-5 h-5" />
                  </div>
                  <span className="font-medium">Kokteylleri İncele</span>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Link>
            
            <Link href="/requests">
              <div className="glass glass-hover p-4 rounded-xl flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <span className="font-medium">Talep Oluştur</span>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-amber-500 transition-colors" />
              </div>
            </Link>

            <Link href="/messages">
              <div className="glass glass-hover p-4 rounded-xl flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <span className="font-medium">Üyeye Mesaj Gönder</span>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-blue-500 transition-colors" />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
