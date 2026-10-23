import { Link, useNavigate } from 'react-router-dom';
import { get } from '../api.js';
import { Pill, Stat, Status, fmt, useLoad } from '../components/ui.jsx';

export default function StudentDashboard() {
  const nav = useNavigate();
  const exams = useLoad(() => get('/exams'));
  const results = useLoad(() => get('/attempts/mine/results'));
  const list = exams.data?.exams || [];
  const rs = results.data?.results || [];
  const now = Date.now();
  const avg = rs.length ? (rs.reduce((s, r) => s + r.percentage, 0) / rs.length).toFixed(1) : '—';

  const state = (e) => {
    if (e.attemptStatus === 'submitted') return 'submitted';
    if (e.attemptStatus === 'in_progress') return 'in_progress';
    if (now < new Date(e.startTime)) return 'upcoming';
    if (now > new Date(e.endTime)) return 'closed';
    return 'available';
  };

  return (
    <>
      <h1>Student Dashboard</h1>
      <p className="sub">View available exams, attempt them and check your results.</p>
      <div className="grid">
        <Stat num={list.filter((e) => state(e) === 'available' || state(e) === 'in_progress').length} label="Exams available" />
        <Stat num={rs.length} label="Exams completed" />
        <Stat num={avg === '—' ? avg : `${avg}%`} label="Average score" />
      </div>

      <h2 style={{ marginTop: 24 }}>Exams</h2>
      <Status loading={exams.loading} error={exams.error} />
      {list.length === 0 && !exams.loading && <p className="muted">No exams have been published yet.</p>}
      {list.map((e) => {
        const s = state(e);
        return (
          <div className="card between" key={e._id}>
            <div>
              <b>{e.title}</b> <Pill value={s === 'available' ? 'published' : s === 'upcoming' || s === 'closed' ? 'UNAVAILABLE' : s} />
              <div className="small muted">{e.description}</div>
              <div className="small muted">By {e.faculty?.name} · {e.duration} min · {e.totalMarks} marks · {e.questionCount} questions</div>
              <div className="small muted">Window: {fmt(e.startTime)} → {fmt(e.endTime)}</div>
            </div>
            <div>
              {(s === 'available' || s === 'in_progress') && (
                <button className="btn" onClick={() => nav(`/exam/take/${e._id}`)}>{s === 'in_progress' ? 'Resume exam' : 'Start exam'}</button>
              )}
              {s === 'submitted' && <Link className="btn ghost" to={`/attempt/${e.attemptId}/review`}>View result</Link>}
              {s === 'upcoming' && <span className="muted small">Not open yet</span>}
              {s === 'closed' && <span className="muted small">Closed</span>}
            </div>
          </div>
        );
      })}

      <h2 style={{ marginTop: 24 }}>My Results</h2>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Exam</th><th>Score</th><th>Percentage</th><th>Grade</th><th>Date</th></tr></thead>
          <tbody>
            {rs.map((r) => (
              <tr key={r._id}><td>{r.exam?.title}</td><td>{r.totalScore}/{r.totalMarks}</td><td>{r.percentage}%</td><td><b>{r.grade}</b></td><td>{fmt(r.createdAt)}</td></tr>
            ))}
            {rs.length === 0 && <tr><td colSpan="5" className="muted">No results yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
