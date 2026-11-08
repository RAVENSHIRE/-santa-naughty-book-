import { useEffect, useRef, useState } from 'react';
import type { Guest, Verdict } from '../demoData';
import type { Locale } from '../i18n';
import { useBook, useStrings } from '../store';
import { IconClose, IconDown, IconEye, IconTrash, IconUp } from './icons';

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

  const exportJson = () => {
    const data = { app: 'santa-naughty-book', version: 1, event, guests: guests.map(({ id: _id, revealed: _r, ...g }) => g) };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'santa-naughty-book.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const onImport = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (!importData(JSON.parse(String(reader.result)))) alert(s.importFailed);
      } catch {
        alert(s.importFailed);
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

          <section className="host-section">
            <h3>{s.dataSection}</h3>
            <div className="btn-grid">
              <button className="btn btn-ghost" onClick={exportJson}>
                {s.exportJson}
              </button>
              <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
                {s.importJson}
              </button>
              <button className="btn btn-ghost" onClick={resetReveals}>
                {s.resetReveals}
              </button>
              <button className="btn btn-ghost" onClick={() => confirm(s.confirmDemo) && loadDemo()}>
                {s.loadDemo}
              </button>
              <button className="btn btn-ghost btn-danger" onClick={() => confirm(s.confirmClear) && clearAll()}>
                {s.clearAll}
              </button>
            </div>
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
