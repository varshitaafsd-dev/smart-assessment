const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const sign = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role = 'student', department = '', year, inviteCode } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    if (!['student', 'faculty'].includes(role)) return res.status(400).json({ message: 'Role must be student or faculty' });
    if (role === 'faculty' && process.env.FACULTY_INVITE_CODE && inviteCode !== process.env.FACULTY_INVITE_CODE) {
      return res.status(403).json({ message: 'Invalid faculty invite code' });
    }
    if (await User.findOne({ email: email.toLowerCase() })) {
      return res.status(409).json({ message: 'Email is already registered' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      passwordHash,
      role,
      department,
      year: role === 'student' && year ? Number(year) : null,
    });
    res.status(201).json({ token: sign(user), user: user.toSafeJSON() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    if (!user.active) return res.status(403).json({ message: 'Account is disabled' });
    res.json({ token: sign(user), user: user.toSafeJSON() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user.toSafeJSON() }));

module.exports = router;
