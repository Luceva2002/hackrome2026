# Decisioni

Scelte prese durante l'hackathon quando c'era un dubbio. Vale sempre la più semplice che funziona.

## Prodotto
- **Nome "SportInComune"**: nome, tagline e immagini del marchio stanno in `src/lib/brand.ts`, si cambiano in un punto solo.
- **Segnalazioni di CityAlert rimosse** (wizard, foto, voti, commenti, XP/monete/livelli). Le tabelle vecchie non vengono cancellate dallo schema: c'è `supabase/cleanup-cityalert.sql`, da eseguire a mano solo su un database dedicato. Le segnalazioni di *spazi informali* della community restano nel piano (fase 7) come punti con badge.
- **Step "Chi sei?" prima della registrazione**: l'utente sceglie Cittadino o Gestore di impianto. La scelta arriva al trigger `handle_new_user` in `raw_user_meta_data.signup_role`; `admin` non è mai auto-assegnabile. Il ruolo `manager` è solo il tipo di account: per modificare una scheda serve un claim approvato dall'admin su quell'impianto.
- **Chiunque abbia un account può creare un'attività** (SPEC: anche un volontario al parco). Se l'Owner è il gestore verificato del luogo, la bacheca lo indica.
- **Tutta l'app richiede il login**: senza account non si vede nulla, né pagine né API (`RequireAuth` nel layout di `(app)`, `requireAuth` nei GET). Pubbliche solo `/auth` e le pagine info (privacy, termini, supporto). Dopo il login `/auth?next=…` riporta alla pagina chiesta.

## Dati
- **Il censimento non ha coordinate**: le posizioni arrivano dal geocoding Mapbox (bbox di Roma, cache in `data/processed/geocode-cache.json`). Finché un indirizzo non è geocodificato la scheda compare nell'elenco con "Posizione da verificare" e non sulla mappa. OSM (priorità più alta per la posizione) non è ancora importato perché il file `data/raw/osm-roma.geojson` non c'è.
- **Municipio**: senza i confini dei 15 Municipi non si può fare il point-in-polygon, quindi la pipeline converte la vecchia numerazione a 20 con la tabella della riforma 2013 (confidenza 0,85, la scheda lo dice). Se si aggiunge `data/raw/municipi-roma.geojson` la pipeline usa automaticamente il point-in-polygon sulle coordinate.
- **Accessibilità**: "sì" solo dove il censimento dice "anche per div. abili" (21 impianti). Altrove è "da verificare", mai "no": l'assenza del dato non è un dato.
- **Stato**: INAGIBILE / RISTRUTTURAZIONE / REALIZZAZIONE / PROGETTAZIONE dal censimento; per tutti gli altri "da verificare" (il dato è precedente al 2013, non possiamo dire "attivo").
- **Tipologia** dedotta da nome e strutture (fonte "Elaborazione SportInComune", con confidenza). Le scuole sono riconosciute dalle sigle (I.C., S.M.S., C.D., Liceo…).
- **Righe malformate** (virgolette rotte nel CSV, 12 righe): l'impianto viene tenuto ma marcato "in revisione" con la nota.
- **Bootstrap**: il primo caricamento dei luoghi (`npm run db:seed`) scrive direttamente le schede, perché approvare 1.900 proposte "create" una per una non ha senso. Dalla seconda esecuzione in poi la pipeline produce solo `proposals`; il seed non tocca mai i luoghi già rivendicati da un gestore.
- **Fallback senza database**: l'API dei luoghi legge Supabase e, se è vuoto o non configurato, l'ultimo export della pipeline. La mappa resta dimostrabile anche offline dal database.

## Sicurezza e privacy
- Iscrizioni e lista d'attesa solo tramite le RPC `join_activity` / `leave_activity` (security definer, lock sulla riga dell'attività). Nessuno, Owner compreso, legge le iscrizioni altrui: la bacheca espone solo i contatori tramite la vista `activities_public`.
- Il gestore verificato aggiorna solo i dati operativi: il trigger `guard_venue_update` ripristina gli altri campi e marca quelli toccati in `manager_edited_fields`; `apply_proposal` li salta. Testato in `supabase/tests/rls.test.sql`.
- Contrasto: `--text-low` e `--gold-600` scuriti per arrivare ad AA su bianco; rimosso il blocco dello zoom nel viewport.

