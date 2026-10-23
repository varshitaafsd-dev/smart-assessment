import { Link, useLocation, useParams } from 'react-router-dom';
import { get } from '../api.js';
import { Status, useLoad } from '../components/ui.jsx';

export default function ReviewAttempt() {
  const { attemptId } = useParams();
  const { state } = useLocation();
  const { data, error, loading } = useLoad(() => get(`/attempts/${attemptId}/review`), [attemptId]);
  const r = data?.result;

  return (
    <>
      <Status loading={loading} error={error} />
      {data && (
        <>
          {state?.auto && <div className="alert warn">Time ran out — your exam was submitted automatically.</div>}
          <h1>{data.exam.title}</h1>
          <div className="card grid">
            <div className="stat"><div className="num">{r.totalScore}/{r.totalMarks}</div><div className="lbl">Score</div></div>
            <div className="stat"><div className="num">{r.percentage}%</div><div className="lbl">Percentage</div></div>
            <div className="stat"><div className="num">{r.grade}</div><div className="lbl">Grade</div></div>
          </div>
          <h2>Answer review</h2>
          {data.review.map((q, i) => (
            <div className="card" key={i}>
              <div className="between"><b>Q{i + 1}. {q.questionText}</b><span className={`pill ${q.isCorrect ? 'LOW' : 'HIGH'}`}>{q.marksAwarded}/{q.marks}</span></div>
              {q.options.map((o, j) => (
                <div key={j} className={`option ${o.isCorrect ? 'correct' : o.selected ? 'wrong' : ''}`} style={{ cursor: 'default' }}>
                  {o.isCorrect ? '✅' : o.selected ? '❌' : '⚪'} {o.optionText}
                  {o.selected && <span className="muted small"> (your answer)</span>}
                </div>
              ))}
              {!q.options.some((o) => o.selected) && <div className="small muted">You did not answer this question.</div>}
            </div>
          ))}
          <Link className="btn ghost" to="/student">← Back to dashboard</Link>
        </>
      )}
    </>
  );
}
