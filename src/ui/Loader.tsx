import { useBook, useStrings } from '../store';
import { IconSnow } from './icons';

export function Loader() {
  const ready = useBook((s) => s.ready);
  const s = useStrings();
  return (
    <div className={`loader ${ready ? 'is-done' : ''}`} aria-hidden={ready}>
      <div className="loader-inner">
        <IconSnow className="loader-snow" width={54} height={54} />
        <p className="loader-title">
          <span className="brand-script">Santa's</span> Naughty Book
        </p>
        <p className="loader-text">{s.loading}</p>
      </div>
    </div>
  );
}
