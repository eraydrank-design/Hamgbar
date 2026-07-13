import { useAuth } from '@/lib/auth-context';
import { useCollection } from '@/hooks/use-firestore';
import { useState } from 'react';
import { orderBy } from 'firebase/firestore';
import { CheckSquare, Plus, Clock, User, Check, Play, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Düşük',
  medium: 'Orta',
  high: 'Yüksek',
  urgent: 'Acil',
};

export default function Tasks() {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin';
  
  const { data: tasks, loading, add, update, remove } = useCollection('tasks', [
    orderBy('dueDate', 'asc')
  ]);
  const { data: users } = useCollection('users');

  const staffMembers = users.filter((u: any) => u.role === 'admin' || u.role === 'staff');

  const [isAdding, setIsAdding] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formAssignee, setFormAssignee] = useState('');
  const [formPriority, setFormPriority] = useState('medium');
  const [formDate, setFormDate] = useState('');

  const priorities = ['low', 'medium', 'high', 'urgent'];

  const columns = [
    { id: 'pending', title: 'Yapılacak' },
    { id: 'in_progress', title: 'Devam Ediyor' },
    { id: 'done', title: 'Tamamlandı' },
  ];

  const handleAdd = async () => {
    if (!formTitle) return;
    await add({
      title: formTitle,
      description: formDesc,
      assignedTo: formAssignee,
      priority: formPriority,
      status: 'pending',
      dueDate: formDate ? new Date(formDate) : null,
      createdBy: userData?.displayName,
    });
    setIsAdding(false);
    setFormTitle('');
    setFormDesc('');
    setFormAssignee('');
  };

  const updateStatus = async (id: string, currentStatus: string) => {
    const nextMap: Record<string, string> = {
      pending: 'in_progress',
      in_progress: 'done',
      done: 'pending',
    };
    await update(id, { status: nextMap[currentStatus] });
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'urgent': return 'text-destructive border-destructive bg-destructive/10';
      case 'high': return 'text-orange-500 border-orange-500/50 bg-orange-500/10';
      case 'medium': return 'text-amber-500 border-amber-500/50 bg-amber-500/10';
      default: return 'text-primary border-primary/50 bg-primary/10';
    }
  };

  return (
    <div className="h-[calc(100dvh-2rem)] md:h-[calc(100dvh-6rem)] flex flex-col animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6 mb-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-gradient-gold mb-2">Personel Görevleri</h1>
          <p className="text-muted-foreground">Dahili operasyonlar ve atamalar.</p>
        </div>
        {isAdmin && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg transition-all hover:bg-primary/90 font-medium"
          >
            <Plus className="w-4 h-4" /> Görev Oluştur
          </button>
        )}
      </header>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass p-6 rounded-2xl mb-8 border-primary/30"
          >
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Görev Başlığı"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl py-2 px-4 text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
                />
                <textarea
                  placeholder="Açıklama..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-black/50 border border-white/10 rounded-xl py-2 px-4 text-foreground focus:outline-none focus:border-primary/50 resize-none"
                />
              </div>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-[10px] uppercase text-muted-foreground mb-1">Atanan Kişi</label>
                    <select
                      value={formAssignee}
                      onChange={(e) => setFormAssignee(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl py-2 px-4 text-foreground appearance-none"
                    >
                      <option value="">Herkese Açık</option>
                      {staffMembers.map((u: any) => (
                        <option key={u.id} value={u.id}>{u.displayName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] uppercase text-muted-foreground mb-1">Bitiş Tarihi</label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl py-2 px-4 text-foreground [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-muted-foreground mb-2">Öncelik</label>
                  <div className="flex gap-2">
                    {priorities.map(p => (
                      <button
                        key={p}
                        onClick={() => setFormPriority(p)}
                        className={`flex-1 py-1.5 rounded-lg text-xs uppercase font-bold tracking-wider border transition-all ${
                          formPriority === p ? getPriorityColor(p) : 'border-white/10 text-muted-foreground hover:bg-white/5'
                        }`}
                      >
                        {PRIORITY_LABELS[p]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setIsAdding(false)} className="px-4 py-2 rounded-lg text-muted-foreground hover:bg-white/5">
                    İptal
                  </button>
                  <button onClick={handleAdd} className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium">
                    Ekle
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 grid md:grid-cols-3 gap-6 overflow-hidden pb-4">
        {columns.map(col => {
          const colTasks = tasks.filter((t: any) => t.status === col.id);
          return (
            <div key={col.id} className="flex flex-col glass rounded-2xl bg-black/20 p-4 overflow-hidden border border-white/5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-serif text-lg font-bold text-foreground">{col.title}</h3>
                <span className="bg-white/10 text-muted-foreground px-2 py-0.5 rounded text-xs font-mono">{colTasks.length}</span>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {colTasks.length === 0 ? (
                  <div className="h-24 flex items-center justify-center border border-dashed border-white/10 rounded-xl text-sm text-muted-foreground">
                    Boş
                  </div>
                ) : (
                  colTasks.map((task: any) => {
                    const assignee = users.find((u: any) => u.id === task.assignedTo);
                    return (
                      <div key={task.id} className="glass p-4 rounded-xl border border-white/10 hover:border-white/20 transition-all group">
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded border ${getPriorityColor(task.priority)}`}>
                            {PRIORITY_LABELS[task.priority] || task.priority}
                          </span>
                          
                          <button
                            onClick={() => updateStatus(task.id, task.status)}
                            className="w-6 h-6 rounded flex items-center justify-center bg-white/5 hover:bg-primary/20 hover:text-primary transition-colors text-muted-foreground"
                          >
                            {task.status === 'pending' ? <Play className="w-3 h-3" /> : task.status === 'in_progress' ? <Check className="w-4 h-4" /> : <Clock className="w-3 h-3" />}
                          </button>
                        </div>
                        
                        <h4 className="font-medium text-foreground mb-1 leading-tight">{task.title}</h4>
                        {task.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{task.description}</p>}
                        
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <User className="w-3 h-3" />
                            <span className="truncate max-w-[100px]">{assignee?.displayName || 'Herkese Açık'}</span>
                          </div>
                          {task.dueDate && (
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {format(task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate), 'd MMM', { locale: tr })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
