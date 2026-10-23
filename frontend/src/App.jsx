import { Navigate, Route, Routes, Link, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import StudentDashboard from './pages/StudentDashboard.jsx';
import TakeExam from './pages/TakeExam.jsx';
import ReviewAttempt from './pages/ReviewAttempt.jsx';
import StudentAnalytics from './pages/StudentAnalytics.jsx';
import FacultyDashboard from './pages/FacultyDashboard.jsx';
import ExamEditor from './pages/ExamEditor.jsx';
import ExamResults from './pages/ExamResults.jsx';
import IntegrityReports from './pages/IntegrityReports.jsx';
import AdminPanel from './pages/AdminPanel.jsx';

const home = (role) => (role === 'student' ? '/student' : role === 'faculty' ? '/faculty' : '/admin');

function Guard({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={home(user.role)} replace />;
  return children;
}

function NavBar() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  if (!user || loc.pathname.startsWith('/exam/take')) return null; // distraction-free during exams
  const links = {
    student: [['/student', 'Exams'], ['/student/analytics', 'My Performance']],
    faculty: [['/faculty', 'Dashboard'], ['/faculty/integrity', 'Integrity Reports']],
    admin: [['/admin', 'Administration'], ['/faculty', 'Exams'], ['/faculty/integrity', 'Integrity Reports']],
  }[user.role];
  return (
    <header className="nav">
      <div className="brand">🎓 Smart Assessment</div>
      <nav>
        {links.map(([to, label]) => (
          <Link key={to} to={to} className={loc.pathname === to ? 'active' : ''}>{label}</Link>
        ))}
      </nav>
      <div className="nav-user">
        <span>{user.name} <span className="badge">{user.role}</span></span>
        <button className="btn ghost" onClick={logout}>Logout</button>
      </div>
    </header>
  );
}

export default function App() {
  const { user } = useAuth();
  return (
    <>
      <NavBar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Navigate to={user ? home(user.role) : '/login'} replace />} />
          <Route path="/login" element={user ? <Navigate to={home(user.role)} replace /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to={home(user.role)} replace /> : <Register />} />

          <Route path="/student" element={<Guard roles={['student']}><StudentDashboard /></Guard>} />
          <Route path="/student/analytics" element={<Guard roles={['student']}><StudentAnalytics /></Guard>} />
          <Route path="/exam/take/:examId" element={<Guard roles={['student']}><TakeExam /></Guard>} />
          <Route path="/attempt/:attemptId/review" element={<Guard roles={['student']}><ReviewAttempt /></Guard>} />

          <Route path="/faculty" element={<Guard roles={['faculty', 'admin']}><FacultyDashboard /></Guard>} />
          <Route path="/faculty/exam/:examId" element={<Guard roles={['faculty', 'admin']}><ExamEditor /></Guard>} />
          <Route path="/faculty/exam/:examId/results" element={<Guard roles={['faculty', 'admin']}><ExamResults /></Guard>} />
          <Route path="/faculty/integrity" element={<Guard roles={['faculty', 'admin']}><IntegrityReports /></Guard>} />

          <Route path="/admin" element={<Guard roles={['admin']}><AdminPanel /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
