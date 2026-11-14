'use client';

import { APP_NAME } from '@/lib/brand';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Check, KeyRound, Loader2, Lock, Mail, User, Volleyball } from 'lucide-react';

import { BrandLogo } from '@/components/brand/BrandLogo';
import { PillButton } from '@/components/ui/PillButton';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useT } from '@/lib/i18n';
import { safeAppPath } from '@/lib/safe-path';

type Phase = 'splash' | 'login' | 'role' | 'register';
type SignupRole = 'citizen' | 'manager';

const ROLE_OPTIONS: { id: SignupRole; title: string; desc: string; points: string[]; icon: typeof User }[] = [
  {
    id: 'citizen',
    title: 'Cittadino',
    desc: 'Voglio fare sport a Roma',
    points: ['Trovo campi, palestre e piscine', 'Mi iscrivo alle attività aperte', 'Organizzo un’attività al parco'],
    icon: Volleyball,
  },
  {
    id: 'manager',
    title: 'Gestore di un impianto',
    desc: 'Gestisco un luogo dove si fa sport',
    points: ['Rivendico la scheda del mio impianto', 'Aggiorno orari, contatti e accessibilità', 'Pubblico attività ed eventi'],
    icon: KeyRound,
  },
];

/** Solo percorsi interni: niente open redirect */
const safeNext = (next: string | null) => safeAppPath(next);

const SPLASH_MS = 2200;

const inputWrapClass =
  'flex items-center gap-3 w-full h-[52px] px-4 rounded-2xl bg-(--surface-muted) border border-(--stroke-dark) focus-within:bg-white focus-within:border-gold-500 focus-within:shadow-[0_0_0_4px_rgba(245,179,1,0.18)] transition-all';
const inputClass =
  'flex-1 bg-transparent text-base text-hi outline-none placeholder:text-low min-w-0';

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-hi mb-1.5 ml-0.5">
      {children}
    </label>
  );
}

