import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';
import { Loader2, Mail, Lock, GlassWater, CheckCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { motion } from 'framer-motion';

export default function Login() {
  const [, setLocation] = useLocation();
  const { user, userData, loading } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Redirect once auth + userData are both ready.
  useEffect(() => {
    if (!loading && user && userData) {
      const dest = userData.role === 'admin' ? '/admin' : '/dashboard';
      setLocation(dest);
    }
  }, [loading, user, userData]);

  const translateError = (msg: string): string => {
    if (msg.includes('Invalid login credentials')) return 'E-posta veya şifre hatalı.';
    if (msg.includes('Email not confirmed')) return 'E-posta adresinizi onaylamanız gerekiyor. Gelen kutunuzu kontrol edin.';
    if (msg.includes('User already registered')) return 'Bu e-posta adresi zaten kullanımda.';
    if (msg.includes('Password should be at least')) return 'Şifre en az 6 karakter olmalıdır.';
    if (msg.includes('Unable to validate email address')) return 'Geçersiz e-posta adresi.';
    if (msg.includes('signup is disabled')) return 'Kayıt şu an devre dışı.';
    if (msg.includes('rate limit')) return 'Çok fazla deneme. Lütfen bir süre bekleyin.';
    return 'Bir hata oluştu. Lütfen tekrar deneyin.';
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEmailSent(false);
    setIsSubmitting(true);
    try {
      if (isRegister) {
        const { data, error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        // If session is null, Supabase requires email confirmation
        if (!data.session) {
          setEmailSent(true);
          return;
        }
        // Otherwise, onAuthStateChange will handle redirect via useEffect
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        // onAuthStateChange will trigger; redirect happens via useEffect
      }
    } catch (err: any) {
      setError(translateError(err.message ?? String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center relative overflow-hidden bg-background">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-primary/10 rounded-full blur-[100px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="z-10 w-full max-w-md p-6"
      >
        <div className="text-center mb-8">
          <GlassWater className="w-12 h-12 text-primary mx-auto mb-4" />
          <h1 className="font-serif text-4xl font-bold text-gradient-gold tracking-widest uppercase mb-2">HANGOVER</h1>
          <p className="text-muted-foreground text-sm tracking-widest uppercase">Yalnızca Üyeler</p>
        </div>

        <div className="glass rounded-2xl p-8 shadow-2xl">
          {/* ── Email-confirmation success state ── */}
          {emailSent ? (
            <div className="text-center space-y-4">
              <CheckCircle className="w-14 h-14 text-emerald-400 mx-auto" />
              <h2 className="font-serif text-xl font-bold text-foreground">E-postanızı Kontrol Edin</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                <span className="text-foreground font-medium">{email}</span> adresine bir doğrulama bağlantısı gönderdik.
                Hesabınızı etkinleştirmek için gelen e-postadaki bağlantıya tıklayın.
              </p>
              <button
                onClick={() => { setEmailSent(false); setIsRegister(false); setPassword(''); }}
                className="mt-2 text-primary text-sm hover:text-primary/80 transition-colors"
              >
                Giriş sayfasına dön
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="E-posta"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                  required
                  autoComplete="email"
                  data-testid="input-email"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="password"
                  placeholder="Şifre"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                  required
                  minLength={6}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  data-testid="input-password"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 py-3 px-4 rounded-xl border border-destructive/20">
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary text-primary-foreground font-semibold py-3 px-4 rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 mt-2 shadow-[0_0_15px_rgba(201,168,76,0.3)] disabled:opacity-60"
                data-testid="button-submit"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isRegister ? 'Kulübe Katıl' : 'Giriş Yap'}
              </button>

              <p className="text-center text-sm text-muted-foreground pt-2">
                {isRegister ? 'Zaten üye misiniz? ' : 'Yeni misiniz? '}
                <button
                  type="button"
                  onClick={() => { setIsRegister(!isRegister); setError(''); }}
                  className="text-primary hover:text-primary/80 transition-colors focus:outline-none"
                  data-testid="button-toggle-register"
                >
                  {isRegister ? 'Giriş Yap' : 'Kayıt Ol'}
                </button>
              </p>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
