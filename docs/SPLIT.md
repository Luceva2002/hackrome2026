# Lavoro in tre, in parallelo

Base comune: `main` con l'ossatura della nuova UI mobile in liquid glass (dock in basso, Home, Mappa, tendine). Ognuno lavora su un branch suo partendo da `main` aggiornato:

```bash
git checkout main && git pull
git checkout -b feat/ui          # Luca · feat/assistente (Edo) · feat/exa (Fabi, esiste già)
```

## Prima di partire (una persona, 10 minuti)
1. Supabase → SQL Editor → esegui `supabase/schema.sql`, poi `supabase/migrations/*.sql` in ordine.
2. In `.env.local` aggiungi `SUPABASE_SERVICE_ROLE_KEY` → `npm run db:seed` (luoghi, 3 account demo, 10 attività).
3. Passa `.env.local` agli altri **fuori dal repo** (con `NEXT_PUBLIC_MAPBOX_TOKEN`, senza la mappa resta vuota). Credenziali demo in `.env.example`.

## Com'è fatta la UI adesso
```
┌ TopBar: logo ················· profilo (→ /profilo) ┐
│                                                     │
│   /inizio    Home: "Consigliati per te", "Vicino a te"│
│   /mappa   Mappa con filtri attivi ed elenco         │
│                                                     │
└ BottomDock: (Home↔Mappa)  [ Cerca un luogo ]  (🎙) ┘
```
- **Sinistra** `BottomDock` → link `/inizio` ↔ `/mappa` (`/` apre la mappa). Su desktop l'assistente sta in basso a destra.
- **Centro** apre `SearchSheet` (tendina dal basso): barra di ricerca in cima, filtri sotto, risultati dal vivo, "Mostra N luoghi sulla mappa", slot `WebResults`.
- **Destra** `AssistantButton`: tenuto premuto (350 ms, o Spazio) parla, tocco (o Invio) apre `AssistantSheet` con la chat.
- Niente foto finte: senza foto con fonte la `VenueCard` mostra un segnaposto dichiarato ("Nessuna foto disponibile").

## Luca · UI e schermate (`feat/ui`)
**Possiede:** `src/components/{shell,ui,layout,brand}/**`, `src/features/{home,venues/components,profile,auth}/**`, `src/app/(app)/**` (tranne quanto sotto), `src/app/globals.css`.
- Regole di spazi, vetro e tendine in `docs/DESIGN.md`: rispettarle anche nelle nuove schermate.
- Rifinire il liquid glass (dock, tendine, top bar), animazioni con `prefers-reduced-motion`, contrasto AA.
- Profilo in alto a destra: dati personali + pannello essenziale (ruolo, le mie attività, gestore, admin se admin, esci).
- Schermate attività (API pronte): `/attivita` bacheca con filtri **nell'URL** (`paramsToActivityFilters`), `/attivita/[id]` con Iscriviti/Annulla, `/attivita/nuova?luogo=<id>` dentro `RequireAuth`, `/attivita?tab=mie`.
- `/gestore` (claim + modifica dati) e `/admin` (claim, proposte con `apply_proposal`, fonti): pagine semplici, le RPC ci sono già.

