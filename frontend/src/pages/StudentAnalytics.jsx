import { get } from '../api.js';
import { BarChart, LineChart } from '../components/charts.jsx';
import { Stat, Status, fmt, useLoad } from '../components/ui.jsx';

export default function StudentAnalytics() {
  const { data, error, loading } = useLoad(() => get('/analytics/student'));
  const s = data?.summary;
  const t = data?.trend || [];
  const labels = t.map((x) => x.exam);

  return (
    <>
      <h1>My Performance</h1>
      <p className="sub">Your scores over time compared with the class average.</p>
      <Status loading={loading} error={error} />
      {data && (
        <>
          <div className="grid">
            <Stat num={s.examsTaken} label="Exams taken" />
            <Stat num={`${s.averageScore}%`} label="Average score" />
            <Stat num={`${s.bestScore}%`} label="Best score" />
            <Stat num={s.performanceTrend} label="Trend" />
          </div>
          {t.length === 0 ? <p className="muted">Complete an exam to see your analytics.</p> : (
            <>
              <div className="grid-2">
                <div className="card"><h2>Score trend</h2>
                  <LineChart labels={labels} datasets={[{ label: 'My score %', data: t.map((x) => x.percentage), borderColor: '#4f46e5', backgroundColor: '#4f46e522', fill: true, tension: 0.3 }]} />
                </div>
                <div className="card"><h2>Me vs class average</h2>
                  <BarChart labels={labels} datasets={[
                    { label: 'My score %', data: t.map((x) => x.percentage), backgroundColor: '#4f46e5' },
                    { label: 'Class average %', data: t.map((x) => x.classAverage), backgroundColor: '#fbbf24' }]} />
                </div>
              </div>
              <div className="card table-wrap">
                <table>
                  <thead><tr><th>Exam</th><th>Date</th><th>Score</th><th>Grade</th><th>Class avg</th><th>Rank</th></tr></thead>
                  <tbody>{t.map((x, i) => (
                    <tr key={i}><td>{x.exam}</td><td>{fmt(x.date)}</td><td>{x.percentage}%</td><td><b>{x.grade}</b></td><td>{x.classAverage}%</td><td>{x.rank} / {x.participants}</td></tr>))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
