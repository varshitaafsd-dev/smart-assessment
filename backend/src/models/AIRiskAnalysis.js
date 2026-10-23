const mongoose = require('mongoose');

const riskSchema = new mongoose.Schema(
  {
    attempt: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamAttempt', required: true, unique: true },
    riskScore: { type: Number, required: true },
    riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'UNAVAILABLE'], default: 'LOW' },
    suspiciousActivity: [String],
    source: { type: String, enum: ['ai-service', 'fallback'], default: 'ai-service' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AIRiskAnalysis', riskSchema);
