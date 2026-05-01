import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { usePatientApp } from '../../contexts/PatientAppContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface Props {
  onLoginSuccess: () => void;
}

export default function PatientLoginPage({ onLoginSuccess }: Props) {
  const { login } = usePatientApp();
  const { lang, setLang } = useLanguage();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [mrId, setMrId] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const t = lang === 'ta' ? {
    appName: 'BeanHealth',
    appSubtitle: 'நோயாளி போர்டல்',
    appDesc: 'சிறுநீரக மாற்று & ESRD நோயாளி மேலாண்மை',
    signIn: 'உள்நுழை',
    register: 'பதிவு',
    mrId: 'MR எண்',
    mrIdPlaceholder: 'எ.கா. MR001',
    enterMr: 'உங்கள் MR எண்ணை உள்ளிடவும்',
    contactReception: 'பதிவு மருத்துவமனை வரவேற்பறையில் செய்யப்படுகிறது.',
    contactDesc: 'தொடக்க வருகையில் ஒரு முறை பதிவு செய்யப்படும். உங்கள் MR எண் ரசீதில் இருக்கும்.',
  } : {
    appName: 'BeanHealth',
    appSubtitle: 'Patient Portal',
    appDesc: 'Kidney Transplant & ESRD Patient Management',
    signIn: 'Sign In',
    register: 'Register',
    mrId: 'MR ID',
    mrIdPlaceholder: 'e.g. MR001',
    enterMr: 'Enter your MR number to continue',
    contactReception: 'Patient registration is managed at the hospital reception.',
    contactDesc: 'You are registered once during your first visit. Your MR number is on your token receipt.',
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mrId.trim()) { setError(t.enterMr); return; }
    setError(''); setLoading(true);
    try {
      const err = await login(mrId.trim().toUpperCase());
      if (err) { setError(err); return; }
      onLoginSuccess();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="patient-app min-h-screen flex items-center justify-center p-4 relative"
      style={{
        background: 'linear-gradient(135deg, hsl(151 22% 95%) 0%, hsl(60 11% 97%) 100%)',
      }}
    >
      {/* Lang toggle */}
      <button
        onClick={() => setLang(lang === 'ta' ? 'en' : 'ta')}
        className="absolute top-4 right-4 text-xs font-bold px-3 py-1.5 rounded-full border border-border bg-white text-muted-foreground hover:text-foreground transition-colors"
      >
        {lang === 'ta' ? 'EN' : 'த'}
      </button>

      <div className="relative w-full max-w-md animate-fadeInUp">
        <div className="bg-white rounded-2xl shadow-xl border border-border overflow-hidden">
          {/* Header */}
          <div className="px-7 pt-7 pb-5 border-b border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center" style={{ background: 'hsl(var(--primary))' }}>
                <img src="/logo.png" alt="BeanHealth" className="w-7 h-7 object-contain" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  {t.appName}
                </h1>
                <p className="text-xs text-muted-foreground">{t.appSubtitle}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t.appDesc}</p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            {(['login', 'register'] as const).map((tb) => (
              <button
                key={tb}
                onClick={() => { setTab(tb); setError(''); }}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  tab === tb
                    ? 'border-b-2 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                style={tab === tb ? { borderBottomColor: 'hsl(var(--primary))' } : {}}
              >
                {tb === 'login' ? t.signIn : t.register}
              </button>
            ))}
          </div>

          <div className="px-7 py-6">
            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <div className="p-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg">
                    {error}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="mr_id">{t.mrId}</Label>
                  <Input
                    id="mr_id"
                    placeholder={t.mrIdPlaceholder}
                    value={mrId}
                    onChange={(e) => setMrId(e.target.value.toUpperCase())}
                    required
                    autoFocus
                    className="h-12 text-base font-mono tracking-widest"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 text-base font-semibold"
                  style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                >
                  {loading ? '…' : t.signIn}
                </Button>
              </form>
            ) : (
              <div className="py-4 space-y-4 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl overflow-hidden flex items-center justify-center" style={{ background: 'hsl(var(--accent))' }}>
                  <img src="/logo.png" alt="BeanHealth" className="w-9 h-9 object-contain" />
                </div>
                <p className="text-sm font-semibold text-foreground">{t.contactReception}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{t.contactDesc}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
