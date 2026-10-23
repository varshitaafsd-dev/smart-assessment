import { useEffect, useState } from 'react';

export const Pill = ({ value }) => <span className={`pill ${value}`}>{String(value).replace('_', ' ')}</span>;

export const fmt = (d) => new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export const toLocalInput = (d) => {
  const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};

export const Stat = ({ num, label }) => (
  <div className="card stat"><div className="num">{num}</div><div className="lbl">{label}</div></div>
);

// Loads data once and exposes loading / error / reload.
export function useLoad(fn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true); setError('');
    try { setData(await fn()); } catch (e) { setError(e.message); }
    setLoading(false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, deps);
  return { data, error, loading, reload: load };
}

export const Status = ({ loading, error }) => (
  <>
    {loading && <p className="muted">Loading…</p>}
    {error && <div className="alert error">{error}</div>}
  </>
);
