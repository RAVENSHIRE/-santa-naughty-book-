import { useEffect, useState } from 'react';
import { director } from '../santa/director';
import { useSanta } from '../santa/santaStore';
import { LINES } from '../santa/lines';
import { localVoices, primeSpeech, saveVoiceName, savedVoiceName, speak, sttSupported, voiceAudio } from '../santa/speech';
import { clipFor } from '../santa/voicebank';
import { liveAvailable } from '../santa/live';
import { LIVE_VOICES } from '../santa/livePrompt';
import { useBook } from '../store';

function TitleCard() {
  const card = useSanta((s) => s.titleCard);
  const [shown, setShown] = useState(card);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (card) {
      setShown(card);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const id = setTimeout(() => setShown(null), 900);
    return () => clearTimeout(id);
  }, [card]);
  if (!shown) return null;
  return (
    <div className={`title-card ${visible ? 'is-visible' : ''}`}>
      {shown.kicker && <div className="title-kicker">{shown.kicker}</div>}
      <div className="title-main">{shown.title}</div>
      {shown.sub && <div className="title-sub">{shown.sub}</div>}
    </div>
  );
}

/** Live-Modus: Notfall-Eingabe per Tastatur an Mrs. Claus (zugeklappt) */
function LiveInput() {
  const checking = useSanta((s) => s.checking);
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  if (checking) return <p className="heard">Mrs. Claus blättert im Buch …</p>;
  if (!open)
    return (
      <button className="ghost small" onClick={() => setOpen(true)}>
        Tippen
      </button>
    );
  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) director.liveText(value.trim());
        setValue('');
      }}
    >
      <div className="row">
        <input autoFocus type="text" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Name oder Zauberwort" />
        <button type="submit">OK</button>
      </div>
    </form>
  );
}

/** Eingabe per Tastatur – standardmässig zugeklappt, solange das Mikrofon zuhört */
function InputPanel() {
  const input = useSanta((s) => s.input);
  const heard = useSanta((s) => s.heard);
  const checking = useSanta((s) => s.checking);
  const micOn = useSanta((s) => s.mic === 'on') && sttSupported();
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => setValue(''), [input]);
  if (checking) return <p className="heard">Mrs. Claus blättert im Buch …</p>;
  if (!input) return null;
  if (micOn && !open)
    return (
      <>
        {heard && <p className="heard">„{input === 'code' ? '•••' : heard}“</p>}
        <button className="ghost small" onClick={() => setOpen(true)}>
          Tippen
        </button>
      </>
    );
  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) director.input(value.trim());
      }}
    >
      <div className="row">
        <input
          autoFocus
          type={input === 'code' ? 'password' : 'text'}
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={input === 'name' ? 'Dein Name' : 'Dein Zauberwort (zwei Wörter)'}
        />
        <button type="submit">OK</button>
      </div>
    </form>
  );
}

