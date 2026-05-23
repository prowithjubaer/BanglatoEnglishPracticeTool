const db = require('./database');
const bcrypt = require('bcryptjs');
const { normalizeFlexible } = require('./utils/answerChecker');

console.log('Seeding database...');

// ============================================
// SETTINGS (All configurable options)
// ============================================
const settings = [
  // XP Settings
  ['xp_per_correct', '5', 'XP earned per correct answer'],
  ['xp_per_almost_correct', '2', 'XP earned per almost correct answer'],
  ['xp_per_wrong', '0', 'XP earned per wrong answer'],
  ['xp_homework_bonus', '10', 'Bonus XP for completing homework'],
  ['xp_streak_bonus_7', '25', 'Bonus XP for 7-day streak'],
  ['xp_mastery_bonus', '5', 'Bonus XP for mastering a sentence'],

  // Revision/Spaced Repetition
  ['revision_after_correct_days', '7', 'Days before review after correct answer'],
  ['revision_after_almost_correct_days', '2', 'Days before review after almost correct answer'],
  ['revision_after_wrong_days', '1', 'Days before review after wrong answer'],
  ['mastery_required_correct_reviews', '2', 'Correct reviews needed for mastery'],

  // Answer Checking
  ['almost_correct_enabled', '1', 'Enable 3-tier results (Correct/Almost Correct/Wrong)'],
  ['correct_similarity_threshold', '90', 'Similarity % needed for Correct (when no exact match)'],
  ['partial_similarity_threshold', '70', 'Similarity % needed for Almost Correct'],
  ['synonym_matching_enabled', '1', 'Enable synonym dictionary matching'],
  ['retry_xp_behavior', 'reduce', 'XP on retry after seeing answer: full/reduce/none'],

  // Anti-Cheat
  ['anti_cheat_same_day', '1', 'Prevent XP farming same sentence same day'],

  // UI Controls
  ['allow_skip', '1', 'Allow students to skip sentences'],
  ['show_answer_after_wrong', '1', 'Show correct answer after wrong attempt'],
  ['show_advanced_after_submit', '1', 'Show advanced version after submission'],
  ['leaderboard_enabled', '1', 'Enable leaderboard'],
  ['hints_enabled', '1', 'Enable hint button for students'],
  ['review_request_enabled', '1', 'Allow students to request teacher review'],
  ['premium_lock_enabled', '1', 'Enable premium content locking'],

  // Feedback Messages (Bangla)
  ['feedback_correct_bn', 'সঠিক হয়েছে! দারুণ কাজ করেছেন।', 'Correct answer feedback in Bangla'],
  ['feedback_almost_correct_bn', 'প্রায় সঠিক হয়েছে, তবে একটু ভুল আছে। নিচে দেখুন কোথায় সমস্যা।', 'Almost correct feedback in Bangla'],
  ['feedback_wrong_bn', 'এবার সঠিক হয়নি। চিন্তার কিছু নেই, নিচের সঠিক ফরম্যাটগুলো দেখে আবার শিখে নিন।', 'Wrong answer feedback in Bangla'],

  // Premium/Business
  ['premium_cta_text', 'This practice set is for Premium students. Join Premium Batch to unlock guided practice, homework, correction and fluency tools.', 'Premium lock message'],
  ['whatsapp_number', '+8801XXXXXXXXX', 'WhatsApp contact number'],

  // Misc
  ['timed_challenge_seconds', '30', 'Seconds for timed challenge mode'],
  ['no_paid_api_mode', '1', 'System runs without any paid API (default ON)'],
];

const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value, description) VALUES (?, ?, ?)');
settings.forEach(s => insertSetting.run(s[0], s[1], s[2]));

// ============================================
// LEVELS
// ============================================
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

// ============================================
// USERS
// ============================================
const adminHash = bcrypt.hashSync('admin123', 10);
const studentHash = bcrypt.hashSync('student123', 10);

db.prepare(`INSERT OR IGNORE INTO users (name, email, phone, password, role, premium_status) VALUES (?, ?, ?, ?, ?, ?)`)
  .run('Admin', 'admin@proenglishbd.com', '+8801700000000', adminHash, 'admin', 1);
db.prepare(`INSERT OR IGNORE INTO users (name, email, phone, password, role, premium_status) VALUES (?, ?, ?, ?, ?, ?)`)
  .run('Demo Student', 'student@proenglishbd.com', '+8801700000001', studentHash, 'student', 1);

// ============================================
// CATEGORIES
// ============================================
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

// Subcategories
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

