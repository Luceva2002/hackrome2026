Specifiche di Progetto: Piattaforma Mappatura Sportiva e Attività Vocal-First
1. Vision e Obiettivo del Progetto

Realizzare un'applicazione web/mobile dedicata alla mappatura, scoperta e organizzazione di attività sportive e motorie sul territorio (target iniziale: Roma e i suoi Municipi).
La piattaforma unisce dati pubblici ufficiali, aggiornamenti diretti dei gestori e segnalazioni della community, separando in modo chiaro la scoperta dei luoghi (mappa interattiva) dalla scoperta degli eventi (pagina bacheca dedicata alle attività). L'elemento distintivo è l'accessibilità totale: ogni singola funzione dell'app (ricerca, filtri, navigazione tra viste, prenotazione, creazione di eventi o modifica delle schede) deve poter essere eseguita sia tramite interfaccia tradizionale sia interamente tramite comandi vocali, grazie a un agente conversazionale alimentato da ElevenLabs.
2. Ruoli Utente e Permessi

Il sistema gestisce l'autenticazione e i permessi tramite database relazionale (es. Supabase) distinguendo due profili principali, oltre a un ruolo amministrativo per la moderazione.

    Cittadino (Utente Base):

        Esplora la mappa dei luoghi e applica filtri combinati (disciplina sportiva, tipologia di struttura, Municipio, livello di accessibilità, natura pubblica o privata).

        Esplora la pagina dedicata alle attività e filtra gli eventi sportivi attivi.

        Segnala nuovi punti d'interesse informali sulla mappa (parchi pubblici, campetti di quartiere, piste ciclabili, percorsi di corsa o trekking).

        Crea "Attività" pubbliche o aperte su invito (es. sessione di yoga al parco la domenica mattina), assumendo il ruolo di Owner dell'evento.

        Si iscrive come Guest alle attività create da altri cittadini.

        Interagisce con l'intera piattaforma tramite l'assistente vocale.

    Gestore (Proprietario / Concessionario di Impianto):

        Rivendica (claim) la proprietà o la concessione di un impianto già presente a sistema tramite i dati pubblici (previa verifica documentale o tramite codice/PEC) oppure ne censisce uno nuovo.

        Mantiene aggiornati i dati operativi della propria scheda: orari di apertura, discipline praticabili, stato di agibilità, tariffe, contatti e requisiti di accessibilità architettonica.

        Gestisce le proprie schede anche tramite comandi vocali (es. "Aggiorna l'orario del sabato fino alle 20:00").

    Admin / Moderatore:

        Approva le richieste di rivendicazione dei Gestori sugli impianti pubblici/privati per evitare furti d'identità o modifiche non autorizzate.

        Gestisce le segnalazioni di abuso o luoghi inesistenti inseriti dai cittadini.

3. Fonti Dati e Pipeline di Aggiornamento Automatico

Il database iniziale viene popolato e mantenuto sincronizzato incrociando tre fonti istituzionali:

    Censimento degli impianti sportivi comunali: dataset strutturato (formato CSV su portale Open Data comunale) contenente anagrafica, indirizzo, tipologia impianto e gestione.

    Anagrafe dell'Edilizia Scolastica (SNAES): dataset ministeriale (CSV/JSON) filtrato per estrarre esclusivamente gli istituti dotati di palestre o spazi sportivi utilizzabili in orario extrascolastico.

    Concessioni alle associazioni: elenchi pubblicati nelle sezioni Amministrazione Trasparente di Comune e Municipi (formati eterogenei: CSV, XLS o PDF).

