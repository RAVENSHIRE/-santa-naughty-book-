# Samichlaus-Hotline 🎅📞

Interaktive Webseite für das Team-Weihnachtsessen:

1. **Startbild** – Schreibtisch im Flughafen-Hauptquartier, auf dem Tisch eine dunkle Schneekugel.
2. **Klick auf die Kugel** – sie wird geschüttelt, leuchtet auf, und der Film startet nahtlos:
   Die Kamera fährt in die Kugel, der Samichlaus steigt vom Schlitten, begrüsst alle und geht in sein Häuschen.
3. **Stube** – der Samichlaus sitzt im Sessel mit dem goldenen Buch (fixe Kamera, Schleifen «zuhören» / «sprechen»).
4. **Anruf** – «Samichlaus anrufen» → es klingelt → «Wie heisst du?» → der Gast sagt seinen Namen ins Mikrofon
   (Spracherkennung im Browser, Chrome/Edge) → der Samichlaus erzählt seine Geschichte mit Untertiteln.
   Klappt die Erkennung nicht, kann man den Namen antippen.

Bilder und Filme: Higgsfield (GPT Image 2.6, Kling 3.0). Stimme: ElevenLabs über Higgsfield (Stimme «Gideon»).

## Bedienung am Abend

Chrome oder Edge, Mikrofon erlauben, Taste **F** für Vollbild.

| Taste | Wirkung |
| --- | --- |
| Leertaste | Kugel schütteln / Intro überspringen / Anruf starten / Pause |
| 1–8 | Geschichte direkt abspielen (ohne Namensabfrage) |
| S | Schlusswort |
| Esc | zurück zur Schneekugel |
| H | Hilfe ein/aus |

## Auf dem Handy testen

Die Einzeldatei `demo/samichlaus-hotline.html` enthält die ganze App (Bilder, Filme und Stimme kommen von Higgsfield):
https://raw.githack.com/RAVENSHIRE/-santa-naughty-book-/main/demo/samichlaus-hotline.html

Am besten im Querformat, Mikrofon erlauben. Neu bauen mit `npm run build:single`.

## Entwickeln

```bash
npm install
npm run dev
```

Inhalte (Bild-/Video-/Ton-URLs, Namen, Untertitel-Zeiten) stehen in `src/show.json`.
Vercel baut jeden Push automatisch (Vite, Ausgabe `dist`).