## UI mobile liquid glass
- **Niente foto di repertorio nelle card.** Una foto generica sembrerebbe il luogo vero: senza una foto con licenza e credito mostriamo un segnaposto per tipologia con "Nessuna foto disponibile".
- **"Consigliati per te" senza profilo.** Non abbiamo ancora preferenze utente: per ora consigliamo le schede più complete (gestore verificato, accessibilità dichiarata, attive) e lo diciamo nella card. Fabi può sostituire l'euristica mantenendo la firma.
- **Assistente segnaposto onesto.** Finché il motore ElevenLabs non c'è, il pulsante e la chat funzionano ma rispondono che l'assistente non è collegato, invece di simulare risposte.
- **Fabiola/Fabi.** Nella richiesta compaiono "Fabiola ed Edo (assistente)" e "Fabi (Exa)": abbiamo letto tre persone, Luca UI, Edo assistente, Fabi Exa. Da correggere in `docs/SPLIT.md` se diverso.

## Foto dei luoghi
- **Fonte: Wikidata + Wikimedia Commons, dal browser.** Le API Wikimedia accettano CORS, quindi la foto si cerca quando si apre la scheda o la card, senza un import da rilanciare. Il container di sviluppo non raggiunge Wikimedia: verificato solo il codice e il segnaposto, la ricerca vera va provata sul telefono.
- **Regola di accettazione.** Elemento Wikidata con foto entro 250 m e almeno una parola significativa in comune con il nome del luogo (escluse parole generiche come "centro sportivo", "palestra", "via"). Il motivo dell'abbinamento è nel `title` del credito. Meglio nessuna foto che quella di un altro posto.
- **Credito sempre visibile** (autore · licenza · Wikimedia Commons) con link alla pagina della foto.
- **Exa** può aggiungere un fornitore alla stessa catena (filone di Fabi), non un secondo sistema.

## Mappa e assistente (14 nov)
- **Densità 3D al posto dei gruppi.** I pallini numerati coprivano la città. Da lontano mostriamo prismi esagonali (~450 m) alti quanto il numero di luoghi: si capisce dove c'è offerta e dove manca. Il numero esatto si vede avvicinandosi.
- **Niente elenco.** Richiesta di Luca. L'alternativa accessibile alla mappa sono i risultati nella tendina di ricerca, navigabili da tastiera e lettore di schermo, con "Mostra altri".
- **Motore locale dell'assistente.** Finché non c'è il motore ElevenLabs di Edo, l'assistente usa la voce del browser (Web Speech API, dove disponibile) e capisce solo richieste di ricerca semplici, che diventano filtri reali; tutto il resto lo dichiara. Il contratto `AssistantEngine` riceve ora `act` (navigate, map, locate, count) da usare anche nel motore vero.
- **Nome SportInComune.** Luca ha scritto "spotrincomune": letto come refuso. Si cambia in `src/lib/brand.ts`.
- **Logo e icona da Higgsfield.** Generati in SVG, ma il container non scarica da cloudfront: l'app usa `public/brand/logo-mark.svg` e `public/brand/assistant.svg` se ci sono, altrimenti i segnaposto vettoriali.
- **Foto profilo.** Bucket `avatars` (lettura pubblica, scrittura solo nella propria cartella), URL nei metadati dell'utente. L'immagine è ritagliata a 512 px e ricodificata nel browser, quindi senza EXIF né posizione GPS.

## Municipi e quartieri sulla mappa (al posto dei prismi a esagoni)
- **Richiesta di Luca**: divisione come romaquartieri.it, prima per Municipio poi per quartiere. Codice nostro (Mapbox, non il loro MapLibre); dal repo `urbe-hub/quartieri-roma-2026` prendiamo solo i confini, con le loro condizioni: quartieri/rioni/zone della delib. 150/2026 di Roma Capitale (dati aperti, fonte citata), municipi da OpenStreetMap (ODbL, attribuzione). Credito nell'attribuzione della mappa e in `data/sources.json`. Il nome e il logo di Urbe Hub non si usano.
- **Conteggi**: Municipio dal campo del censimento (lo stesso dei filtri), quartiere per punto-nel-poligono. Sul campione, 169 luoghi su 1.563 hanno un Municipio nel censimento diverso da quello del poligono in cui cadono: è un segnale di qualità dei dati da rivedere (indirizzo o Municipio sbagliato).
- **Attribuzione Mapbox/OSM di nuovo visibile** (era nascosta da CityAlert: la licenza la richiede), sopra il dock.
- **Voce e quartieri**: "palestre a Monti" diventa "entro 1,5 km dal centro di Monti", detto esplicitamente, perché non esiste un filtro per quartiere.

