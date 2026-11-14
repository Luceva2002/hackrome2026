Specifiche di Progetto: Piattaforma Mappatura Sportiva e Attività Vocal-First
1. Vision e Obiettivo del Progetto

Realizzare un'applicazione web/mobile dedicata alla mappatura, scoperta e organizzazione di attività sportive e motorie sul territorio (target iniziale: Roma e i suoi Municipi).
La piattaforma unisce dati pubblici ufficiali, arricchimento semantico automatizzato dal web (Exa) con strategie ottimizzate per l'hackathon, aggiornamenti diretti dei gestori e segnalazioni della community, separando in modo chiaro la scoperta dei luoghi (mappa interattiva) dalla scoperta degli eventi (pagina bacheca dedicata alle attività). L'elemento distintivo è l'accessibilità totale: ogni singola funzione dell'app (ricerca, filtri, navigazione tra viste, prenotazione, creazione di eventi o modifica delle schede) deve poter essere eseguita sia tramite interfaccia tradizionale sia interamente tramite comandi vocali, grazie a un agente conversazionale alimentato da ElevenLabs.
2. Ruoli Utente e Permessi

Il sistema gestisce l'autenticazione e i permessi tramite database relazionale (es. Supabase) distinguendo due profili principali, oltre a un ruolo amministrativo per la moderazione.

    Cittadino (Utente Base):

        Esplora la mappa dei luoghi e applica filtri combinati (disciplina sportiva, tipologia di struttura, Municipio, livello di accessibilità, natura pubblica o privata).

        Esplora la pagina dedicata alle attività e filtra gli eventi sportivi attivi.

        Segnala nuovi punti d'interesse informali inserendo direttamente tutti i dati in suo possesso (nome, indirizzo, tipologia, foto, orari, status pubblico/privato e feedback).

        Crea "Attività" pubbliche o aperte su invito (es. sessione di yoga al parco la domenica mattina), assumendo il ruolo di Owner dell'evento.

        Si iscrive come Guest alle attività create da altri cittadini.

        Interagisce con l'intera piattaforma tramite l'assistente vocale.

    Gestore (Proprietario / Concessionario di Impianto):

        Rivendica (claim) la proprietà o la concessione di un impianto già presente a sistema (previa verifica documentale o tramite codice/PEC) oppure ne censisce uno nuovo.

        Mantiene aggiornati i dati operativi della propria scheda: orari di apertura, discipline praticabili, stato di agibilità, tariffe, contatti e requisiti di accessibilità architettonica.

        Gestisce le proprie schede anche tramite comandi vocali (es. "Aggiorna l'orario del sabato fino alle 20:00").

    Admin / Moderatore:

        Approva le richieste di rivendicazione dei Gestori sugli impianti pubblici/privati per evitare furti d'identità o modifiche non autorizzate.

        Gestisce le segnalazioni di abuso o luoghi inesistenti inseriti dai cittadini.

3. Fonti Dati, Ottimizzazione Exa e Pipeline di Aggiornamento

I dataset pubblici forniscono la struttura anagrafica di base, mentre Exa agisce come motore di arricchimento semantico intelligente, progettato per rispettare i limiti di budget dell'hackathon.
Fonti Istituzionali di Partenza

    Censimento degli impianti sportivi comunali: dataset strutturato (CSV su portale Open Data comunale) con anagrafica, indirizzo, tipologia impianto e gestione.

    Anagrafe dell'Edilizia Scolastica (SNAES): dataset ministeriale (CSV/JSON) filtrato per estrarre esclusivamente gli istituti dotati di palestre o spazi sportivi utilizzabili in orario extrascolastico.

    Concessioni alle associazioni: elenchi pubblicati nelle sezioni Amministrazione Trasparente di Comune e Municipi (formati eterogenei: CSV, XLS o PDF).

Strategia di Arricchimento Exa ottimizzata per l'Hackathon (Zero Spreco Crediti)

