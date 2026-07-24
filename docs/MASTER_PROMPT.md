# MASTER PROMPT — AI BUNDLE STUDIO

## 0. Scopo del prompt

Questo prompt avvia da zero lo sviluppo reale di **AI Bundle Studio**, una web app locale e privacy-first che trasforma una cartella o un archivio ZIP in un pacchetto di file ottimizzato per essere caricato e analizzato da Microsoft Copilot o da altri assistenti AI che non accettano direttamente archivi ZIP.

L’applicazione deve essere:

- interamente eseguita nel browser;
- priva di backend, database remoto, account e servizi cloud;
- distribuibile come sito statico su GitHub Pages;
- utilizzabile anche offline come PWA dopo il primo caricamento;
- progettata per non inviare mai i file dell’utente in rete;
- robusta su progetti grandi, entro i limiti reali della memoria e delle API del browser;
- trasparente sulle conversioni riuscite, parziali, degradate o impossibili.

Il progetto parte completamente da zero. Non esiste ancora alcun repository.

---

# 1. Mandato dell’agente

Agisci come un gruppo di lavoro senior coordinato da un Principal Software Engineer, ma non fingere processi paralleli o persone realmente esistenti. Esegui invece passaggi distinti e verificabili assumendo, nell’ordine necessario, i seguenti ruoli virtuali.

## Livello 0 — Direzione

### Product Director
Definisce il problema, l’esperienza utente, i casi d’uso, i limiti del prodotto e i criteri di successo.

### Principal Engineer
Detiene la coerenza architetturale, approva le dipendenze, risolve i compromessi e impedisce soluzioni fragili o eccessivamente complesse.

## Livello 1 — Responsabili di area

### Frontend Architecture Lead
Cura architettura React, TypeScript, stato, routing, componenti, accessibilità, design system e compatibilità browser.

### File Processing Lead
Cura acquisizione file, ZIP, virtual filesystem, classificazione MIME, hashing, parser, adapter e pipeline di conversione.

### Document Intelligence Lead
Cura PDF, Word, PowerPoint, immagini, fogli di calcolo, estrazione semantica e rappresentazioni per AI.

### Security & Privacy Lead
Cura isolamento locale, sanitizzazione, Zip Slip, zip bomb, macro, segreti, file corrotti, limiti e threat model.

### Performance Lead
Cura Web Workers, streaming, memoria, annullamento, progresso, sharding e gestione di input grandi.

### Quality Engineering Lead
Cura test unitari, integrazione, end-to-end, fixture, regression test, browser matrix e quality gate.

### Release & Documentation Lead
Cura Git, CI, GitHub Pages, PWA, documentazione, licenze, changelog e release.

## Livello 2 — Revisione indipendente

Al termine di ogni step esegui passaggi separati come:

1. implementatore;
2. revisore architetturale;
3. revisore sicurezza;
4. revisore test e regressioni;
5. validatore finale.

Non dichiarare mai un controllo eseguito se non lo hai eseguito realmente.

---

# 2. Principi non negoziabili

1. **Local-first e zero upload.** Tutta l’elaborazione deve avvenire nel browser. Nessun file, nome file, hash, telemetria o contenuto deve essere trasmesso a server esterni.

2. **Static hosting.** La build finale deve essere composta esclusivamente da asset statici compatibili con GitHub Pages.

3. **Progressive enhancement.** Le API browser avanzate possono migliorare l’esperienza, ma non devono essere l’unico modo per utilizzare l’app.

4. **Nessuna falsa universalità.** “Qualsiasi file” significa:
   - qualsiasi file può essere rilevato, classificato e inventariato;
   - solo i formati supportati possono essere convertiti completamente;
   - altri formati possono ricevere estrazione parziale, anteprima, metadati o semplice inventario;
   - nessun formato deve essere dichiarato convertito quando non lo è.

5. **Nessuna esecuzione del contenuto.** Script, macro, eseguibili, HTML attivo e allegati non devono mai essere eseguiti.

6. **Output deterministico.** A parità di input e impostazioni, il contenuto logico degli output deve essere stabile e testabile.

7. **Trasparenza.** Ogni file deve ricevere uno stato di conversione e una motivazione leggibile.

8. **Fail safely.** Un file corrotto o non supportato non deve bloccare l’intero progetto.

9. **Privacy verificabile.** L’interfaccia e il codice devono rendere evidente che il trattamento è locale.

10. **Qualità prima della quantità.** Non inserire librerie solo per dichiarare un formato supportato. Ogni adapter deve avere fixture e test.

---

# 3. Obiettivo del prodotto

L’utente deve poter:

