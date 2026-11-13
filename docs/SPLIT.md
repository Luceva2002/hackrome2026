# Lavoro in tre, in parallelo

Base comune: `main` (fasi 1–3 + API attività). Ognuno parte da `main` aggiornato su un branch suo:

```bash
git checkout main && git pull
git checkout -b feat/attivita        # A · oppure feat/gestore-admin (B) · feat/voce-pipeline (C)
```

## Prima di partire (una persona, 10 minuti)
1. Supabase → SQL Editor → esegui `supabase/schema.sql`.
2. In `.env.local` aggiungi `SUPABASE_SERVICE_ROLE_KEY` → `npm run db:seed` (luoghi, 3 account demo, 10 attività).
3. Passa `.env.local` agli altri due **fuori dal repo**. Credenziali demo in `.env.example`.

## A · Attività (fase 4 UI) — API già pronte
**Possiede:** `src/app/(app)/attivita/**`, `src/features/activities/**`, `src/app/api/activities/**`.
- `/attivita` bacheca: filtri **nell'URL** letti con `paramsToActivityFilters` (vincolo: la voce ci naviga). Card con "N posti liberi su M" / "Completo · lista d'attesa".
- `/attivita/[id]`: mini-mappa (Mapbox Static Images), link al luogo `/?luogo=<id>`, Iscriviti/Annulla (senza login → `/auth?next=…`), l'Owner annulla l'attività.
- `/attivita/nuova` (dentro `RequireAuth`), precompilato da `?luogo=<id>`, ricerca luogo su `/api/venues?q=`.
- `/attivita?tab=mie`: `GET /api/activities/mine` → organizzo / partecipo (confermato o in attesa).

## B · Gestore e Admin (fase 5) + spazi della community (fase 7)
**Possiede:** `src/app/(app)/gestore/**`, `src/app/(app)/admin/**`, `src/features/{manager,admin,community}/**`, `src/app/api/{claims,admin,community}/**`, il `PATCH` in `src/app/api/venues/[id]/route.ts`, `supabase/migrations/*_b_*.sql`.
- `/gestore`: i miei claim, form di rivendicazione da `?luogo=<id>`, modifica dati operativi dei miei impianti verificati.
- `/admin`: claim in attesa (RPC `review_claim`), proposte (RPC `apply_proposal`, mostra i campi saltati), fonti + "Controlla aggiornamenti", log live (Realtime su `ingestion_events`).
- Segnalazione spazio informale come punto (`kind = spazio_informale`, `community = true`): migration con RPC o policy di insert.

## C · Voce e pipeline (fase 6) + adattatori (fase 7)
**Possiede:** `src/lib/{tools,agent,pipeline}/**`, `src/features/voice/**`, `scripts/pipeline/**`, `data/**`; tocca solo la riga del pulsante vocale in `src/app/(app)/layout.tsx`.
- Registry `lib/tools/` (nome, schema zod, handler): naviga, cerca_impianti, cerca_attivita, dettagli_luogo, dettagli_attivita, crea_attivita, iscriviti_attivita, segnala_luogo, aggiorna_info_impianto. Navigazione con `router.push` sugli URL dei filtri (`filtersToSearchParams`, `activityFiltersToParams`); scritture via API con la sessione utente e conferma vocale.
- `@elevenlabs/react` con client tools, pulsante persistente accessibile, prompt in `lib/agent/voice-prompt.md`.
- `src/lib/pipeline/check-source.ts` → `checkSource(sourceId)`; adattatori mim, concessioni, generico → solo `proposals`.
- Secondo passaggio di geocoding degli indirizzi senza posizione.

## Contratti (non cambiarli senza avvisare)
**URL** — Luoghi: `/?q&disciplina&tipo&municipio&accessibile=1&natura&vicino=lat,lng,km&luogo=<id>` · Attività: `/attivita?quando=oggi|domani|weekend|settimana&fascia=mattina|pomeriggio|sera&disciplina&livello&municipio&posti_liberi=1&accessibile=1&luogo&tab=mie`, `/attivita/[id]`, `/attivita/nuova?luogo=<id>`.

**API pronte:** `GET /api/venues` (stessi parametri) · `GET /api/venues/[id]` (con `fields` = fonte di ogni campo) · `GET|POST /api/activities` (`createActivitySchema`) · `GET|PATCH /api/activities/[id]` (`{status:'cancelled'}`, solo Owner) · `POST|DELETE /api/activities/[id]/join` → `{status:'confirmed'|'waitlist'}`, 401 senza login, 409 con `message` · `GET /api/activities/mine` → `{organizzo, partecipo}`.

**API che fa B (le usa C):** `PATCH /api/venues/[id]` `{opening_hours?, phone?, website?, prices?, description?, disciplines?, status?, accessibility?, accessibility_notes?}` → `{venue}`, 403 se non gestore verificato · `POST /api/claims` `{venue_id, org_name, role_in_org?, evidence?}` · `GET /api/claims/mine` · `POST /api/community/venues` `{name, kind, latitude, longitude, disciplines[], accessibility, description}`.

**Funzione che fa C (la usa B):** `checkSource(sourceId): Promise<{changed: boolean; proposals: number; message: string}>`. Nel frattempo B usa uno stub.

## File condivisi (modifiche piccole, avvisando)
`src/lib/sports/taxonomy.ts`, `src/components/layout/AppNav.tsx`, `src/app/globals.css`, `src/lib/i18n/**`. `supabase/schema.sql` non si tocca: nuovo SQL in `supabase/migrations/NNN_<filone>_<cosa>.sql`. `DECISIONS.md` e `PROGRESS.md`: solo righe aggiunte.

## Ordine di merge su `main`
1. **A** (nessuna dipendenza, è la demo) → 2. **B** → 3. **C** (chiama A e B; sviluppa in parallelo sui contratti).
Prima di unire: `git rebase main`, `npm run typecheck && npm run build`, 3 righe in `PROGRESS.md`. Rifinitura demo (fase 8) tutti insieme dopo l'ultimo merge.

## Stato dei dati
1.912 impianti di Roma; 1.563 con posizione verificata, gli altri in elenco come "Posizione da verificare". Un risultato del geocoding è accettato solo se contiene la via cercata ed è nel Comune di Roma. Due passaggi di geocoding fatti (Mapbox libero + strutturato); 349 restano da verificare: candidati per un terzo passaggio con OSM/Nominatim.
