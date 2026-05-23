const db = require('./database');
const bcrypt = require('bcryptjs');

console.log('Seeding database...');

// Settings
const settings = [
  ['xp_per_correct', '5', 'XP earned per correct answer'],
  ['xp_homework_bonus', '10', 'Bonus XP for completing homework'],
  ['xp_streak_bonus_7', '25', 'Bonus XP for 7-day streak'],
  ['xp_mastery_bonus', '5', 'Bonus XP for mastering a sentence'],
  ['revision_after_correct_days', '7', 'Days before review after correct answer'],
  ['revision_after_wrong_days', '1', 'Days before review after wrong answer'],
  ['mastery_required_correct_reviews', '2', 'Correct reviews needed for mastery'],
  ['allow_skip', '1', 'Allow students to skip sentences'],
  ['show_answer_after_wrong', '1', 'Show correct answer after wrong attempt'],
  ['show_advanced_after_submit', '1', 'Show advanced version after submission'],
  ['leaderboard_enabled', '1', 'Enable leaderboard'],
  ['anti_cheat_same_day', '1', 'Prevent XP farming same sentence same day'],
  ['feedback_correct_bn', 'সঠিক হয়েছে! দারুণ কাজ করেছেন।', 'Correct answer feedback in Bangla'],
  ['feedback_wrong_bn', 'এবার সঠিক হয়নি। চিন্তার কিছু নেই, নিচের সঠিক ফরম্যাটগুলো দেখে আবার শিখে নিন।', 'Wrong answer feedback in Bangla'],
  ['premium_cta_text', 'This practice set is for Premium students. Join Premium Batch to unlock guided practice, homework, correction and fluency tools.', 'Premium lock message'],
  ['whatsapp_number', '+8801XXXXXXXXX', 'WhatsApp contact number'],
  ['timed_challenge_seconds', '30', 'Seconds for timed challenge mode'],
];

const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value, description) VALUES (?, ?, ?)');
settings.forEach(s => insertSetting.run(s[0], s[1], s[2]));

// Levels
const levels = [
  [1, 'Beginner', 0, 99, '🌱'],
  [2, 'Learner', 100, 249, '📚'],
  [3, 'Practitioner', 250, 499, '✍️'],
  [4, 'Skilled', 500, 999, '⭐'],
  [5, 'Advanced', 1000, 1999, '🏆'],
  [6, 'Expert', 2000, 4999, '💎'],
  [7, 'Master', 5000, 99999, '👑'],
];

const insertLevel = db.prepare('INSERT OR REPLACE INTO levels (level_number, name, min_xp, max_xp, badge) VALUES (?, ?, ?, ?, ?)');
levels.forEach(l => insertLevel.run(l[0], l[1], l[2], l[3], l[4]));

// Admin user
const adminHash = bcrypt.hashSync('admin123', 10);
const studentHash = bcrypt.hashSync('student123', 10);

db.prepare(`INSERT OR IGNORE INTO users (name, email, phone, password, role, premium_status) VALUES (?, ?, ?, ?, ?, ?)`)
  .run('Admin', 'admin@proenglishbd.com', '+8801700000000', adminHash, 'admin', 1);

db.prepare(`INSERT OR IGNORE INTO users (name, email, phone, password, role, premium_status) VALUES (?, ?, ?, ?, ?, ?)`)
  .run('Demo Student', 'student@proenglishbd.com', '+8801700000001', studentHash, 'student', 1);

// Categories
const categories = [
  ['Present Simple', 'Learn present simple tense sentences', '📗', 1],
  ['Present Continuous', 'Learn present continuous tense sentences', '📘', 2],
  ['Present Perfect', 'Learn present perfect tense sentences', '📙', 3],
  ['Present Perfect Continuous', 'Learn present perfect continuous', '📕', 4],
  ['Past Simple', 'Learn past simple tense sentences', '📓', 5],
  ['Past Continuous', 'Learn past continuous tense sentences', '📔', 6],
  ['Past Perfect', 'Learn past perfect tense sentences', '📒', 7],
  ['Past Perfect Continuous', 'Learn past perfect continuous', '📝', 8],
  ['Future Simple', 'Learn future simple tense sentences', '🔮', 9],
  ['Future Continuous', 'Learn future continuous tense sentences', '🌟', 10],
  ['Future Perfect', 'Learn future perfect tense sentences', '💫', 11],
  ['Future Perfect Continuous', 'Learn future perfect continuous', '✨', 12],
  ['Mixed Tense Practice', 'Practice with mixed tenses', '🎯', 13],
  ['Spoken English Daily Sentences', 'Daily conversation practice', '🗣️', 14],
  ['IELTS Speaking Sentences', 'IELTS speaking practice', '🎓', 15],
  ['Freelancing / Client Communication', 'Professional communication', '💼', 16],
];

const insertCat = db.prepare('INSERT OR IGNORE INTO categories (name, description, icon, sort_order) VALUES (?, ?, ?, ?)');
categories.forEach(c => insertCat.run(c[0], c[1], c[2], c[3]));

// Subcategories for each category
const subcats = [
  'Basic', 'Intermediate', 'Advanced', 'IELTS', 'Freelancing',
  'Daily Conversation', 'Question Form', 'Negative Form', 'Mixed Practice'
];

const insertSubcat = db.prepare('INSERT OR IGNORE INTO subcategories (category_id, name, difficulty, sort_order) VALUES (?, ?, ?, ?)');
const allCats = db.prepare('SELECT id FROM categories').all();
allCats.forEach(cat => {
  subcats.forEach((sc, idx) => {
    const diff = idx < 3 ? ['Easy', 'Medium', 'Hard'][idx] : 'Medium';
    insertSubcat.run(cat.id, sc, diff, idx + 1);
  });
});

