const router = require('express').Router();
const User = require('../models/User');
const Exam = require('../models/Exam');
const Result = require('../models/Result');
const IntegrityReport = require('../models/IntegrityReport');
const AIRiskAnalysis = require('../models/AIRiskAnalysis');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth, requireRole('admin'));

router.get('/users', async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json({ users: users.map((u) => u.toSafeJSON()) });
});

router.put('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (String(user._id) === String(req.user._id)) return res.status(400).json({ message: 'You cannot modify your own account here' });
    if (req.body.role && ['student', 'faculty', 'admin'].includes(req.body.role)) user.role = req.body.role;
    if (typeof req.body.active === 'boolean') user.active = req.body.active;
    await user.save();
    res.json({ user: user.toSafeJSON() });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/users/:id', async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) return res.status(400).json({ message: 'You cannot delete yourself' });
  await User.findByIdAndDelete(req.params.id);
  res.json({ message: 'User deleted' });
});

router.get('/stats', async (req, res) => {
  try {
    const [students, faculty, admins, exams, results, high, pending] = await Promise.all([
      User.countDocuments({ role: 'student' }), User.countDocuments({ role: 'faculty' }),
      User.countDocuments({ role: 'admin' }), Exam.countDocuments(), Result.countDocuments(),
      AIRiskAnalysis.countDocuments({ riskLevel: 'HIGH' }),
      IntegrityReport.countDocuments({ reportStatus: 'pending_review' }),
    ]);
    res.json({ students, faculty, admins, exams, submissions: results, highRiskFlags: high, pendingReviews: pending });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