1. trascinare un file ZIP;
2. selezionare uno ZIP tramite file picker;
3. selezionare più file;
4. selezionare una cartella tramite meccanismi compatibili con il browser;
5. ottenere una scansione preventiva del contenuto;
6. vedere il tree originale;
7. ricercare, filtrare, includere o escludere file e cartelle;
8. scegliere le strategie di conversione;
9. avviare la generazione;
10. seguire il progresso e annullare in sicurezza;
11. controllare errori, omissioni e avvisi;
12. scaricare separatamente gli output;
13. facoltativamente scaricare un archivio ZIP di conservazione locale, senza considerarlo parte del flusso destinato a Copilot.

---

# 4. Contratto degli output

La modalità standard produce tre famiglie logiche di output.

## 4.1 `<project>-documents.pdf`

Rappresentazione visiva e documentale.

Deve contenere, quando tecnicamente possibile:

- copertina;
- istruzioni sintetiche per l’assistente AI;
- riepilogo del progetto;
- indice navigabile o indice testuale con numeri di pagina;
- legenda degli stati;
- pagine separatrici per ogni file;
- percorso originale completo;
- tipo originale e tipo rilevato;
- dimensione originale;
- SHA-256 originale;
- stato della conversione;
- avvisi di fedeltà;
- PDF originali importati pagina per pagina;
- rappresentazioni derivate di DOCX;
- rappresentazioni derivate di immagini;
- anteprime di fogli complessi;
- contenuti visuali supportati;
- report finale dei file esclusi o non rappresentabili.

Non creare una singola pagina verticale enorme. Produrre un PDF multipagina standard e leggibile.

## 4.2 `<project>-content.md`

Rappresentazione semantica, testuale e orientata all’analisi AI.

Deve contenere:

- istruzioni d’uso;
- riepilogo;
- tree compatto;
- indice dei file;
- contenuto di codice, testo e configurazioni;
- dati tabellari;
- formule dei fogli di calcolo, quando disponibili;
- testo estratto dai documenti;
- note, commenti e metadati utili, quando disponibili;
- riferimenti al PDF e al manifest;
- errori e avvisi per file;
- ancore deterministiche;
- delimitatori robusti e non ambigui.

Ogni sezione deve riportare almeno:

- percorso originale;
- identificatore univoco;
- MIME rilevato;
- estensione;
- dimensione;
- hash;
- encoding rilevato o assunto;
- stato;
- eventuale troncamento;
- eventuale parte di output.

Per i blocchi di codice, scegliere dinamicamente delimitatori Markdown più lunghi di qualunque sequenza di backtick presente nel contenuto, oppure utilizzare un formato di delimitazione alternativo sicuro.

## 4.3 `<project>-manifest.json`

Indice autorevole e machine-readable.

Deve descrivere:

- versione dello schema;
- versione dell’app;
- data e ora;
- impostazioni usate;
- origine dell’input;
- riepilogo quantità e dimensioni;
- struttura completa delle directory;
- record di ogni file;
- output in cui è rappresentato;
- pagine PDF;
- ancore Markdown;
- stato di conversione;
- parser e versione logica dell’adapter;
- errori;
- warning;
- file esclusi;
- motivi delle esclusioni;
- segnalazioni di sicurezza;
- hash originali;
- eventuali hash degli output;
- statistiche;
- limiti applicati;
- informazioni sullo sharding.

Definire uno schema JSON versionato e validarlo prima del download.

---

# 5. Modalità di output

## Modalità “Tre file”

Tenta di produrre esattamente:

- un PDF;
- un Markdown;
- un JSON.

Prima dell’elaborazione mostra una stima e avvisa quando la scelta può generare output troppo grandi o ridurre l’affidabilità dell’analisi AI.

## Modalità “Multipart sicura”

Quando una famiglia supera una soglia configurabile, suddividerla:

- `<project>-documents.part-001.pdf`;
- `<project>-content.part-001.md`;
- `<project>-content.part-002.md`;
- `<project>-manifest.json`.

Il manifest deve rimanere il punto di ingresso unico e indicare tutte le parti.

Le soglie non devono essere codificate come verità universali. Devono essere configurabili, documentate e accompagnate da valori predefiniti prudenti.

## Modalità “Anteprima rapida”

Elabora solo:

- manifest;
- tree;
- README e documentazione principale;
- file di configurazione;
- campioni dei fogli;
- inventario dei file pesanti.

Serve per grandi archivi o analisi preliminari.

---

# 6. Matrice di capacità

Ogni formato deve ricevere uno dei seguenti livelli.

- **A — Conversione completa o quasi completa**
- **B — Estrazione strutturata**
- **C — Rappresentazione visiva derivata**
- **D — Metadati e inventario**
- **E — Non supportato o bloccato**

Il livello deve essere registrato per ogni file nel manifest.

## 6.1 Testo e codice

Supportare tramite adapter generico e registry estensioni:

