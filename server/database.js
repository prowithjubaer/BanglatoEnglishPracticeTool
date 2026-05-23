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
    daily_goal INTEGER DEFAULT 10,
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
    hint TEXT,
    category_id INTEGER,
    subcategory_id INTEGER,
    difficulty TEXT DEFAULT 'Easy',
    checking_mode TEXT DEFAULT 'flexible' CHECK(checking_mode IN ('exact','flexible','ai')),
    is_active INTEGER DEFAULT 1,
    is_premium INTEGER DEFAULT 0,
    tags TEXT,
    audio_bangla TEXT,
    audio_english TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (subcategory_id) REFERENCES subcategories(id)
  );

  CREATE TABLE IF NOT EXISTS sentence_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sentence_id INTEGER NOT NULL,
    correct_answer TEXT NOT NULL,
    normalized_answer TEXT,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (sentence_id) REFERENCES sentences(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS student_sentence_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    sentence_id INTEGER NOT NULL,
    status TEXT DEFAULT 'new' CHECK(status IN ('new','attempted','correct','wrong','needs_review','mastered')),
    attempts_count INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    wrong_count INTEGER DEFAULT 0,
    last_answer TEXT,
    last_result TEXT,
    next_review_at TEXT,
    mastered_at TEXT,
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
    is_correct INTEGER DEFAULT 0,
    xp_earned INTEGER DEFAULT 0,
    feedback_shown INTEGER DEFAULT 1,
    submitted_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (sentence_id) REFERENCES sentences(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS homework_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    category_id INTEGER,
    subcategory_id INTEGER,
    assigned_by INTEGER,
    batch_id INTEGER,
    start_date TEXT,
    due_date TEXT,
    xp_bonus INTEGER DEFAULT 10,
    allow_late INTEGER DEFAULT 1,
    show_answer_after_wrong INTEGER DEFAULT 1,
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
  CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sentences_category ON sentences(category_id);
  CREATE INDEX IF NOT EXISTS idx_sentences_subcategory ON sentences(subcategory_id);
`);

module.exports = db;
