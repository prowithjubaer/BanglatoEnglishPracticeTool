const db = require('./database');
const bcrypt = require('bcryptjs');
const { normalizeFlexible } = require('./utils/answerChecker');

console.log('Seeding database...');

// ============================================
// SETTINGS
// ============================================
const settings = [
  // XP Settings
  ['xp_per_correct', '5', 'XP earned per correct answer'],
  ['xp_homework_bonus', '10', 'Bonus XP for completing homework'],
  ['xp_streak_bonus', '25', 'Bonus XP for 7-day streak'],
  ['xp_mastery_bonus', '5', 'Bonus XP for mastering a sentence'],

  // Revision/Spaced Repetition
  ['revision_after_correct_days', '7', 'Days before review after correct answer'],
  ['revision_after_not_matched_days', '1', 'Days before review after not matched'],
  ['mastery_required_correct_reviews', '2', 'Correct reviews needed for mastery'],

  // Answer Checking
  ['default_checking_mode', 'flexible', 'Default checking mode: exact or flexible'],

  // Anti-Cheat & Retry
  ['anti_cheat_same_day', '1', 'Prevent XP farming same sentence same day'],
  ['allow_retry', '1', 'Allow students to retry after not matched'],
  ['retry_xp_enabled', '0', 'Give XP on retry after seeing answer (0=no, 1=yes)'],

  // UI Controls
  ['allow_skip', '1', 'Allow students to skip sentences'],
  ['show_answer_after_not_matched', '1', 'Show accepted answers after not matched'],
  ['leaderboard_enabled', '1', 'Enable leaderboard'],
  ['premium_lock_enabled', '1', 'Enable premium content locking'],

  // Feedback Messages (Bangla)
  ['feedback_correct_bn', 'সঠিক হয়েছে! দারুণ কাজ করেছেন।', 'Correct answer feedback in Bangla'],
  ['feedback_not_matched_bn', 'আপনার উত্তরটি এই practice-এর expected format-এর সাথে মেলেনি।', 'Not matched feedback in Bangla'],

  // Premium/Business
  ['premium_cta_text', 'এই practice set Premium students-দের জন্য। Guided practice, homework, revision এবং fluency tools unlock করতে Premium Batch-এ join করুন।', 'Premium lock message'],
  ['whatsapp_number', '01334556130', 'WhatsApp contact number'],
];

const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value, description) VALUES (?, ?, ?)');
settings.forEach(s => insertSetting.run(s[0], s[1], s[2]));

// ============================================
// LEVELS (10 levels with custom names)
// ============================================
const levels = [
  [1, 'Starter Speaker', 0, 99, '🌱'],
  [2, 'Sentence Builder', 100, 249, '📝'],
  [3, 'Confident Learner', 250, 499, '📚'],
  [4, 'Tense Fighter', 500, 999, '⚔️'],
  [5, 'Fluent Builder', 1000, 1999, '🏗️'],
  [6, 'Smart Speaker', 2000, 3499, '🧠'],
  [7, 'Pro Speaker', 3500, 5499, '⭐'],
  [8, 'English Warrior', 5500, 7999, '🛡️'],
  [9, 'Fluency Champion', 8000, 11999, '🏆'],
  [10, 'Master Communicator', 12000, 99999, '👑'],
];

const insertLevel = db.prepare('INSERT OR REPLACE INTO levels (level_number, name, min_xp, max_xp, badge) VALUES (?, ?, ?, ?, ?)');
levels.forEach(l => insertLevel.run(l[0], l[1], l[2], l[3], l[4]));

// ============================================
// USERS
// ============================================
const adminHash = bcrypt.hashSync('admin123', 10);
const studentHash = bcrypt.hashSync('student123', 10);

db.prepare(`INSERT OR IGNORE INTO users (name, email, phone, password, role, premium_status) VALUES (?, ?, ?, ?, ?, ?)`)
  .run('Admin', 'admin@proenglishbd.com', '01334556130', adminHash, 'admin', 1);
db.prepare(`INSERT OR IGNORE INTO users (name, email, phone, password, role, premium_status) VALUES (?, ?, ?, ?, ?, ?)`)
  .run('Demo Student', 'student@proenglishbd.com', '01700000001', studentHash, 'student', 1);