- TXT, MD, RST;
- JSON, JSONC, JSONL;
- XML;
- YAML;
- TOML;
- INI e properties;
- CSV, TSV;
- HTML e CSS;
- JavaScript, TypeScript, JSX, TSX;
- Python;
- Java, Kotlin;
- C, C++, header;
- C#;
- Go;
- Rust;
- Swift;
- PHP;
- Ruby;
- shell, PowerShell, batch;
- SQL;
- Dockerfile;
- Makefile;
- file senza estensione riconosciuti;
- altri linguaggi tramite classificazione estensibile.

Requisiti:

- rilevamento ragionevole di binario contro testo;
- gestione UTF-8, BOM e fallback controllati;
- rilevamento e segnalazione di caratteri non decodificabili;
- numeri di riga opzionali;
- troncamento configurabile;
- esclusione globs;
- niente syntax highlighting nel file esportato se aumenta inutilmente la dimensione.

## 6.2 PDF

Requisiti:

- importare pagine originali senza rasterizzarle quando possibile;
- estrarre testo in parallelo per il Markdown;
- rilevare PDF cifrati, corrotti o protetti;
- non tentare bypass di password;
- mostrare errore per singolo file;
- mantenere separatori e mappatura pagina-percorso;
- preservare dimensioni pagina e orientamento quando possibile.

## 6.3 DOCX e formati Word

Per DOCX:

- estrarre struttura semantica;
- titoli, paragrafi, liste, tabelle, collegamenti e immagini supportate;
- generare HTML sanitizzato;
- generare testo/Markdown;
- produrre una rappresentazione PDF derivata;
- indicare chiaramente che la resa può non essere identica a Microsoft Word;
- conservare nel manifest warning di fedeltà;
- rilevare macro o varianti macro-enabled e non eseguirle.

Per DOC, RTF, ODT e altri formati:

- non promettere conversione completa nel browser;
- verificare librerie mature, licenze e dimensioni;
- in assenza di soluzione affidabile, limitarsi a metadati e inventario;
- documentare possibili estensioni future.

## 6.4 Fogli di calcolo

Gestire, in base alle capacità reali degli adapter scelti:

- XLSX;
- XLS;
- XLSM senza eseguire macro;
- CSV e TSV;
- ODS quando supportabile in modo affidabile.

Per ogni workbook estrarre:

- nomi dei fogli;
- ordine;
- stato visibile o nascosto;
- range utilizzato;
- valori;
- valori formattati;
- formule;
- tipi cella;
- righe e colonne;
- celle unite;
- commenti e note, se disponibili;
- nomi definiti, se disponibili;
- metadati di base;
- indicatori di grafici, pivot, collegamenti e feature non rappresentate.

Nel Markdown:

- creare una sezione per workbook e foglio;
- non generare tabelle ingestibili senza limiti;
- supportare modalità completa, paginata e campionata;
- includere formule accanto ai valori;
- indicare righe e colonne omesse.

Nel PDF:

- inserire anteprime leggibili dei fogli selezionati;
- suddividere tabelle larghe;
- non ridurre il testo a dimensioni illeggibili;
- offrire orientamento e scala configurabili.

## 6.5 Presentazioni

Per PPTX e formati simili:

- analizzare il pacchetto e i metadati senza eseguire contenuti;
- estrarre testo delle slide;
- estrarre note del relatore, quando accessibili;
- estrarre tabelle e media inventariabili;
- preservare ordine e numero delle slide;
- registrare relazioni e warning;
- generare un’anteprima visuale solo se esiste una soluzione client-side sufficientemente affidabile e testata;
- non fingere fedeltà grafica;
- in assenza di rendering affidabile, inserire nel PDF una pagina derivata per slide con testo, note, immagini estraibili e avviso di resa semplificata.

## 6.6 Immagini

Supportare almeno i formati che il browser e le librerie selezionate possono decodificare in sicurezza.

Requisiti:

- correggere orientamento quando possibile;
- leggere dimensioni;
- mantenere proporzioni;
- downsampling configurabile;
- limite di megapixel;
- evitare decompression bomb;
- inserire didascalia, percorso e metadati;
- preservare trasparenza quando il formato PDF lo consente;
- per formati non decodificabili, usare inventario.

## 6.7 Audio, video, 3D, CAD, database, eseguibili e binari

Non tentare conversioni universali.

Produrre:

- percorso;
- tipo dichiarato e rilevato;
- dimensione;
- hash;
- metadati ricavabili in sicurezza;
- stato D o E;
- motivazione;
- eventuali suggerimenti di esportazione esterna, senza effettuare upload.

Per SQLite, quando una libreria WASM matura e compatibile lo consente, valutare una modalità opzionale che estragga solo schema, nomi tabelle e statistiche, mai esecuzione di codice arbitrario.

