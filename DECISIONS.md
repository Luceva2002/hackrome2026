# Decisioni

Scelte prese durante l'hackathon quando c'era un dubbio. Vale sempre la più semplice che funziona.

## Prodotto
- **Nome provvisorio "RomaInCampo"**: il logo e il nome stanno in `src/components/brand/BrandLogo.tsx`, si cambiano in un punto solo.
- **Segnalazioni di CityAlert rimosse** (wizard, foto, voti, commenti, XP/monete/livelli). Le tabelle vecchie non vengono cancellate dallo schema: c'è `supabase/cleanup-cityalert.sql`, da eseguire a mano solo su un database dedicato. Le segnalazioni di *spazi informali* della community restano nel piano (fase 7) come punti con badge.
- **Step "Chi sei?" prima della registrazione**: l'utente sceglie Cittadino o Gestore di impianto. La scelta arriva al trigger `handle_new_user` in `raw_user_meta_data.signup_role`; `admin` non è mai auto-assegnabile. Il ruolo `manager` è solo il tipo di account: per modificare una scheda serve un claim approvato dall'admin su quell'impianto.
- **Chiunque abbia un account può creare un'attività** (SPEC: anche un volontario al parco). Se l'Owner è il gestore verificato del luogo, la bacheca lo indica.
- **Mappa, schede e bacheca pubbliche**: il login si chiede solo all'azione (`/auth?next=…` riporta indietro).

## Dati
- **Il censimento non ha coordinate**: le posizioni arrivano dal geocoding Mapbox (bbox di Roma, cache in `data/processed/geocode-cache.json`). Finché un indirizzo non è geocodificato la scheda compare nell'elenco con "Posizione da verificare" e non sulla mappa. OSM (priorità più alta per la posizione) non è ancora importato perché il file `data/raw/osm-roma.geojson` non c'è.
- **Municipio**: senza i confini dei 15 Municipi non si può fare il point-in-polygon, quindi la pipeline converte la vecchia numerazione a 20 con la tabella della riforma 2013 (confidenza 0,85, la scheda lo dice). Se si aggiunge `data/raw/municipi-roma.geojson` la pipeline usa automaticamente il point-in-polygon sulle coordinate.
- **Accessibilità**: "sì" solo dove il censimento dice "anche per div. abili" (21 impianti). Altrove è "da verificare", mai "no": l'assenza del dato non è un dato.
- **Stato**: INAGIBILE / RISTRUTTURAZIONE / REALIZZAZIONE / PROGETTAZIONE dal censimento; per tutti gli altri "da verificare" (il dato è precedente al 2013, non possiamo dire "attivo").
- **Tipologia** dedotta da nome e strutture (fonte "Elaborazione RomaInCampo", con confidenza). Le scuole sono riconosciute dalle sigle (I.C., S.M.S., C.D., Liceo…).
- **Righe malformate** (virgolette rotte nel CSV, 12 righe): l'impianto viene tenuto ma marcato "in revisione" con la nota.
- **Bootstrap**: il primo caricamento dei luoghi (`npm run db:seed`) scrive direttamente le schede, perché approvare 1.900 proposte "create" una per una non ha senso. Dalla seconda esecuzione in poi la pipeline produce solo `proposals`; il seed non tocca mai i luoghi già rivendicati da un gestore.
- **Fallback senza database**: l'API dei luoghi legge Supabase e, se è vuoto o non configurato, l'ultimo export della pipeline. La mappa resta dimostrabile anche offline dal database.

## Sicurezza e privacy
- Iscrizioni e lista d'attesa solo tramite le RPC `join_activity` / `leave_activity` (security definer, lock sulla riga dell'attività). Nessuno, Owner compreso, legge le iscrizioni altrui: la bacheca espone solo i contatori tramite la vista `activities_public`.
- Il gestore verificato aggiorna solo i dati operativi: il trigger `guard_venue_update` ripristina gli altri campi e marca quelli toccati in `manager_edited_fields`; `apply_proposal` li salta. Testato in `supabase/tests/rls.test.sql`.
- Contrasto: `--text-low` e `--gold-600` scuriti per arrivare ad AA su bianco; rimosso il blocco dello zoom nel viewport.

## Exa (ricerca web)
- Exa entra solo lato server e negli script (`src/lib/exa/`, `EXA_API_KEY` in `.env.local`, mai `NEXT_PUBLIC_`). Una ricerca `/search` con output strutturato per impianto: un campo è tenuto solo se il grounding di Exa cita almeno un URL, che diventa la fonte del campo. Il risultato è una `proposal`, mai una scrittura diretta. `npm run exa:venue` è una prova a secco.