Per evitare di esaurire i crediti gratuiti o bloccare l'app durante l'importazione massiva dei CSV, la piattaforma adotta un approccio ibrido:

    Importazione Anagrafica Pulita (Gratuita): I CSV vengono importati su Supabase salvando solo nome, indirizzo, coordinate e Municipio (senza chiamare Exa in blocco).

    Arricchimento Lazy (On-Demand): Exa viene interrogato in tempo reale solo quando un utente (o tu durante la demo) apre per la prima volta la scheda dettagliata di un impianto che ha campi vuoti. Il risultato viene immediatamente salvato in cache su Supabase, azzerando le chiamate superflue.

    Seed Dataset Pre-compilato (Il trucco da Demo): Per i 10-15 impianti chiave mostrati sul palco, i dati JSON di Exa vengono pre-caricati in un file di seed locale, garantendo una risposta istantanea al millisecondo durante la presentazione.

    Logica di Merge Additivo (User-First / Community Sovereign):

        Quando un cittadino segnala un nuovo luogo, inserisce autonomamente tutti i dati che possiede (nome, indirizzo, foto, orari, status pubblico/privato, feedback). Questi dati scritti dall'utente sono sovrani e immodificabili da parte dell'AI.

        Il job di Exa (attivato in background sulla segnalazione) agisce esclusivamente con logica "Riempibuchi" (Fill-in-the-Blanks): può popolare solo i campi lasciati vuoti dall'utente (es. link istituzionali, contatti web) o aggiungere fonti esterne, senza mai sovrascrivere foto, orari o scelte dichiarate dalla community.

Gerarchia di Sovrascrittura (Data Governance)
1. Gestore Verificato>2. Dati Inseriti dalla Community>3. Dati Ufficiali (CSV/SNAES)>4. Arricchimento Exa
1. Gestore Verificato>2. Dati Inseriti dalla Community>3. Dati Ufficiali (CSV/SNAES)>4. Arricchimento Exa
4. Funzionalità Core della Piattaforma
A. Esplora Luoghi: Mappa Unificata e Sistema di Filtri

La vista mappa principale è dedicata esclusivamente agli spazi fisici, con marker distinti per categoria:

    Impianti Ufficiali (pubblici, in concessione, privati, palestre scolastiche).

    Spazi Informali / Segnalati (parchi, campetti liberi, ciclabili, percorsi trekking/running tracciabili anche come linee/percorsi oltre che come singoli pin).

