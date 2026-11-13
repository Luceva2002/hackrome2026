import type { Metadata } from 'next';
import { Mail, MessageCircleQuestion, Siren } from 'lucide-react';

import { InfoPageShell, InfoSection } from '@/components/layout/InfoPageShell';

export const metadata: Metadata = {
  title: 'Assistenza — RomaInCampo',
};

export default function SupportPage() {
  return (
    <InfoPageShell
      titleKey="profile.account.menu.support"
      subtitle="Siamo qui per aiutarti. Rispondiamo di solito entro 48 ore."
    >
      <a
        href="mailto:supporto@romaincampo.example?subject=Richiesta%20assistenza%20RomaInCampo"
        className="glass-heavy rounded-3xl px-6 py-5 flex items-center gap-4 hover:bg-white/90 active:scale-[0.99] transition-all"
      >
        <span className="w-12 h-12 rounded-2xl bg-linear-to-b from-gold-400 to-gold-600 flex items-center justify-center shrink-0 shadow-[0_6px_18px_rgba(245,179,1,0.35)]">
          <Mail className="w-6 h-6 text-(--on-gold)" />
        </span>
        <span>
          <span
            className="block text-base font-bold text-hi"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Scrivici una email
          </span>
          <span className="block text-sm text-mid mt-0.5">
            supporto@romaincampo.example
          </span>
        </span>
      </a>

      <div className="glass rounded-3xl px-6 py-5 flex items-start gap-4 border-l-4 border-l-danger">
        <Siren className="w-6 h-6 text-danger shrink-0 mt-0.5" />
        <p className="text-sm leading-relaxed text-mid">
          <strong className="text-hi">Emergenze:</strong> RomaInCampo non sostituisce
          i servizi di soccorso. In caso di pericolo immediato chiama il{' '}
          <strong className="text-hi">112</strong>.
        </p>
      </div>

      <InfoSection title="Domande frequenti">
        <div className="space-y-4">
          <div>
            <p className="font-bold text-hi flex items-center gap-2">
              <MessageCircleQuestion className="w-4 h-4 text-gold-600" />
              Un dato della scheda è sbagliato o “da verificare”
            </p>
            <p className="mt-1">
              Molti dati pubblici sono datati. Se gestisci l’impianto, rivendicalo dalla scheda e
              aggiornalo tu: le fonti pubbliche non sovrascriveranno mai le tue modifiche.
            </p>
          </div>
          <div>
            <p className="font-bold text-hi flex items-center gap-2">
              <MessageCircleQuestion className="w-4 h-4 text-gold-600" />
              Il GPS non trova la mia posizione
            </p>
            <p className="mt-1">
              Controlla che il browser abbia il permesso di accedere alla posizione nelle
              impostazioni del telefono e che il GPS sia attivo.
            </p>
          </div>
          <div>
            <p className="font-bold text-hi flex items-center gap-2">
              <MessageCircleQuestion className="w-4 h-4 text-gold-600" />
              Come cambio username o password?
            </p>
            <p className="mt-1">
              Vai su Profilo → Impostazioni account: da lì puoi modificare username e password.
            </p>
          </div>
          <div>
            <p className="font-bold text-hi flex items-center gap-2">
              <MessageCircleQuestion className="w-4 h-4 text-gold-600" />
              Chi vede la mia iscrizione a un’attività?
            </p>
            <p className="mt-1">
              Nessuno: organizzatore e partecipanti vedono solo quanti posti sono occupati,
              mai i nomi o i contatti degli iscritti.
            </p>
          </div>
        </div>
      </InfoSection>
    </InfoPageShell>
  );
}