## 6.8 Archivi annidati

- Inventariarli sempre.
- Non estrarli ricorsivamente per impostazione predefinita.
- Consentire ricorsione opzionale con profondità massima.
- Applicare limiti cumulativi.
- Bloccare archivi cifrati o non supportati con motivazione.
- Non supportare path assoluti, traversal o nomi pericolosi.

---

# 7. Acquisizione e virtual filesystem

Implementare un modello interno indipendente dalla provenienza dei file.

Ogni nodo deve avere:

- `id`;
- `path`;
- `normalizedPath`;
- `name`;
- `extension`;
- `kind`;
- `size`;
- `source`;
- `mimeDeclared`;
- `mimeDetected`;
- `lastModified`, se disponibile;
- `hash`, quando calcolato;
- `status`;
- `capabilityLevel`;
- `warnings`;
- `errors`;
- riferimento lazy ai byte;
- relazioni con output e conversioni.

Canali di input:

1. drag and drop;
2. input file multiplo;
3. input directory con fallback compatibile;
4. File System Access API come miglioramento opzionale;
5. caricamento ZIP;
6. caricamento di output precedentemente salvati per sola verifica futura, se previsto.

Non duplicare inutilmente i byte in memoria.

---

# 8. Pipeline

La pipeline deve essere esplicita, osservabile e interrompibile.

1. acquisizione;
2. preflight;
3. normalizzazione percorsi;
4. scansione sicurezza;
5. inventario;
6. classificazione;
7. stima memoria e output;
8. scelta adapter;
9. estrazione;
10. trasformazione;
11. generazione sezioni Markdown;
12. generazione pagine PDF;
13. generazione manifest;
14. validazione incrociata;
15. sharding;
16. hashing degli output;
17. download.

Ogni fase deve emettere:

- stato;
- percentuale o avanzamento determinabile;
- file corrente;
- quantità elaborate;
- warning;
- errori;
- tempo trascorso;
- possibilità di annullare.

L’annullamento deve rilasciare worker, buffer, object URL e risorse.

---

# 9. Architettura tecnica richiesta

## Stack preferito

Usa come baseline:

- React;
- TypeScript in modalità strict;
- Vite;
- PWA;
- Web Workers;
- test unitari e componenti;
- test end-to-end;
- GitHub Actions;
- GitHub Pages.

Prima di installare dipendenze:

1. verifica documentazione ufficiale;
2. verifica manutenzione recente;
3. verifica licenza;
4. verifica funzionamento browser;
5. verifica compatibilità con worker e build statica;
6. verifica dimensione del bundle;
7. verifica vulnerabilità note;
8. registra la decisione in `docs/DEPENDENCY_DECISIONS.md`.

Candidate da valutare, senza adottarle automaticamente:

- libreria ZIP client-side;
- motore PDF per lettura/rendering;
- libreria PDF per creazione e merge;
- parser DOCX semantico;
- parser fogli di calcolo;
- sanitizzatore HTML;
- rilevamento MIME/file signature;
- generatore Markdown;
- virtualizzazione UI;
- schema validator;
- PWA plugin.

Non inserire una dipendenza se una Web API standard risolve bene il problema.

## Moduli

Separare almeno:

- `app`;
- `ui`;
- `features/import`;
- `features/preflight`;
- `features/configuration`;
- `features/processing`;
- `features/results`;
- `core/vfs`;
- `core/pipeline`;
- `core/adapters`;
- `core/security`;
- `core/hash`;
- `core/output`;
- `workers`;
- `schemas`;
- `testing`;
- `docs`.

Ogni parser deve implementare una interfaccia comune.

Esempio concettuale:

```ts
interface FileAdapter {
  id: string;
  version: string;
  canHandle(file: VirtualFile): Promise<SupportDecision>;
  inspect(file: VirtualFile, context: AdapterContext): Promise<InspectionResult>;
  extract(file: VirtualFile, context: AdapterContext): Promise<ExtractionResult>;
  render?(file: VirtualFile, context: AdapterContext): Promise<RenderResult>;
}
```

Non copiare questa interfaccia ciecamente: raffinala durante lo STEP architetturale.

---

# 10. Elaborazione di file grandi

Requisiti:

- Web Workers per operazioni costose;
- messaggi tipizzati;
- transfer di `ArrayBuffer` quando appropriato;
- streaming quando disponibile;
- lettura lazy;
- backpressure;
- concorrenza limitata;
- coda prioritaria;
- stima memoria;
- soglie configurabili;
- preflight prima di allocazioni grandi;
- possibilità di rifiutare in modo sicuro input oltre i limiti;
- modalità campionata;
- sharding incrementale;
- rilascio esplicito di risorse;
- evitare un unico stato React contenente tutti i byte.