I filtri applicabili (sia via UI che a voce) includono:

    Disciplina / Corso (es. basket, nuoto, yoga, calisthenics, corsa, tennis — arricchiti anche dai dati trovati da Exa).

    Tipologia struttura (al chiuso, all'aperto, campo libero, palestra scolastica, centro sportivo, percorso).

    Territorio (filtro per Municipio o raggio chilometrico dalla posizione attuale).

    Accessibilità (presenza di rampe, spogliatoi accessibili, percorsi senza barriere, supporto disabilità).

    Natura spazio e Costi (Pubblico gratuito, Pubblico in concessione, Privato, fasce di prezzo).

B. Crowdsourcing e Segnalazione Luoghi

    Un cittadino può aggiungere un nuovo spazio sulla mappa (campetto, parco, ciclabile o palestra non censita) compilando un form completo con nome, indirizzo, tipologia, foto, orari stimati, natura pubblica/privata e proprio feedback.

    Il luogo compare subito sulla mappa con il badge "Segnalato dalla community" e, se applicabile, un job asincrono in background interroga Exa per aggiungere eventuali informazioni mancanti (senza toccare i dati immessi dal cittadino).

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

        Tool di lettura: cerca_impianti(filtri), cerca_attivita(filtri_evento), dettagli_luogo(id) (attiva l'arricchimento lazy via Exa se necessario), dettagli_attivita(id).

        Tool di azione (con conferma vocale prima della scrittura): crea_attivita(...), iscriviti_attivita(id_attivita), segnala_luogo(...), aggiorna_info_impianto(...) (riservato al ruolo Gestore).

    Sincronizzazione UI-Voce e Navigazione: L'agente controlla sia i filtri che la navigazione tra le viste. Se l'utente dice "Mostrami i campetti da basket accessibili nel Municipio XV", l'agente apre la Mappa e applica i filtri; se dice "Portami alla pagina attività e cercami yoga questo weekend con posti liberi", l'agente naviga sulla Pagina Attività, aggiorna i filtri a schermo e legge a voce le opzioni trovate, permettendo l'iscrizione immediata con un comando successivo (es. "Iscrivimi alla prima").

6. Roadmap di Sviluppo (Step e Task Operativi)
Step 1: Design del Database e Autenticazione (Supabase)

    Task 1.1: Definizione dello schema relazionale su Supabase (users, roles, venues con metadati di provenienza campo per campo e source_urls, venue_claims, activities e activity_participants con gestione posti e lista d'attesa).

    Task 1.2: Configurazione dell'estensione geospaziale (PostGIS su Supabase) per gestire ricerche nel raggio di X km, coordinate dei punti e tracciati (LineString) per ciclabili e percorsi trekking.

    Task 1.3: Implementazione delle policy di sicurezza (Row Level Security - RLS) per garantire che solo gli Owner possano modificare le proprie attività e solo i Gestori verificati possano editare le schede degli impianti.

Step 2: Pipeline Dati Pubblici e Arricchimento Exa (Lazy & Seed)

    Task 2.1: Analisi strutturale dei tracciati record reali (CSV del censimento impianti, CSV/JSON anagrafe edilizia scolastica, tabelle/documenti delle concessioni) e importazione anagrafica base gratuita.

    Task 2.2: Creazione del file di seed pre-compilato con i dati JSON di Exa per i luoghi chiave della demo.

    Task 2.3: Integrazione delle API di Exa con logica lazy on-demand (attivata alla prima visualizzazione del dettaglio luogo) e parser JSON strutturato per recuperare orari, discipline, corsi, tariffe e immagini.

    Task 2.4: Configurazione della logica di merge additivo (protezione dei dati inseriti dai cittadini e rispetto della gerarchia rispetto ai gestori).

Step 3: Backend API & Server MCP

    Task 3.1: Sviluppo delle API CRUD principali per ricerca filtrata luoghi, ricerca filtrata attività, segnalazione luoghi (con salvataggio sovrano dei dati utente), flusso di claim dei gestori e gestione iscrizioni/lista d'attesa.

    Task 3.2: Creazione del server MCP che incapsula tutte le operazioni dell'app come tool documentati, passando il token/contesto dell'utente autenticato per rispettare i permessi di ruolo (Cittadino vs Gestore).

Step 4: Integrazione Agente Vocale (ElevenLabs)

    Task 4.1: Configurazione dell'agente conversazionale con ElevenLabs per gestione turno di parola, interruzioni e sintesi vocale.

    Task 4.2: Collegamento dell'agente al server MCP e definizione dei prompt di sistema (inclusa la regola di richiedere conferma vocale prima di azioni di scrittura come creazione evento, iscrizione, segnalazione luogo o modifica impianto).

    Task 4.3: Implementazione del bridge eventi tra risposta dell'agente e stato dell'interfaccia (cambio automatico tra Mappa e Pagina Attività e aggiornamento dei relativi filtri in tempo reale).

Step 5: Frontend Web/Mobile (Mappa & Pagina Attività)

    Task 5.1: Sviluppo della vista Esplora Luoghi (Mappa) con clustering dei pin, rendering dei percorsi (ciclabili/trekking), pannello filtri, scheda luogo completa (con orari, corsi, costi, gallery e badge fonte dati) e form di segnalazione spazi informali.

    Task 5.2: Sviluppo della Pagina Dedicata alle Attività con feed filtrabile (data, fascia oraria, disciplina, livello, Municipio, posti liberi), dettaglio evento con mini-mappa, flusso di creazione (Owner), iscrizione (Guest) e tab "Le mie attività".

    Task 5.3: Sviluppo della dashboard dedicata ai Gestori (rivendicazione impianto e modifica dati prioritaria) e del pannello di moderazione Admin.

    Task 5.4: Integrazione del widget/pulsante vocale persistente e accessibile (screen-reader friendly, alto contrasto, attivabile da tastiera o tap).

Step 6: Testing e Validazione End-to-End per l'Hackathon

    Task 6.1: Test dei flussi completi sia via interfaccia grafica che esclusivamente via voce (es. segnalazione di un nuovo luogo, navigazione sulla pagina attività, filtro eventi e registrazione da zero solo parlando).

    Task 6.2: Verifica della tenuta dei permessi, della cache Exa e dei dati di seed pre-caricati per assicurare una demo impeccabile e priva di colli di bottiglia sul palco.
