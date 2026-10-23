const mongoose = require('mongoose');

// User + Student + Faculty from the ER diagram are merged into one collection;
// `role` decides which extra fields apply (department for faculty/student, year for student).
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['student', 'faculty', 'admin'], default: 'student' },
    department: { type: String, default: '' },
    year: { type: Number, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    department: this.department,
    year: this.year,
    active: this.active,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
