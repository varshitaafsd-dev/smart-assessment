const mongoose = require('mongoose');

const ACTIVITY_TYPES = [
  'tab_switch',
  'copy_paste',
  'right_click',
  'fullscreen_exit',
  'key_shortcut',
  'face_not_visible',
];

const activitySchema = new mongoose.Schema({
  attempt: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamAttempt', required: true, index: true },
  activityType: { type: String, enum: ACTIVITY_TYPES, required: true },
  activityTime: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ExamActivity', activitySchema);
module.exports.ACTIVITY_TYPES = ACTIVITY_TYPES;
