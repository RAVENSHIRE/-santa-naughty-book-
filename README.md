# Santa's Naughty Book 🎅📕

**Ein live 3D-Frontend für Gastgeber von Weihnachtsevents.**
Santas rotes Samtbuch mit Pelzkante liegt auf einem Lesepult vor dem knisternden Kamin. Der Gastgeber blättert Gast für Gast durch das Buch – links die guten Taten, rechts die Missetaten – und verkündet dann mit Trommelwirbel und Stempel das Urteil: **Brav** oder **Unartig**.

Die Szene ist vom Referenzbild inspiriert (Santa mit goldener Lesebrille, roter Samt und weisser Pelz, Stechpalmen-Brosche mit Tannenzapfen, Kamin mit geschmiedetem Gitter, Kerzen und Bilderrahmen auf dem Sims, Fenster mit Lichtern in der Nacht) und komplett prozedural in Three.js nachgebaut – es werden keine Fotos oder 3D-Modelle von Dritten verwendet.

## Features

- **Echtes 3D-Buch**: Seiten biegen sich beim Umblättern (Skinned Meshes), starrer Samt-Einband mit Goldprägung, Goldschnitt, Pelzkante (Shell-Fur) und Stechpalmen-Brosche
- **Gemütliche Szene**: animiertes Kaminfeuer mit Glut, flackernde Kerzen, Girlande, Schnee vor dem Fenster, Santas Mütze, Brille, Milch & Kekse, Tiefenunschärfe und Glühen
- **Pro Gast eine Doppelseite**: Name, gute Taten, Missetaten, „Frech-O-Meter“ und Urteilsfeld
- **Urteil verkünden**: Kamerafahrt aufs Urteil, Trommelwirbel, Stempel knallt auf die Seite, Konfetti (brav) oder Kohle (unartig)
- **Gastgeber-Bereich**: Event, Gäste, Taten, Urteile live bearbeiten – Änderungen erscheinen sofort im Buch; Import/Export als JSON; Daten bleiben im Browser gespeichert
- **Titelseite mit Verzeichnis** und **Bilanz-Seite** am Ende
- **Deutsch & Englisch**, Sounds komplett per Web Audio erzeugt (Kaminknistern, Umblättern, Glöckchen, „Wah-wah“-Posaune)
- **Präsentationsmodus**: Bedienelemente blenden sich aus, Steuerung per Tastatur oder Presenter-Fernbedienung; auf dem Handy wird im Hochformat Seite für Seite gezeigt (Wischen zum Blättern)

## Schnellstart

```bash
npm install
npm run dev        # http://localhost:5173
```

Build:

```bash
npm run build          # -> dist/ (z. B. für GitHub Pages)
npm run build:single   # -> dist-single/index.html (alles in einer Datei)
```

## Bedienung am Event

| Aktion | Maus / Touch | Tastatur |
| --- | --- | --- |
| Buch öffnen / weiterblättern | aufs Buch (rechte Seite) tippen, nach links wischen | → / Leertaste / Bild ↓ |
| Zurückblättern | linke Seite antippen, nach rechts wischen | ← / Bild ↑ |
| Urteil verkünden | Knopf „Urteil verkünden“ | Enter / R |
| Gastgeber-Bereich | Knopf „Gastgeber“ | H |
| Vollbild | Knopf oben rechts | F |
| Zum Anfang / Ende | – | Pos1 / Ende |

Über das Label in der unteren Leiste kann man direkt zu einem Gast springen.

**Tipp:** Vor dem Event im Gastgeber-Bereich alle Gäste erfassen (oder per „Mehrere Gäste auf einmal“ einfügen) und als JSON exportieren. Urteile bleiben verdeckt, bis sie verkündet werden.

Qualität erzwingen: `?quality=low` (schwache Geräte) oder `?quality=high`.

## Live stellen (GitHub Pages)

Der Workflow `.github/workflows/deploy.yml` baut und veröffentlicht die Seite bei jedem Push auf `main`.
Einmalig nötig: im Repository unter **Settings → Pages → Build and deployment → Source** „**GitHub Actions**“ auswählen.
Danach ist das Buch unter `https://<user>.github.io/<repo>/` erreichbar.

## Technik

- [React 19](https://react.dev) + [Vite](https://vite.dev) + TypeScript
- [three.js](https://threejs.org), [@react-three/fiber](https://r3f.docs.pmnd.rs), [@react-three/drei](https://drei.docs.pmnd.rs), [@react-three/postprocessing](https://react-postprocessing.docs.pmnd.rs)
- [zustand](https://zustand.docs.pmnd.rs) für Zustand & Speicherung
- Schriften über [Fontsource](https://fontsource.org) (Cinzel, Cinzel Decorative, Great Vibes, IM Fell English – alle SIL Open Font License)

Alle Texturen (Samt, Pergament, Holz, Backstein, Seiten) werden zur Laufzeit per Canvas gezeichnet – es gibt keine Bild-Assets.

```
src/
  store.ts, i18n.ts, demoData.ts   Zustand, Texte (DE/EN), Beispielgäste
  audio.ts                         synthetische Soundeffekte
  three/
    book/      3D-Buch: Seiten-Rig, Texturverwaltung, Stempel & Partikel
    room/      Raum, Fenster, Kamin, Feuer-Shader
    props/     Schreibtisch, Lesepult, Brille, Mütze, Stechpalme, Tannenzapfen
    tex/       Canvas-Zeichnungen für Seiten, Einband und Ornamente
    CameraRig.tsx, Lights.tsx, Effects.tsx, RevealDirector.tsx
  ui/          Overlay, Gastgeber-Bereich, Ladebildschirm
```

Entwickler-Ansicht aller generierten Seitentexturen: `?debug=textures`.