function StartPanel() {
  const frame = useSanta((s) => s.frame);
  const total = useSanta((s) => s.total);
  const [camera, setCamera] = useState(true);
  const [mic, setMic] = useState(sttSupported());
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voice, setVoice] = useState(savedVoiceName());
  useEffect(() => {
    void localVoices().then((v) => {
      setVoices(v);
      if (!v.some((x) => x.name === voice) && v[0]) setVoice(v[0].name);
    });
  }, [voice]);
  const ready = useBook((s) => s.ready);
  const recorded = useSanta((s) => s.recorded);
  const [liveOk, setLiveOk] = useState<boolean | null>(null);
  const [useLive, setUseLive] = useState(true);
  const [liveVoice, setLiveVoice] = useState(() => {
    try {
      return localStorage.getItem('claus-live-voice') || LIVE_VOICES[0].id;
    } catch {
      return LIVE_VOICES[0].id;
    }
  });
  useEffect(() => {
    void liveAvailable().then(setLiveOk);
  }, []);
  const live = !!liveOk && useLive;
  const probe = async () => {
    primeSpeech();
    const clip = await clipFor(LINES.askName);
    if (!clip) return;
    const a = voiceAudio();
    a.src = clip.url;
    void a.play().catch(() => {});
  };
  return (
    <div className="start">
      <h1>{frame?.title || "Santa's Naughty Book"}</h1>
      {frame?.subtitle && <p className="sub">{frame.subtitle}</p>}
      {!frame && <p className="warn">Keine Geschichten gefunden (public/event.json fehlt).</p>}
      {frame && <p>{total} versiegelte Geschichten im Buch. Jede öffnet sich nur mit dem Zauberwort der Person.</p>}
      <div className="opts">
        <label>
          <input type="checkbox" checked={camera} onChange={(e) => setCamera(e.target.checked)} /> Kamera
        </label>
        <label>
          <input type="checkbox" checked={mic} disabled={!sttSupported()} onChange={(e) => setMic(e.target.checked)} /> Mikrofon
        </label>
      </div>
      <div className="row">
        <label>
          <input type="checkbox" checked={live} disabled={!liveOk} onChange={(e) => setUseLive(e.target.checked)} /> Live-Gespräch (Gemini)
        </label>
        {live && (
          <select
            value={liveVoice}
            onChange={(e) => {
              setLiveVoice(e.target.value);
              try {
                localStorage.setItem('claus-live-voice', e.target.value);
              } catch {
                /* egal */
              }
            }}
          >
            {LIVE_VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        )}
      </div>
      {liveOk === false && <p className="note">Live-Gespräch aus: In Vercel fehlt die Umgebungsvariable GEMINI_API_KEY.</p>}
      {live ? null : recorded ? (
        <div className="row">
          <span>Stimme: Mrs. Claus (aufgenommen)</span>
          <button type="button" className="ghost" onClick={() => void probe()}>
            Probe
          </button>
        </div>
      ) : voices.length ? (
        <div className="row">
          <select
            value={voice}
            onChange={(e) => {
              setVoice(e.target.value);
              saveVoiceName(e.target.value);
            }}
          >
            {voices.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name.replace(/^Microsoft\s+/, '')} ({v.lang})
              </option>
            ))}
          </select>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              saveVoiceName(voice);
              primeSpeech();
              void speak('Grüezi! Ich bin Mrs. Claus.');
            }}
          >
            Probe
          </button>
        </div>
      ) : (
        <p className="warn">
          Keine lokale deutsche Stimme gefunden – Mrs. Claus spricht nur in Untertiteln. Windows: Einstellungen → Zeit und Sprache →
          Sprache → Deutsch (Schweiz) → Sprachausgabe installieren.
        </p>
      )}
      <button
        className="go"
        disabled={!frame || !ready}
        onClick={() => void (live ? director.startLive({ camera, mic, voice: liveVoice }) : director.start({ camera, mic }))}
      >
        Mrs. Claus starten
      </button>
      <p className="note">
        Nichts wird gespeichert oder hochgeladen: Die Stimme ist vorab aufgenommen und pro Person verschlüsselt, die Kamera
        wird nur im Browser ausgewertet. Die Spracherkennung des Browsers kann Audio an Google/Microsoft senden – ohne
        Mikrofon wird getippt. Taste F: Vollbild.
      </p>
    </div>
  );
}

export function Stage() {
  const phase = useSanta((s) => s.phase);
  const mode = useSanta((s) => s.mode);
  const caption = useSanta((s) => s.caption);
  const letterbox = useSanta((s) => s.letterbox);
  const titleCard = useSanta((s) => s.titleCard);
  const error = useSanta((s) => s.error);
  const live = useSanta((s) => s.live);
  const running = phase !== 'idle' && phase !== 'finale';

  return (
    <div className="stage">
      <div className={`letterbox ${letterbox && mode === 'santa' ? 'is-on' : ''}`}>
        <span />
        <span />
      </div>
      {phase === 'idle' && <StartPanel />}
      {running && <TitleCard />}
      {running && (
        <>
          <div className="bottom">
            {caption && !titleCard && <p className="caption">{caption}</p>}
            {live ? <LiveInput /> : <InputPanel />}
            {error && <p className="warn">{error}</p>}
            <div className="controls">
              {!live && <button onClick={director.skip}>Weiter ␣</button>}
              <button onClick={director.personHere}>Person ist da P</button>
              <button onClick={director.end}>Abschied E</button>
            </div>
          </div>
        </>
      )}
      {phase === 'finale' && (
        <div className="bottom finale">
          <div className="controls">
            <button onClick={() => useBook.getState().prev()}>←</button>
            <button onClick={() => useBook.getState().next()}>→</button>
            <button onClick={() => director.stop()}>Beenden &amp; Daten vergessen</button>
          </div>
        </div>
      )}
    </div>
  );
}
