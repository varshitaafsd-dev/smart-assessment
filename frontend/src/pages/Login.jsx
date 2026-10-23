import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await login(email, password); } catch (err) { setError(err.message); setBusy(false); }
  };

  const fill = (e, p) => { setEmail(e); setPassword(p); };

  return (
    <div className="auth-wrap">
      <div className="card">
        <h1>🎓 Smart Online Assessment</h1>
        <p className="sub">Secure exams. Smart evaluation. Trusted integrity.</p>
        <form onSubmit={submit}>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <div className="alert error">{error}</div>}
          <button className="btn" style={{ width: '100%', marginTop: 16 }} disabled={busy}>{busy ? 'Signing in…' : 'Login'}</button>
        </form>
        <p className="small">New here? <Link to="/register">Create an account</Link></p>
        <div className="demo">
          <b>Demo accounts</b> (password <code>password123</code>) — click to fill:<br />
          {[['student@college.edu', 'Student'], ['faculty@college.edu', 'Faculty'], ['admin@college.edu', 'Admin']].map(([em, r]) => (
            <button key={em} type="button" className="btn ghost small" style={{ margin: '6px 6px 0 0' }} onClick={() => fill(em, 'password123')}>{r}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
