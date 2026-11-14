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

## Design mobile · ricerca, mappa, tendine, foto — ✓
Regole di spazi e dimensioni come token (`docs/DESIGN.md`), liquid glass a tre strati, tendine a molla che galleggiano sopra il dock (che si fa da parte) con X, Esc e trascinamento per chiudere.
Ricerca con barra in cima e filtri a chip (sport, tipo di luogo, Municipio, gestione); mappa con pin a goccia che mostrano l'icona del tipo di luogo, gruppi con alone, chip delle tipologie come legenda, pulsante "la mia posizione".
Foto da Wikidata/Commons cercate all'apertura, accettate solo se vicine (≤ 250 m) e con nome compatibile, sempre con autore e licenza; scheda del luogo ridotta all'essenziale, il resto in "Tutti i dati e le fonti".

## Mappa al centro · SportInComune — ✓
Nome dell'app in un solo punto (`src/lib/brand.ts`). Tolti l'elenco dei luoghi e i filtri fissi sopra la mappa: si filtra solo dalla ricerca o a voce.
Mappa 3D inclinata con volo d'ingresso: da lontano prismi esagonali di densità al posto dei pallini dei gruppi, avvicinandosi punti colorati e poi pin con l'icona del tipo; un luogo si apre con un volo in prospettiva. Tendine come pannelli laterali su desktop.
Assistente con icona da agente e motore locale (voce del browser + comprensione di sport, luogo, Municipio, accessibilità, vicino a me): filtra la mappa, la fa volare e dice quanti luoghi ha trovato. Foto profilo personalizzabile (migration 030, ridimensionata e senza EXIF).

## Mappa per Municipi e quartieri — ✓
Da lontano i 15 Municipi in rilievo colorati e alti secondo il numero di luoghi, con nome e conteggio; avvicinandosi i 457 quartieri, rioni e zone di Roma Capitale con lo stesso schema; poi punti e pin. Un tocco su un'area ci vola dentro. I conteggi seguono i filtri (anche quelli dati a voce).
Confini da romaquartieri.it (Roma Capitale + OpenStreetMap) con credito; l'assistente capisce anche i quartieri ("palestre a Monti").
