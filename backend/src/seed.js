require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Exam = require('./models/Exam');
const Question = require('./models/Question');

const q = (text, opts, correct, marks = 2) => ({
  questionText: text, marks,
  options: opts.map((o, i) => ({ optionText: o, isCorrect: i === correct })),
});

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const hash = await bcrypt.hash('password123', 10);

  const upsert = async (email, data) =>
    (await User.findOne({ email })) || User.create({ email, passwordHash: hash, ...data });

  const admin = await upsert('admin@college.edu', { name: 'Admin User', role: 'admin' });
  const faculty = await upsert('faculty@college.edu', { name: 'Swapna Duggi', role: 'faculty', department: 'CSE' });
  await upsert('student@college.edu', { name: 'Varshitaa P', role: 'student', department: 'CSE', year: 3 });
  await upsert('student2@college.edu', { name: 'Arun Kumar', role: 'student', department: 'CSE', year: 3 });

  if (!(await Exam.findOne({ title: 'Full Stack Development - Unit Test 1' }))) {
    const now = Date.now();
    const exam = await Exam.create({
      title: 'Full Stack Development - Unit Test 1',
      description: 'MERN stack fundamentals: JavaScript, Node.js, Express, MongoDB and React.',
      faculty: faculty._id, status: 'published', duration: 20,
      startTime: new Date(now - 24 * 3600 * 1000),
      endTime: new Date(now + 30 * 24 * 3600 * 1000),
    });
    const qs = [
      q('What does the "M" in MERN stand for?', ['MySQL', 'MongoDB', 'Mongoose', 'Middleware'], 1),
      q('Which library is used to build the user interface in the MERN stack?', ['Express', 'Node.js', 'React', 'Mongoose'], 2),
      q('Which HTTP method is normally used to create a new resource in a REST API?', ['GET', 'POST', 'DELETE', 'HEAD'], 1),
      q('Which Node.js framework is used to build the REST API in MERN?', ['Django', 'Flask', 'Express.js', 'Laravel'], 2),
      q('JWT is mainly used for:', ['Styling pages', 'Stateless authentication', 'Database indexing', 'Image compression'], 1),
      q('Which hook is used to manage state in a React function component?', ['useEffect', 'useState', 'useRef', 'useMemo'], 1),
      q('MongoDB stores data in which format?', ['Tables and rows', 'BSON documents', 'XML files', 'CSV files'], 1),
      q('Which library is commonly used to hash passwords in Node.js?', ['bcrypt', 'cors', 'axios', 'morgan'], 0),
      q('In React, props are:', ['Mutable internal state', 'Read-only inputs to a component', 'Database queries', 'CSS classes'], 1),
      q('Which status code means "Unauthorized"?', ['200', '301', '401', '500'], 2),
    ];
    await Question.insertMany(qs.map((x) => ({ ...x, exam: exam._id })));
    exam.totalMarks = qs.reduce((s, x) => s + x.marks, 0);
    await exam.save();
  }

  console.log('Seed complete. Demo accounts (password: password123):');
  console.log('  admin@college.edu   (admin)');
  console.log('  faculty@college.edu (faculty)');
  console.log('  student@college.edu / student2@college.edu (student)');
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
