'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarDays, ChevronRight, KeyRound, Loader2, Settings, ShieldCheck } from 'lucide-react';

import { GlassIconButton } from '@/components/ui/GlassIconButton';
import { RingAvatar } from '@/components/ui/RingAvatar';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { ROLE_LABELS, type UserProfile } from '@/features/profile/types';

function NavRow({ href, icon: Icon, title, desc }: { href: string; icon: typeof CalendarDays; title: string; desc: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 p-4 hover:bg-(--surface-muted) transition-colors">
        <span className="w-11 h-11 rounded-2xl bg-(--gold-tint) flex items-center justify-center shrink-0" aria-hidden>
          <Icon className="w-5 h-5 text-gold-600" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-bold text-hi">{title}</span>
          <span className="block text-[13px] text-mid">{desc}</span>
        </span>
        <ChevronRight className="w-5 h-5 text-low" aria-hidden />
      </Link>
    </li>
  );
}

export function ProfileScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const p = await fetch('/api/profile');
      if (!p.ok) throw new Error('profile');
      setProfile(await p.json());
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-(--bg)" role="status">
        <span className="sr-only">Caricamento del profilo…</span>
        <Loader2 className="w-10 h-10 text-gold-500 animate-spin" aria-hidden />
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 bg-(--bg) px-8">
        <p className="text-mid text-sm text-center">Impossibile caricare il profilo.</p>
        <button type="button" onClick={load} className="h-11 px-5 rounded-xl bg-ink text-white font-bold">
          Riprova
        </button>
      </div>
    );
  }

  const username = profile.displayName ?? profile.email.split('@')[0] ?? 'utente';

  return (
    <div className="h-full overflow-y-auto bg-(--bg) pb-12">
      <div className="relative max-w-2xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between pt-safe pb-4">
          <GlassIconButton href="/" ariaLabel="Torna alla mappa" className="rounded-2xl!">
            <ArrowLeft className="w-5 h-5" aria-hidden />
          </GlassIconButton>
          <h1 className="text-[17px] font-bold text-hi" style={{ fontFamily: 'var(--font-display)' }}>
            Il mio profilo
          </h1>
          <GlassIconButton href="/profilo/account" ariaLabel="Impostazioni dell'account" className="rounded-2xl!">
            <Settings className="w-5 h-5" aria-hidden />
          </GlassIconButton>
        </div>

        <section className="card rounded-[28px] p-5 flex items-center gap-4">
          <RingAvatar initial={username.charAt(0).toUpperCase()} size="md" />
          <div className="min-w-0">
            <p className="text-[22px] font-bold text-hi leading-tight truncate" style={{ fontFamily: 'var(--font-display)' }}>
              {username}
            </p>
            <p className="text-sm text-mid mt-0.5">{ROLE_LABELS[profile.role]}</p>
          </div>
        </section>

        <ul className="card rounded-[28px] mt-4 overflow-hidden divide-y divide-(--stroke)">
          <NavRow href="/attivita?tab=mie" icon={CalendarDays} title="Le mie attività" desc="Quelle che organizzi e quelle a cui sei iscritto" />
          {profile.role !== 'admin' && (
            <NavRow
              href="/gestore"
              icon={KeyRound}
              title="Area gestore"
              desc={profile.role === 'manager' ? 'I tuoi impianti e le richieste di gestione' : 'Gestisci un impianto? Rivendicalo'}
            />
          )}
          {profile.role === 'admin' && (
            <NavRow href="/admin" icon={ShieldCheck} title="Pannello admin" desc="Rivendicazioni, fonti dati e proposte" />
          )}
        </ul>

        <button
          type="button"
          disabled={signingOut}
          onClick={async () => {
            setSigningOut(true);
            await signOut();
            router.replace('/');
          }}
          className="w-full mt-10 h-12 rounded-2xl card text-center text-sm font-bold text-danger hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          {signingOut ? 'Uscita in corso…' : 'Esci'}
        </button>
      </div>
    </div>
  );
}