Valutare OPFS come ottimizzazione facoltativa, non come requisito unico.

Non promettere supporto per dimensioni arbitrarie. Mostrare:

- dimensione compressa;
- dimensione non compressa stimata;
- numero file;
- rapporto di compressione;
- memoria stimata;
- livello di rischio;
- suggerimento modalità.

---

# 11. Sicurezza e privacy

Creare `docs/THREAT_MODEL.md`.

Coprire almeno:

- Zip Slip e path traversal;
- path assoluti;
- separator confusion;
- Unicode e nomi equivalenti;
- null byte;
- nomi riservati;
- duplicati di percorso;
- directory depth abuse;
- zip bomb;
- file count bomb;
- compression ratio abuse;
- immagini enormi;
- PDF corrotti;
- XML entity attack, quando applicabile;
- HTML e SVG attivi;
- macro Office;
- formule pericolose esportate come testo;
- CSV injection;
- file eseguibili;
- worker denial of service;
- memory exhaustion;
- output formula injection;
- XSS nelle anteprime;
- dipendenze compromesse;
- supply-chain risk;
- service worker obsoleto;
- leakage tramite log;
- network requests involontarie.

Regole:

- normalizzare e validare ogni percorso;
- non scrivere mai fuori dallo spazio controllato;
- non interpretare HTML non sanitizzato;
- non caricare risorse remote contenute nei documenti;
- disabilitare link esterni attivi nelle anteprime, salvo visualizzazione testuale;
- non eseguire macro;
- non valutare formule;
- non aprire eseguibili;
- non usare `eval`;
- non usare HTML pericoloso senza sanitizzazione;
- non registrare contenuti sensibili nella console in produzione;
- usare CSP compatibile con GitHub Pages;
- preferire dipendenze bundle-locali;
- verificare che l’app funzioni senza rete dopo il caricamento.

## Scansione segreti

Implementare una funzione opzionale e trasparente che segnali:

- `.env`;
- chiavi private;
- token;
- password;
- connection string;
- credenziali cloud;
- file di configurazione sensibili;
- pattern ad alta entropia;
- nomi file notoriamente sensibili.

Prevedere:

- sola segnalazione;
- esclusione;
- redazione nella rappresentazione;
- nessuna modifica dell’originale;
- anteprima delle redazioni;
- conteggio;
- warning sui falsi positivi;
- registrazione nel manifest senza riportare il segreto.

---

# 12. Esperienza utente

Creare un’interfaccia professionale, sobria e accessibile.

## Flusso

### Schermata 1 — Introduzione

Mostrare:

- cosa fa lo strumento;
- elaborazione locale;
- nessun upload;
- formati e livelli;
- limiti;
- call to action.

### Schermata 2 — Importazione

- drag and drop;
- selezione ZIP;
- selezione cartella;
- selezione file;
- esempi;
- compatibilità browser;
- privacy indicator.

### Schermata 3 — Preflight

- metriche;
- tree virtualizzato;
- ricerca;
- filtri;
- dimensioni;
- formati;
- file esclusi;
- file sensibili;
- rischi;
- conversion capability;
- stima output.

### Schermata 4 — Configurazione

- modalità tre file/multipart/rapida;
- soglia dimensioni;
- profondità archivi;
- esclusioni;
- globs;
- redazione;
- immagini;
- fogli Excel;
- troncamento;
- inclusione del testo estratto;
- compatibilità AI target;
- lingua dell’output.

### Schermata 5 — Elaborazione

- pipeline;
- progresso;
- file corrente;
- log sintetico;
- warning;
- errori non bloccanti;
- pausa solo se implementabile correttamente;
- annulla.

### Schermata 6 — Risultati

- card per ogni output;
- dimensioni;
- hash;
- validazione;
- contenuto incluso;
- parti;
- download;
- copia del prompt consigliato per Copilot;
- report errori;
- possibilità di tornare alla configurazione.

## Accessibilità

Obiettivo WCAG 2.2 AA:

- tastiera completa;
- focus visibile;
- semantic HTML;
- etichette;
- live region per progresso;
- contrasto;
- reduced motion;
- responsive;
- screen reader;
- errori associati ai controlli;
- nessuna informazione affidata solo al colore.

## Design system

- componenti riutilizzabili;
- light e dark mode;
- layout responsive;
- nessuna animazione inutile;
- numeri e progressi leggibili;
- tree scalabile;
- niente dashboard sovraccarica;
- stato privacy sempre visibile;
- messaggi chiari per utenti non tecnici.

---

# 13. Manifest e riferimenti incrociati

Ogni file deve avere un `fileId` stabile derivato in modo deterministico dal percorso normalizzato e, quando utile, dall’hash.

Il manifest deve permettere di rispondere a:

- dove si trovava il file?
- in quale output è finito?
- in quali pagine PDF?
- in quale sezione Markdown?
- è completo?
- è stato troncato?
- è stato redatto?
- quale adapter lo ha gestito?
- quali warning esistono?
- è stato escluso?
- perché?
- qual è l’hash originale?

Creare test automatici di coerenza:

- ogni riferimento PDF punta a una pagina valida;
- ogni anchor Markdown esiste;
- ogni file incluso compare nel manifest;
- ogni esclusione ha un motivo;
- ogni parte dichiarata esiste;
- somme e conteggi sono coerenti;
- lo schema JSON è valido.

---

# 14. Prompt incorporato per l’assistente AI

All’inizio di `content.md` e nel manifest includere istruzioni concise, per esempio:

- leggere prima il manifest;
- considerare il manifest come indice autorevole;
- usare sempre i percorsi originali;
- non confondere file omonimi;
- consultare il PDF per il layout visivo;
- consultare il Markdown per testo, codice e tabelle;
- dichiarare quando un file è parziale;
- non assumere contenuti esclusi;
- citare percorso e sezione nelle risposte;
- attendere tutte le parti in modalità multipart.

L’app deve consentire di copiare un prompt di caricamento già pronto.

---

# 15. Compatibilità browser

Definire una browser matrix realistica.

Requisiti:

- supporto prioritario desktop moderno;
- fallback tramite `<input type="file">`;
- selezione cartella senza dipendenza esclusiva da una singola API;
- feature detection;
- messaggi chiari;
- nessun crash su API mancanti;
- test su Chromium, Firefox e WebKit tramite E2E quando tecnicamente possibile;
- documentare le differenze;
- non dichiarare compatibilità non testata.

---

# 16. Struttura repository iniziale

Crea realmente un repository Git.

Struttura minima da affinare:

```text
ai-bundle-studio/
├── .github/
│   └── workflows/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DECISIONS.md
│   ├── DEPENDENCY_DECISIONS.md
│   ├── FILE_SUPPORT_MATRIX.md
│   ├── PRODUCT_SPEC.md
│   ├── ROADMAP.md
│   ├── SECURITY.md
│   ├── TEST_MATRIX.md
│   └── THREAT_MODEL.md
├── public/
├── src/
│   ├── app/
│   ├── core/
│   ├── features/
│   ├── schemas/
│   ├── ui/
│   └── workers/
├── tests/
│   ├── fixtures/
│   ├── integration/
│   └── e2e/
├── .editorconfig
├── .gitignore
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
├── README.md
├── package.json
├── tsconfig.json
└── vite.config.ts
```

Aggiungere file necessari senza creare una struttura artificiale o eccessiva.

---

# 17. Documentazione operativa

Mantenere durante tutto il progetto:

## `docs/ROADMAP.md`

- step;
- stato;
- obiettivi;
- dipendenze;
- criteri di accettazione.

## `docs/DECISIONS.md`

ADR sintetiche per ogni decisione significativa.

## `docs/FILE_SUPPORT_MATRIX.md`

Per ogni formato:

- livello;
- adapter;
- dati estratti;
- PDF;
- Markdown;
- manifest;
- limiti;
- fixture;
- test;
- stato.

## `docs/TEST_MATRIX.md`

Test per browser, formato, sicurezza, dimensione e regressione.

## `CHANGELOG.md`

Aggiornato a ogni step concluso.

## `README.md`

Deve includere:

- problema;
- soluzione;
- privacy;
- demo;
- utilizzo;
- sviluppo;
- test;
- build;
- deploy;
- limiti;
- support matrix;
- screenshot finali;
- licenza.

---

# 18. Git e disciplina di sviluppo

- inizializzare Git;
- branch principale pulito;
- commit piccoli e semantici;
- Conventional Commits;
- niente segreti;
- niente file generati pesanti;
- lockfile versionato;
- dipendenze pin o range controllati secondo decisione documentata;
- lint, typecheck, test e build prima di chiudere ogni step;
- non committare un test fallito;
- non riscrivere la storia senza motivo;
- non pubblicare su GitHub senza richiesta esplicita dell’utente;
- preparare deploy GitHub Pages tramite Actions.

Ogni step deve terminare con:

- riepilogo;
- file creati/modificati;
- decisioni;
- test realmente eseguiti;
- risultato;
- problemi aperti;
- commit;
- prossima fase.

---

# 19. Quality gate

Uno step è concluso solo se:

1. codice compilabile;
2. TypeScript senza errori;
3. lint superato;
4. test pertinenti superati;
5. build produzione riuscita;
6. nessun warning critico ignorato;
7. documentazione aggiornata;
8. test manuale minimo eseguito quando necessario;
9. revisione sicurezza eseguita;
10. regressioni valutate;
11. Git pulito;
12. commit creato.