// ============================================
// GRAMMAR PATTERNS
// ============================================
const patterns = [
  ['Present Simple Positive', 'Subject + base verb (+ s/es for 3rd person) + object', 'Subject + V1/V1s + Object', 'do,does', null, 'Present Simple'],
  ['Present Simple Negative', 'Subject + do/does + not + base verb + object', 'Subject + do/does + not + V1 + Object', 'do not,does not,don\'t,doesn\'t', null, 'Present Simple'],
  ['Present Simple Question', 'Do/Does + subject + base verb + object?', 'Do/Does + Subject + V1 + Object?', 'do,does', null, 'Present Simple'],
  ['Present Continuous Positive', 'Subject + am/is/are + verb-ing + object', 'Subject + am/is/are + V-ing + Object', 'am,is,are', null, 'Present Continuous'],
  ['Past Simple Positive', 'Subject + past verb (V2) + object', 'Subject + V2 + Object', null, 'is,are,am', 'Past Simple'],
  ['Past Simple Negative', 'Subject + did not + base verb + object', 'Subject + did not + V1 + Object', 'did not,didn\'t', null, 'Past Simple'],
  ['Past Simple Question', 'Did + subject + base verb + object?', 'Did + Subject + V1 + Object?', 'did', null, 'Past Simple'],
  ['Future Simple Positive', 'Subject + will + base verb + object', 'Subject + will + V1 + Object', 'will', null, 'Future Simple'],
  ['Future Simple Negative', 'Subject + will not + base verb + object', 'Subject + will not + V1 + Object', 'will not,won\'t', null, 'Future Simple'],
  ['Present Perfect Positive', 'Subject + have/has + past participle + object', 'Subject + have/has + V3 + Object', 'have,has', null, 'Present Perfect'],
  ['Past Perfect Positive', 'Subject + had + past participle + object', 'Subject + had + V3 + Object', 'had', null, 'Past Perfect'],
  ['Present Continuous Negative', 'Subject + am/is/are + not + verb-ing', 'Subject + am/is/are + not + V-ing', 'not', null, 'Present Continuous'],
];

const insertPattern = db.prepare('INSERT OR IGNORE INTO grammar_patterns (name, description, expected_structure, required_markers, forbidden_markers, tense_category) VALUES (?, ?, ?, ?, ?, ?)');
patterns.forEach(p => insertPattern.run(p[0], p[1], p[2], p[3], p[4], p[5]));

// ============================================
// SYNONYM GROUPS
// ============================================
const synonyms = [
  ['learn/study/practice', 'learn, study, practice'],
  ['daily/every day', 'daily, every day'],
  ['buy/purchase', 'buy, purchase'],
  ['begin/start', 'begin, start'],
  ['speak/talk', 'speak, talk'],
  ['go/travel/commute', 'go, travel, commute'],
  ['eat/have/consume', 'eat, have, consume'],
  ['big/large/huge', 'big, large, huge'],
  ['small/little/tiny', 'small, little, tiny'],
  ['happy/glad/pleased', 'happy, glad, pleased'],
  ['sad/unhappy/upset', 'sad, unhappy, upset'],
  ['fast/quick/rapid', 'fast, quick, rapid'],
  ['help/assist/support', 'help, assist, support'],
  ['like/enjoy/love', 'like, enjoy, love'],
  ['make/create/build', 'make, create, build'],
];

const insertSynonym = db.prepare('INSERT OR IGNORE INTO synonym_groups (group_name, words) VALUES (?, ?)');
synonyms.forEach(s => insertSynonym.run(s[0], s[1]));

// ============================================
// SAMPLE SENTENCES (Present Simple - Basic)
// ============================================
const catPS = db.prepare("SELECT id FROM categories WHERE name = 'Present Simple'").get();
const subBasic = db.prepare("SELECT id FROM subcategories WHERE category_id = ? AND name = 'Basic'").get(catPS.id);

