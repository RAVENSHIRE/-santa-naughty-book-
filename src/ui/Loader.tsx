import { useBook } from '../store';
import { STRINGS } from '../strings';

export function Loader() {
  const ready = useBook((s) => s.ready);
  return (
    <div className={`loader ${ready ? 'is-done' : ''}`} aria-hidden={ready}>
      <p className="loader-title">Santa's Naughty Book</p>
      <p>{STRINGS.loading}</p>
    </div>
  );
}
