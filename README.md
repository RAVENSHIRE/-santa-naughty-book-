# Santa's Naughty Book 🎅📕

**Santa AI – ein sprechender 3D-Weihnachtsmann für Gastgeber von Weihnachtsevents.**
Santa steht in seiner Stube vor dem knisternden Kamin, sieht über die Kamera, wer vor ihm steht, fragt nach dem Namen und liest jedem Gast seine Geschichte aus dem grossen Buch vor – mit Urteil: **Brav** oder **Unartig**. Danach ruft er die nächste Person, bis alle dran waren, und verabschiedet sich.

Optional gibt es den **Buch-Modus**: das rote Samtbuch auf dem Lesepult, in dem der Gastgeber selbst blättert.

Die Szene ist vom Referenzbild inspiriert (Santa mit goldener Lesebrille, roter Samt und weisser Pelz, Stechpalmen-Brosche mit Tannenzapfen, Liste in der Hand, Kamin mit geschmiedetem Gitter, Kerzen und Bilderrahmen, Fenster mit Lichtern in der Nacht) und komplett prozedural in Three.js nachgebaut – es werden keine Fotos oder 3D-Modelle von Dritten verwendet.

## Santa AI: Ablauf

1. **Begrüssung** – Santa winkt und stellt sich vor.
2. **Person erkennen** – die Gesichtserkennung (MediaPipe, läuft lokal im Browser) merkt, wenn jemand vor die Kamera tritt; Santa schaut die Person an.
3. **Namen erfragen** – per Mikrofon (Spracherkennung des Browsers). Der Name wird mit der Gästeliste abgeglichen; unbekannte Gäste schreibt Santa neu ins Buch.
4. **Geschichte vorlesen** – aus den Einträgen im Buch (gute Taten, Missetaten), mit Sprachausgabe, Lippenbewegung und Untertiteln.
5. **Urteil** – Trommelwirbel, Stempel im Buch, Santa lacht oder schüttelt den Kopf.
6. **„Wer ist als Nächstes dran?“** – bis alle Gäste der Liste dran waren.
7. **Abschied** – „Frohe Weihnachten! Ho ho ho!“

Der Gastgeber kann jederzeit eingreifen: Namen antippen oder eintippen (praktisch, wenn es laut ist), „Person ist da“, „Weiter“, „Abschied“, „Stopp“.

| Taste | Santa-Modus |
| --- | --- |
| Leertaste | Weiter (aktuellen Satz überspringen) |
| P | Person ist da |
| E | Abschied |
| H | Gastgeber-Bereich (Gästeliste, Taten, Urteile) |

### Voraussetzungen

- **https:// oder localhost** – sonst geben Browser Kamera und Mikrofon nicht frei (GitHub Pages und Codespaces-Ports sind https).
- **Chrome oder Edge** empfohlen: Dort gibt es Spracherkennung *und* gute Stimmen. Safari geht meist auch. In Firefox fehlt die Spracherkennung – dann einfach die Namen antippen.
- Die Spracherkennung von Chrome schickt das Gesagte an den Sprachdienst des Browsers. Kamerabilder verlassen den Browser nicht und werden nicht gespeichert.
- Ohne Kamera oder Mikrofon läuft alles weiter: „Person ist da“ antippen und Namen eintippen.

## Stimme (ElevenLabs), Schwiizerdütsch und Branding

### Inhalt: `public/content.json`

Alles für den Abend steht in **einer Datei**: Sprache, Branding, Stimme, Storyline und Gästeliste (Schema: `public/content.schema.json`, VS Code prüft die Datei automatisch).

| Datei | Inhalt |
| --- | --- |
| `public/content.local.json` | **euer Manuskript** – wird automatisch geladen, ist in `.gitignore` (privat, landet nie im Repo) |
| `public/content.local.de.json` | z. B. dieselbe Fassung auf Hochdeutsch → mit `?content=content.local.de.json` laden |
| `public/content.json` | Standard ohne Gäste (Branding, Sprache, Titel) |
| `public/content.example.json` | kurzes Beispiel mit allen Feldern |

