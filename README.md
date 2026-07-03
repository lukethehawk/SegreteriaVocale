# SegreteriaVocale

Generatore locale di messaggi per segreteria telefonica con Google Cloud Text-to-Speech, anteprima voce, musica di sottofondo e download in WAV.

## Cosa fa

- permette di salvare la chiave Google TTS nel `localStorage` del browser;
- usa un backend locale Node.js come ponte verso Google Text-to-Speech;
- carica dinamicamente le voci italiane con `voices.list`;
- supporta le famiglie voce disponibili per `it-IT`, incluse Chirp 3 HD, Chirp HD, Neural2, Wavenet e Standard;
- permette anteprima voce e filtro per famiglia voce;
- mixa una traccia audio caricata localmente come sottofondo;
- esporta il risultato finale in WAV;
- salva in locale solo preferenze UI e contatore caratteri.

## Requisiti

- Node.js 18 o superiore.
- Una API key Google Cloud con Cloud Text-to-Speech API abilitata.

## Setup locale

1. Avvia l'app:

   ```bash
   npm run dev
   ```

   Se PowerShell blocca `npm.ps1`, usa uno di questi comandi:

   ```bash
   npm.cmd run dev
   node server.js
   ```

2. Apri:

   ```text
   http://localhost:5173
   ```

3. Incolla la chiave API nella pagina e premi `Salva chiave`.

## Note Google Text-to-Speech

La lista voci non e piu hardcoded nel frontend. Il server chiama:

```text
GET https://texttospeech.googleapis.com/v1/voices?languageCode=it-IT
```

La sintesi usa:

```text
POST https://texttospeech.googleapis.com/v1/text:synthesize
```

Questo rende il progetto piu facile da mantenere: se Google aggiunge o cambia voci italiane, l'app le legge dal servizio invece di richiedere una modifica manuale nel codice.

## Chiave API

La chiave viene salvata nel `localStorage` del browser e inviata al server locale solo nelle chiamate verso `/api/voices` e `/api/synthesize`. Il server non la scrive su disco e non la inserisce nel repository.

In alternativa, per uso locale o automazioni puoi ancora impostare `GOOGLE_TTS_API_KEY` in `.env.local` o come variabile d'ambiente.

## Struttura

```text
.
├── index.html
├── server.js
├── src/
│   ├── app.js
│   └── styles.css
├── .env.example
├── .gitignore
└── package.json
```
