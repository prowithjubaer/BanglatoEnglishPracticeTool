const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'app.db');
const fs = require('fs');
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'student' CHECK(role IN ('student','admin')),
    premium_status INTEGER DEFAULT 0,
    batch_id INTEGER,
    total_xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    streak INTEGER DEFAULT 0,
    daily_goal INTEGER DEFAULT 20,
    last_active_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    is_premium INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS subcategories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    difficulty TEXT DEFAULT 'Easy',
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    is_premium INTEGER DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sentences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bangla_sentence TEXT NOT NULL,
    advanced_version TEXT,
    explanation TEXT,
    structure_hint TEXT,
    fill_blank_hint TEXT,
    first_word_hint TEXT,
    word_bank_words TEXT,
    category_id INTEGER,
    subcategory_id INTEGER,
    difficulty TEXT DEFAULT 'Easy',
    practice_mode TEXT DEFAULT 'typing' CHECK(practice_mode IN ('typing','word_bank','fill_blank','mixed')),
    homework_mode TEXT DEFAULT 'learning' CHECK(homework_mode IN ('learning','test')),
    checking_mode TEXT DEFAULT 'flexible' CHECK(checking_mode IN ('exact','flexible')),
    is_active INTEGER DEFAULT 1,
    is_premium INTEGER DEFAULT 0,
    tags TEXT,
    sort_order INTEGER DEFAULT 0,
    review_after_correct_days INTEGER DEFAULT 7,
    review_after_not_matched_days INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (subcategory_id) REFERENCES subcategories(id)
  );

  CREATE TABLE IF NOT EXISTS sentence_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sentence_id INTEGER NOT NULL,
    accepted_answer TEXT NOT NULL,
    normalized_answer TEXT,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (sentence_id) REFERENCES sentences(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS student_sentence_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    sentence_id INTEGER NOT NULL,
    status TEXT DEFAULT 'new' CHECK(status IN ('new','correct','not_matched','needs_practice','mastered')),
    attempts_count INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    not_matched_count INTEGER DEFAULT 0,
    last_answer TEXT,
    last_result TEXT,
    next_review_at TEXT,
    mastered_at TEXT,
    xp_earned_total INTEGER DEFAULT 0,
    last_attempted_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, sentence_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (sentence_id) REFERENCES sentences(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    sentence_id INTEGER NOT NULL,
    submitted_answer TEXT NOT NULL,
    normalized_answer TEXT,
    result TEXT DEFAULT 'not_matched' CHECK(result IN ('correct','not_matched')),
    xp_earned INTEGER DEFAULT 0,
    submitted_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (sentence_id) REFERENCES sentences(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS homework_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    batch_id INTEGER,
    category_id INTEGER,
    subcategory_id INTEGER,
    assigned_by INTEGER,
    start_date TEXT,
    due_date TEXT,
    homework_mode TEXT DEFAULT 'learning' CHECK(homework_mode IN ('learning','test')),
    practice_mode TEXT DEFAULT 'typing' CHECK(practice_mode IN ('typing','word_bank','fill_blank','mixed')),
    xp_per_correct INTEGER DEFAULT 5,
    completion_bonus INTEGER DEFAULT 10,
    allow_late_submission INTEGER DEFAULT 1,
    allow_retry INTEGER DEFAULT 1,
    shuffle_sentences INTEGER DEFAULT 0,
    show_answer_after_submit INTEGER DEFAULT 1,
    lock_next_until_answered INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (assigned_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS homework_sentences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    homework_id INTEGER NOT NULL,
    sentence_id INTEGER NOT NULL,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (homework_id) REFERENCES homework_sets(id) ON DELETE CASCADE,
    FOREIGN KEY (sentence_id) REFERENCES sentences(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS homework_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    homework_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    status TEXT DEFAULT 'assigned' CHECK(status IN ('assigned','in_progress','completed','missed')),
    completed_at TEXT,
    score INTEGER DEFAULT 0,
    total_questions INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    accuracy REAL DEFAULT 0,
    UNIQUE(homework_id, user_id),
    FOREIGN KEY (homework_id) REFERENCES homework_sets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    course_name TEXT,
    start_date TEXT,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS levels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level_number INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    min_xp INTEGER NOT NULL,
    max_xp INTEGER NOT NULL,
    badge TEXT
  );

  CREATE TABLE IF NOT EXISTS badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    badge_name TEXT NOT NULL,
    badge_type TEXT,
    earned_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_progress_user ON student_sentence_progress(user_id);
  CREATE INDEX IF NOT EXISTS idx_progress_sentence ON student_sentence_progress(sentence_id);
  CREATE INDEX IF NOT EXISTS idx_progress_review ON student_sentence_progress(next_review_at);
  CREATE INDEX IF NOT EXISTS idx_progress_status ON student_sentence_progress(status);
  CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id);
  CREATE INDEX IF NOT EXISTS idx_submissions_sentence ON submissions(sentence_id);
  CREATE INDEX IF NOT EXISTS idx_sentences_category ON sentences(category_id);
  CREATE INDEX IF NOT EXISTS idx_sentences_subcategory ON sentences(subcategory_id);
`);

module.exports = db;