// ============================================
// CATEGORIES (20 categories)
// ============================================
const categories = [
  ['Present Simple', 'Present Simple tense practice', '📗', 1],
  ['Present Continuous', 'Present Continuous tense practice', '📘', 2],
  ['Present Perfect', 'Present Perfect tense practice', '📙', 3],
  ['Present Perfect Continuous', 'Present Perfect Continuous practice', '📕', 4],
  ['Past Simple', 'Past Simple tense practice', '📓', 5],
  ['Past Continuous', 'Past Continuous tense practice', '📔', 6],
  ['Past Perfect', 'Past Perfect tense practice', '📒', 7],
  ['Past Perfect Continuous', 'Past Perfect Continuous practice', '📝', 8],
  ['Future Simple', 'Future Simple tense practice', '🔮', 9],
  ['Future Continuous', 'Future Continuous tense practice', '🌟', 10],
  ['Future Perfect', 'Future Perfect tense practice', '💫', 11],
  ['Future Perfect Continuous', 'Future Perfect Continuous practice', '✨', 12],
  ['Mixed Tense Practice', 'Practice with mixed tenses', '🎯', 13],
  ['Daily Spoken English', 'Daily conversation sentences', '🗣️', 14],
  ['IELTS Speaking Sentences', 'IELTS speaking practice', '🎓', 15],
  ['Freelancing / Client Communication', 'Professional communication', '💼', 16],
  ['Office English', 'Office and workplace English', '🏢', 17],
  ['Interview English', 'Job interview preparation', '🤝', 18],
  ['Travel English', 'Travel and tourism English', '✈️', 19],
  ['Expat Daily English', 'Daily English for expats abroad', '🌍', 20],
];

const insertCat = db.prepare('INSERT OR IGNORE INTO categories (name, description, icon, sort_order) VALUES (?, ?, ?, ?)');
categories.forEach(c => insertCat.run(c[0], c[1], c[2], c[3]));

// ============================================
// SUBCATEGORIES (11 per category)
// ============================================
const subcats = [
  ['Basic', 'Easy'],
  ['Intermediate', 'Medium'],
  ['Advanced', 'Hard'],
  ['IELTS', 'Hard'],
  ['Freelancing', 'Medium'],
  ['Daily Conversation', 'Easy'],
  ['Positive Sentence', 'Easy'],
  ['Negative Sentence', 'Medium'],
  ['Question Form', 'Medium'],
  ['WH Question', 'Medium'],
  ['Mixed Practice', 'Hard'],
];

const insertSubcat = db.prepare('INSERT OR IGNORE INTO subcategories (category_id, name, difficulty, sort_order) VALUES (?, ?, ?, ?)');
const allCats = db.prepare('SELECT id FROM categories').all();
allCats.forEach(cat => {
  subcats.forEach((sc, idx) => {
    insertSubcat.run(cat.id, sc[0], sc[1], idx + 1);
  });
});

// ============================================
// SAMPLE SENTENCES (Present Simple - Basic)
// ============================================
const catPS = db.prepare("SELECT id FROM categories WHERE name = 'Present Simple'").get();
const subBasic = db.prepare("SELECT id FROM subcategories WHERE category_id = ? AND name = 'Basic'").get(catPS.id);

