import { useAuth } from '@/lib/auth-context';
import { useCollection } from '@/hooks/use-firestore';
import { useState } from 'react';
import { Shield, Users, Martini, ShieldAlert, Trash2, User } from 'lucide-react';
import { orderBy } from 'firebase/firestore';

const ROLE_LABELS: Record<string, string> = {
  member: 'Üye',
  staff: 'Personel',
  admin: 'Yönetici',
};

export default function Admin() {
  const { userData } = useAuth();
  const [activeTab, setActiveTab] = useState('Genel Bakış');

  const { data: users, update: updateUser } = useCollection('users');
  const { data: requests } = useCollection('requests');
  const { data: tasks } = useCollection('tasks');
  const { data: cocktails, update: updateCocktail, remove: removeCocktail } = useCollection('cocktails');

  const memberCount = users.filter((u: any) => u.role === 'member').length;
  const staffCount = users.filter((u: any) => u.role === 'staff').length;
  const adminCount = users.filter((u: any) => u.role === 'admin').length;
  const pendingRequests = requests.filter((r: any) => r.status === 'pending').length;
  const activeTasks = tasks.filter((t: any) => t.status !== 'done').length;

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (userId === userData?.uid) return;
    await updateUser(userId, { role: newRole });
  };

  const toggleCocktailAvailability = async (id: string, current: boolean) => {
    await updateCocktail(id, { available: !current });
  };

  const tabs = ['Genel Bakış', 'Kullanıcılar', 'Kokteyller'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="border-b border-white/10 pb-6">
        <h1 className="font-serif text-3xl font-bold text-gradient-gold mb-2 flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-primary" /> Yönetim Paneli
        </h1>
        <p className="text-muted-foreground">Sistem yapılandırması ve kullanıcı yönetimi.</p>
      </header>

      <div className="flex gap-2 border-b border-white/5 pb-4">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'text-muted-foreground hover:bg-white/5 border border-transparent'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="pt-4">
        {activeTab === 'Genel Bakış' && (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="glass p-6 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-blue-500/20 rounded-xl text-blue-500"><Users className="w-6 h-6" /></div>
                <h3 className="font-serif text-xl font-bold">Kullanıcı Tabanı</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Üyeler</span><span className="font-mono">{memberCount}</span></div>
                <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Personel</span><span className="font-mono">{staffCount}</span></div>
                <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Yöneticiler</span><span className="font-mono">{adminCount}</span></div>
                <div className="pt-3 border-t border-white/10 flex justify-between items-center font-bold">
                  <span className="text-foreground">Toplam</span>
                  <span className="font-mono text-primary">{users.length}</span>
                </div>
              </div>
            </div>

            <div className="glass p-6 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-amber-500/20 rounded-xl text-amber-500"><Shield className="w-6 h-6" /></div>
                <h3 className="font-serif text-xl font-bold">Operasyonlar</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Bekleyen Talepler</span><span className="font-mono text-amber-500">{pendingRequests}</span></div>
                <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Aktif Görevler</span><span className="font-mono">{activeTasks}</span></div>
                <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Toplam Kokteyl</span><span className="font-mono">{cocktails.length}</span></div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Kullanıcılar' && (
          <div className="glass rounded-2xl overflow-hidden border border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-black/40 text-muted-foreground uppercase tracking-wider text-[10px] border-b border-white/10">
                  <tr>
                    <th className="px-6 py-4 font-medium">Kullanıcı</th>
                    <th className="px-6 py-4 font-medium">E-posta</th>
                    <th className="px-6 py-4 font-medium">Katılım</th>
                    <th className="px-6 py-4 font-medium">Rol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((u: any) => (
                    <tr key={u.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 overflow-hidden">
                            {u.photoURL
                              ? <img src={u.photoURL} alt="" className="w-full h-full object-cover" />
                              : <User className="w-4 h-4 m-2 text-primary" />}
                          </div>
                          <span className="font-medium text-foreground">{u.displayName || 'İsimsiz'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{u.email}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {u.joinedAt?.toDate
                          ? new Date(u.joinedAt.toDate()).toLocaleDateString('tr-TR')
                          : 'Yok'}
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          disabled={u.id === userData?.uid}
                          className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-foreground uppercase tracking-wider focus:border-primary/50 disabled:opacity-50"
                        >
                          <option value="member">Üye</option>
                          <option value="staff">Personel</option>
                          <option value="admin">Yönetici</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'Kokteyller' && (
          <div className="space-y-6">
            <div className="glass rounded-2xl overflow-hidden border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-black/40 text-muted-foreground uppercase tracking-wider text-[10px] border-b border-white/10">
                  <tr>
                    <th className="px-6 py-4 font-medium">İsim</th>
                    <th className="px-6 py-4 font-medium">Kategori</th>
                    <th className="px-6 py-4 font-medium">Fiyat</th>
                    <th className="px-6 py-4 font-medium text-center">Durum</th>
                    <th className="px-6 py-4 font-medium text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {cocktails.map((c: any) => (
                    <tr key={c.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-serif font-bold text-foreground text-base">{c.name}</td>
                      <td className="px-6 py-4 text-muted-foreground text-xs uppercase">{c.category}</td>
                      <td className="px-6 py-4 text-primary">{c.price} ₺</td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => toggleCocktailAvailability(c.id, c.available)}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-colors ${
                            c.available
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20'
                          }`}
                        >
                          {c.available ? 'Mevcut' : 'Mevcut Değil'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => removeCocktail(c.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors" title="Sil">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
