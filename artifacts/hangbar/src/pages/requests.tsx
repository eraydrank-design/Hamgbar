import { useAuth } from '@/lib/auth-context';
import { useCollection } from '@/hooks/use-firestore';
import { useState } from 'react';
import { orderBy, limit } from 'firebase/firestore';
import { ClipboardList, Plus, CheckCircle, XCircle, X, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

export default function Requests() {
  const { userData, user } = useAuth();
  const isAdminOrStaff = userData?.role === 'admin' || userData?.role === 'staff';
  
  const { data: requests, loading, add, update } = useCollection('requests', [
    orderBy('createdAt', 'desc')
  ]);

  const [isAdding, setIsAdding] = useState(false);
  const [formType, setFormType] = useState('Table Service');
  const [formDescription, setFormDescription] = useState('');

  const requestTypes = ['Table Service', 'Special Event', 'Guest Pass', 'Complaint', 'Other'];

  const handleSubmit = async () => {
    if (!formDescription) return;
    await add({
      type: formType,
      description: formDescription,
      status: 'pending',
      requestedBy: user?.uid,
      requestedByName: userData?.displayName,
      notes: ''
    });
    setFormDescription('');
    setFormType('Table Service');
    setIsAdding(false);
  };

  const updateStatus = async (id: string, status: string) => {
    await update(id, { status });
  };

  // Filter requests based on role
  const visibleRequests = isAdminOrStaff 
    ? requests 
    : requests.filter((r: any) => r.requestedBy === user?.uid);

  const StatusBadge = ({ status }: { status: string }) => {
    const styles = {
      pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      approved: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      denied: 'bg-destructive/10 text-destructive border-destructive/20'
    }[status] || 'bg-white/10 text-foreground border-white/20';

    return (
      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${styles}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex items-end justify-between border-b border-white/10 pb-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-gradient-gold mb-2">
            {isAdminOrStaff ? 'Member Requests' : 'My Requests'}
          </h1>
          <p className="text-muted-foreground">
            {isAdminOrStaff ? 'Manage incoming requests from members.' : 'Submit requests to the HangBar staff.'}
          </p>
        </div>
        {!isAdminOrStaff && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg transition-all hover:bg-primary/90 font-medium shadow-[0_0_15px_rgba(201,168,76,0.3)]"
          >
            <Plus className="w-4 h-4" /> New Request
          </button>
        )}
      </header>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass p-6 rounded-2xl border-primary/30 relative overflow-hidden"
          >
            <h3 className="font-serif text-xl font-bold text-foreground mb-4">Submit a Request</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Request Type</label>
                <div className="flex flex-wrap gap-2">
                  {requestTypes.map(type => (
                    <button
                      key={type}
                      onClick={() => setFormType(type)}
                      className={`px-4 py-2 rounded-xl text-sm transition-all border ${
                        formType === type 
                          ? 'bg-primary/20 border-primary text-primary' 
                          : 'bg-black/50 border-white/10 text-muted-foreground hover:border-white/30'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Details</label>
                <textarea
                  placeholder="Provide details about your request..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={4}
                  className="w-full bg-black/50 border border-white/10 rounded-xl py-3 px-4 text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 resize-none"
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button onClick={() => setIsAdding(false)} className="px-4 py-2 rounded-lg text-muted-foreground hover:bg-white/5">
                  Cancel
                </button>
                <button 
                  onClick={handleSubmit} 
                  disabled={!formDescription}
                  className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50"
                >
                  Submit Request
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="glass p-6 rounded-2xl animate-pulse h-32" />)
        ) : visibleRequests.length === 0 ? (
          <div className="text-center py-20 glass rounded-2xl border-dashed">
            <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground mb-1">No requests</h3>
            <p className="text-muted-foreground text-sm">
              {isAdminOrStaff ? 'All caught up.' : 'You haven\'t made any requests yet.'}
            </p>
          </div>
        ) : (
          visibleRequests.map((req: any) => (
            <div key={req.id} className="glass p-6 rounded-2xl flex flex-col md:flex-row gap-6 justify-between group">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-semibold text-primary border border-primary/20 bg-primary/10 px-3 py-1 rounded-full">
                    {req.type}
                  </span>
                  <StatusBadge status={req.status} />
                </div>
                <p className="text-foreground mt-3 leading-relaxed">{req.description}</p>
                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground uppercase tracking-wider">
                  {isAdminOrStaff && (
                    <span className="flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> By: {req.requestedByName}
                    </span>
                  )}
                  <span>
                    {req.createdAt?.toDate ? format(req.createdAt.toDate(), 'MMM d, yyyy • h:mm a') : 'Just now'}
                  </span>
                </div>
              </div>

              {isAdminOrStaff && req.status === 'pending' && (
                <div className="flex md:flex-col gap-2 md:justify-center border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6">
                  <button
                    onClick={() => updateStatus(req.id, 'approved')}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 px-4 py-2 rounded-lg transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                  <button
                    onClick={() => updateStatus(req.id, 'denied')}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 px-4 py-2 rounded-lg transition-colors"
                  >
                    <XCircle className="w-4 h-4" /> Deny
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
