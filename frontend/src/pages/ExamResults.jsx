import { Link, useParams } from 'react-router-dom';
import { get } from '../api.js';
import { BarChart } from '../components/charts.jsx';
import { Pill, Stat, Status, fmt, useLoad } from '../components/ui.jsx';

export default function ExamResults() {
  const { examId } = useParams();
  const { data, error, loading } = useLoad(() => get(`/faculty/exams/${examId}/results`), [examId]);
  const rs = data?.results || [];
  const avg = rs.length ? (rs.reduce((s, r) => s + r.percentage, 0) / rs.length).toFixed(1) : 0;
  const pass = rs.filter((r) => r.percentage >= 40).length;

  // score distribution in 10% buckets
  const buckets = Array.from({ length: 10 }, (_, i) => `${i * 10}-${i * 10 + 10}`);
  const counts = buckets.map((_, i) => rs.filter((r) => Math.min(Math.floor(r.percentage / 10), 9) === i).length);

  return (
    <>
      <Link to="/faculty" className="muted small">← Back to dashboard</Link>
      <h1>{data?.exam.title || 'Results'}</h1>
      <p className="sub">Scores, grades and AI integrity flags for every submission.</p>
      <Status loading={loading} error={error} />
      {data && (
        <>
          <div className="grid">
            <Stat num={rs.length} label="Submissions" /><Stat num={`${avg}%`} label="Average" />
            <Stat num={rs.length ? `${Math.round((pass / rs.length) * 100)}%` : '—'} label="Pass rate (≥40%)" />
            <Stat num={rs.filter((r) => r.riskLevel === 'HIGH').length} label="High-risk flags" />
          </div>
          {rs.length > 0 && <div className="card"><h2>Score distribution</h2>
            <div className="chart-box"><BarChart labels={buckets} datasets={[{ label: 'Students', data: counts, backgroundColor: '#4f46e5' }]} /></div></div>}
          <div className="card table-wrap">
            <table>
              <thead><tr><th>Rank</th><th>Student</th><th>Score</th><th>%</th><th>Grade</th><th>AI risk</th><th>Review</th><th>Submitted</th></tr></thead>
              <tbody>
                {rs.map((r, i) => (
                  <tr key={r._id}>
                    <td>{i + 1}</td><td>{r.student?.name}<div className="small muted">{r.student?.email}</div></td>
                    <td>{r.totalScore}/{r.totalMarks}</td><td>{r.percentage}%</td><td><b>{r.grade}</b></td>
                    <td><Pill value={r.riskLevel} /> {r.riskScore !== null && <span className="small muted">{r.riskScore}</span>}</td>
                    <td>{r.reportStatus ? <Pill value={r.reportStatus} /> : '—'}</td><td>{fmt(r.createdAt)}</td>
                  </tr>
                ))}
                {rs.length === 0 && <tr><td colSpan="8" className="muted">No submissions yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