Flusso di ingestione e pulizia (Data Pipeline):

    Monitoraggio periodico: Un job schedulato (cron job / worker) interroga periodicamente gli endpoint ufficiali o le pagine sorgente verificando la data di ultimo aggiornamento o l'hash del file per scaricare solo le nuove versioni.

    Parsing e Normalizzazione: Moduli dedicati convertono i file eterogenei (parser CSV/Excel e estrattori strutturati per eventuali PDF tabellari) in un unico schema dati coerente.

    Deduplicazione e Geocoding: Il sistema incrocia gli indirizzi e i codici identificativi per evitare duplicati (es. lo stesso impianto presente sia nel censimento sia nell'elenco concessioni) e converte gli indirizzi in coordinate geografiche (lat, lng) per il posizionamento su mappa.

    Regola di sovrascrittura: Se un Gestore verificato ha aggiornato manualmente un dato (es. orari o telefono), l'aggiornamento automatico dai dataset pubblici non deve sovrascrivere le modifiche recenti del gestore, ma aggiornare solo i metadati istituzionali (es. scadenza della concessione).

4. Funzionalità Core della Piattaforma
A. Esplora Luoghi: Mappa Unificata e Sistema di Filtri

La vista mappa principale è dedicata esclusivamente agli spazi fisici, evitando sovraffollamento visivo, con marker distinti per categoria:

    Impianti Ufficiali (pubblici, in concessione, privati, palestre scolastiche).

    Spazi Informali / Segnalati (parchi, campetti liberi, ciclabili, percorsi trekking/running tracciabili anche come linee/percorsi oltre che come singoli pin).

I filtri applicabili (sia via UI che a voce) includono:

    Disciplina (es. basket, nuoto, yoga, calisthenics, corsa, tennis).

    Tipologia struttura (al chiuso, all'aperto, campo libero, palestra scolastica, centro sportivo, percorso).

    Territorio (filtro per Municipio o raggio chilometrico dalla posizione attuale).

    Accessibilità (presenza di rampe, spogliatoi accessibili, percorsi senza barriere, supporto disabilità).

    Natura spazio (Pubblico gratuito, Pubblico in concessione, Privato).

B. Crowdsourcing e Segnalazione Luoghi

    Un cittadino può aggiungere un nuovo spazio informale direttamente dalla mappa indicando posizione (o tracciando un percorso), tipologia (parco, campetto, ciclabile, trail), foto/descrizione e livello di accessibilità.

    I luoghi segnalati entrano subito con un badge "Segnalato dalla community" e ricevono conferme/feedback dagli altri utenti (sistema di reputazione o validazione comunitaria).

C. Pagina Dedicata alle Attività (Bacheca Eventi, Owner & Guest)

Una sezione separata e dedicata interamente agli eventi sportivi organizzati dagli utenti, accessibile dalla navigazione principale o tramite comando vocale:

    Visualizzazione a Bacheca (Feed): Lista di schede evento dettagliate con informazioni immediate su disciplina, data/ora, luogo ospitante (con mini-mappa contestuale e link diretto alla mappa generale), livello richiesto, profilo dell'Owner e contatore posti disponibili.

    Sistema di Filtri Dedicato:

        Data e Fascia Oraria: oggi, domani, questo weekend, fascia mattutina/pomeridiana/serale.

        Disciplina e Livello: sport praticato e livello richiesto (principiante, intermedio, avanzato, aperto a tutti).

        Territorio e Tipologia Luogo: Municipio, raggio di distanza dall'utente, o tipo di location (al chiuso, parco pubblico, campetto, percorso).

        Disponibilità e Accessibilità: filtro per mostrare solo attività con posti ancora liberi e filtro sull'accessibilità architettonica del luogo ospitante.

    Creazione Attività (Owner): Dalla pagina Attività (o direttamente dalla scheda di un luogo sulla mappa) qualsiasi cittadino può avviare un nuovo evento collegandolo a un luogo esistente, definendo titolo, descrizione, disciplina, data/ora, livello e tetto massimo di partecipanti, diventando Owner.

    Partecipazione (Guest): Gli altri cittadini si registrano come Guest con un tap o tramite comando vocale fino all'esaurimento dei posti disponibili (con lista d'attesa automatica e notifiche di conferma/cancellazione).

    Tab "Le mie attività": Vista interna alla pagina dove l'utente gestisce sia gli eventi creati come Owner (modifica orari, gestione partecipanti, annullamento) sia quelli a cui è iscritto come Guest.

5. Architettura dell'Agente Vocale (ElevenLabs + MCP)

Per garantire che l'app sia completamente navigabile e utilizzabile senza toccare lo schermo:

    Interfaccia Vocale (ElevenLabs): Gestisce il riconoscimento vocale in ingresso (Speech-to-Text) e la sintesi vocale naturale in uscita (Text-to-Speech) con bassa latenza, fungendo da interfaccia conversazionale bidirezionale.

    Architettura Tool / MCP (Model Context Protocol): Esporre le funzionalità del backend tramite un server MCP permette all'agente LLM di invocare strumenti deterministici per leggere e scrivere sul database rispettando i ruoli utente.

        Tool di lettura: cerca_impianti(filtri), cerca_attivita(filtri_evento), dettagli_luogo(id), dettagli_attivita(id).

        Tool di azione (con conferma vocale prima della scrittura): crea_attivita(...), iscriviti_attivita(id_attivita), segnala_luogo(...), aggiorna_info_impianto(...) (riservato al ruolo Gestore).

    Sincronizzazione UI-Voce e Navigazione: L'agente controlla sia i filtri che la navigazione tra le viste. Se l'utente dice "Mostrami i campetti da basket accessibili nel Municipio XV", l'agente apre la Mappa e applica i filtri; se dice "Portami alla pagina attività e cercami yoga questo weekend con posti liberi", l'agente naviga sulla Pagina Attività, aggiorna i filtri a schermo e legge a voce le opzioni trovate, permettendo l'iscrizione immediata con un comando successivo (es. "Iscrivimi alla prima").

6. Roadmap di Sviluppo (Step e Task Operativi)
Step 1: Design del Database e Autenticazione (Supabase)

    Task 1.1: Definizione dello schema relazionale su Supabase (users, roles, venues per impianti e luoghi segnalati, venue_claims per le richieste dei gestori, activities e activity_participants con gestione posti e lista d'attesa).

    Task 1.2: Configurazione dell'estensione geospaziale (PostGIS su Supabase) per gestire ricerche nel raggio di X km, coordinate dei punti e tracciati (LineString) per ciclabili e percorsi trekking.

    Task 1.3: Implementazione delle policy di sicurezza (Row Level Security - RLS) per garantire che solo gli Owner possano modificare le proprie attività e solo i Gestori verificati possano editare le schede degli impianti.

Step 2: Pipeline Dati Pubblici (Ingestion & Parsing)

    Task 2.1: Analisi strutturale dei tracciati record reali (CSV del censimento impianti, CSV/JSON anagrafe edilizia scolastica, tabelle/documenti delle concessioni).

    Task 2.2: Sviluppo degli script di parsing e normalizzazione in un formato JSON/SQL unificato.

    Task 2.3: Implementazione del servizio di geocoding e deduplicazione per popolare il database iniziale senza doppioni.

    Task 2.4: Configurazione di un worker schedulato per il controllo periodico delle fonti ufficiali e l'aggiornamento incrementale (rispettando le modifiche manuali dei gestori).

Step 3: Backend API & Server MCP

    Task 3.1: Sviluppo delle API CRUD principali per ricerca filtrata luoghi, ricerca filtrata attività, flusso di claim dei gestori e gestione iscrizioni/lista d'attesa.

    Task 3.2: Creazione del server MCP che incapsula tutte le operazioni dell'app come tool documentati, passando il token/contesto dell'utente autenticato per rispettare i permessi di ruolo (Cittadino vs Gestore).

Step 4: Integrazione Agente Vocale (ElevenLabs)

    Task 4.1: Configurazione dell'agente conversazionale con ElevenLabs per gestione turno di parola, interruzioni e sintesi vocale.

    Task 4.2: Collegamento dell'agente al server MCP e definizione dei prompt di sistema (inclusa la regola di richiedere conferma vocale prima di azioni di scrittura come creazione evento, iscrizione o modifica impianto).

    Task 4.3: Implementazione del bridge eventi tra risposta dell'agente e stato dell'interfaccia (cambio automatico tra Mappa e Pagina Attività e aggiornamento dei relativi filtri in tempo reale).

Step 5: Frontend Web/Mobile (Mappa & Pagina Attività)

    Task 5.1: Sviluppo della vista Esplora Luoghi (Mappa) con clustering dei pin, rendering dei percorsi (ciclabili/trekking), pannello filtri e form di segnalazione spazi informali.

    Task 5.2: Sviluppo della Pagina Dedicata alle Attività con feed filtrabile (data, fascia oraria, disciplina, livello, Municipio, posti liberi), dettaglio evento con mini-mappa, flusso di creazione (Owner), iscrizione (Guest) e tab "Le mie attività".

    Task 5.3: Sviluppo della dashboard dedicata ai Gestori (rivendicazione impianto e modifica dati) e del pannello di moderazione Admin.

    Task 5.4: Integrazione del widget/pulsante vocale persistente e accessibile (screen-reader friendly, alto contrasto, attivabile da tastiera o tap).

Step 6: Testing e Validazione End-to-End

    Task 6.1: Test dei flussi completi sia via interfaccia grafica che esclusivamente via voce (es. navigazione sulla pagina attività, filtro eventi e registrazione da zero solo parlando).

    Task 6.2: Verifica della tenuta dei permessi (un cittadino non deve poter modificare i dati di un impianto né a voce né via UI).
