const router = require('express').Router();
const Exam = require('../models/Exam');
const Question = require('../models/Question');
const ExamAttempt = require('../models/ExamAttempt');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

async function recalcTotal(examId) {
  const qs = await Question.find({ exam: examId });
  const total = qs.reduce((s, q) => s + q.marks, 0);
  await Exam.findByIdAndUpdate(examId, { totalMarks: total });
  return total;
}

// Ownership guard: faculty can only touch their own exams (admin can touch all).
async function loadOwnedExam(req, res) {
  const exam = await Exam.findById(req.params.id);
  if (!exam) { res.status(404).json({ message: 'Exam not found' }); return null; }
  if (req.user.role === 'faculty' && String(exam.faculty) !== String(req.user._id)) {
    res.status(403).json({ message: 'You do not own this exam' }); return null;
  }
  return exam;
}

// List exams. Student: published only (with own attempt status). Faculty: own. Admin: all.
router.get('/', async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'student') filter = { status: 'published' };
    if (req.user.role === 'faculty') filter = { faculty: req.user._id };
    const exams = await Exam.find(filter).populate('faculty', 'name').sort({ startTime: -1 }).lean();

    if (req.user.role === 'student') {
      const attempts = await ExamAttempt.find({ student: req.user._id }).lean();
      const byExam = Object.fromEntries(attempts.map((a) => [String(a.exam), a]));
      const counts = await Question.find({ exam: { $in: exams.map((e) => e._id) } }).select('exam').lean();
      const qCount = {};
      counts.forEach((q) => { qCount[String(q.exam)] = (qCount[String(q.exam)] || 0) + 1; });
      exams.forEach((e) => {
        const a = byExam[String(e._id)];
        e.attemptStatus = a ? a.status : 'not_started';
        e.attemptId = a ? a._id : null;
        e.questionCount = qCount[String(e._id)] || 0;
      });
    }
    res.json({ exams });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', requireRole('faculty', 'admin'), async (req, res) => {
  try {
    const { title, description, startTime, endTime, duration } = req.body;
    if (!title || !startTime || !endTime || !duration) return res.status(400).json({ message: 'Title, start, end and duration are required' });
    if (new Date(endTime) <= new Date(startTime)) return res.status(400).json({ message: 'End time must be after start time' });
    const exam = await Exam.create({ title, description, startTime, endTime, duration: Number(duration), faculty: req.user._id });
    res.status(201).json({ exam });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id).populate('faculty', 'name');
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    res.json({ exam });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id', requireRole('faculty', 'admin'), async (req, res) => {
  try {
    const exam = await loadOwnedExam(req, res); if (!exam) return;
    const { title, description, startTime, endTime, duration, status } = req.body;
    if (title !== undefined) exam.title = title;
    if (description !== undefined) exam.description = description;
    if (startTime) exam.startTime = startTime;
    if (endTime) exam.endTime = endTime;
    if (duration) exam.duration = Number(duration);
    if (status) {
      if (status === 'published' && (await Question.countDocuments({ exam: exam._id })) === 0) {
        return res.status(400).json({ message: 'Add at least one question before publishing' });
      }
      exam.status = status;
    }
    await exam.save();
    res.json({ exam });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', requireRole('faculty', 'admin'), async (req, res) => {
  try {
    const exam = await loadOwnedExam(req, res); if (!exam) return;
    if (await ExamAttempt.countDocuments({ exam: exam._id })) {
      return res.status(400).json({ message: 'Exam already has attempts; unpublish it instead of deleting' });
    }
    await Question.deleteMany({ exam: exam._id });
    await exam.deleteOne();
    res.json({ message: 'Exam deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ---- Question management (faculty/admin: includes correct answers)
router.get('/:id/questions', requireRole('faculty', 'admin'), async (req, res) => {
  try {
    const exam = await loadOwnedExam(req, res); if (!exam) return;
    const questions = await Question.find({ exam: exam._id }).sort({ createdAt: 1 });
    res.json({ questions });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

function validateQuestion(body) {
  const { questionText, options, marks } = body;
  if (!questionText || !questionText.trim()) return 'Question text is required';
  if (!Array.isArray(options) || options.length < 2) return 'At least 2 options are required';
  if (options.some((o) => !o.optionText || !String(o.optionText).trim())) return 'Option text cannot be empty';
  if (options.filter((o) => o.isCorrect).length !== 1) return 'Exactly one option must be marked correct';
  if (marks !== undefined && Number(marks) < 0) return 'Marks cannot be negative';
  return null;
}

router.post('/:id/questions', requireRole('faculty', 'admin'), async (req, res) => {
  try {
    const exam = await loadOwnedExam(req, res); if (!exam) return;
    const err = validateQuestion(req.body); if (err) return res.status(400).json({ message: err });
    const { questionText, questionType = 'mcq', options, marks = 1 } = req.body;
    const q = await Question.create({
      exam: exam._id, questionText, questionType, marks: Number(marks),
      options: options.map((o) => ({ optionText: o.optionText, isCorrect: !!o.isCorrect })),
    });
    await recalcTotal(exam._id);
    res.status(201).json({ question: q });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id/questions/:qid', requireRole('faculty', 'admin'), async (req, res) => {
  try {
    const exam = await loadOwnedExam(req, res); if (!exam) return;
    const err = validateQuestion(req.body); if (err) return res.status(400).json({ message: err });
    const q = await Question.findOne({ _id: req.params.qid, exam: exam._id });
    if (!q) return res.status(404).json({ message: 'Question not found' });
    q.questionText = req.body.questionText;
    q.questionType = req.body.questionType || q.questionType;
    q.marks = Number(req.body.marks ?? q.marks);
    q.options = req.body.options.map((o) => ({ optionText: o.optionText, isCorrect: !!o.isCorrect }));
    await q.save();
    await recalcTotal(exam._id);
    res.json({ question: q });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id/questions/:qid', requireRole('faculty', 'admin'), async (req, res) => {
  try {
    const exam = await loadOwnedExam(req, res); if (!exam) return;
    await Question.deleteOne({ _id: req.params.qid, exam: exam._id });
    await recalcTotal(exam._id);
    res.json({ message: 'Question deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
