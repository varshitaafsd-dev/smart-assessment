import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { del, get, post, put } from '../api.js';
import { Status, toLocalInput, useLoad } from '../components/ui.jsx';

const blank = () => ({ questionText: '', marks: 1, options: [{ optionText: '', isCorrect: true }, { optionText: '', isCorrect: false }, { optionText: '', isCorrect: false }, { optionText: '', isCorrect: false }] });

export default function ExamEditor() {
  const { examId } = useParams();
  const exam = useLoad(() => get(`/exams/${examId}`), [examId]);
  const qs = useLoad(() => get(`/exams/${examId}/questions`), [examId]);
  const [form, setForm] = useState(blank());
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [settings, setSettings] = useState(null);

  const e = exam.data?.exam;
  const s = settings || (e && { title: e.title, description: e.description, duration: e.duration, startTime: toLocalInput(e.startTime), endTime: toLocalInput(e.endTime) });

  const refresh = () => { exam.reload(); qs.reload(); };
  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 4000); };

  const saveSettings = async (ev) => {
    ev.preventDefault();
    try { await put(`/exams/${examId}`, { ...s, startTime: new Date(s.startTime), endTime: new Date(s.endTime) }); flash('ok', 'Exam settings saved'); refresh(); setSettings(null); }
    catch (err) { flash('error', err.message); }
  };
  const saveQuestion = async (ev) => {
    ev.preventDefault();
    const payload = { ...form, options: form.options.filter((o) => o.optionText.trim()) };
    try {
      if (editing) await put(`/exams/${examId}/questions/${editing}`, payload);
      else await post(`/exams/${examId}/questions`, payload);
      setForm(blank()); setEditing(null); flash('ok', editing ? 'Question updated' : 'Question added'); refresh();
    } catch (err) { flash('error', err.message); }
  };
  const edit = (q) => {
    setEditing(q._id);
    setForm({ questionText: q.questionText, marks: q.marks, options: q.options.map((o) => ({ optionText: o.optionText, isCorrect: o.isCorrect })) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const remove = async (q) => {
    if (!window.confirm('Delete this question?')) return;
    try { await del(`/exams/${examId}/questions/${q._id}`); refresh(); } catch (err) { flash('error', err.message); }
  };
  const setOpt = (i, patch) => setForm({ ...form, options: form.options.map((o, j) => (j === i ? { ...o, ...patch } : patch.isCorrect ? { ...o, isCorrect: false } : o)) });

  return (
    <>
      <Link to="/faculty" className="muted small">← Back to dashboard</Link>
      <Status loading={exam.loading} error={exam.error} />
      {e && s && (
        <>
          <h1>{e.title}</h1>
          <p className="sub">{e.totalMarks} total marks · {qs.data?.questions.length || 0} questions · {e.status}</p>
          {msg.text && <div className={`alert ${msg.type}`}>{msg.text}</div>}

          <details className="card"><summary><b>Exam settings</b> (schedule, duration, marks)</summary>
            <form onSubmit={saveSettings}>
              <label>Title</label><input value={s.title} onChange={(x) => setSettings({ ...s, title: x.target.value })} required />
              <label>Description</label><textarea rows="2" value={s.description} onChange={(x) => setSettings({ ...s, description: x.target.value })} />
              <div className="row">
                <div><label>Opens</label><input type="datetime-local" value={s.startTime} onChange={(x) => setSettings({ ...s, startTime: x.target.value })} /></div>
                <div><label>Closes</label><input type="datetime-local" value={s.endTime} onChange={(x) => setSettings({ ...s, endTime: x.target.value })} /></div>
                <div><label>Duration (min)</label><input type="number" min="1" value={s.duration} onChange={(x) => setSettings({ ...s, duration: x.target.value })} /></div>
              </div>
              <button className="btn" style={{ marginTop: 14 }}>Save settings</button>
            </form>
          </details>

          <form className="card" onSubmit={saveQuestion}>
            <h2>{editing ? 'Edit question' : 'Add question'}</h2>
            <label>Question</label><textarea rows="2" value={form.questionText} onChange={(x) => setForm({ ...form, questionText: x.target.value })} required />
            <label>Marks</label><input type="number" min="0" style={{ maxWidth: 120 }} value={form.marks} onChange={(x) => setForm({ ...form, marks: x.target.value })} />
            <label>Options (select the correct one)</label>
            {form.options.map((o, i) => (
              <div className="row" key={i} style={{ marginBottom: 8 }}>
                <input type="radio" className="auto" style={{ width: 'auto', flex: '0 0 auto' }} name="correct" checked={o.isCorrect} onChange={() => setOpt(i, { isCorrect: true })} title="Mark as correct" />
                <input placeholder={`Option ${i + 1}`} value={o.optionText} onChange={(x) => setOpt(i, { optionText: x.target.value })} required={i < 2} />
              </div>
            ))}
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn auto">{editing ? 'Update question' : 'Add question'}</button>
              {editing && <button type="button" className="btn ghost auto" onClick={() => { setEditing(null); setForm(blank()); }}>Cancel</button>}
            </div>
            <p className="small muted">Leave options 3–4 blank for fewer choices (minimum 2).</p>
          </form>

          <h2>Questions</h2>
          {(qs.data?.questions || []).map((q, i) => (
            <div className="card" key={q._id}>
              <div className="between"><b>Q{i + 1}. {q.questionText}</b><span className="pill published">{q.marks} marks</span></div>
              {q.options.map((o) => <div key={o._id} className="small">{o.isCorrect ? '✅' : '⚪'} {o.optionText}</div>)}
              <div style={{ marginTop: 10 }}>
                <button className="btn ghost small" onClick={() => edit(q)}>Edit</button>{' '}
                <button className="btn danger small" onClick={() => remove(q)}>Delete</button>
              </div>
            </div>
          ))}
          {qs.data?.questions.length === 0 && <p className="muted">No questions yet.</p>}
        </>
      )}
    </>
  );
}
