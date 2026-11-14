import { APP_NAME } from '@/lib/brand';
import type { Metadata } from 'next';

import { InfoPageShell, InfoSection } from '@/components/layout/InfoPageShell';

export const metadata: Metadata = {
  title: `Privacy — ${APP_NAME}`,
};

export default function PrivacyPage() {
  return (
    <InfoPageShell titleKey="profile.account.menu.privacy" subtitle="Ultimo aggiornamento: novembre 2026">
      <InfoSection title="Senza account">
        <p>Mappa, schede dei luoghi e bacheca delle attività si consultano senza registrarsi e senza cookie di profilazione.</p>
        <p>
          <strong className="text-hi">Posizione:</strong> la chiediamo solo quando premi “Vicino a me” e resta sul tuo
          dispositivo per filtrare i risultati. Non tracciamo i tuoi spostamenti.
        </p>
      </InfoSection>

      <InfoSection title="Con un account">
        <p>
          <strong className="text-hi">Account:</strong> email e nome visualizzato. L’email non è mai visibile agli altri
          utenti.
        </p>
        <p>
          <strong className="text-hi">Iscrizioni:</strong> chi organizza un’attività e gli altri iscritti vedono solo il
          numero dei posti occupati, mai i nomi o i contatti dei partecipanti.
        </p>
        <p>
          <strong className="text-hi">Gestori:</strong> per rivendicare un impianto indichi il nome dell’associazione o
          della società. Sulla scheda pubblica compare l’organizzazione, non la persona.
        </p>
      </InfoSection>

      <InfoSection title="Dati pubblici">
        <p>
          Le schede degli impianti nascono da fonti aperte (censimento della Città metropolitana di Roma, anagrafe
          dell’edilizia scolastica, elenchi delle concessioni). Ogni campo indica la sua fonte. Dalle concessioni
          importiamo solo i nomi delle organizzazioni, mai quelli di persone fisiche.
        </p>
      </InfoSection>

      <InfoSection title="I tuoi diritti">
        <p>
          Ai sensi del GDPR puoi chiedere in qualsiasi momento accesso, rettifica o cancellazione dei tuoi dati dalla
          pagina Assistenza. La cancellazione dell’account rimuove profilo e iscrizioni.
        </p>
      </InfoSection>
    </InfoPageShell>
  );
}