## Gerarchia delle zone come Urbe Hub (14 nov, notte)
- **Livelli, non soglie di zoom.** I problemi di sincronizzazione (maschere e rilievi sfalsati durante i voli) venivano dal mostrare Municipi e quartieri in base allo zoom, che durante un volo automatico passa per tutte le soglie. Come nella vista 3D di Urbe Hub ora c'è uno stato esplicito Roma → Municipio → area: decide cosa si vede e dove va la camera, nello stesso render.
- **Porting, non import del modulo.** Il loro `vista-3d.js` (156 KB, MapLibre, etichette in HTML, intro a mosaico) è legato alla loro pagina; per le 14 abbiamo riportato su Mapbox la logica (gerarchia, H_TIPO, velo al 58%) con nota di copyright e licenza MIT in THIRD_PARTY.md. Se l'integrazione con romaquartieri.it va avanti, il contratto naturale è il loro `Vista3D.apri({ aree, municipi, palette, selezione, onSeleziona })`.
- **Colori**: un colore per Municipio dalla palette del design (oro, blu, viola, ciano, verde, arancio, rosa e vicini di tono), non la rampa crema-arancio; dentro un Municipio le aree sono sfumature del suo colore, più piene dove ci sono più luoghi.
- **Conteggio del Municipio** = somma delle sue aree (punto nel poligono), coerente con la mappa.
- **Colori e resa di Urbe Hub** (richiesta di Luca, la mappa interessa anche a loro): `MAPPA_PALETTE` per i 15 Municipi, contorno scurito 0,62, riempimento 42% (26% da vicino), retino per le zone funzionali, confini amaranto, velo `#1C2024` 38% fuori dal livello. Roma resta in rilievo; Municipio e quartiere sono a terra, così nessun rilievo copre i luoghi.
- **Luoghi per livello, non per zoom**: punti nel Municipio scelto, pin nel quartiere scelto (e nel Municipio oltre zoom 14,5). A Roma con al più 60 risultati tutto va a terra e si vedono i pin.
- **Allontanarsi molto con le dita risale di livello** (1,6 livelli di zoom sotto l'inquadratura automatica): quartiere → Municipio → Roma.
- **Non verificato col fondo Mapbox vero**: dal cloud Mapbox è bloccato; i livelli sono stati provati con uno stile vuoto. Resta da guardare su telefono: leggibilità del velo sopra il fondo e etichette.
## Exa (ricerca web)
- Exa entra solo lato server e negli script (`src/lib/exa/`, `EXA_API_KEY` in `.env.local`, mai `NEXT_PUBLIC_`). Una ricerca `/search` con output strutturato per impianto: un campo è tenuto solo se il grounding di Exa cita almeno un URL, che diventa la fonte del campo. Il risultato è una `proposal`, mai una scrittura diretta. `npm run exa:venue` è una prova a secco.
- Exa è una fonte in `sources` (`exa_web`, migration `020_exa_fonte_web.sql`): `POST /api/exa/venues/[id]` (solo admin) crea una proposta con orari, telefono e sito; prezzi e descrizione restano fuori perché `apply_proposal` non li applica.
- Voce: strumento `cerca_sul_web` → `POST /api/exa/search` (`type: lite` per la latenza, 5 risultati, limite di 10 ricerche al minuto per IP). L'LLM passa sempre `query` e `objective`. Ciò che trova serve a rispondere citando il sito, mai a scrivere sulle schede.
- Giro di verifica (14 nov): `npm run exa:audit` controlla un campione (luoghi delle attività demo, con gestore, poi centri sportivi/piscine/campi) con `/search` `type: deep` e schema di 8 campi: stato, nome attuale, orari, telefono, sito, `cost`/`cost_price`/`cost_note` (formato di `031_cost.sql`, fonte unica sotto la chiave `cost`). "Chiuso" diventa `inagibile` perché lo schema non ha "chiuso"; la nota della fonte lo dice.
- Luoghi gratuiti mancanti: `npm run exa:free-places` usa l'Agent API (è costruzione di una lista), `effort: auto`, tetto di 5 $. Un luogo resta solo se il suo `source_url` è tra le citazioni del run, l'indirizzo passa la regola del geocoding del censimento con un Municipio, e non c'è già un luogo entro 150 m con una parola del nome in comune. Diventa una proposta `create` con id `exa-<slug>`; il payload include tutti i campi not null perché `jsonb_populate_record` ignora i default.