Non scrivere “completato” se uno dei controlli obbligatori non è stato effettuato. In tal caso dichiarare la consegna parziale.

---

# 20. Strategia di test

## Unit test

- path normalization;
- MIME detection;
- text/binary detection;
- tree;
- file IDs;
- hashing;
- globs;
- delimiter Markdown;
- sharding;
- schema manifest;
- redazione;
- limiti;
- progress events.

## Integration test

- ZIP misto;
- PDF multipli;
- DOCX;
- XLSX con formule;
- immagini;
- file omonimi;
- Unicode;
- cartelle profonde;
- file corrotti;
- archivi annidati;
- output multipart;
- annullamento.

## Security fixture

- `../`;
- path assoluti;
- backslash traversal;
- nomi duplicati;
- null byte simulato;
- rapporti compressione anomali;
- file count elevato controllato;
- HTML con script;
- SVG attivo;
- CSV injection;
- macro-enabled Office;
- segreti fittizi;
- immagini con dimensioni anomale;
- PDF cifrato;
- XML ostile.

Non creare veri payload dannosi. Usare fixture innocue che testano il comportamento difensivo.

## Golden tests

Confrontare:

- manifest;
- sezioni Markdown;
- mappatura PDF;
- conteggi;
- warning;
- output deterministici.

## E2E

- import;
- preflight;
- configurazione;
- elaborazione;
- annullamento;
- errori;
- download;
- refresh PWA;
- GitHub Pages base path.

---

# 21. Performance e budget

Definire benchmark misurabili durante STEP-000 e aggiornarli con dati reali.

Misurare almeno:

- tempo preflight;
- tempo hashing;
- tempo estrazione ZIP;
- memoria stimata;
- durata generazione PDF;
- durata generazione Markdown;
- dimensione bundle JS;
- tempo di interazione UI;
- regressioni.

Non fissare obiettivi irrealistici prima dei benchmark.

Usare dataset sintetici e fixture controllate:

- molti file piccoli;
- pochi file grandi;
- archivio misto;
- foglio grande;
- PDF lungo;
- immagini grandi;
- input corrotto.

---

# 22. PWA e offline

- service worker;
- app shell offline;
- nessuna cache dei file dell’utente senza scelta esplicita;
- nessun contenuto utente in Cache Storage;
- aggiornamento sicuro;
- indicatore offline;
- manifest PWA;
- icone;
- installabilità;
- reset dati;
- documentazione sulla persistenza;
- test che nessun file venga inviato in rete.

---

# 23. GitHub Pages

Preparare:

- `base` path dinamico o configurabile;
- routing compatibile con hosting statico;
- asset relativi corretti;
- workflow Actions;
- build riproducibile;
- artifact;
- deploy Pages;
- ambiente preview locale;
- documentazione del deploy;
- nessuna dipendenza da variabili server segrete.

---

# 24. Piano di sviluppo obbligatorio

## STEP-000 — Bootstrap, ricerca tecnica e baseline

- creare repository;
- definire nome finale;
- scaffold Vite + React + TypeScript;
- configurare qualità;
- creare documenti;
- verificare fattibilità;
- creare support matrix iniziale;
- scegliere dipendenze;
- prototipi tecnici minimi per ZIP, PDF, DOCX e XLSX;
- threat model iniziale;
- benchmark iniziale;
- roadmap;
- commit.

## STEP-001 — Design system e application shell

- layout;
- navigazione;
- temi;
- componenti;
- accessibilità;
- schermate vuote;
- responsive;
- test.

## STEP-002 — Input e virtual filesystem

- drag/drop;
- file;
- directory;
- ZIP;
- normalizzazione;
- tree;
- metadati;
- test traversal.

## STEP-003 — Preflight e capability engine

- classificazione;
- MIME;
- support level;
- stime;
- filtri;
- globs;
- rischi;
- UI preflight.

## STEP-004 — Manifest v1

- schema;
- generator;
- validator;
- tree;
- file mapping;
- test deterministici.

## STEP-005 — Pipeline testo e Markdown

- text/code adapters;
- encoding;
- anchors;
- delimitatori;
- troncamento;
- sharding;
- contenuto AI instructions.

## STEP-006 — Fogli di calcolo

- workbook parser;
- valori;
- formule;
- fogli;
- tabelle Markdown;
- anteprima PDF;
- limiti;
- fixture.

## STEP-007 — PDF e immagini

- PDF import;
- testo;
- separator pages;
- index;
- immagini;
- downsampling;
- mappatura pagine.

## STEP-008 — DOCX e documenti Office

- estrazione semantica;
- sanitizzazione;
- immagini;
- rendering derivato;
- warning fedeltà;
- macro flags;
- PPTX extraction fallback;
- support matrix aggiornata.

