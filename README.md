# Santa's Naughty Book – Mrs. Claus

Mrs. Claus begrüsst die Gäste in einem 3D-Weihnachtszimmer. Wer vor die Kamera tritt, nennt seinen Namen und sein **Zauberwort** – nur dann öffnet sich seine Geschichte im Buch. Am Schluss blättert das Buch alle 2 Minuten von selbst um.

## Datenschutz

- **Versiegelt:** Jede Geschichte ist mit dem Zauberwort der Person verschlüsselt (PBKDF2 + AES-256-GCM, Web Crypto). Im Repo und auf der Website liegen nur verschlüsselte Daten (`public/event.json`), ohne Namen im Klartext.
- **Unverschlüsselt (bewusst):** Titel, Begrüssung und Schlusswort.
- **Nichts wird gespeichert:** Entschlüsselte Daten leben nur im Arbeitsspeicher. Neu laden oder „Beenden“ = vergessen. Einzige Ausnahme im Browser: der Name der gewählten Stimme.
- **Stimme lokal:** Es werden nur Stimmen des Betriebssystems genutzt (`localService`), keine Cloud-Stimmen. Unter Windows: Einstellungen → Zeit und Sprache → Sprache → Deutsch (Schweiz) → Sprachausgabe.
- **Kamera lokal:** Gesichtserkennung (MediaPipe) läuft im Browser.
- **Spracherkennung:** Die des Browsers (Chrome/Edge) kann Audio an Google/Microsoft senden. Ohne Mikrofon wird getippt.
- Zauberwörter sind Passwörter aus zwei Wörtern: Schutz gegen Neugierige, nicht gegen gezielte Angriffe mit viel Rechenzeit.

## Geschichten versiegeln

1. Vorlage kopieren: `demo/event.example.json` → `private/event.json` (der Ordner `private/` ist in `.gitignore`).
2. Begrüssung, Schlusswort und Gäste eintragen (pro Gast bis zu 7 Geschichten in `stories`).
3. `npm run seal`
   - schreibt `public/event.json` (darf ins Repo),
   - schreibt `private/zugangscodes.csv` (Name;Zauberwort – jedem nur sein eigenes geben),
   - merkt sich die Codes in `private/codes.json`, damit ein erneuter Lauf sie beibehält.
4. `public/event.json` committen und pushen → Vercel baut neu.

## Entwickeln

```bash
npm install
npm run dev
```

Vercel erkennt Vite automatisch (Build `npm run build`, Ausgabe `dist`). Kamera und Mikrofon brauchen https (Vercel) oder localhost.

## Bedienung am Abend

Chrome oder Edge, Vollbild (F). Leertaste = Satz überspringen, P = Person ist da, E = Abschied. Im Buch: Pfeiltasten.