// Sample sentences for Present Simple - Basic
const catPS = db.prepare("SELECT id FROM categories WHERE name = 'Present Simple'").get();
const subBasic = db.prepare("SELECT id FROM subcategories WHERE category_id = ? AND name = 'Basic'").get(catPS.id);

const sampleSentences = [
  {
    bangla: 'আমি প্রতিদিন ইংরেজি শিখি।',
    answers: ['I learn English every day.', 'I study English every day.', 'I practice English every day.', 'I learn English daily.'],
    advanced: 'I make it a habit to practice English every single day.',
    explanation: 'Present Simple is used for daily habits and routines. Structure: Subject + base verb + object.',
    hint: 'Use subject + base verb. Think about daily habits.',
  },
  {
    bangla: 'সে প্রতিদিন সকালে ঘুম থেকে ওঠে।',
    answers: ['He wakes up every morning.', 'He gets up every morning.', 'He wakes up every day in the morning.'],
    advanced: 'He makes it a point to wake up early every single morning without fail.',
    explanation: 'For third person singular (he/she/it), add -s/-es to the base verb.',
    hint: 'Third person singular needs -s. Think: he/she + verb+s',
  },
  {
    bangla: 'আমরা স্কুলে যাই।',
    answers: ['We go to school.', 'We attend school.', 'We go to the school.'],
    advanced: 'We regularly commute to school as part of our daily routine.',
    explanation: 'Simple present for regular activities. "We" takes base form of verb.',
    hint: 'We + base verb + to + place',
  },
  {
    bangla: 'তারা ফুটবল খেলে।',
    answers: ['They play football.', 'They play soccer.', 'They play football regularly.'],
    advanced: 'They are passionate about playing football and practice it regularly.',
    explanation: 'Present simple for hobbies. "They" takes base form.',
    hint: 'They + base verb + object',
  },
  {
    bangla: 'আমি চা পান করি।',
    answers: ['I drink tea.', 'I have tea.', 'I take tea.'],
    advanced: 'I enjoy having a cup of tea as part of my daily routine.',
    explanation: 'Present simple for habits. Multiple verbs can express the same meaning.',
    hint: 'I + verb + object. Multiple verbs work here.',
  },
  {
    bangla: 'সে বই পড়ে।',
    answers: ['He reads books.', 'She reads books.', 'He reads a book.', 'She reads a book.'],
    advanced: 'He is an avid reader who spends quality time reading books every day.',
    explanation: 'Third person + verb+s. "Read" becomes "reads" for he/she.',
    hint: 'He/She + reads + object',
  },
  {
    bangla: 'পানি ১০০ ডিগ্রিতে ফুটে।',
    answers: ['Water boils at 100 degrees.', 'Water boils at 100 degrees Celsius.'],
    advanced: 'It is a scientific fact that water reaches its boiling point at exactly 100 degrees Celsius.',
    explanation: 'Present simple for scientific facts and universal truths.',
    hint: 'Scientific fact = present simple. Subject + verb+s.',
  },
  {
    bangla: 'সূর্য পূর্বে ওঠে।',
    answers: ['The sun rises in the east.', 'Sun rises in the east.'],
    advanced: 'The sun invariably rises in the east, which is a universal truth.',
    explanation: 'Universal truths use present simple tense.',
    hint: 'Universal truth. The sun + verb+s.',
  },
  {
    bangla: 'আমি ভাত খাই।',
    answers: ['I eat rice.', 'I have rice.'],
    advanced: 'Rice is a staple food that I consume as part of my regular diet.',
    explanation: 'Present simple for regular eating habits.',
    hint: 'I + eat/have + food item',
  },
  {
    bangla: 'সে অফিসে কাজ করে।',
    answers: ['He works in an office.', 'She works in an office.', 'He works at the office.', 'She works at the office.'],
    advanced: 'He is employed at an office where he works diligently every day.',
    explanation: 'Present simple for occupation/work routine.',
    hint: 'He/She + works + in/at + place',
  },
];

const insertSentence = db.prepare(`
  INSERT INTO sentences (bangla_sentence, advanced_version, explanation, hint, category_id, subcategory_id, difficulty, checking_mode, is_active, tags)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertAnswer = db.prepare(`INSERT INTO sentence_answers (sentence_id, correct_answer, normalized_answer, sort_order) VALUES (?, ?, ?, ?)`);

function normalizeAnswer(text) {
  return text.toLowerCase().trim().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ').replace(/dont/g, "don't").replace(/doesnt/g, "doesn't");
}

sampleSentences.forEach(s => {
  const result = insertSentence.run(
    s.bangla, s.advanced, s.explanation, s.hint,
    catPS.id, subBasic.id, 'Easy', 'flexible', 1, 'daily routine, habit'
  );
  s.answers.forEach((ans, idx) => {
    insertAnswer.run(result.lastInsertRowid, ans, normalizeAnswer(ans), idx);
  });
});

// Create a batch
db.prepare(`INSERT OR IGNORE INTO batches (name, course_name, start_date, status) VALUES (?, ?, ?, ?)`)
  .run('Batch 1 - 2024', 'Spoken English Complete', '2024-01-01', 'active');

// Assign student to batch
db.prepare(`UPDATE users SET batch_id = 1 WHERE email = 'student@proenglishbd.com'`).run();

console.log('Database seeded successfully!');
console.log('Admin: admin@proenglishbd.com / admin123');
console.log('Student: student@proenglishbd.com / student123');