## STEP-009 — Sicurezza, segreti e resilienza

- scanner;
- redazione;
- limiti;
- zip bomb;
- XSS;
- CSV injection;
- cancellazione;
- error boundaries;
- threat tests.

## STEP-010 — Processing engine e worker orchestration

- workers;
- queue;
- progresso;
- cancel;
- concorrenza;
- memoria;
- cleanup;
- recovery.

## STEP-011 — Output, sharding e download

- tre file;
- multipart;
- stime;
- naming;
- hash;
- validazione incrociata;
- ZIP di conservazione opzionale.

## STEP-012 — UX completa e prompt Copilot

- configurazione;
- risultati;
- report;
- prompt copia;
- messaggi;
- onboarding;
- privacy indicator.

## STEP-013 — PWA, offline e GitHub Pages

- service worker;
- manifest;
- offline;
- workflow;
- base path;
- deploy test.

## STEP-014 — QA finale

- browser matrix;
- fixture corpus;
- E2E;
- a11y;
- performance;
- security review;
- bundle audit;
- docs.

## STEP-015 — Release 1.0

- changelog;
- versione;
- release notes;
- demo;
- licenze;
- SBOM o elenco dipendenze;
- artifact;
- tag;
- deploy finale, solo con autorizzazione.

---

# 25. Protocollo di esecuzione

Quando ricevi questo prompt:

1. non limitarti a proporre codice;
2. crea realmente il repository e i file;
3. esegui solo `STEP-000`;
4. non implementare prematuramente gli step successivi;
5. usa prototipi tecnici usa-e-getta solo quando servono a validare la fattibilità;
6. conserva nel prodotto solo il codice approvato;
7. esegui i quality gate;
8. crea il commit dello step;
9. presenta il report finale;
10. attendi il comando dell’utente: `Ora implementiamo STEP-001`.

Per gli step successivi l’utente userà:

```text
Ora implementiamo STEP-XXX
```

Prima di ogni implementazione:

1. rileggi prompt, roadmap, decisioni e stato repository;
2. controlla Git;
3. conferma lo scope dello step;
4. identifica rischi e regressioni;
5. implementa;
6. testa;
7. revisiona;
8. aggiorna documenti;
9. committa;
10. consegna il report.

---

# 26. Regole decisionali

- Non chiedere conferme per dettagli risolvibili con best practice.
- Se una scelta è reversibile, sceglila e documentala.
- Se una scelta cambia radicalmente prodotto, sicurezza o compatibilità, presentala nel report.
- Non aggiungere backend per semplificare.
- Non introdurre servizi cloud.
- Non inviare dati.
- Non sacrificare privacy per fedeltà.
- Non includere un formato nella matrice senza test.
- Non usare una libreria solo perché popolare.
- Non nascondere limitazioni.
- Non forzare tre file se il risultato è tecnicamente dannoso senza avvisare.
- Mantieni la modalità tre file come esperienza principale.
- Mantieni multipart come fallback professionale.
- Preferisci output AI-readable rispetto alla replica grafica perfetta.
- Conserva sempre il percorso originale.
- L’hash deve riferirsi ai byte originali, non alla rappresentazione derivata.
- Qualunque normalizzazione deve essere dichiarata.

---

# 27. Criteri di accettazione della versione 1.0

La release è accettabile solo quando:

- gira completamente in browser;
- funziona da GitHub Pages;
- nessun contenuto viene inviato in rete;
- accetta ZIP, file multipli e cartelle con fallback;
- produce manifest JSON valido;
- produce Markdown navigabile;
- produce PDF multipagina;
- supporta almeno testo/codice, PDF, immagini, DOCX e XLSX con livelli documentati;
- inventaria qualunque altro file;
- gestisce errori per file;
- implementa limiti di sicurezza;
- rileva path traversal;
- segnala segreti;
- supporta tre file e multipart;
- mostra progresso;
- consente annullamento;
- non blocca facilmente la UI;
- ha test unitari, integrazione ed E2E;
- supera accessibilità di base;
- dispone di threat model;
- dispone di documentazione completa;
- dispone di workflow GitHub Pages;
- non contiene segreti o telemetria;
- non presenta funzionalità simulate.

---

# 28. Prima risposta richiesta all’agente

Avvia immediatamente `STEP-000`.

Nella risposta finale dello step indica:

- repository creato;
- stack effettivo;
- architettura proposta;
- risultati dei prototipi;
- formati realmente fattibili;
- formati degradati;
- dipendenze accettate e rifiutate;
- rischi;
- benchmark iniziali;
- test eseguiti;
- output dei comandi;
- commit;
- prossima istruzione esatta.

Non dichiarare concluso STEP-000 senza repository reale, build riuscita, test di baseline, documentazione e commit.
