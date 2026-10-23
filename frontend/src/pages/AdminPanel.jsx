import { del, get, put } from '../api.js';
import { Stat, Status, fmt, useLoad } from '../components/ui.jsx';
import { useAuth } from '../auth.jsx';

export default function AdminPanel() {
  const { user: me } = useAuth();
  const stats = useLoad(() => get('/admin/stats'));
  const users = useLoad(() => get('/admin/users'));
  const s = stats.data;

  const update = async (u, patch) => {
    try { await put(`/admin/users/${u.id}`, patch); users.reload(); stats.reload(); } catch (e) { alert(e.message); }
  };
  const remove = async (u) => {
    if (!window.confirm(`Delete ${u.name}? This cannot be undone.`)) return;
    try { await del(`/admin/users/${u.id}`); users.reload(); stats.reload(); } catch (e) { alert(e.message); }
  };

  return (
    <>
      <h1>Administration</h1>
      <p className="sub">Manage users, system access and view system-wide reports.</p>
      <Status loading={stats.loading} error={stats.error} />
      {s && (
        <div className="grid">
          <Stat num={s.students} label="Students" /><Stat num={s.faculty} label="Faculty" /><Stat num={s.exams} label="Exams" />
          <Stat num={s.submissions} label="Submissions" /><Stat num={s.highRiskFlags} label="High-risk flags" /><Stat num={s.pendingReviews} label="Pending reviews" />
        </div>
      )}
      <h2 style={{ marginTop: 24 }}>Users</h2>
      <Status loading={users.loading} error={users.error} />
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th></th></tr></thead>
          <tbody>
            {(users.data?.users || []).map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td><td>{u.email}</td>
                <td>
                  <select value={u.role} disabled={u.id === me.id} onChange={(e) => update(u, { role: e.target.value })} style={{ width: 120 }}>
                    <option value="student">student</option><option value="faculty">faculty</option><option value="admin">admin</option>
                  </select>
                </td>
                <td><span className={`pill ${u.active ? 'LOW' : 'HIGH'}`}>{u.active ? 'active' : 'disabled'}</span></td>
                <td>{fmt(u.createdAt)}</td>
                <td>
                  {u.id !== me.id && <>
                    <button className="btn ghost small" onClick={() => update(u, { active: !u.active })}>{u.active ? 'Disable' : 'Enable'}</button>{' '}
                    <button className="btn danger small" onClick={() => remove(u)}>Delete</button></>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
