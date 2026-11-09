import { useEffect, useRef, useState } from 'react';
import { director } from '../santa/director';
import { santaRuntime } from '../santa/santaRuntime';
import { useSanta } from '../santa/santaStore';
import { vision } from '../santa/vision';
import { useBook, useStrings } from '../store';
import { IconClose, IconEye, IconQuill, IconRight } from './icons';

const RUNNING = new Set(['starting', 'greeting', 'waiting', 'asking-name', 'reading', 'verdict', 'next', 'farewell']);

function MicMeter() {
  const bar = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let id = 0;
    const tick = () => {
      if (bar.current) bar.current.style.transform = `scaleX(${Math.max(0.04, santaRuntime.micLevel)})`;
      id = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <span className="mic-meter" aria-hidden>
      <span ref={bar} />
    </span>
  );
}

function CameraPreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const camera = useSanta((s) => s.camera);
  const face = useSanta((s) => s.face);
  const present = useSanta((s) => s.present);
  useEffect(() => {
    const v = videoRef.current;
    const stream = vision().video.srcObject as MediaStream | null;
    if (v && stream && v.srcObject !== stream) {
      v.srcObject = stream;
      void v.play().catch(() => {});
    }
  }, [camera]);
  if (camera !== 'on') return null;
  return (
    <div className={`cam-preview ${present ? 'has-person' : ''}`}>
      <video ref={videoRef} muted playsInline autoPlay />
      {face && (
        <span
          className="face-box"
          style={{ left: `${face.x * 100}%`, top: `${face.y * 100}%`, width: `${face.w * 100}%`, height: `${face.h * 100}%` }}
        />
      )}
    </div>
  );
}

function NamePanel() {
  const s = useStrings();
  const guests = useBook((st) => st.guests);
  const doneIds = useSanta((st) => st.doneIds);
  const [name, setName] = useState('');
  const remaining = guests.filter((g) => !doneIds.includes(g.id));
  const send = (n: string) => {
    director.provideName(n);
    setName('');
  };
  return (
    <div className="name-panel">
      <div className="name-panel-title">{s.whoIsThere}</div>
      {remaining.length > 0 && (
        <div className="chips">
          {remaining.slice(0, 18).map((g) => (
            <button key={g.id} className="chip" onClick={() => send(g.name)}>
              {g.name || '…'}
            </button>
          ))}
        </div>
      )}
      <form
        className="name-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) send(name);
        }}
      >
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={s.typeName} maxLength={60} />
        <button className="btn btn-gold" type="submit" disabled={!name.trim()}>
          {s.ok}
        </button>
      </form>
    </div>
  );
}

export function SantaOverlay() {
  const s = useStrings();
  const phase = useSanta((st) => st.phase);
  const caption = useSanta((st) => st.caption);
  const heard = useSanta((st) => st.heard);
  const camera = useSanta((st) => st.camera);
  const mic = useSanta((st) => st.mic);
  const detector = useSanta((st) => st.detector);
  const present = useSanta((st) => st.present);
  const speechIn = useSanta((st) => st.speechIn);
  const speechOut = useSanta((st) => st.speechOut);
  const awaitingName = useSanta((st) => st.awaitingName);
  const awaitingPerson = useSanta((st) => st.awaitingPerson);
  const doneIds = useSanta((st) => st.doneIds);
  const ready = useBook((st) => st.ready);
  const guests = useBook((st) => st.guests);
  const [useCam, setUseCam] = useState(true);
  const [useMic, setUseMic] = useState(true);
  const [listening, setListening] = useState(false);
  const running = RUNNING.has(phase);
  const secure = typeof window !== 'undefined' ? window.isSecureContext : true;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setListening(santaRuntime.listening), 150);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if (e.key === ' ') {
        e.preventDefault();
        director.skip();
      } else if (e.key === 'p' || e.key === 'P') director.personHere();
      else if (e.key === 'e' || e.key === 'E') director.end();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running]);

  const camLabel =
    camera === 'on'
      ? detector === 'on'
        ? present
          ? s.statusPerson
          : s.statusNoPerson
        : detector === 'starting'
          ? s.detectorLoading
          : s.noDetector
      : camera === 'denied'
        ? s.camDenied
        : s.camOff;

  return (
    <div className={`santa-ui ${ready ? 'is-ready' : ''}`}>
      {!running && (
        <section className="santa-start">
          <div className="santa-card">
            <h2>
              <span className="brand-script">Santa</span> AI
            </h2>
            {phase === 'finished' && guests.length > 0 && doneIds.length >= guests.length && <p className="santa-finished">{s.finished}</p>}
            <p>{s.santaIntro}</p>
            <p className="muted">{s.guestsOnList(guests.length)}</p>
            <div className="santa-toggles">
              <label className="toggle">
                <input type="checkbox" checked={useCam} onChange={(e) => setUseCam(e.target.checked)} />
                <span>{s.useCamera}</span>
              </label>
              <label className="toggle">
                <input type="checkbox" checked={useMic} onChange={(e) => setUseMic(e.target.checked)} />
                <span>{s.useMic}</span>
              </label>
            </div>
            {!secure && <p className="warn">{s.httpsHint}</p>}
            <div className="santa-actions">
              <button className="btn btn-gold btn-lg" disabled={!ready} onClick={() => void director.start({ camera: useCam, mic: useMic })}>
                {phase === 'finished' ? s.restartSanta : s.startSanta}
              </button>
              <button className="btn btn-ghost" onClick={() => useBook.getState().setHostOpen(true)}>
                <IconQuill /> {s.editGuests}
              </button>
            </div>
            <p className="muted small">{s.privacy}</p>
          </div>
        </section>
      )}

      {running && (
        <>
          <div className="santa-status">
            <span className={`status-chip ${camera === 'on' && present ? 'is-good' : camera === 'denied' ? 'is-bad' : ''}`}>
              <IconEye /> {camLabel}
            </span>
            <span className={`status-chip ${listening ? 'is-live' : mic === 'denied' ? 'is-bad' : ''}`}>
              {mic === 'on' ? (
                <>
                  <MicMeter /> {listening ? s.statusListening : s.useMic}
                </>
              ) : mic === 'denied' ? (
                s.micDenied
              ) : (
                s.micOff
              )}
            </span>
            {guests.length > 0 && <span className="status-chip">{s.progress(doneIds.length, guests.length)}</span>}
            {mic === 'on' && !speechIn && <span className="status-chip is-warn">{s.noSpeechIn}</span>}
            {!speechOut && <span className="status-chip is-warn">{s.noSpeechOut}</span>}
          </div>

          <CameraPreview />

          <div className="santa-bottom">
            {heard && (
              <div className="heard">
                <span>{s.heardLabel}:</span> «{heard}»
              </div>
            )}
            {caption && (
              <div className="caption" aria-live="polite">
                <span className="caption-who">Santa</span>
                {caption}
              </div>
            )}
            {(awaitingName || (awaitingPerson && detector !== 'on')) && <NamePanel />}
            <div className="host-controls">
              {awaitingPerson && (
                <button className="btn btn-gold" onClick={() => director.personHere()}>
                  <IconEye /> {s.personHere}
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => director.skip()}>
                <IconRight /> {s.skip}
              </button>
              <button className="btn btn-ghost" onClick={() => director.end()}>
                {s.farewellNow}
              </button>
              <button className="btn btn-ghost" onClick={() => director.stop()} aria-label={s.stop}>
                <IconClose /> {s.stop}
              </button>
            </div>
            <p className="keys-hint">{s.santaKeys}</p>
          </div>
        </>
      )}
    </div>
  );
}
