import { APP_NAME } from '@/lib/brand';
import type { Metadata } from 'next';

import { InfoPageShell, InfoSection } from '@/components/layout/InfoPageShell';

export const metadata: Metadata = {
  title: `Termini e condizioni — ${APP_NAME}`,
};

export default function TermsPage() {
  return (
    <InfoPageShell titleKey="profile.account.menu.terms" subtitle="Ultimo aggiornamento: novembre 2026">
      <InfoSection title="1. Il servizio">
        <p>
          {APP_NAME} è la mappa dei luoghi dove fare sport a Roma e la bacheca delle attività aperte a tutti. I dati
          dei luoghi provengono da fonti pubbliche, dai gestori verificati e dalle segnalazioni della community: ogni
          campo indica da dove viene.
        </p>
        <p>
          I dati pubblici possono essere datati: quando un’informazione non è confermata la scheda la mostra come “da
          verificare”.
        </p>
      </InfoSection>

      <InfoSection title="2. Account e ruoli">
        <p>
          Per iscriverti o creare un’attività serve un account. Il gestore di un impianto può modificarne la scheda solo
          dopo che un amministratore ha approvato la sua richiesta.
        </p>
      </InfoSection>

      <InfoSection title="3. Attività">
        <p>
          Chi crea un’attività ne è responsabile e si impegna a pubblicare informazioni veritiere. {APP_NAME} non
          organizza le attività e non risponde del loro svolgimento.
        </p>
      </InfoSection>

      <InfoSection title="4. Uso corretto">
        <p>È vietato pubblicare luoghi inesistenti, spam, pubblicità ingannevole o contenuti illeciti.</p>
      </InfoSection>
    </InfoPageShell>
  );
}
