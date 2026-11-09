import { useEffect, useRef, useState } from 'react';
import type { Guest, Verdict } from '../demoData';
import type { Locale } from '../i18n';
import { useBook, useStrings } from '../store';
import { applyContent, contentSettings, useContent, type SantaLanguage } from '../content';
import { director } from '../santa/director';
import { useSanta } from '../santa/santaStore';
import { prerender, resetVoice, voiceAvailable } from '../santa/voice';
import { IconClose, IconDown, IconEye, IconTrash, IconUp } from './icons';

type Downloads = { save: (r: { filename: string; data: string }) => Promise<unknown> };

/** Download-Schnittstelle, wenn die Seite als Claude-Artefakt läuft – sonst null */
async function artifactDownloads(): Promise<Downloads | null> {
  const host = (window as unknown as { claude?: { use?: (name: string) => Promise<unknown> } }).claude;
  if (!host?.use) return null;
  try {
    return ((await host.use('downloads')) as Downloads | null) ?? null;
  } catch {
    return null;
  }
}

/** Zweistufige Bestätigung statt confirm() (funktioniert auch in eingebetteten Frames) */
function ConfirmButton({ label, onConfirm, className }: { label: string; onConfirm: () => void; className: string }) {
  const s = useStrings();
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(id);
  }, [armed]);
  return (
    <button
      className={`${className} ${armed ? 'is-armed' : ''}`}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? s.tapAgain : label}
    </button>
  );
}

