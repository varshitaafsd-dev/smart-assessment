import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Register() {
  const { register } = useAuth();
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'student', department: '', year: '', inviteCode: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await register(f); } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <div className="auth-wrap">
      <div className="card">
        <h1>Create account</h1>
        <p className="sub">Register as a student or faculty member.</p>
        <form onSubmit={submit}>
          <label>Full name</label><input value={f.name} onChange={set('name')} required />
          <label>Email</label><input type="email" value={f.email} onChange={set('email')} required />
          <label>Password (min 6 characters)</label><input type="password" minLength={6} value={f.password} onChange={set('password')} required />
          <label>I am a</label>
          <select value={f.role} onChange={set('role')}><option value="student">Student</option><option value="faculty">Faculty</option></select>
          <label>Department</label><input value={f.department} onChange={set('department')} placeholder="e.g. CSE" />
          {f.role === 'student' && (<><label>Year</label><input type="number" min="1" max="6" value={f.year} onChange={set('year')} /></>)}
          {f.role === 'faculty' && (<><label>Faculty invite code</label><input value={f.inviteCode} onChange={set('inviteCode')} placeholder="Provided by your institution" /></>)}
          {error && <div className="alert error">{error}</div>}
          <button className="btn" style={{ width: '100%', marginTop: 16 }} disabled={busy}>{busy ? 'Creating…' : 'Register'}</button>
        </form>
        <p className="small">Already registered? <Link to="/login">Login</Link></p>
      </div>
    </div>
  );
}