> Das Repository ist öffentlich: Gästelisten und Geschichten deshalb nur in `content.local*.json` ablegen. Auch `public/voice/` (die vorgerenderte Stimme) ist ignoriert, weil sie das gesprochene Manuskript enthält.

Pro Gast: `name`, `title` (Kapitel-Untertitel), `verdict` (`nice`/`naughty`/`undecided`), `score`, `nice`/`naughty` (Einträge im Buch) und `story` – die Geschichte, die Santa **wörtlich** vorliest.
Eröffnung, Prolog und Schlusswort stehen unter `story` (`greeting`, `prologue`, `epilogue`, `farewell`). Änderungen an der Datei werden beim nächsten Laden übernommen; Änderungen im Gastgeber-Bereich bleiben sonst erhalten.

### Filmischer Ablauf

Titelkarte („UBS präsentiert – S goldige Buech vom Samichlaus“) mit Spieldose („Stille Nacht“) → Prolog → Eröffnung → pro Gast ein **Kapitel** (Titelkarte mit Name und Untertitel, Geschichte, Schnitt aufs Buch: Stempel, Urteil) → Schlusswort → Abspann „Schöni Wiehnachte“. Kinobalken, Kamerafahrten und harte Schnitte (Totale, Halbnah, Nah, Buch). Hält der Gastgeber mit „Abschied“ früher an, kommt trotzdem das Schlusswort, sobald mindestens ein Gast dran war.

### ElevenLabs-Stimme einrichten

Der API-Key bleibt **auf dem Server** (Vite-Dev-/Preview-Server) und gelangt nie in den Browser.

1. **Codespace:** GitHub → *Settings → Codespaces → Secrets* → `ELEVENLABS_API_KEY` anlegen und für dieses Repository freigeben (optional `ELEVENLABS_VOICE_ID`). Codespace neu starten.
   **Lokal:** Datei `.env.local` mit `ELEVENLABS_API_KEY=…` (ist in `.gitignore`).
2. `npm run dev` → Gastgeber-Bereich (H) → **Stimme & Story** → „**Stimme vorbereiten**“. Alle Sätze werden einmal erzeugt und in `.voice-cache/` gespeichert (≈ 21 000 Zeichen für das ganze Manuskript).
3. Optional `npm run voice:export` → kopiert die Aufnahmen nach `public/voice/` (z. B. für einen Offline-Build mit `npm run build && npm run preview`). Nur in einem **privaten** Repository committen.

Ohne Key spricht automatisch die Browser-Stimme. Stimme wählen: `voice.voiceId` in `content.json` (oder `ELEVENLABS_VOICE_ID`). Für Datenresidenz: `ELEVENLABS_API_BASE`.

**Schwiizerdütsch:** ElevenLabs liest Mundart-Text mit einer deutschen Aussprache. Vor dem vollständigen Rendern ein paar Sätze in beiden Fassungen anhören (`content.local.json` vs. `?content=content.local.de.json`) und eine männliche Stimme mit Schweizer Akzent aus der Voice Library wählen – oder die eigene Stimme klonen.

### Branding

`brand.preset: "ubs"` setzt Rot/Weiss, Schrift und eckigere Bedienelemente. Das **Logo wird nicht mitgeliefert**: die freigegebene Datei nach `public/brand/` legen und `brand.logo` eintragen (z. B. `"brand/logo.svg"`); ohne Logo steht der Name als Text.

## Buch-Modus

- **Echtes 3D-Buch**: Seiten biegen sich beim Umblättern, Samt-Einband mit Goldprägung, Goldschnitt, Pelzkante und Brosche
- **Pro Gast eine Doppelseite**: Name, gute Taten, Missetaten, „Frech-O-Meter“ und Urteilsfeld; Titelseite mit Verzeichnis und Bilanz-Seite
- **Urteil verkünden**: Kamerafahrt, Trommelwirbel, Stempel, Konfetti (brav) oder Kohle (unartig)

