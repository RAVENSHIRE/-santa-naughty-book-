import { useEffect, useRef, useState } from 'react';
import { sfx } from '../audio';
import { guestIndexForPage, lastPage, useBook, useStrings } from '../store';
import { IconBook, IconExpand, IconLeft, IconMute, IconQuill, IconRight, IconSound, IconStamp } from './icons';

function toggleFullscreen() {
  try {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  } catch {
    /* nicht unterstützt */
  }
}

/** Blendet die Bedienelemente nach ein paar Sekunden ohne Bewegung aus (Präsentationsmodus) */
function useIdle(ms: number) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let id = 0;
    const wake = () => {
      setIdle(false);
      window.clearTimeout(id);
      id = window.setTimeout(() => setIdle(true), ms);
    };
    wake();
    const evs = ['pointermove', 'pointerdown', 'keydown', 'touchstart'] as const;
    evs.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    return () => {
      window.clearTimeout(id);
      evs.forEach((e) => window.removeEventListener(e, wake));
    };
  }, [ms]);
  return idle;
}

export function Overlay() {
  const s = useStrings();
  const page = useBook((st) => st.page);
  const guests = useBook((st) => st.guests);
  const event = useBook((st) => st.event);
  const focus = useBook((st) => st.focus);
  const singlePage = useBook((st) => st.singlePage);
  const reveal = useBook((st) => st.reveal);
  const sound = useBook((st) => st.sound);
  const ready = useBook((st) => st.ready);
  const hostOpen = useBook((st) => st.hostOpen);
  const { next, prev, setPage, startReveal, toggleSound, setHostOpen } = useBook.getState();
  const [picker, setPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const idle = useIdle(4000);

  const max = lastPage(guests.length);
  const gi = guestIndexForPage(page, guests.length);
  const guest = gi >= 0 ? guests[gi] : null;
  const busy = reveal.phase === 'suspense' || reveal.phase === 'slam';

  useEffect(() => {
    if (!picker) return;
    const close = (e: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPicker(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [picker]);

  const label =
    page === 0
      ? s.cover
      : page === 1
        ? s.titlePage
        : page === max
          ? s.closing
          : guest
            ? `${s.file} ${gi + 1}/${guests.length} · ${guest.name || '…'}`
            : '';

  const canPrev = page > 0;
  const canNext = page < max || (singlePage && focus === 'left');
  const act = (fn: () => void) => () => {
    sfx.unlock();
    fn();
  };

  const entries = [
    { label: s.titlePage, page: 1 },
    ...guests.map((g, i) => ({ label: `${i + 1}. ${g.name || '…'}`, page: i + 2, done: g.revealed, verdict: g.verdict })),
    { label: s.closing, page: max },
  ];

  return (
    <div className={`overlay ${idle && page > 0 && !hostOpen && !picker ? 'is-idle' : ''} ${ready ? 'is-ready' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-script">Santa's</span>
          <span className="brand-title">Naughty Book</span>
          {page > 0 && <span className="brand-event">{event.name}</span>}
        </div>
        <div className="top-actions">
          {page > 0 && (
            <button className="icon-btn" onClick={act(() => setPage(0))} title={s.closeBook} aria-label={s.closeBook}>
              <IconBook />
            </button>
          )}
          <button className="icon-btn" onClick={act(toggleSound)} title={sound ? s.soundOff : s.soundOn} aria-label={sound ? s.soundOff : s.soundOn}>
            {sound ? <IconSound /> : <IconMute />}
          </button>
          <button className="icon-btn hide-ios" onClick={toggleFullscreen} title={s.fullscreen} aria-label={s.fullscreen}>
            <IconExpand />
          </button>
          <button className="icon-btn icon-btn--gold" onClick={act(() => setHostOpen(true))} title={s.host} aria-label={s.host}>
            <IconQuill />
            <span className="btn-label">{s.host}</span>
          </button>
        </div>
      </header>

      {page === 0 && (
        <section className="intro">
          <div className="intro-card">
            <p className="intro-kicker">{event.date}</p>
            <h1>
              <span className="intro-script">Santa's</span>
              <span className="intro-title">Naughty Book</span>
            </h1>
            <p className="intro-event">{event.name}</p>
          </div>
          <div className="intro-cta">
            <button className="btn btn-gold btn-lg" onClick={act(next)} disabled={!ready}>
              <IconBook /> {s.openBook}
            </button>
            <p className="hint">{s.tapToOpen}</p>
          </div>
        </section>
      )}

      {page > 0 && (
        <nav className="bottombar" aria-label="Navigation">
          {guest && (
            <button className={`btn btn-gold reveal-btn ${busy ? 'is-busy' : ''}`} onClick={act(startReveal)} disabled={busy}>
              <IconStamp />
              {busy ? s.revealing : guest.revealed ? s.replay : s.reveal}
            </button>
          )}
          <div className="pager">
            <button className="icon-btn" onClick={act(prev)} disabled={!canPrev || busy} aria-label={s.prev}>
              <IconLeft />
            </button>
            <div className="pager-label-wrap" ref={pickerRef}>
              <button className="pager-label" onClick={() => setPicker((v) => !v)} title={s.jumpTo}>
                {label}
              </button>
              {picker && (
                <div className="picker" role="menu">
                  <div className="picker-title">{s.jumpTo}</div>
                  {entries.map((e) => (
                    <button
                      key={e.page}
                      role="menuitem"
                      className={`picker-item ${e.page === page ? 'is-active' : ''}`}
                      onClick={() => {
                        sfx.unlock();
                        setPage(e.page);
                        setPicker(false);
                      }}
                    >
                      <span>{e.label}</span>
                      {'done' in e && e.done && <span className={`dot dot--${e.verdict}`} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="icon-btn" onClick={act(next)} disabled={!canNext || busy} aria-label={s.next}>
              <IconRight />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
