const router = require('express').Router();
const Exam = require('../models/Exam');
const Result = require('../models/Result');
const ExamAttempt = require('../models/ExamAttempt');
const ExamActivity = require('../models/ExamActivity');
const AIRiskAnalysis = require('../models/AIRiskAnalysis');
const IntegrityReport = require('../models/IntegrityReport');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth, requireRole('faculty', 'admin'));

const examFilter = (user) => (user.role === 'admin' ? {} : { faculty: user._id });

// Results for one exam, joined with AI risk + integrity report status.
router.get('/exams/:id/results', async (req, res) => {
  try {
    const exam = await Exam.findOne({ _id: req.params.id, ...examFilter(req.user) });
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    const results = await Result.find({ exam: exam._id }).populate('student', 'name email department year').sort({ percentage: -1 }).lean();
    const attemptIds = results.map((r) => r.attempt);
    const analyses = await AIRiskAnalysis.find({ attempt: { $in: attemptIds } }).lean();
    const reports = await IntegrityReport.find({ attempt: { $in: attemptIds } }).lean();
    const aMap = Object.fromEntries(analyses.map((a) => [String(a.attempt), a]));
    const rMap = Object.fromEntries(reports.map((r) => [String(r.attempt), r]));
    res.json({
      exam,
      results: results.map((r) => ({
        ...r,
        riskLevel: aMap[String(r.attempt)]?.riskLevel || 'PENDING',
        riskScore: aMap[String(r.attempt)]?.riskScore ?? null,
        reportStatus: rMap[String(r.attempt)]?.reportStatus || null,
      })),
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Integrity reports across the faculty's exams.
router.get('/integrity', async (req, res) => {
  try {
    const exams = await Exam.find(examFilter(req.user)).select('_id title').lean();
    const filter = { exam: { $in: exams.map((e) => e._id) } };
    if (req.query.examId) filter.exam = req.query.examId;
    const reports = await IntegrityReport.find(filter)
      .populate('analysis').populate('student', 'name email').populate('exam', 'title').sort({ createdAt: -1 }).lean();

    const out = [];
    for (const r of reports) {
      const acts = await ExamActivity.find({ attempt: r.attempt }).lean();
      const counts = {};
      acts.forEach((a) => { counts[a.activityType] = (counts[a.activityType] || 0) + 1; });
      out.push({ ...r, activityCounts: counts });
    }
    // Highest risk first
    out.sort((a, b) => (b.analysis?.riskScore || 0) - (a.analysis?.riskScore || 0));
    res.json({ reports: out });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Faculty makes the final decision. The AI never decides alone.
router.put('/integrity/:id', async (req, res) => {
  try {
    const { reportStatus, remarks } = req.body;
    if (!['pending_review', 'cleared', 'escalated'].includes(reportStatus)) return res.status(400).json({ message: 'Invalid status' });
    const report = await IntegrityReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found' });
    const exam = await Exam.findOne({ _id: report.exam, ...examFilter(req.user) });
    if (!exam) return res.status(403).json({ message: 'Not your exam' });
    report.reportStatus = reportStatus;
    report.remarks = remarks || '';
    report.reviewedBy = req.user._id;
    await report.save();
    res.json({ report });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Faculty dashboard analytics (computed in JS so it behaves identically on any Mongo-compatible DB).
router.get('/analytics', async (req, res) => {
  try {
    const exams = await Exam.find(examFilter(req.user)).lean();
    const ids = exams.map((e) => e._id);
    const results = await Result.find({ exam: { $in: ids } }).lean();
    const analyses = await AIRiskAnalysis.find({}).lean();
    const attemptIds = new Set(results.map((r) => String(r.attempt)));

    const perExam = exams.map((e) => {
      const rs = results.filter((r) => String(r.exam) === String(e._id));
      const avg = rs.length ? rs.reduce((s, r) => s + r.percentage, 0) / rs.length : 0;
      const pass = rs.filter((r) => r.percentage >= 40).length;
      return {
        examId: e._id, title: e.title, status: e.status, attempts: rs.length,
        average: Math.round(avg * 10) / 10,
        highest: rs.length ? Math.max(...rs.map((r) => r.percentage)) : 0,
        lowest: rs.length ? Math.min(...rs.map((r) => r.percentage)) : 0,
        passRate: rs.length ? Math.round((pass / rs.length) * 100) : 0,
      };
    });

    const gradeDist = {};
    results.forEach((r) => { gradeDist[r.grade] = (gradeDist[r.grade] || 0) + 1; });
    const riskDist = { LOW: 0, MEDIUM: 0, HIGH: 0, UNAVAILABLE: 0 };
    analyses.filter((a) => attemptIds.has(String(a.attempt))).forEach((a) => { riskDist[a.riskLevel] += 1; });

    res.json({
      totals: {
        exams: exams.length,
        published: exams.filter((e) => e.status === 'published').length,
        submissions: results.length,
        pendingReviews: await IntegrityReport.countDocuments({ exam: { $in: ids }, reportStatus: 'pending_review', }),
      },
      perExam, gradeDistribution: gradeDist, riskDistribution: riskDist,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
