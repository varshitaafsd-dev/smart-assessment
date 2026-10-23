const router = require('express').Router();
const Result = require('../models/Result');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth, requireRole('student'));

// Student performance analytics: trend, average, best, and comparison with class average.
router.get('/student', async (req, res) => {
  try {
    const mine = await Result.find({ student: req.user._id }).populate('exam', 'title').sort({ createdAt: 1 }).lean();
    const trend = [];
    for (const r of mine) {
      const all = await Result.find({ exam: r.exam._id }).lean();
      const classAvg = all.reduce((s, x) => s + x.percentage, 0) / all.length;
      const rank = all.filter((x) => x.percentage > r.percentage).length + 1;
      trend.push({
        exam: r.exam.title, date: r.createdAt, percentage: r.percentage, grade: r.grade,
        classAverage: Math.round(classAvg * 10) / 10, rank, participants: all.length,
      });
    }
    const avg = mine.length ? mine.reduce((s, r) => s + r.percentage, 0) / mine.length : 0;
    let performanceTrend = 'not enough data';
    if (mine.length >= 2) {
      const diff = mine[mine.length - 1].percentage - mine[0].percentage;
      performanceTrend = diff > 3 ? 'improving' : diff < -3 ? 'declining' : 'stable';
    }
    res.json({
      summary: {
        examsTaken: mine.length,
        averageScore: Math.round(avg * 10) / 10,
        bestScore: mine.length ? Math.max(...mine.map((r) => r.percentage)) : 0,
        performanceTrend,
      },
      trend,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
