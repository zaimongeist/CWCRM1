# Personal CRM (Mini-Salesforce Engine)

> Motore CRM headless/web-first essenziale, orientato alla gestione della pipeline ad alto valore, tracciamento relazioni chiave e monitoraggio rigoroso del deal flow, senza il bloatware tipico delle piattaforme enterprise.

---

## 1. Vision & Core Philosophy

Questo sistema è progettato per ottimizzare l'esecuzione commerciale e il mantenimento delle relazioni critiche con il minimo attrito di inserimento dati.

* **Zero Fluff**: Nessun modulo superfluo (marketing automation di massa, ticketing complesso, ticket analytics dispersivi).
* **Speed-First**: Tempo di caricamento sottomillisecondo, supporto scorciatoie

---

# Nexus CRM

CRM personale per il telefono: contatti, deal, agenda delle attività di network, allegati.
È una **PWA** (Progressive Web App): si installa sulla schermata Home di iPhone e Android senza passare dagli store, funziona offline e tiene tutti i dati sul dispositivo.

Nessun server, nessun account, nessun costo. Vanilla HTML/CSS/JS, zero dipendenze, zero build.

## Struttura

| Sezione | Cosa fa |
|---|---|
| **Oggi** | KPI (pipeline aperta e pesata, ritardi, attività della settimana, vinto), scadenze in ritardo, da fare oggi, attività registrate, prossimi giorni |
| **Contatti** | Rubrica con ricerca, tag, ultimo contatto. Dettaglio con azioni rapide (chiama, email, LinkedIn), deal collegati, storico attività, allegati |
| **Deal** | Pipeline a fasi (Lead → Contattato → Proposta → Negoziazione → Vinto/Perso), valore, probabilità, prossimo step con scadenza, timeline degli step, allegati |
| **Agenda** | Vista settimanale, attività per giorno (chiamata, incontro, email, LinkedIn, evento, caffè, follow-up, nota), statistiche del mese |
| **Impostazioni** | Export CSV, backup/ripristino JSON, import contatti da CSV, tema, spazio |

Le immagini (screenshot di mail, biglietti da visita) si allegano a contatti, deal e attività. Vengono compresse e salvate in locale.

## Export dati

- **CSV** separati per contatti, deal e attività. Intestazioni in inglese (`first_name`, `company`, `deal_name`, `stage`, `amount`, …) per importarli facilmente in Google Sheets, HubSpot, Pipedrive, Notion o Excel.
- **Backup JSON** completo, immagini incluse: serve per cambiare telefono o come copia di sicurezza. Si ripristina dalle Impostazioni.

## Pubblicazione e installazione

1. Fai il merge su `main`: il workflow `.github/workflows/pages.yml` pubblica l'app su GitHub Pages.
   La prima volta, in *Settings → Pages* del repository imposta *Source: GitHub Actions*.
2. Apri l'URL di Pages dal telefono.
3. Installa:
   - **iPhone**: Safari → Condividi → *Aggiungi alla schermata Home*.
   - **Android**: Chrome → menu ⋮ → *Installa app*.

Funziona anche aprendo `index.html` da qualsiasi hosting statico (Netlify, Vercel, un server qualunque): è solo una cartella di file statici.

## Sviluppo locale

```bash
python3 -m http.server 8787
# poi apri http://localhost:8787
```

## Dati

Tutto è in IndexedDB nel browser del dispositivo (`contacts`, `deals`, `activities`, `attachments`).
Se il sistema operativo libera spazio può cancellare i dati dei siti non usati: fai un backup periodico e, dalle Impostazioni, richiedi l'*archiviazione persistente*.
