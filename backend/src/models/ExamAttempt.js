const mongoose = require('mongoose');

// ANSWER table from the ER diagram is embedded as an array inside the attempt.
const answerSchema = new mongoose.Schema({
  question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  selectedOption: { type: mongoose.Schema.Types.ObjectId, default: null },
  isCorrect: { type: Boolean, default: false },
  marksAwarded: { type: Number, default: 0 },
});

const attemptSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date, default: null },
    status: { type: String, enum: ['in_progress', 'submitted'], default: 'in_progress' },
    score: { type: Number, default: 0 },
    answers: [answerSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('ExamAttempt', attemptSchema);