## Edo · Assistente vocale e chat (`feat/assistente`)
**Possiede:** `src/features/assistant/**`, `src/lib/{tools,agent}/**`.
- Scrivere il motore vero che implementa `AssistantEngine` (`src/features/assistant/engine.ts`) con `@elevenlabs/react` e client tools; registrarlo passando `engineFactory` ad `AssistantProvider` (in `src/components/shell/AppShell.tsx`, l'unica riga fuori dalla sua cartella).
- Registry `src/lib/tools/` (nome, schema zod, handler): `naviga`, `cerca_impianti`, `cerca_attivita`, `dettagli_luogo`, `dettagli_attivita`, `crea_attivita`, `iscriviti_attivita`, `cerca_sul_web` (già pronto in `src/lib/exa/web-search.ts` su `feat/exa`).
- Navigare con `router.push` sugli URL dei filtri (`filtersToSearchParams`, `activityFiltersToParams`): la mappa e la Home si aggiornano da sole. Scritture solo via API, con conferma a voce.
- Prompt in `src/lib/agent/voice-prompt.md` (+ `src/lib/exa/voice-prompt-web-search.md`). La chat scritta usa lo stesso motore.

## Fabi · Ricerca delle informazioni via Exa (`feat/exa`)
**Possiede:** `src/lib/exa/**`, `src/app/api/exa/**`, `scripts/exa/**`, `src/features/search/web/**`, `src/features/home/recommend.ts`, `src/features/photos/**`, `supabase/migrations/*_exa_*.sql`.
- `WebResults` (`src/features/search/web/WebResults.tsx`): sotto i luoghi nella tendina di ricerca, chiama `POST /api/exa/search {query, objective}` e mostra titolo + sito. Sempre la fonte, mai scritture sulle schede.
- `recommendVenues(all, ctx)` in `src/features/home/recommend.ts`: oggi euristica sui dati completi. Può usare preferenze utente e fatti Exa, **stessa firma**, `reason` sempre vero.
- Foto dei luoghi: nessuna ricerca su Wikipedia/Wikimedia (tolta su richiesta); senza foto si vede l'illustrazione segnaposto `VenuePlaceholder`. Un fornitore Exa (foto dal sito ufficiale, con URL della pagina come fonte) si aggiunge a `PHOTO_PROVIDERS` in `src/features/photos/use-venue-photo.ts` con la firma `PhotoProvider`. Senza foto verificata resta il segnaposto.
- Fatti sugli impianti (orari, contatti, sito) → solo `proposals` con fonte `exa_web`, approvate dall'admin.

## Contratti (non cambiarli senza avvisare)
- **Assistente:** `AssistantEngine {startVoice, stopVoice, sendText, dispose}` + callback `onStatus`, `onMessage({id, role, text, at, sources?})` e `act {navigate(url), map: mapBridge, locate(), count(filters)}`. Oggi gira `createLocalEngine` (voce del browser + `local-intents.ts`), da tenere come riserva.
- **Mappa:** `mapBridge.send({type: 'flyTo'|'overview'|'fitResults'|'tour'|'orbit', …})` in `src/features/map/map-bridge.ts`; filtri e luogo selezionato sempre via URL `/mappa?…&luogo=<id>`. Stati: `idle | connecting | listening | thinking | speaking | error`.
- **Shell:** `useShell() → {searchOpen, openSearch, closeSearch}` · `useAssistant() → {status, messages, chatOpen, openChat, closeChat, startVoice, stopVoice, sendText}`.
- **Foto:** `PhotoProvider = (venue, signal) => Promise<VenuePhoto | null>`, `VenuePhoto {url, credit, sourceUrl, alt, provider, match}`.
- **Home:** `recommendVenues(all, {location?, disciplines?}, limit) → {venue, reason?, distanceKm?}[]`.
- **Ricerca web:** `<WebResults query={string} />` · `POST /api/exa/search {query, objective} → {results: [{title, url, site, highlights}]}`, 503 senza chiave, 429 oltre 10/min.
- **URL** — Mappa: `/mappa?q&disciplina&tipo&municipio&accessibile=1&natura&vicino=lat,lng,km&luogo=<id>` · Attività: `/attivita?quando=oggi|domani|weekend|settimana&fascia=mattina|pomeriggio|sera&disciplina&livello&municipio&posti_liberi=1&accessibile=1&luogo&tab=mie`, `/attivita/[id]`, `/attivita/nuova?luogo=<id>`.
- **API pronte:** `GET /api/venues` · `GET /api/venues/[id]` (con `fields` = fonte di ogni campo) · `GET|POST /api/activities` · `GET|PATCH /api/activities/[id]` · `POST|DELETE /api/activities/[id]/join` → `{status:'confirmed'|'waitlist'}` · `GET /api/activities/mine`.

## File condivisi (modifiche piccole, avvisando nel gruppo)
`src/lib/sports/taxonomy.ts`, `src/components/shell/AppShell.tsx`, `src/app/globals.css`, `.env.example`, `package.json`. `supabase/schema.sql` non si tocca: nuovo SQL in `supabase/migrations/NNN_<cosa>.sql`. `DECISIONS.md` e `PROGRESS.md`: solo righe aggiunte.

## Ordine di merge su `main`
1. **Fabi · `feat/exa`** per primo (è già pronto, Edo ha bisogno di `cerca_sul_web`): `git rebase main` e merge.
2. **Luca · `feat/ui`** a pezzi piccoli, anche più volte al giorno (gli altri due ci appoggiano sopra).
3. **Edo · `feat/assistente`**: lavora sul contratto con il motore segnaposto, unisce quando parla davvero.

Prima di unire: `git rebase main`, `npm run typecheck && npm run build`, 3 righe in `PROGRESS.md`.

## Stato dei dati
1.912 impianti di Roma; 1.563 con posizione verificata, gli altri in elenco come "Posizione da verificare". Un risultato del geocoding è accettato solo se contiene la via cercata ed è nel Comune di Roma. 349 restano da verificare: candidati per un terzo passaggio con OSM/Nominatim.