function GuestCard({ g, index, total }: { g: Guest; index: number; total: number }) {
  const s = useStrings();
  const { updateGuest, removeGuest, moveGuest, goToGuest, setHostOpen, singlePage } = useBook.getState();
  const [open, setOpen] = useState(false);
  const verdicts: Verdict[] = ['nice', 'naughty', 'undecided'];
  return (
    <div className={`guest-card ${open ? 'is-open' : ''}`}>
      <div className="guest-row">
        <span className="guest-num">{index + 1}</span>
        <input
          className="input guest-name"
          value={g.name}
          placeholder={s.guestName}
          maxLength={80}
          onChange={(e) => updateGuest(g.id, { name: e.target.value })}
        />
        <span className={`dot dot--${g.verdict}`} title={s[g.verdict]} />
        <button className="mini-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open} title={open ? s.close : s.verdict}>
          {open ? <IconUp /> : <IconDown />}
        </button>
      </div>
      {open && (
        <div className="guest-body">
          <div className="field">
            <span className="field-label">{s.verdict}</span>
            <div className="segmented">
              {verdicts.map((v) => (
                <button key={v} className={`seg seg--${v} ${g.verdict === v ? 'is-active' : ''}`} onClick={() => updateGuest(g.id, { verdict: v })}>
                  {s[v]}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span className="field-label">
              {s.score}: <strong>{g.score}</strong>
            </span>
            <input type="range" min={0} max={100} value={g.score} onChange={(e) => updateGuest(g.id, { score: Number(e.target.value) })} />
          </label>
          <label className="field">
            <span className="field-label">{s.niceList}</span>
            <textarea className="input" rows={3} value={g.nice.join('\n')} onChange={(e) => updateGuest(g.id, { nice: e.target.value.split('\n') })} />
          </label>
          <label className="field">
            <span className="field-label">{s.naughtyList}</span>
            <textarea className="input" rows={3} value={g.naughty.join('\n')} onChange={(e) => updateGuest(g.id, { naughty: e.target.value.split('\n') })} />
          </label>
          <label className="field">
            <span className="field-label">{s.chapterTitle}</span>
            <input className="input" value={g.title ?? ''} maxLength={120} onChange={(e) => updateGuest(g.id, { title: e.target.value || undefined })} />
          </label>
          <label className="field">
            <span className="field-label">{s.ownStory}</span>
            <textarea
              className="input"
              rows={4}
              value={g.story ?? ''}
              placeholder={s.ownStoryHint}
              onChange={(e) => updateGuest(g.id, { story: e.target.value || undefined })}
            />
          </label>
          <div className="guest-actions">
            <button
              className="btn btn-ghost"
              onClick={() => {
                goToGuest(index);
                if (singlePage || window.innerWidth < 900) setHostOpen(false);
              }}
            >
              <IconEye /> {s.showInBook}
            </button>
            <label className="toggle">
              <input type="checkbox" checked={g.revealed} onChange={(e) => updateGuest(g.id, { revealed: e.target.checked })} />
              <span>{g.revealed ? s.revealed : s.hidden}</span>
            </label>
            <span className="spacer" />
            <button className="mini-btn" disabled={index === 0} onClick={() => moveGuest(g.id, -1)} title={s.moveUp}>
              <IconUp />
            </button>
            <button className="mini-btn" disabled={index === total - 1} onClick={() => moveGuest(g.id, 1)} title={s.moveDown}>
              <IconDown />
            </button>
            <button className="mini-btn mini-btn--danger" onClick={() => removeGuest(g.id)} title={s.remove}>
              <IconTrash />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Santas Sprache + ElevenLabs-Stimme vorbereiten (alle Sätze vorab aufnehmen → ohne Wartezeit beim Event) */
function VoiceSection() {
  const s = useStrings();
  const language = useContent((st) => st.language);
  const setLanguage = useContent((st) => st.setLanguage);
  const source = useContent((st) => st.source);
  const voiceId = useContent((st) => st.voice.voiceId);
  const [state, setState] = useState<'idle' | 'checking' | 'eleven' | 'browser'>('checking');
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let alive = true;
    void voiceAvailable().then((ok) => alive && setState(ok ? 'eleven' : 'browser'));
    return () => {
      alive = false;
    };
  }, [voiceId]);

  const prepare = async () => {
    setMsg('');
    resetVoice();
    if (!(await voiceAvailable())) {
      setState('browser');
      setMsg(s.prepareFailed);
      return;
    }
    const texts = director.scriptTexts();
    const ok = await prerender(texts, (d, n) => setProgress([d, n]));
    setProgress(null);
    setMsg(ok > 0 ? s.prepared(ok) : s.prepareFailed);
    if (ok > 0) useSanta.getState().patch({ voice: 'elevenlabs' });
  };

  return (
    <section className="host-section">
      <h3>{s.voiceSection}</h3>
      <div className="field-row">
        <label className="field">
          <span className="field-label">{s.santaLanguage}</span>
          <select className="input" value={language} onChange={(e) => setLanguage(e.target.value as SantaLanguage)}>
            <option value="gsw">{s.langGsw}</option>
            <option value="de">{s.langDe}</option>
            <option value="en">{s.langEn}</option>
          </select>
        </label>
      </div>
      <div className="voice-row">
        <span className={`status-chip ${state === 'eleven' ? 'is-good' : ''}`}>
          {state === 'eleven' ? s.voiceEleven : state === 'browser' ? s.voiceBrowser : s.voiceChecking}
        </span>
        <button className="btn btn-ghost" onClick={() => void prepare()} disabled={!!progress}>
          {progress ? s.preparing(progress[0], progress[1]) : s.prepareVoice}
        </button>
      </div>
      {msg && (
        <p className="note" role="status">
          {msg}
        </p>
      )}
      <p className="voice-note">
        {s.voiceHelp}
        {source === 'file' ? ` · ${s.contentFile} ✓` : ''}
      </p>
    </section>
  );
}

export function HostPanel() {
  const s = useStrings();
  const open = useBook((st) => st.hostOpen);
  const event = useBook((st) => st.event);
  const guests = useBook((st) => st.guests);
  const locale = useBook((st) => st.locale);
  const { setHostOpen, updateEvent, addGuest, addGuests, setLocale, loadDemo, resetReveals, clearAll, importData } = useBook.getState();
  const [bulk, setBulk] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const [note, setNote] = useState('');
  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(''), 3500);
    return () => clearTimeout(id);
  }, [note]);

  const json = () =>
    JSON.stringify(
      { app: 'santa-naughty-book', version: 2, ...contentSettings(), event, guests: guests.map(({ id: _id, revealed: _r, ...g }) => g) },
      null,
      2,
    );

  const exportJson = async () => {
    const data = json();
    // Als Claude-Artefakt eingebettet: Download über die Plattform anbieten
    const dl = await artifactDownloads();
    if (dl) {
      try {
        await dl.save({ filename: 'santa-naughty-book.json', data });
      } catch (e) {
        if ((e as { code?: string })?.code !== 'declined') setNote(s.copyFailed);
      }
      return;
    }
    try {
      const blob = new Blob([data], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'santa-naughty-book.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch {
      setNote(s.copyFailed);
    }
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(json());
      setNote(s.copied);
    } catch {
      setNote(s.copyFailed);
    }
  };

  const onImport = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(String(reader.result));
        const full = d && typeof d === 'object' && ('brand' in d || 'voice' in d || 'story' in d || 'language' in d);
        setNote((full ? applyContent(d) : importData(d)) ? s.imported : s.importFailed);
      } catch {
        setNote(s.importFailed);
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <div className={`scrim ${open ? 'is-open' : ''}`} onClick={() => setHostOpen(false)} />
      <aside ref={panelRef} tabIndex={-1} className={`host ${open ? 'is-open' : ''}`} aria-hidden={!open} aria-label={s.hostTitle}>
        <header className="host-head">
          <div>
            <h2>{s.hostTitle}</h2>
            <p>{s.hostIntro}</p>
          </div>
          <button className="icon-btn" onClick={() => setHostOpen(false)} aria-label={s.close}>
            <IconClose />
          </button>
        </header>

        <div className="host-scroll">
          <section className="host-section">
            <h3>{s.eventSection}</h3>
            <label className="field">
              <span className="field-label">{s.eventName}</span>
              <input className="input" value={event.name} maxLength={80} onChange={(e) => updateEvent({ name: e.target.value })} />
            </label>
            <label className="field">
              <span className="field-label">{s.eventDate}</span>
              <input className="input" value={event.date} maxLength={80} onChange={(e) => updateEvent({ date: e.target.value })} />
            </label>
            <div className="field-row">
              <label className="field">
                <span className="field-label">{s.santaName}</span>
                <input className="input" value={event.santa} maxLength={40} onChange={(e) => updateEvent({ santa: e.target.value })} />
              </label>
              <label className="field field--narrow">
                <span className="field-label">{s.language}</span>
                <select className="input" value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
                  <option value="de">Deutsch</option>
                  <option value="en">English</option>
                </select>
              </label>
            </div>
          </section>

          <section className="host-section">
            <h3>
              {s.guestsSection} <small>{s.guestsCount(guests.length)}</small>
            </h3>
            <div className="guest-list">
              {guests.map((g, i) => (
                <GuestCard key={g.id} g={g} index={i} total={guests.length} />
              ))}
            </div>
            <button className="btn btn-gold btn-block" onClick={() => addGuest()}>
              + {s.addGuest}
            </button>
            <label className="field">
              <span className="field-label">{s.bulkAdd}</span>
              <textarea className="input" rows={3} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={'Anna\nLuca\nMia'} />
            </label>
            <button
              className="btn btn-ghost btn-block"
              disabled={!bulk.trim()}
              onClick={() => {
                addGuests(bulk.split('\n'));
                setBulk('');
              }}
            >
              {s.bulkAddButton}
            </button>
          </section>

          <VoiceSection />

          <section className="host-section">
            <h3>{s.dataSection}</h3>
            <div className="btn-grid">
              <button className="btn btn-ghost" onClick={exportJson}>
                {s.exportJson}
              </button>
              <button className="btn btn-ghost" onClick={copyJson}>
                {s.copyJson}
              </button>
              <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
                {s.importJson}
              </button>
              <button className="btn btn-ghost" onClick={resetReveals}>
                {s.resetReveals}
              </button>
              <ConfirmButton className="btn btn-ghost" label={s.loadDemo} onConfirm={loadDemo} />
              <ConfirmButton className="btn btn-ghost btn-danger" label={s.clearAll} onConfirm={clearAll} />
            </div>
            {note && (
              <p className="note" role="status">
                {note}
              </p>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                onImport(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </section>

          <section className="host-section">
            <h3>{s.shortcuts}</h3>
            <p className="muted">{s.shortcutsText}</p>
          </section>
        </div>
      </aside>
    </>
  );
}