export function AuthScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params?.get('next') ?? null);
  const t = useT();
  const { user, loading: authLoading, signIn, signUp } = useAuth();

  // Se arrivo qui da un'azione (iscriviti, crea…) salto lo splash
  const [phase, setPhase] = useState<Phase>(next ? 'login' : params?.get('mode') === 'register' ? 'role' : 'splash');
  const [signupRole, setSignupRole] = useState<SignupRole>('citizen');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length >= 6;
  const isRegister = phase === 'register';

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(next ?? '/');
    }
  }, [user, authLoading, router, next]);

  useEffect(() => {
    if (phase !== 'splash') return;
    const timer = setTimeout(() => setPhase('login'), SPLASH_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  const skipSplash = useCallback(() => {
    if (phase === 'splash') setPhase('login');
  }, [phase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (isRegister && password !== confirmPassword) {
      setError(t('auth.passwordsNoMatch'));
      return;
    }

    setSubmitting(true);
    try {
      if (isRegister) {
        const { needsEmailConfirmation } = await signUp(email, password, {
          signup_role: signupRole,
          display_name: displayName.trim() || undefined,
        });
        if (needsEmailConfirmation) {
          setSuccessMessage(t('auth.emailConfirmation'));
          return;
        }
        router.replace(next ?? (signupRole === 'manager' ? '/gestore' : '/'));
      } else {
        await signIn(email, password);
        router.replace(next ?? '/');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth.error'));
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="h-dvh w-full flex items-center justify-center bg-(--bg)">
        <Loader2 className="w-10 h-10 animate-spin text-gold-500" />
      </div>
    );
  }

  return (
    <div className="h-dvh w-full bg-(--bg) relative overflow-hidden flex flex-col dot-grid">
      {/* Alone dorato di fondo */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[620px] h-[620px] rounded-full opacity-40"
        style={{
          background:
            'radial-gradient(circle, rgba(245,179,1,0.22) 0%, rgba(245,179,1,0.05) 45%, transparent 70%)',
        }}
        aria-hidden
      />

      <AnimatePresence mode="wait">
        {phase === 'splash' && (
          <motion.button
            key="splash"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            onClick={skipSplash}
            className="relative flex-1 flex flex-col items-center justify-center w-full cursor-pointer select-none"
            aria-label={t('auth.splash.continue')}
          >
            {/* Radar dietro il logo */}
            <div className="relative flex items-center justify-center mb-10" aria-hidden>
              <span className="absolute w-24 h-24 rounded-full border border-(--gold-500)/50 animate-radar" />
              <span
                className="absolute w-24 h-24 rounded-full border border-(--gold-500)/50 animate-radar"
                style={{ animationDelay: '0.8s' }}
              />
              <span
                className="absolute w-24 h-24 rounded-full border border-(--gold-500)/50 animate-radar"
                style={{ animationDelay: '1.6s' }}
              />
              <span
                className="relative w-5 h-5 rounded-full bg-gold-500"
                style={{ boxShadow: '0 0 24px rgba(245,179,1,0.8)' }}
              />
            </div>

            <motion.div
              animate={{ scale: [1, 1.015, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <BrandLogo className="text-[56px]" />
            </motion.div>

            <p className="text-mid text-sm mt-4 font-medium">{t('auth.tagline')}</p>

            <span className="absolute bottom-14 text-low text-[11px] font-semibold tracking-[0.22em] uppercase">
              {t('auth.splash.hint')}
            </span>
          </motion.button>
        )}

        {phase === 'role' && (
          <motion.div
            key="role"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ type: 'spring', damping: 24, stiffness: 220 }}
            className="relative flex-1 flex flex-col items-center overflow-y-auto px-4 sm:px-6 pt-safe pb-safe"
          >
            <div className="w-full max-w-[520px] flex flex-col my-auto">
              <div className="pb-6 flex flex-col items-center text-center">
                <BrandLogo className="text-[34px]" />
                <h1 className="text-[24px] font-bold text-hi mt-5" style={{ fontFamily: 'var(--font-display)' }}>
                  Chi sei?
                </h1>
                <p className="text-mid text-[15px] mt-1.5 max-w-[340px]">
                  Scegli come userai {APP_NAME}. Potrai sempre cambiare in seguito.
                </p>
              </div>

              <fieldset>
                <legend className="sr-only">Tipo di account</legend>
                <div className="flex flex-col gap-3">
                  {ROLE_OPTIONS.map((opt) => {
                    const checked = signupRole === opt.id;
                    const Icon = opt.icon;
                    return (
                      <label
                        key={opt.id}
                        className={`card rounded-[24px] p-5 flex gap-4 cursor-pointer transition-all border-2 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-gold-600 ${
                          checked ? 'border-gold-500! shadow-(--shadow-gold)' : 'hover:bg-(--surface-muted)'
                        }`}
                      >
                        <input
                          type="radio"
                          name="signup-role"
                          value={opt.id}
                          checked={checked}
                          onChange={() => setSignupRole(opt.id)}
                          className="sr-only"
                        />
                        <span
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${checked ? 'bg-gold-500 text-(--on-gold)' : 'bg-(--gold-tint) text-gold-600'}`}
                          aria-hidden
                        >
                          <Icon className="w-6 h-6" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-[17px] font-bold text-hi" style={{ fontFamily: 'var(--font-display)' }}>
                              {opt.title}
                            </span>
                            <span
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${checked ? 'bg-gold-500 border-gold-500' : 'border-(--stroke-dark)'}`}
                              aria-hidden
                            >
                              {checked && <Check className="w-4 h-4 text-(--on-gold)" strokeWidth={3} />}
                            </span>
                          </span>
                          <span className="block text-[14px] text-mid mt-0.5">{opt.desc}</span>
                          <ul className="mt-2.5 space-y-1">
                            {opt.points.map((p) => (
                              <li key={p} className="text-[13px] text-hi flex gap-2">
                                <span className="text-gold-600" aria-hidden>•</span>
                                {p}
                              </li>
                            ))}
                          </ul>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {signupRole === 'manager' && (
                <p className="text-[13px] text-mid mt-3 px-1">
                  Dopo la registrazione cerchi il tuo impianto e invii una richiesta: un amministratore la verifica
                  prima che tu possa modificare la scheda.
                </p>
              )}

              <div className="mt-5">
                <PillButton variant="gold" onClick={() => setPhase('register')}>
                  Continua come {signupRole === 'manager' ? 'gestore' : 'cittadino'}
                </PillButton>
              </div>
              <button
                type="button"
                onClick={() => setPhase('login')}
                className="mt-4 h-11 text-[15px] font-semibold text-mid hover:text-hi transition-colors text-center"
              >
                {t('auth.hasAccount')}
              </button>
            </div>
          </motion.div>
        )}

        {(phase === 'login' || phase === 'register') && (
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ type: 'spring', damping: 24, stiffness: 220 }}
            className="relative flex-1 flex flex-col items-center overflow-y-auto px-4 sm:px-6 pt-safe pb-safe"
          >
            <div className="w-full max-w-[420px] flex flex-col my-auto">
              <div className="pb-8 flex flex-col items-center shrink-0">
                <BrandLogo className="text-[38px]" />
                <p className="text-mid text-[15px] mt-3 text-center max-w-[290px] leading-snug">
                  {isRegister ? t('auth.register.subtitle') : t('auth.login.subtitle')}
                </p>
              </div>

              {/* Card del modulo */}
              <div className="card rounded-[28px] px-5 py-6 sm:px-7 sm:py-8">
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  {isRegister && (
                    <div className="flex items-center justify-between gap-2 rounded-2xl bg-(--gold-tint) px-4 py-3">
                      <span className="text-[14px] text-hi">
                        Account: <strong>{signupRole === 'manager' ? 'Gestore di impianto' : 'Cittadino'}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setPhase('role')}
                        className="text-[13px] font-bold text-gold-600 underline inline-flex items-center gap-1"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" aria-hidden /> Cambia
                      </button>
                    </div>
                  )}
                  {isRegister && (
                    <div>
                      <FieldLabel htmlFor="auth-name">Nome visualizzato</FieldLabel>
                      <div className={inputWrapClass}>
                        <User className="w-[18px] h-[18px] text-low shrink-0" aria-hidden />
                        <input
                          id="auth-name"
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          autoComplete="nickname"
                          maxLength={24}
                          placeholder={signupRole === 'manager' ? 'Es. ASD Tor Sapienza' : 'Es. Giulia'}
                          className={inputClass}
                        />
                      </div>
                      <p className="text-[12px] text-mid mt-1 ml-0.5">
                        È l’unico dato che gli altri vedono, solo se organizzi un’attività.
                      </p>
                    </div>
                  )}
                  <div>
                    <FieldLabel htmlFor="auth-email">{t('auth.email')}</FieldLabel>
                    <div className={inputWrapClass}>
                      <Mail className="w-[18px] h-[18px] text-low shrink-0" aria-hidden />
                      <input
                        id="auth-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        required
                        placeholder={t('auth.emailPlaceholder')}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <FieldLabel htmlFor="auth-password">{t('auth.password')}</FieldLabel>
                    <div className={inputWrapClass}>
                      <Lock className="w-[18px] h-[18px] text-low shrink-0" aria-hidden />
                      <input
                        id="auth-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete={isRegister ? 'new-password' : 'current-password'}
                        required
                        minLength={6}
                        placeholder="••••••••"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {isRegister && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <FieldLabel htmlFor="auth-confirm">{t('auth.confirmPassword')}</FieldLabel>
                      <div className={inputWrapClass}>
                        <Lock className="w-[18px] h-[18px] text-low shrink-0" aria-hidden />
                        <input
                          id="auth-confirm"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          autoComplete="new-password"
                          required
                          minLength={6}
                          placeholder="••••••••"
                          className={inputClass}
                        />
                      </div>
                    </motion.div>
                  )}

                  {error && (
                    <p role="alert" className="text-sm text-danger text-center font-semibold">{error}</p>
                  )}
                  {successMessage && (
                    <p role="status" className="text-sm text-success text-center font-semibold">
                      {successMessage}
                    </p>
                  )}

                  <div className="mt-1">
                    <PillButton
                      type="submit"
                      variant="gold"
                      disabled={!canSubmit}
                      loading={submitting}
                    >
                      {isRegister ? t('auth.register') : t('auth.submit')}
                    </PillButton>
                  </div>
                </form>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPhase(isRegister ? 'login' : 'role');
                  setError('');
                  setSuccessMessage('');
                }}
                className="mt-6 h-11 text-[15px] font-semibold text-mid hover:text-hi transition-colors text-center"
              >
                {isRegister ? t('auth.hasAccount') : t('auth.noAccount')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