const sampleSentences = [
  {
    bangla: 'আমি প্রতিদিন ইংরেজি শিখি।',
    answers: ['I learn English every day.', 'I study English every day.', 'I practice English every day.', 'I learn English daily.'],
    advanced: 'I make it a habit to practice English every single day.',
    explanation: 'Present Simple is used for daily habits and routines. Structure: Subject + base verb + object.',
    hint: 'Use subject + base verb. Think about daily habits.',
    required_words: 'English',
    grammar_pattern: 'Present Simple Positive',
    mistake_focus: 'Daily habit sentence - Present Simple',
  },
  {
    bangla: 'সে প্রতিদিন সকালে ঘুম থেকে ওঠে।',
    answers: ['He wakes up every morning.', 'He gets up every morning.', 'He wakes up every day in the morning.'],
    advanced: 'He makes it a point to wake up early every single morning without fail.',
    explanation: 'For third person singular (he/she/it), add -s/-es to the base verb.',
    hint: 'Third person singular needs -s. Think: he/she + verb+s',
    required_words: 'morning',
    forbidden_words: 'waking',
    grammar_pattern: 'Present Simple Positive',
    mistake_focus: 'Third person -s/-es rule',
  },
  {
    bangla: 'আমরা স্কুলে যাই।',
    answers: ['We go to school.', 'We attend school.', 'We go to the school.'],
    advanced: 'We regularly commute to school as part of our daily routine.',
    explanation: 'Simple present for regular activities. "We" takes base form of verb.',
    hint: 'We + base verb + to + place',
    required_words: 'school',
    grammar_pattern: 'Present Simple Positive',
    mistake_focus: 'Regular activity',
  },
  {
    bangla: 'তারা ফুটবল খেলে।',
    answers: ['They play football.', 'They play soccer.', 'They play football regularly.'],
    advanced: 'They are passionate about playing football and practice it regularly.',
    explanation: 'Present simple for hobbies. "They" takes base form.',
    hint: 'They + base verb + object',
    required_words: 'play',
    forbidden_words: 'playing',
    grammar_pattern: 'Present Simple Positive',
    mistake_focus: 'Hobby/regular activity',
  },
  {
    bangla: 'আমি চা পান করি।',
    answers: ['I drink tea.', 'I have tea.', 'I take tea.'],
    advanced: 'I enjoy having a cup of tea as part of my daily routine.',
    explanation: 'Present simple for habits. Multiple verbs can express the same meaning.',
    hint: 'I + verb + object. Multiple verbs work here.',
    required_words: 'tea',
    grammar_pattern: 'Present Simple Positive',
    mistake_focus: 'Multiple correct verbs for same meaning',
  },
  {
    bangla: 'সে বই পড়ে।',
    answers: ['He reads books.', 'She reads books.', 'He reads a book.', 'She reads a book.'],
    advanced: 'He is an avid reader who spends quality time reading books every day.',
    explanation: 'Third person + verb+s. "Read" becomes "reads" for he/she.',
    hint: 'He/She + reads + object',
    required_words: 'reads',
    forbidden_words: 'read,reading',
    grammar_pattern: 'Present Simple Positive',
    mistake_focus: 'Third person verb conjugation',
  },
  {
    bangla: 'পানি ১০০ ডিগ্রিতে ফুটে।',
    answers: ['Water boils at 100 degrees.', 'Water boils at 100 degrees Celsius.'],
    advanced: 'It is a scientific fact that water reaches its boiling point at exactly 100 degrees Celsius.',
    explanation: 'Present simple for scientific facts and universal truths.',
    hint: 'Scientific fact = present simple. Subject + verb+s.',
    required_words: 'boils,100',
    grammar_pattern: 'Present Simple Positive',
    mistake_focus: 'Scientific fact / Universal truth',
  },
  {
    bangla: 'সূর্য পূর্বে ওঠে।',
    answers: ['The sun rises in the east.', 'Sun rises in the east.'],
    advanced: 'The sun invariably rises in the east, which is a universal truth.',
    explanation: 'Universal truths use present simple tense.',
    hint: 'Universal truth. The sun + verb+s.',
    required_words: 'rises,east',
    grammar_pattern: 'Present Simple Positive',
    mistake_focus: 'Universal truth',
  },
  {
    bangla: 'আমি ভাত খাই।',
    answers: ['I eat rice.', 'I have rice.'],
    advanced: 'Rice is a staple food that I consume as part of my regular diet.',
    explanation: 'Present simple for regular eating habits.',
    hint: 'I + eat/have + food item',
    required_words: 'rice',
    grammar_pattern: 'Present Simple Positive',
    mistake_focus: 'Food habit',
  },
  {
    bangla: 'সে অফিসে কাজ করে।',
    answers: ['He works in an office.', 'She works in an office.', 'He works at the office.', 'She works at the office.'],
    advanced: 'He is employed at an office where he works diligently every day.',
    explanation: 'Present simple for occupation/work routine.',
    hint: 'He/She + works + in/at + place',
    required_words: 'works,office',
    forbidden_words: 'work,working',
    grammar_pattern: 'Present Simple Positive',
    mistake_focus: 'Occupation/work routine - third person',
  },
];

const insertSentence = db.prepare(`
  INSERT INTO sentences (bangla_sentence, advanced_version, explanation, hint, category_id, subcategory_id, difficulty, checking_mode, grammar_pattern, mistake_focus, required_words, forbidden_words, partial_match_enabled, is_active, tags)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertAnswer = db.prepare(`INSERT INTO sentence_answers (sentence_id, correct_answer, normalized_answer, sort_order) VALUES (?, ?, ?, ?)`);

sampleSentences.forEach(s => {
  const result = insertSentence.run(
    s.bangla, s.advanced, s.explanation, s.hint,
    catPS.id, subBasic.id, 'Easy', 'flexible',
    s.grammar_pattern || null, s.mistake_focus || null,
    s.required_words || null, s.forbidden_words || null,
    1, 1, 'daily routine, habit, present simple'
  );
  s.answers.forEach((ans, idx) => {
    insertAnswer.run(result.lastInsertRowid, ans, normalizeFlexible(ans), idx);
  });
});

// ============================================
// BATCH
// ============================================
db.prepare(`INSERT OR IGNORE INTO batches (name, course_name, start_date, status) VALUES (?, ?, ?, ?)`)
  .run('Batch 1 - 2024', 'Spoken English Complete', '2024-01-01', 'active');
db.prepare(`UPDATE users SET batch_id = 1 WHERE email = 'student@proenglishbd.com'`).run();

console.log('Database seeded successfully!');
console.log('Admin: admin@proenglishbd.com / admin123');
console.log('Student: student@proenglishbd.com / student123');
console.log('');
console.log('New features seeded:');
console.log('- 30+ configurable settings (XP, thresholds, UI controls)');
console.log('- 12 grammar patterns');
console.log('- 15 synonym groups');
console.log('- 10 sample sentences with required/forbidden words');
