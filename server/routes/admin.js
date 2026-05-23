const express = require('express');
const db = require('../database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const { normalizeFlexible } = require('../utils/answerChecker');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Setup multer for file uploads
const upload = multer({ dest: path.join(__dirname, '..', '..', 'uploads') });

// Admin dashboard stats
router.get('/dashboard', authenticate, requireAdmin, (req, res) => {
  try {
    const totalStudents = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'student'").get().count;
    const activeToday = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'student' AND date(last_active_at) = date('now')").get().count;
    const totalSentences = db.prepare('SELECT COUNT(*) as count FROM sentences').get().count;
    const activeSentences = db.prepare('SELECT COUNT(*) as count FROM sentences WHERE is_active = 1').get().count;
    const totalSubmissions = db.prepare('SELECT COUNT(*) as count FROM submissions').get().count;
    const todaySubmissions = db.prepare("SELECT COUNT(*) as count FROM submissions WHERE date(submitted_at) = date('now')").get().count;
    const correctRate = db.prepare('SELECT AVG(is_correct) * 100 as rate FROM submissions').get().rate || 0;
    const totalHomework = db.prepare('SELECT COUNT(*) as count FROM homework_sets WHERE is_active = 1').get().count;

    // Most difficult sentences (lowest accuracy)
    const hardSentences = db.prepare(`
      SELECT s.bangla_sentence, s.id,
        COUNT(sub.id) as attempts,
        SUM(sub.is_correct) as correct_count,
        ROUND((SUM(sub.is_correct) * 100.0 / COUNT(sub.id)), 1) as accuracy
      FROM sentences s
      JOIN submissions sub ON sub.sentence_id = s.id
      GROUP BY s.id
      HAVING attempts >= 3
      ORDER BY accuracy ASC
      LIMIT 10
    `).all();

    // Recent activity
    const recentActivity = db.prepare(`
      SELECT u.name, s.bangla_sentence, sub.is_correct, sub.submitted_at
      FROM submissions sub
      JOIN users u ON u.id = sub.user_id
      JOIN sentences s ON s.id = sub.sentence_id
      ORDER BY sub.submitted_at DESC
      LIMIT 20
    `).all();

    res.json({
      totalStudents,
      activeToday,
      totalSentences,
      activeSentences,
      totalSubmissions,
      todaySubmissions,
      correctRate: Math.round(correctRate),
      totalHomework,
      hardSentences,
      recentActivity,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Student reports
router.get('/students', authenticate, requireAdmin, (req, res) => {
  try {
    const students = db.prepare(`
      SELECT u.id, u.name, u.email, u.phone, u.premium_status, u.total_xp, u.level, u.streak,
        u.last_active_at, u.batch_id, b.name as batch_name,
        (SELECT COUNT(*) FROM submissions WHERE user_id = u.id) as total_submissions,
        (SELECT SUM(is_correct) FROM submissions WHERE user_id = u.id) as correct_submissions,
        (SELECT COUNT(*) FROM student_sentence_progress WHERE user_id = u.id AND status = 'mastered') as mastered
      FROM users u
      LEFT JOIN batches b ON b.id = u.batch_id
      WHERE u.role = 'student'
      ORDER BY u.total_xp DESC
    `).all();

    students.forEach(s => {
      s.accuracy = s.total_submissions > 0 ? Math.round((s.correct_submissions / s.total_submissions) * 100) : 0;
    });

    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Individual student report
router.get('/students/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const student = db.prepare(`
      SELECT u.*, b.name as batch_name FROM users u LEFT JOIN batches b ON b.id = u.batch_id WHERE u.id = ?
    `).get(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const { password: _, ...safeStudent } = student;

    // Category breakdown
    const categoryBreakdown = db.prepare(`
      SELECT c.name, c.icon,
        COUNT(p.id) as attempted,
        SUM(CASE WHEN p.status = 'mastered' THEN 1 ELSE 0 END) as mastered,
        SUM(CASE WHEN p.last_result = 'correct' THEN 1 ELSE 0 END) as correct,
        SUM(CASE WHEN p.last_result = 'wrong' THEN 1 ELSE 0 END) as wrong
      FROM student_sentence_progress p
      JOIN sentences s ON s.id = p.sentence_id
      JOIN categories c ON c.id = s.category_id
      WHERE p.user_id = ?
      GROUP BY c.id
    `).all(req.params.id);

    // Recent submissions
    const recentSubmissions = db.prepare(`
      SELECT sub.*, s.bangla_sentence, c.name as category_name
      FROM submissions sub
      JOIN sentences s ON s.id = sub.sentence_id
      LEFT JOIN categories c ON c.id = s.category_id
      WHERE sub.user_id = ?
      ORDER BY sub.submitted_at DESC LIMIT 50
    `).all(req.params.id);

    res.json({ student: safeStudent, categoryBreakdown, recentSubmissions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset student progress
router.post('/students/:id/reset', authenticate, requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM student_sentence_progress WHERE user_id = ?').run(req.params.id);
    db.prepare('DELETE FROM submissions WHERE user_id = ?').run(req.params.id);
    db.prepare('UPDATE users SET total_xp = 0, level = 1, streak = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Settings management
router.get('/settings', authenticate, requireAdmin, (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM settings').all();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/settings', authenticate, requireAdmin, (req, res) => {
  try {
    const { settings } = req.body;
    const update = db.prepare('INSERT OR REPLACE INTO settings (key, value, description) VALUES (?, ?, COALESCE((SELECT description FROM settings WHERE key = ?), ?))');
    settings.forEach(s => update.run(s.key, s.value, s.key, s.key));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Levels management
router.get('/levels', authenticate, requireAdmin, (req, res) => {
  try {
    const levels = db.prepare('SELECT * FROM levels ORDER BY level_number').all();
    res.json(levels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/levels', authenticate, requireAdmin, (req, res) => {
  try {
    const { levels } = req.body;
    const upsert = db.prepare('INSERT OR REPLACE INTO levels (level_number, name, min_xp, max_xp, badge) VALUES (?, ?, ?, ?, ?)');
    levels.forEach(l => upsert.run(l.level_number, l.name, l.min_xp, l.max_xp, l.badge));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CSV/XLSX Upload
router.post('/upload', authenticate, requireAdmin, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    let rows = [];
    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    if (ext === '.csv') {
      const content = fs.readFileSync(filePath, 'utf-8');
      rows = parse(content, { columns: true, skip_empty_lines: true, trim: true });
    } else if (ext === '.xlsx' || ext === '.xls') {
      const workbook = XLSX.readFile(filePath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet);
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Unsupported file format. Use CSV or XLSX.' });
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    let imported = 0;
    let errors = [];

    const insertSentence = db.prepare(`
      INSERT INTO sentences (bangla_sentence, advanced_version, explanation, hint, category_id, subcategory_id, difficulty, checking_mode, is_active, is_premium, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertAnswer = db.prepare('INSERT INTO sentence_answers (sentence_id, correct_answer, normalized_answer, sort_order) VALUES (?, ?, ?, ?)');

    rows.forEach((row, idx) => {
      try {
        const bangla = row.bangla_sentence || row.bangla;
        if (!bangla) { errors.push(`Row ${idx + 2}: Missing bangla_sentence`); return; }

        // Find category
        let categoryId = null;
        if (row.category) {
          const cat = db.prepare('SELECT id FROM categories WHERE name = ?').get(row.category);
          categoryId = cat?.id;
        }

        // Find subcategory
        let subcategoryId = null;
        if (row.subcategory && categoryId) {
          const subcat = db.prepare('SELECT id FROM subcategories WHERE name = ? AND category_id = ?').get(row.subcategory, categoryId);
          subcategoryId = subcat?.id;
        }

        const result = insertSentence.run(
          bangla,
          row.advanced_version || null,
          row.explanation || null,
          row.hint || null,
          categoryId,
          subcategoryId,
          row.difficulty || 'Easy',
          row.checking_mode || 'flexible',
          (row.is_active === 'No' || row.is_active === '0') ? 0 : 1,
          (row.is_premium === 'Yes' || row.is_premium === '1') ? 1 : 0,
          row.tags || null
        );

        // Add answers
        for (let i = 1; i <= 5; i++) {
          const answer = row[`correct_answer_${i}`];
          if (answer && answer.trim()) {
            insertAnswer.run(result.lastInsertRowid, answer.trim(), normalizeFlexible(answer.trim()), i - 1);
          }
        }

        imported++;
      } catch (rowErr) {
        errors.push(`Row ${idx + 2}: ${rowErr.message}`);
      }
    });

    res.json({ success: true, imported, total: rows.length, errors: errors.slice(0, 20) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export sentences as CSV
router.get('/export', authenticate, requireAdmin, (req, res) => {
  try {
    const sentences = db.prepare(`
      SELECT s.*, c.name as category_name, sc.name as subcategory_name
      FROM sentences s
      LEFT JOIN categories c ON c.id = s.category_id
      LEFT JOIN subcategories sc ON sc.id = s.subcategory_id
      ORDER BY s.id
    `).all();

    const getAnswers = db.prepare('SELECT correct_answer FROM sentence_answers WHERE sentence_id = ? ORDER BY sort_order');

    const csvRows = sentences.map(s => {
      const answers = getAnswers.all(s.id).map(a => a.correct_answer);
      return {
        id: s.id,
        bangla_sentence: s.bangla_sentence,
        correct_answer_1: answers[0] || '',
        correct_answer_2: answers[1] || '',
        correct_answer_3: answers[2] || '',
        correct_answer_4: answers[3] || '',
        correct_answer_5: answers[4] || '',
        advanced_version: s.advanced_version || '',
        explanation: s.explanation || '',
        hint: s.hint || '',
        category: s.category_name || '',
        subcategory: s.subcategory_name || '',
        difficulty: s.difficulty || '',
        is_premium: s.is_premium ? 'Yes' : 'No',
        is_active: s.is_active ? 'Yes' : 'No',
        checking_mode: s.checking_mode || 'flexible',
        tags: s.tags || '',
      };
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=sentences_export.csv');

    const { stringify } = require('csv-stringify/sync');
    const csv = stringify(csvRows, { header: true });
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export student progress
router.get('/export/students', authenticate, requireAdmin, (req, res) => {
  try {
    const students = db.prepare(`
      SELECT u.name, u.email, u.phone, u.total_xp, u.level, u.streak, u.last_active_at,
        b.name as batch_name,
        (SELECT COUNT(*) FROM submissions WHERE user_id = u.id) as total_attempts,
        (SELECT SUM(is_correct) FROM submissions WHERE user_id = u.id) as correct_answers,
        (SELECT COUNT(*) FROM student_sentence_progress WHERE user_id = u.id AND status = 'mastered') as mastered
      FROM users u
      LEFT JOIN batches b ON b.id = u.batch_id
      WHERE u.role = 'student'
      ORDER BY u.total_xp DESC
    `).all();

    students.forEach(s => {
      s.accuracy = s.total_attempts > 0 ? Math.round((s.correct_answers / s.total_attempts) * 100) + '%' : '0%';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=students_export.csv');

    const { stringify } = require('csv-stringify/sync');
    const csv = stringify(students, { header: true });
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Batches
router.get('/batches', authenticate, requireAdmin, (req, res) => {
  try {
    const batches = db.prepare(`
      SELECT b.*, (SELECT COUNT(*) FROM users WHERE batch_id = b.id) as student_count
      FROM batches b ORDER BY b.id DESC
    `).all();
    res.json(batches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/batches', authenticate, requireAdmin, (req, res) => {
  try {
    const { name, course_name, start_date } = req.body;
    const result = db.prepare('INSERT INTO batches (name, course_name, start_date) VALUES (?, ?, ?)').run(name, course_name, start_date);
    res.json({ id: result.lastInsertRowid, success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
