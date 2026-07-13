import { useCollection } from '@/hooks/use-firestore';
import { useAuth } from '@/lib/auth-context';
import { orderBy, limit } from 'firebase/firestore';
import { useState } from 'react';
import { Plus, Edit2, Trash2, Check, X, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Rules() {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin';
  
  const { data: rules, loading, add, update, remove } = useCollection('rules', [
    orderBy('order', 'asc')
  ]);

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');

  const resetForm = () => {
    setFormTitle('');
    setFormContent('');
    setIsAdding(false);
    setEditingId(null);
  };

  const handleEdit = (rule: any) => {
    setFormTitle(rule.title);
    setFormContent(rule.content);
    setEditingId(rule.id);
    setIsAdding(false);
  };

  const handleSave = async () => {
    if (!formTitle || !formContent) return;
    
    if (editingId) {
      await update(editingId, { title: formTitle, content: formContent, updatedAt: new Date() });
    } else {
      const newOrder = rules.length > 0 ? Math.max(...rules.map((r: any) => r.order || 0)) + 1 : 1;
      await add({ title: formTitle, content: formContent, order: newOrder, updatedAt: new Date() });
    }
    resetForm();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex items-end justify-between border-b border-white/10 pb-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-gradient-gold mb-2">House Rules</h1>
          <p className="text-muted-foreground">Guidelines for the HangBar community to ensure an exceptional experience.</p>
        </div>
        {isAdmin && !isAdding && !editingId && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add Rule
          </button>
        )}
      </header>

      <div className="space-y-6">
        <AnimatePresence>
          {(isAdding || editingId) && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="glass p-6 rounded-xl border-primary/30"
            >
              <div className="space-y-4">
                <h3 className="font-serif text-xl font-bold text-foreground">
                  {editingId ? 'Edit Rule' : 'New Rule'}
                </h3>
                <input
                  type="text"
                  placeholder="Rule Title (e.g. Respect the Space)"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl py-2 px-4 text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
                />
                <textarea
                  placeholder="Detailed description..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  rows={4}
                  className="w-full bg-black/50 border border-white/10 rounded-xl py-2 px-4 text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 resize-none"
                />
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={resetForm} className="px-4 py-2 rounded-lg text-muted-foreground hover:bg-white/5 flex items-center gap-2">
                    <X className="w-4 h-4" /> Cancel
                  </button>
                  <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium flex items-center gap-2 hover:bg-primary/90">
                    <Check className="w-4 h-4" /> Save
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass p-6 rounded-xl animate-pulse h-32" />
            ))}
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-12 glass rounded-xl border-dashed">
            <ShieldAlert className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground mb-1">No rules set</h3>
            <p className="text-muted-foreground text-sm">Admins haven't added any house rules yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rules.map((rule: any, index: number) => (
              <div key={rule.id} className="glass p-6 rounded-xl relative group overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary/50 to-primary/10"></div>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-4">
                    <span className="font-serif text-3xl text-primary/30 font-bold leading-none mt-1">
                      {(index + 1).toString().padStart(2, '0')}
                    </span>
                    <div>
                      <h3 className="text-lg font-serif font-bold text-foreground mb-2">{rule.title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">{rule.content}</p>
                    </div>
                  </div>
                  
                  {isAdmin && editingId !== rule.id && (
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(rule)} className="p-2 bg-white/5 hover:bg-primary/20 text-muted-foreground hover:text-primary rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => remove(rule.id)} className="p-2 bg-white/5 hover:bg-destructive/20 text-muted-foreground hover:text-destructive rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
