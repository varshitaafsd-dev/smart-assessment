import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { del, get, post, put } from '../api.js';
import { BarChart, DonutChart } from '../components/charts.jsx';
import { Pill, Stat, Status, fmt, toLocalInput, useLoad } from '../components/ui.jsx';

export default function FacultyDashboard() {
  const nav = useNavigate();
  const exams = useLoad(() => get('/exams'));
  const an = useLoad(() => get('/faculty/analytics'));
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [f, setF] = useState({ title: '', description: '', duration: 30,
    startTime: toLocalInput(new Date()), endTime: toLocalInput(new Date(Date.now() + 7 * 864e5)) });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const create = async (e) => {
    e.preventDefault(); setErr('');
    try {
      const { exam } = await post('/exams', { ...f, startTime: new Date(f.startTime), endTime: new Date(f.endTime) });
      nav(`/faculty/exam/${exam._id}`);
    } catch (e2) { setErr(e2.message); }
  };
  const toggle = async (e) => {
    try { await put(`/exams/${e._id}`, { status: e.status === 'published' ? 'draft' : 'published' }); exams.reload(); an.reload(); }
    catch (e2) { alert(e2.message); }
  };
  const remove = async (e) => {
    if (!window.confirm(`Delete "${e.title}" and all its questions?`)) return;
    try { await del(`/exams/${e._id}`); exams.reload(); an.reload(); } catch (e2) { alert(e2.message); }
  };

  const a = an.data;
  const risk = a?.riskDistribution || {};
  const grades = a?.gradeDistribution || {};
  const withData = (a?.perExam || []).filter((x) => x.attempts > 0);

  return (
    <>
      <div className="between"><div><h1>Faculty Dashboard</h1><p className="sub">Create exams, manage questions and review results.</p></div>
        <button className="btn" onClick={() => setShow(!show)}>{show ? 'Cancel' : '+ New exam'}</button></div>

      {show && (
        <form className="card" onSubmit={create}>
          <h2>Create exam</h2>
          <label>Title</label><input value={f.title} onChange={set('title')} required />
          <label>Description</label><textarea rows="2" value={f.description} onChange={set('description')} />
          <div className="row">
            <div><label>Opens</label><input type="datetime-local" value={f.startTime} onChange={set('startTime')} required /></div>
            <div><label>Closes</label><input type="datetime-local" value={f.endTime} onChange={set('endTime')} required /></div>
            <div><label>Duration (min)</label><input type="number" min="1" value={f.duration} onChange={set('duration')} required /></div>
          </div>
          {err && <div className="alert error">{err}</div>}
          <button className="btn" style={{ marginTop: 14 }}>Create & add questions</button>
        </form>
      )}

      {a && (
        <>
          <div className="grid">
            <Stat num={a.totals.exams} label="Exams" /><Stat num={a.totals.published} label="Published" />
            <Stat num={a.totals.submissions} label="Submissions" /><Stat num={a.totals.pendingReviews} label="Integrity reviews pending" />
          </div>
          {withData.length > 0 && (
            <div className="grid-2">
              <div className="card"><h2>Average score per exam</h2>
                <BarChart labels={withData.map((x) => x.title)} datasets={[{ label: 'Average %', data: withData.map((x) => x.average), backgroundColor: '#4f46e5' }, { label: 'Pass rate %', data: withData.map((x) => x.passRate), backgroundColor: '#34d399' }]} /></div>
              <div className="card"><h2>AI integrity risk levels</h2>
                <DonutChart labels={['Low', 'Medium', 'High', 'Unavailable']} data={[risk.LOW || 0, risk.MEDIUM || 0, risk.HIGH || 0, risk.UNAVAILABLE || 0]} colors={['#22c55e', '#f59e0b', '#ef4444', '#9ca3af']} />
                <p className="small muted">Grades: {Object.entries(grades).map(([g, n]) => `${g}: ${n}`).join(' · ') || '—'}</p></div>
            </div>
          )}
        </>
      )}

      <h2 style={{ marginTop: 24 }}>My exams</h2>
      <Status loading={exams.loading} error={exams.error} />
      {(exams.data?.exams || []).map((e) => (
        <div className="card between" key={e._id}>
          <div>
            <b>{e.title}</b> <Pill value={e.status} />
            <div className="small muted">{e.duration} min · {e.totalMarks} marks · {fmt(e.startTime)} → {fmt(e.endTime)}</div>
          </div>
          <div className="row" style={{ flex: '0 0 auto' }}>
            <Link className="btn ghost small auto" to={`/faculty/exam/${e._id}`}>Questions</Link>
            <Link className="btn ghost small auto" to={`/faculty/exam/${e._id}/results`}>Results</Link>
            <button className="btn small auto" onClick={() => toggle(e)}>{e.status === 'published' ? 'Unpublish' : 'Publish'}</button>
            <button className="btn danger small auto" onClick={() => remove(e)}>Delete</button>
          </div>
        </div>
      ))}
      {exams.data?.exams.length === 0 && <p className="muted">No exams yet. Click “New exam”.</p>}
    </>
  );
}
