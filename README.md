# Santa's Naughty Book – Mrs. Claus

Mrs. Claus begrüsst die Gäste als Video-Avatar: Aus einem Porträt entstehen mit LivePortrait zwei echte Bewegungs-Schleifen (zuhören, sprechen), zwischen denen die App weich umschaltet. Die Stimme ist vorab mit ElevenLabs aufgenommen. Für Buch und Stempel schneidet das Bild in ein 3D-Weihnachtszimmer. Wer vor die Kamera tritt, nennt seinen Namen und sein **Zauberwort** – nur dann öffnet sich seine Geschichte. Am Schluss blättert das Buch alle 2 Minuten von selbst um.

## Datenschutz

- **Versiegelt:** Jede Geschichte ist mit dem Zauberwort der Person verschlüsselt (PBKDF2 + AES-256-GCM, Web Crypto). Im Repo und auf der Website liegen nur verschlüsselte Daten (`public/event.json`), ohne Namen im Klartext.
- **Aufnahmen versiegelt:** Die vorgelesenen Geschichten (`public/voice/g/*.bin`) sind mit demselben Zauberwort verschlüsselt. Öffentlich (`public/voice/p/`) sind nur die allgemeinen Sätze, Begrüssung und Schlusswort.
- **ElevenLabs nur einmal:** Die Texte gehen ein einziges Mal zur Vertonung an ElevenLabs (kein Dokument, keine Wissensdatenbank). Das Skript löscht danach den Verlauf im ElevenLabs-Konto. Am Abend selbst geht nichts an ElevenLabs.
- **Unverschlüsselt (bewusst):** Titel, Begrüssung, Schlusswort, Avatar-Bild und -Videos.
- **Nichts wird gespeichert:** Entschlüsselte Daten leben nur im Arbeitsspeicher. Neu laden oder „Beenden“ = vergessen.
- **Kamera lokal:** Gesichtserkennung (MediaPipe) läuft im Browser. Das Mikrofon wird nur zum Zuhören geöffnet.
- **Spracherkennung:** Die des Browsers (Chrome/Edge) kann Audio an Google/Microsoft senden. Ohne Mikrofon wird getippt.
- Zauberwörter sind Passwörter aus zwei Wörtern: Schutz gegen Neugierige, nicht gegen gezielte Angriffe mit viel Rechenzeit.

## Geschichten versiegeln

1. Vorlage kopieren: `demo/event.example.json` → `private/event.json` (der Ordner `private/` ist in `.gitignore`).
2. Begrüssung, Schlusswort und Gäste eintragen (pro Gast bis zu 7 Geschichten in `stories`).
3. `npm run seal`
   - schreibt `public/event.json` (darf ins Repo),
   - schreibt `private/zugangscodes.csv` (Name;Zauberwort – jedem nur sein eigenes geben),
   - merkt sich die Codes in `private/codes.json`, damit ein erneuter Lauf sie beibehält.
4. Danach neu vertonen (unten) – die Aufnahmen hängen an den Zauberwörtern.

## Stimme aufnehmen (ElevenLabs)

Läuft auf dem eigenen PC (Node 18+), nicht im Browser. API-Key als einzige Zeile in `%USERPROFILE%\santa-elevenlabs.txt`.

```bash
node scripts/voice.mjs --voices                      # Stimmen im Konto + freie Zeichen
node scripts/voice.mjs --search --accent swiss       # Frauenstimmen (Deutsch) aus der Library
node scripts/voice.mjs --add <owner> <voice> "Mrs. Claus"
node scripts/voice.mjs --voice <voice_id> --dry      # zeigt, wie viele Zeichen es braucht
node scripts/voice.mjs --voice <voice_id>            # vertont, verschlüsselt, löscht den Verlauf
```

Braucht nur `private/codes.json` und `public/event.json`; die Geschichten entschlüsselt das Skript selbst. Danach `public/voice/` committen. Fehlt eine Aufnahme, spricht die lokale Windows-Stimme.

## Avatar erneuern

`public/avatar/mrs-claus.jpg` (16:9) ist das Standbild, `idle.mp4` und `talk.mp4` sind die Schleifen. Erzeugt mit [LivePortrait](https://github.com/KwaiVGI/LivePortrait) (CPU reicht, ca. 7 s pro Bild):

```bash
python inference.py -s mrs-claus.jpg -d driving.mp4 --flag_force_cpu --no-flag_use_half_precision --source_max_dim 960
```

Treiber-Videos aus `assets/examples/driving/` (zuhören: `d19`, sprechen: `d13` mit `--flag_crop_driving_video`), je 6 s mit 15 Bildern/s. Danach mit ffmpeg auf 30 Bilder/s interpolieren und vorwärts + rückwärts aneinanderhängen, damit die Schleife nahtlos ist.

## Entwickeln

```bash
npm install
npm run dev
```

Vercel erkennt Vite automatisch (Build `npm run build`, Ausgabe `dist`). Kamera und Mikrofon brauchen https (Vercel) oder localhost.

## Bedienung am Abend

Chrome oder Edge. F = Vollbild ein/aus, Leertaste = Satz überspringen, P = Person ist da, E = Abschied. Im Buch: Pfeiltasten.
