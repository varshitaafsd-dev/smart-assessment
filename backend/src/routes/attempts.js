const router = require('express').Router();
const Exam = require('../models/Exam');
const Question = require('../models/Question');
const ExamAttempt = require('../models/ExamAttempt');
const ExamActivity = require('../models/ExamActivity');
const Result = require('../models/Result');
const { requireAuth, requireRole } = require('../middleware/auth');
const { gradeFor } = require('../utils/grade');
const { analyzeAttempt } = require('../utils/aiClient');

router.use(requireAuth, requireRole('student'));

const GRACE_MS = 15 * 1000; // network grace after the timer hits zero

const deadlineOf = (attempt, exam) => new Date(attempt.startTime.getTime() + exam.duration * 60 * 1000);

// Strip correct-answer info before sending questions to a student.
const publicQuestion = (q) => ({
  id: q._id,
  questionText: q.questionText,
  questionType: q.questionType,
  marks: q.marks,
  options: q.options.map((o) => ({ id: o._id, optionText: o.optionText })),
});

// AUTOMATED EVALUATION: compare selected option with the correct option.
async function gradeAndFinish(attempt, exam, submitted = []) {
  const questions = await Question.find({ exam: exam._id });
  const chosen = new Map();
  // saved progress first, then anything sent with the final submit overrides it
  attempt.answers.forEach((a) => chosen.set(String(a.question), a.selectedOption ? String(a.selectedOption) : null));
  submitted.forEach((a) => chosen.set(String(a.questionId), a.optionId || null));

  let score = 0;
  const graded = questions.map((q) => {
    const sel = chosen.get(String(q._id)) || null;
    const correct = q.options.find((o) => o.isCorrect);
    const isCorrect = !!sel && !!correct && String(correct._id) === sel;
    const marksAwarded = isCorrect ? q.marks : 0;
    score += marksAwarded;
    return { question: q._id, selectedOption: sel, isCorrect, marksAwarded };
  });

  const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
  const percentage = totalMarks ? Math.round((score / totalMarks) * 1000) / 10 : 0;

  attempt.answers = graded;
  attempt.score = score;
  attempt.status = 'submitted';
  attempt.endTime = new Date();
  await attempt.save();

  const result = await Result.findOneAndUpdate(
    { attempt: attempt._id },
    { student: attempt.student, exam: exam._id, totalScore: score, totalMarks, percentage, grade: gradeFor(percentage) },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // AI proctoring analysis (never blocks the student's result)
  analyzeAttempt({ attempt, exam, questionCount: questions.length }).catch((e) => console.error('[AI]', e.message));
  return result;
}

router.post('/start', async (req, res) => {
  try {
    const exam = await Exam.findById(req.body.examId);
    if (!exam || exam.status !== 'published') return res.status(404).json({ message: 'Exam not available' });

    let attempt = await ExamAttempt.findOne({ student: req.user._id, exam: exam._id });
    if (attempt && attempt.status === 'submitted') return res.status(409).json({ message: 'You have already submitted this exam' });

    const now = new Date();
    if (!attempt) {
      if (now < exam.startTime) return res.status(403).json({ message: 'This exam has not started yet' });
      if (now > exam.endTime) return res.status(403).json({ message: 'This exam window has closed' });
      attempt = await ExamAttempt.create({ student: req.user._id, exam: exam._id, startTime: now });
    } else if (now.getTime() > deadlineOf(attempt, exam).getTime() + GRACE_MS) {
      await gradeAndFinish(attempt, exam);
      return res.status(409).json({ message: 'Your time ran out; the exam was auto-submitted' });
    }

    const questions = await Question.find({ exam: exam._id }).sort({ createdAt: 1 });
    res.json({
      attemptId: attempt._id,
      exam: { id: exam._id, title: exam.title, duration: exam.duration, totalMarks: exam.totalMarks },
      deadline: deadlineOf(attempt, exam),
      serverNow: new Date(),
      questions: questions.map(publicQuestion),
      savedAnswers: attempt.answers.map((a) => ({ questionId: a.question, optionId: a.selectedOption })),
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

async function ownAttempt(req, res) {
  const attempt = await ExamAttempt.findOne({ _id: req.params.id, student: req.user._id });
  if (!attempt) { res.status(404).json({ message: 'Attempt not found' }); return null; }
  return attempt;
}

// Autosave a single answer so a refresh/crash does not lose progress.
router.put('/:id/answer', async (req, res) => {
  try {
    const attempt = await ownAttempt(req, res); if (!attempt) return;
    if (attempt.status !== 'in_progress') return res.status(409).json({ message: 'Attempt already submitted' });
    const { questionId, optionId } = req.body;
    const existing = attempt.answers.find((a) => String(a.question) === String(questionId));
    if (existing) existing.selectedOption = optionId;
    else attempt.answers.push({ question: questionId, selectedOption: optionId });
    await attempt.save();
    res.json({ saved: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Proctoring events from the browser.
router.post('/:id/activity', async (req, res) => {
  try {
    const attempt = await ownAttempt(req, res); if (!attempt) return;
    if (attempt.status !== 'in_progress') return res.json({ logged: false });
    if (!ExamActivity.ACTIVITY_TYPES.includes(req.body.activityType)) return res.status(400).json({ message: 'Unknown activity type' });
    await ExamActivity.create({ attempt: attempt._id, activityType: req.body.activityType });
    res.json({ logged: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/:id/submit', async (req, res) => {
  try {
    const attempt = await ownAttempt(req, res); if (!attempt) return;
    if (attempt.status === 'submitted') return res.status(409).json({ message: 'Already submitted' });
    const exam = await Exam.findById(attempt.exam);
    const result = await gradeAndFinish(attempt, exam, req.body.answers || []);
    res.json({ result });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// All of this student's results.
router.get('/mine/results', async (req, res) => {
  try {
    const results = await Result.find({ student: req.user._id }).populate('exam', 'title duration').sort({ createdAt: -1 });
    res.json({ results });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Review a submitted attempt (shows the correct answers).
router.get('/:id/review', async (req, res) => {
  try {
    const attempt = await ownAttempt(req, res); if (!attempt) return;
    if (attempt.status !== 'submitted') return res.status(409).json({ message: 'Finish the exam first' });
    const exam = await Exam.findById(attempt.exam);
    const questions = await Question.find({ exam: exam._id }).sort({ createdAt: 1 });
    const result = await Result.findOne({ attempt: attempt._id });
    const byQ = new Map(attempt.answers.map((a) => [String(a.question), a]));
    res.json({
      exam: { title: exam.title },
      result,
      review: questions.map((q) => {
        const a = byQ.get(String(q._id));
        return {
          questionText: q.questionText,
          marks: q.marks,
          marksAwarded: a ? a.marksAwarded : 0,
          isCorrect: a ? a.isCorrect : false,
          options: q.options.map((o) => ({
            optionText: o.optionText,
            isCorrect: o.isCorrect,
            selected: !!a && String(a.selectedOption) === String(o._id),
          })),
        };
      }),
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