| Aktion | Maus / Touch | Tastatur |
| --- | --- | --- |
| Buch öffnen / weiterblättern | aufs Buch (rechte Seite) tippen, nach links wischen | → / Leertaste / Bild ↓ |
| Zurückblättern | linke Seite antippen, nach rechts wischen | ← / Bild ↑ |
| Urteil verkünden | Knopf „Urteil verkünden“ | Enter / R |
| Gastgeber-Bereich | Knopf „Gastgeber“ | H |
| Vollbild | Knopf oben rechts | F |

**Tipp:** Vor dem Event im Gastgeber-Bereich alle Gäste erfassen (oder per „Mehrere Gäste auf einmal“ einfügen) und als JSON exportieren. Santa AI und das Buch nutzen dieselbe Gästeliste.

## Schnellstart

```bash
npm install
npm run dev        # http://localhost:5173
```

Build:

```bash
npm run build          # -> dist/ (z. B. für GitHub Pages, inkl. Gesichtserkennung)
npm run build:single   # -> dist-single/index.html (alles in einer Datei, ohne Gesichtserkennung)
```

### In einem GitHub Codespace

Das Repository bringt eine `.devcontainer/devcontainer.json` mit (Node 22, Port 5173, `npm install` automatisch, fragt nach `ELEVENLABS_API_KEY`).

```bash
git switch feature/santa-ai && git pull
npm install
npm run dev -- --host
```

Dann im Tab **Ports** den weitergeleiteten Port 5173 im Browser öffnen (https) und Kamera und Mikrofon erlauben.

## Live stellen (GitHub Pages)

Der Workflow `.github/workflows/deploy.yml` baut und veröffentlicht die Seite bei jedem Push auf `main`.
Einmalig nötig: im Repository unter **Settings → Pages → Build and deployment → Source** „**GitHub Actions**“ auswählen.
Danach ist alles unter `https://<user>.github.io/<repo>/` erreichbar.

## Technik

- [React 19](https://react.dev) + [Vite](https://vite.dev) + TypeScript
- [three.js](https://threejs.org), [@react-three/fiber](https://r3f.docs.pmnd.rs), [@react-three/drei](https://drei.docs.pmnd.rs), [@react-three/postprocessing](https://react-postprocessing.docs.pmnd.rs)
- [MediaPipe Face Detection](https://github.com/google-ai-edge/mediapipe) (lokal ausgeliefert, kein CDN), Web Speech API (Spracherkennung und -ausgabe)
- [zustand](https://zustand.docs.pmnd.rs) für Zustand & Speicherung
- Schriften über [Fontsource](https://fontsource.org) (Cinzel, Cinzel Decorative, Great Vibes, IM Fell English – alle SIL Open Font License)

Alle Texturen (Samt, Pergament, Holz, Haut, Seiten) werden zur Laufzeit per Canvas gezeichnet; Bart, Pelz und Haare sind per Shell-Texturing gerendert.

```
src/
  santa/       Santa AI: Avatar, Gesprächsablauf, Kamera/Gesichtserkennung, Sprache, Geschichten
  store.ts, i18n.ts, demoData.ts   Zustand, Texte (DE/EN), Beispielgäste
  audio.ts                         synthetische Soundeffekte
  three/
    book/      3D-Buch: Seiten-Rig, Texturverwaltung, Stempel & Partikel
    room/      Raum, Fenster, Kamin, Feuer-Shader
    props/     Schreibtisch, Lesepult, Brille, Mütze, Stechpalme, Tannenzapfen
    tex/       Canvas-Zeichnungen für Seiten, Einband und Ornamente
  ui/          Overlay, Santa-Steuerung, Gastgeber-Bereich, Ladebildschirm
```

Qualität erzwingen: `?quality=low` (schwache Geräte) oder `?quality=high`. Entwickler-Ansicht der Seitentexturen: `?debug=textures`.