const sampleSentences = [
  {
    bangla: 'আমি প্রতিদিন ইংরেজি শিখি।',
    answers: ['I learn English every day.', 'I study English every day.', 'I practice English every day.', 'I learn English daily.', 'I study English daily.', 'I practice English daily.'],
    advanced: 'I make it a habit to practice English every single day.',
    explanation: 'This is a Present Simple sentence used for daily habits. Structure: Subject + base verb + object + time.',
    structure_hint: 'Subject + base verb + object + time',
    fill_blank: 'I ___ English every day.',
    first_word: 'I',
    word_bank: 'I, learn, English, every day',
    practice_mode: 'typing',
  },
  {
    bangla: 'সে প্রতিদিন সকালে ঘুম থেকে ওঠে।',
    answers: ['He wakes up every morning.', 'He gets up every morning.', 'He wakes up in the morning every day.'],
    advanced: 'He makes it a point to wake up early every single morning.',
    explanation: 'Third person singular (he/she/it) needs -s/-es on the verb in Present Simple.',
    structure_hint: 'He/She + verb+s + time',
    fill_blank: 'He ___ up every morning.',
    first_word: 'He',
    word_bank: 'He, wakes, up, every, morning',
    practice_mode: 'word_bank',
  },
  {
    bangla: 'আমরা স্কুলে যাই।',
    answers: ['We go to school.', 'We attend school.', 'We go to the school.'],
    advanced: 'We regularly commute to school as part of our daily routine.',
    explanation: 'Present Simple for regular activities. "We" takes base form of verb.',
    structure_hint: 'We + base verb + to + place',
    fill_blank: 'We ___ to school.',
    first_word: 'We',
    word_bank: 'We, go, to, school',
    practice_mode: 'typing',
  },
  {
    bangla: 'তারা ফুটবল খেলে।',
    answers: ['They play football.', 'They play soccer.', 'They play football regularly.'],
    advanced: 'They are passionate about playing football and practice it regularly.',
    explanation: 'Present Simple for hobbies and regular activities.',
    structure_hint: 'They + base verb + object',
    fill_blank: 'They ___ football.',
    first_word: 'They',
    word_bank: 'They, play, football',
    practice_mode: 'fill_blank',
  },
  {
    bangla: 'আমি চা পান করি।',
    answers: ['I drink tea.', 'I have tea.', 'I take tea.'],
    advanced: 'I enjoy having a cup of tea as part of my daily routine.',
    explanation: 'Present Simple for habits. Multiple verbs (drink/have/take) can express the same meaning.',
    structure_hint: 'I + verb + object',
    fill_blank: 'I ___ tea.',
    first_word: 'I',
    word_bank: 'I, drink, tea',
    practice_mode: 'typing',
  },
  {
    bangla: 'সে বই পড়ে।',
    answers: ['He reads books.', 'She reads books.', 'He reads a book.', 'She reads a book.'],
    advanced: 'He is an avid reader who spends quality time reading books every day.',
    explanation: 'Third person + verb+s. "Read" becomes "reads" for he/she.',
    structure_hint: 'He/She + verb+s + object',
    fill_blank: 'He ___ books.',
    first_word: 'He',
    word_bank: 'He, reads, books',
    practice_mode: 'word_bank',
  },
  {
    bangla: 'পানি ১০০ ডিগ্রিতে ফুটে।',
    answers: ['Water boils at 100 degrees.', 'Water boils at 100 degrees Celsius.'],
    advanced: 'It is a scientific fact that water reaches its boiling point at exactly 100 degrees Celsius.',
    explanation: 'Present Simple for scientific facts and universal truths.',
    structure_hint: 'Subject + verb+s + at + fact',
    fill_blank: 'Water ___ at 100 degrees.',
    first_word: 'Water',
    word_bank: 'Water, boils, at, 100, degrees',
    practice_mode: 'typing',
  },
  {
    bangla: 'সূর্য পূর্বে ওঠে।',
    answers: ['The sun rises in the east.', 'Sun rises in the east.'],
    advanced: 'The sun invariably rises in the east, which is a universal truth.',
    explanation: 'Universal truths use Present Simple tense.',
    structure_hint: 'The + subject + verb+s + in the + direction',
    fill_blank: 'The sun ___ in the east.',
    first_word: 'The',
    word_bank: 'The, sun, rises, in, the, east',
    practice_mode: 'fill_blank',
  },
  {
    bangla: 'আমি ভাত খাই।',
    answers: ['I eat rice.', 'I have rice.'],
    advanced: 'Rice is a staple food that I consume as part of my regular diet.',
    explanation: 'Present Simple for regular eating habits.',
    structure_hint: 'I + verb + food',
    fill_blank: 'I ___ rice.',
    first_word: 'I',
    word_bank: 'I, eat, rice',
    practice_mode: 'typing',
  },
  {
    bangla: 'সে অফিসে কাজ করে।',
    answers: ['He works in an office.', 'She works in an office.', 'He works at the office.', 'She works at the office.'],
    advanced: 'He is employed at an office where he works diligently every day.',
    explanation: 'Present Simple for occupation/work routine. Third person needs -s.',
    structure_hint: 'He/She + verb+s + in/at + place',
    fill_blank: 'He ___ in an office.',
    first_word: 'He',
    word_bank: 'He, works, in, an, office',
    practice_mode: 'word_bank',
  },
];

const insertSentence = db.prepare(`
  INSERT INTO sentences (bangla_sentence, advanced_version, explanation, structure_hint, fill_blank_hint, first_word_hint, word_bank_words, category_id, subcategory_id, difficulty, practice_mode, homework_mode, checking_mode, is_active, tags, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertAnswer = db.prepare(`INSERT INTO sentence_answers (sentence_id, accepted_answer, normalized_answer, sort_order) VALUES (?, ?, ?, ?)`);

sampleSentences.forEach((s, sIdx) => {
  const result = insertSentence.run(
    s.bangla, s.advanced, s.explanation, s.structure_hint,
    s.fill_blank, s.first_word, s.word_bank,
    catPS.id, subBasic.id, 'Easy', s.practice_mode, 'learning', 'flexible',
    1, 'present simple, daily habit, spoken english', sIdx + 1
  );
  s.answers.forEach((ans, idx) => {
    insertAnswer.run(result.lastInsertRowid, ans, normalizeFlexible(ans), idx);
  });
});

// ============================================
// BATCH
// ============================================
db.prepare(`INSERT OR IGNORE INTO batches (name, course_name, start_date, status) VALUES (?, ?, ?, ?)`)
  .run('Batch 1 - 2025', 'Spoken English Complete Course', '2025-01-01', 'active');
db.prepare(`UPDATE users SET batch_id = 1 WHERE email = 'student@proenglishbd.com'`).run();

console.log('');
console.log('✅ Database seeded successfully!');
console.log('');
console.log('👤 Admin:   admin@proenglishbd.com / admin123');
console.log('👤 Student: student@proenglishbd.com / student123');
console.log('');
console.log('📊 Seeded:');
console.log('   - 20 settings');
console.log('   - 10 levels (Starter Speaker → Master Communicator)');
console.log('   - 20 categories');
console.log('   - 11 subcategories per category (220 total)');
console.log('   - 10 sample sentences with word bank, fill-blank, hints');
console.log('   - 1 batch');
console.log('');
console.log('🚫 No paid APIs used. System is fully offline-capable.');
