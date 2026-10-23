const mongoose = require('mongoose');

const examSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startTime: { type: Date, required: true }, // exam window opens
    endTime: { type: Date, required: true }, // exam window closes
    duration: { type: Number, required: true, min: 1 }, // minutes
    totalMarks: { type: Number, default: 0 }, // recalculated from questions
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Exam', examSchema);
