import { useState } from 'react';
import { get, put } from '../api.js';
import { Pill, Status, fmt, useLoad } from '../components/ui.jsx';

const LABEL = { tab_switch: 'Tab switches', copy_paste: 'Copy/paste', right_click: 'Right-clicks', fullscreen_exit: 'Full-screen exits', key_shortcut: 'Blocked shortcuts', face_not_visible: 'Face not visible' };

function Report({ r, onSaved }) {
  const [remarks, setRemarks] = useState(r.remarks || '');
  const [busy, setBusy] = useState(false);
  const save = async (reportStatus) => {
    setBusy(true);
    try { await put(`/faculty/integrity/${r._id}`, { reportStatus, remarks }); onSaved(); } catch (e) { alert(e.message); }
    setBusy(false);
  };
  const a = r.analysis;
  return (
    <div className="card">
      <div className="between">
        <div><b>{r.student?.name}</b> <span className="muted small">{r.student?.email}</span>
          <div className="small muted">{r.exam?.title} · {fmt(r.createdAt)}</div></div>
        <div style={{ textAlign: 'right' }}><div className="risk-score">{a.riskLevel === 'UNAVAILABLE' ? '—' : a.riskScore}</div><Pill value={a.riskLevel} /></div>
      </div>
      <div style={{ margin: '12px 0' }}>
        {a.suspiciousActivity.length ? <ul style={{ margin: 0 }}>{a.suspiciousActivity.map((s, i) => <li key={i} className="small">{s}</li>)}</ul>
          : <span className="small muted">No suspicious behaviour detected.</span>}
      </div>
      <div className="small muted">{Object.entries(r.activityCounts).map(([k, v]) => `${LABEL[k] || k}: ${v}`).join(' · ') || 'No events logged'}</div>
      <label>Faculty remarks</label>
      <textarea rows="2" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Notes after reviewing the activity log…" />
      <div className="between" style={{ marginTop: 10 }}>
        <Pill value={r.reportStatus} />
        <div>
          <button className="btn success small" disabled={busy} onClick={() => save('cleared')}>Clear</button>{' '}
          <button className="btn danger small" disabled={busy} onClick={() => save('escalated')}>Escalate</button>{' '}
          <button className="btn ghost small" disabled={busy} onClick={() => save('pending_review')}>Mark pending</button>
        </div>
      </div>
    </div>
  );
}

export default function IntegrityReports() {
  const [filter, setFilter] = useState('all');
  const { data, error, loading, reload } = useLoad(() => get('/faculty/integrity'));
  const list = (data?.reports || []).filter((r) => filter === 'all' || r.reportStatus === filter);
  return (
    <>
      <h1>Academic Integrity Reports</h1>
      <div className="alert warn">The AI only <b>flags</b> unusual activity for review. A flag is not proof of misconduct — the final decision is yours.</div>
      <div className="row" style={{ maxWidth: 260, marginBottom: 12 }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All reports</option><option value="pending_review">Pending review</option>
          <option value="cleared">Cleared</option><option value="escalated">Escalated</option>
        </select>
      </div>
      <Status loading={loading} error={error} />
      {list.map((r) => <Report key={r._id + r.updatedAt} r={r} onSaved={reload} />)}
      {!loading && list.length === 0 && <p className="muted">No reports to show.</p>}
    </>
  );
}
