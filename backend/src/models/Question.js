const mongoose = require('mongoose');

// OPTION table from the ER diagram is embedded here as a sub-document array.
const optionSchema = new mongoose.Schema({
  optionText: { type: String, required: true },
  isCorrect: { type: Boolean, default: false },
});

const questionSchema = new mongoose.Schema(
  {
    exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    questionText: { type: String, required: true },
    questionType: { type: String, enum: ['mcq', 'true_false'], default: 'mcq' },
    options: { type: [optionSchema], validate: (v) => v.length >= 2 },
    marks: { type: Number, default: 1, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Question', questionSchema);
