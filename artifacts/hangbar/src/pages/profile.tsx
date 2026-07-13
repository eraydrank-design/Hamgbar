import { useAuth } from '@/lib/auth-context';
import { useDocument } from '@/hooks/use-firestore';
import { useState, useEffect } from 'react';
import { User, Camera, Save, Shield, Calendar, Edit2, X, Loader2 } from 'lucide-react';

export default function Profile() {
  const { user, userData } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const { update } = useDocument('users', user?.uid || '');

  useEffect(() => {
    if (userData) {
      setDisplayName(userData.displayName || '');
      setBio(userData.bio || '');
    }
  }, [userData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await update({
        displayName,
        bio
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update profile", error);
    } finally {
      setIsSaving(false);
    }
  };

  const joinDate = userData?.joinedAt?.toDate?.() 
    ? new Date(userData.joinedAt.toDate()).toLocaleDateString() 
    : 'Unknown';

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="border-b border-white/10 pb-6">
        <h1 className="font-serif text-3xl font-bold text-gradient-gold">Member Profile</h1>
      </header>

      <div className="glass rounded-2xl p-8 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
          <div className="flex flex-col items-center gap-4">
            <div className="w-32 h-32 rounded-full bg-black border-2 border-primary/30 flex items-center justify-center overflow-hidden relative group">
              {userData?.photoURL ? (
                <img src={userData.photoURL} alt={userData.displayName} className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-primary/50" />
              )}
              {isEditing && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="w-8 h-8 text-white" />
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium uppercase tracking-wider">
                <Shield className="w-3.5 h-3.5" />
                {userData?.role}
              </span>
            </div>
          </div>

          <div className="flex-1 w-full">
            {isEditing ? (
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={4}
                    className="w-full bg-black/50 border border-white/10 rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 resize-none"
                    placeholder="Tell other members about yourself..."
                  />
                </div>
                
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 rounded-lg text-muted-foreground hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-[0_0_15px_rgba(201,168,76,0.2)]"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Profile
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-serif font-bold text-foreground mb-1">{userData?.displayName}</h2>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" /> Member since {joinDate}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 text-muted-foreground hover:text-primary bg-white/5 rounded-lg border border-white/10 transition-colors"
                    title="Edit Profile"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">About</h3>
                  {userData?.bio ? (
                    <p className="text-foreground leading-relaxed whitespace-pre-wrap">{userData.bio}</p>
                  ) : (
                    <p className="text-muted-foreground italic text-sm">No bio provided yet.</p>
                  )}
                </div>

                <div className="pt-4 border-t border-white/5">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Account Details</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Email</span>
                      <span className="text-foreground">{userData?.email}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">User ID</span>
                      <span className="text-muted-foreground font-mono text-xs">{user?.uid}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
