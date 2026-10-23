const mongoose = require('mongoose');

// The AI only flags. A human (faculty) decides the final status.
const reportSchema = new mongoose.Schema(
  {
    attempt: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamAttempt', required: true, unique: true },
    analysis: { type: mongoose.Schema.Types.ObjectId, ref: 'AIRiskAnalysis', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    reportStatus: {
      type: String,
      enum: ['pending_review', 'cleared', 'escalated'],
      default: 'pending_review',
    },
    remarks: { type: String, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('IntegrityReport', reportSchema);
