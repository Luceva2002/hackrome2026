# SportInComune

La mappa di tutti i luoghi dove fare sport a Roma, con la fonte di ogni dato, e la bacheca delle attività aperte a tutti. Nato per HackRome 2026 sulla base di CityAlert (Next.js 15, React 19, Supabase, Mapbox, Tailwind v4 "Liquid Civic").

## Avvio rapido

```bash
npm install
cp .env.example .env.local          # Supabase + Mapbox
npm run dev                         # http://localhost:3000
```

Serve Supabase configurato: tutta l'app richiede il login. Se la tabella dei luoghi è vuota, l'API legge l'ultimo export della pipeline (`data/processed/venues.json`).

## Database

1. Supabase → SQL Editor → esegui `supabase/schema.sql` (idempotente).
2. Aggiungi `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` ed esegui `npm run db:seed`: fonti, luoghi, account demo (credenziali in `.env.example`) e 10 attività di esempio.
3. Modalità ospite: esegui `supabase/migrations/033_guest.sql` e attiva Authentication → Sign In / Providers → **Allow anonymous sign-ins** (consigliato anche il CAPTCHA, perché ogni ospite crea un utente anonimo). Senza questa opzione "Visualizza come ospite" funziona lo stesso, solo con un cookie.
4. Facoltativo, solo su un database dedicato: `supabase/cleanup-cityalert.sql` elimina le tabelle di CityAlert.

Test di permessi e lista d'attesa su un Postgres locale:

```bash
psql -f supabase/tests/supabase-shim.sql && psql -f supabase/schema.sql && psql -f supabase/tests/rls.test.sql
psql -f supabase/migrations/031_cost.sql -f supabase/migrations/032_report_venue.sql -f supabase/migrations/033_guest.sql -f supabase/tests/guest.test.sql
```

## Pipeline dati

```bash
npm run pipeline:censimento          # CSV → data/processed/venues.json (salta se l'hash non cambia)
npm run pipeline:censimento -- --limit 50
npm run pipeline:geocode             # indirizzi → coordinate (Mapbox, cache su file)
```

Fonti registrate in `data/sources.json`. Le scelte sui dati sono in `DECISIONS.md`, l'avanzamento in `PROGRESS.md`, la visione in `docs/SPEC.md`.

## Ruoli

- **Cittadino** (default): esplora, si iscrive, crea attività.
- **Gestore**: rivendica un impianto; dopo l'approvazione dell'admin ne aggiorna i dati operativi. Le fonti pubbliche non sovrascrivono mai i suoi campi.
- **Admin**: approva i claim, modera, applica le proposte della pipeline.

Owner e Guest non sono ruoli ma relazioni sulle attività.
