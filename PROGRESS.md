# Avanzamento

## Fase 1 · Schema, ruoli, RLS, seed, pulizia — ✓
Schema completo (luoghi, claim, attività, iscrizioni, fonti, snapshot, fonti di campo, proposte, log) con RLS, lista d'attesa atomica e regola di non-sovrascrittura; `supabase/tests/rls.test.sql` passa su Postgres 16.
Rimossi segnalazioni, voti, commenti e gamification di CityAlert; mappa e bacheca pubbliche; step "Chi sei?" (cittadino/gestore) prima della registrazione.
Seed idempotente `npm run db:seed`: fonti, 1.912 luoghi con le fonti dei campi, 3 account demo, claim approvato, 10 attività di esempio.

## Fase 2 · Pipeline censimento — ✓ (geocoding da lanciare)
`npm run pipeline:censimento` (anche `-- --limit 50`): 6.621 righe → 4.242 di Roma → 1.912 impianti, discipline normalizzate, stato e accessibilità dal testo, Municipio convertito, 116 in revisione, change detection SHA-256.
`npm run pipeline:geocode` geocodifica gli indirizzi con Mapbox (cache su file) e rigenera l'export.

## Fase 3 · Esplora Luoghi — ✓
Mappa con clustering nativo e colori per tipologia, filtri nell'URL (disciplina, tipologia, Municipio, natura, accessibilità, vicino a me), elenco navigabile da tastiera con annuncio dei risultati, scheda con la fonte e l'affidabilità di ogni campo.

## Fase 4 · Attività — API ✓, interfaccia → filone A (docs/SPLIT.md)
API bacheca filtrata (fuso di Roma), creazione, iscrizione e lista d'attesa via RPC atomiche, annullamento dell'Owner, "Le mie attività".
Geocoding verificato: scartati i falsi positivi (via diversa o altro comune); 1.563/1.912 impianti posizionati dopo il secondo passaggio (query strutturata).

## UI mobile liquid glass · ossatura — ✓
Dock in basso a tre elementi (Home↔Mappa, barra di ricerca che apre la tendina con filtri e risultati, assistente: tieni premuto per parlare, tocca per la chat) e profilo in alto a destra.
Nuova Home con "Consigliati per te" e "Vicino a te" in card stile annuncio, segnaposto dichiarato al posto delle foto; la mappa si sposta su `/mappa` con i filtri attivi in alto.
Punti di aggancio per Edo (`AssistantEngine`) e Fabi (`WebResults`, `recommendVenues`, foto con credito); divisione in tre in `docs/SPLIT.md`.
