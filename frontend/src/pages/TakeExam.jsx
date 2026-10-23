import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { post, put } from '../api.js';

const pad = (n) => String(n).padStart(2, '0');

export default function TakeExam() {
  const { examId } = useParams();
  const nav = useNavigate();
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState({}); // questionId -> optionId
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(null);
  const [warning, setWarning] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [started, setStarted] = useState(false);
  const attemptRef = useRef(null);
  const submittedRef = useRef(false);
  const answersRef = useRef({});
  answersRef.current = answers;

  // 1. Start / resume the attempt (server decides the deadline).
  useEffect(() => {
    post('/attempts/start', { examId })
      .then((d) => {
        attemptRef.current = d.attemptId;
        const offset = new Date(d.serverNow).getTime() - Date.now(); // fix client clock skew
        setSession({ ...d, deadlineMs: new Date(d.deadline).getTime() - offset });
        const saved = {};
        d.savedAnswers.forEach((a) => { if (a.optionId) saved[a.questionId] = a.optionId; });
        setAnswers(saved);
      })
      .catch((e) => setError(e.message));
  }, [examId]);

  // 2. Final submit (manual or automatic when time is over).
  const submit = useCallback(async (auto = false) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      await post(`/attempts/${attemptRef.current}/submit`, {
        answers: Object.entries(answersRef.current).map(([questionId, optionId]) => ({ questionId, optionId })),
      });
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      nav(`/attempt/${attemptRef.current}/review`, { replace: true, state: { auto } });
    } catch (e) {
      submittedRef.current = false; setSubmitting(false); setError(e.message);
    }
  }, [nav]);

  // 3. Countdown.
  useEffect(() => {
    if (!session || !started) return undefined;
    const tick = () => {
      const left = Math.max(0, Math.floor((session.deadlineMs - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) submit(true);
    };
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [session, started, submit]);

  // 4. Proctoring: log suspicious browser events.
  const log = useCallback((activityType, message) => {
    if (!attemptRef.current || submittedRef.current) return;
    post(`/attempts/${attemptRef.current}/activity`, { activityType }).catch(() => {});
    setWarning(message);
  }, []);

  useEffect(() => {
    if (!started) return undefined;
    const onVis = () => { if (document.hidden) log('tab_switch', 'Tab switch detected. This has been recorded.'); };
    const onBlur = () => {}; // visibilitychange covers tab switches; blur alone causes false alarms
    const onCopy = (e) => { e.preventDefault(); log('copy_paste', 'Copy / paste is disabled and was recorded.'); };
    const onCtx = (e) => { e.preventDefault(); log('right_click', 'Right-click is disabled and was recorded.'); };
    const onFs = () => { if (!document.fullscreenElement) log('fullscreen_exit', 'You left full-screen mode. This has been recorded.'); };
    const onKey = (e) => {
      const k = e.key.toLowerCase();
      const blocked = e.key === 'F12' || e.key === 'PrintScreen' ||
        ((e.ctrlKey || e.metaKey) && ['u', 'p', 's'].includes(k)) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(k));
      if (blocked) { e.preventDefault(); log('key_shortcut', 'That keyboard shortcut is blocked and was recorded.'); }
    };
    const onUnload = (e) => { if (!submittedRef.current) { e.preventDefault(); e.returnValue = ''; } };

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    document.addEventListener('copy', onCopy); document.addEventListener('cut', onCopy); document.addEventListener('paste', onCopy);
    document.addEventListener('contextmenu', onCtx);
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('copy', onCopy); document.removeEventListener('cut', onCopy); document.removeEventListener('paste', onCopy);
      document.removeEventListener('contextmenu', onCtx);
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [started, log]);

  const begin = async () => {
    try { await document.documentElement.requestFullscreen(); } catch { /* some browsers refuse; continue */ }
    setStarted(true);
  };

  const choose = (qid, oid) => {
    setAnswers((a) => ({ ...a, [qid]: oid }));
    put(`/attempts/${attemptRef.current}/answer`, { questionId: qid, optionId: oid }).catch(() => {}); // autosave
  };

  if (error) return (
    <div className="card"><div className="alert error">{error}</div><button className="btn ghost" onClick={() => nav('/student')}>Back to dashboard</button></div>
  );
  if (!session) return <p className="muted">Preparing your exam…</p>;

  if (!started) {
    return (
      <div className="card" style={{ maxWidth: 640, margin: '30px auto' }}>
        <h1>{session.exam.title}</h1>
        <p className="sub">{session.questions.length} questions · {session.exam.totalMarks} marks · {session.exam.duration} minutes</p>
        <div className="alert warn">
          <b>Proctoring rules</b>
          <ul>
            <li>The exam runs in full-screen mode. Leaving it is recorded.</li>
            <li>Switching tabs/windows, copy-paste, right-click and developer shortcuts are recorded.</li>
            <li>An AI system flags unusual activity for faculty review. It does not decide misconduct on its own.</li>
            <li>The timer cannot be paused. Your exam is submitted automatically when time ends.</li>
            <li>Your answers are saved automatically; you can resume if your browser closes.</li>
          </ul>
        </div>
        <button className="btn" onClick={begin}>I understand — begin exam</button>
      </div>
    );
  }

  const q = session.questions[idx];
  const answeredCount = Object.keys(answers).length;
  const mm = remaining === null ? '--' : pad(Math.floor(remaining / 60));
  const ss = remaining === null ? '--' : pad(remaining % 60);

  return (
    <div className="exam-lock">
      <div className="exam-bar">
        <div><b>{session.exam.title}</b> <span className="muted small">· {answeredCount}/{session.questions.length} answered</span></div>
        <div className={`timer ${remaining !== null && remaining < 60 ? 'low' : ''}`}>⏱ {mm}:{ss}</div>
      </div>

      {warning && <div className="alert warn between"><span>⚠️ {warning}</span><button className="btn ghost small" onClick={() => setWarning('')}>Dismiss</button></div>}

      <div className="q-nav">
        {session.questions.map((qq, i) => (
          <button key={qq.id} className={`${answers[qq.id] ? 'answered' : ''} ${i === idx ? 'current' : ''}`} onClick={() => setIdx(i)}>{i + 1}</button>
        ))}
      </div>

      <div className="card">
        <div className="muted small">Question {idx + 1} of {session.questions.length} · {q.marks} marks</div>
        <h2 style={{ margin: '8px 0 16px' }}>{q.questionText}</h2>
        {q.options.map((o) => (
          <label key={o.id} className={`option ${answers[q.id] === o.id ? 'selected' : ''}`} style={{ fontWeight: 400, margin: '0 0 8px' }}>
            <input type="radio" name={q.id} checked={answers[q.id] === o.id} onChange={() => choose(q.id, o.id)} />
            {o.optionText}
          </label>
        ))}
      </div>

      <div className="between">
        <button className="btn ghost" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>← Previous</button>
        {idx < session.questions.length - 1
          ? <button className="btn" onClick={() => setIdx(idx + 1)}>Next →</button>
          : <button className="btn success" disabled={submitting} onClick={() => {
              if (answeredCount < session.questions.length && !window.confirm(`You have ${session.questions.length - answeredCount} unanswered question(s). Submit anyway?`)) return;
              submit(false);
            }}>{submitting ? 'Submitting…' : 'Submit exam'}</button>}
      </div>
      {idx < session.questions.length - 1 && (
        <div style={{ textAlign: 'right', marginTop: 12 }}>
          <button className="btn success small" disabled={submitting} onClick={() => { if (window.confirm('Submit the exam now?')) submit(false); }}>Submit now</button>
        </div>
      )}
    </div>
  );
}
