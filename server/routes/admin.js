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
const upload = multer({ dest: path.join(__dirname, '..', '..', 'uploads') });

// ============================================
// ADMIN DASHBOARD
// ============================================
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
    const pendingReviews = db.prepare("SELECT COUNT(*) as count FROM review_queue WHERE status = 'pending'").get().count;

    const hardSentences = db.prepare(`
      SELECT s.bangla_sentence, s.id,
        COUNT(sub.id) as attempts,
        SUM(sub.is_correct) as correct_count,
        ROUND((SUM(sub.is_correct) * 100.0 / COUNT(sub.id)), 1) as accuracy
      FROM sentences s
      JOIN submissions sub ON sub.sentence_id = s.id
      GROUP BY s.id HAVING attempts >= 3
      ORDER BY accuracy ASC LIMIT 10
    `).all();

    const recentActivity = db.prepare(`
      SELECT u.name, s.bangla_sentence, sub.result_type, sub.submitted_at
      FROM submissions sub
      JOIN users u ON u.id = sub.user_id
      JOIN sentences s ON s.id = sub.sentence_id
      ORDER BY sub.submitted_at DESC LIMIT 20
    `).all();

    // Mistake type breakdown
    const mistakeBreakdown = db.prepare(`
      SELECT mistake_type, COUNT(*) as count FROM submissions
      WHERE mistake_type IS NOT NULL AND result_type != 'correct'
      GROUP BY mistake_type ORDER BY count DESC LIMIT 10
    `).all();

    res.json({ totalStudents, activeToday, totalSentences, activeSentences, totalSubmissions, todaySubmissions, correctRate: Math.round(correctRate), totalHomework, pendingReviews, hardSentences, recentActivity, mistakeBreakdown });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ============================================
// STUDENTS
// ============================================
router.get('/students', authenticate, requireAdmin, (req, res) => {
  try {
    const students = db.prepare(`
      SELECT u.id, u.name, u.email, u.phone, u.premium_status, u.total_xp, u.level, u.streak,
        u.last_active_at, u.batch_id, b.name as batch_name,
        (SELECT COUNT(*) FROM submissions WHERE user_id = u.id) as total_submissions,
        (SELECT SUM(is_correct) FROM submissions WHERE user_id = u.id) as correct_submissions,
        (SELECT COUNT(*) FROM submissions WHERE user_id = u.id AND result_type = 'almost_correct') as almost_correct_submissions,
        (SELECT COUNT(*) FROM student_sentence_progress WHERE user_id = u.id AND status = 'mastered') as mastered
      FROM users u LEFT JOIN batches b ON b.id = u.batch_id
      WHERE u.role = 'student' ORDER BY u.total_xp DESC
    `).all();
    students.forEach(s => {
      s.accuracy = s.total_submissions > 0 ? Math.round((s.correct_submissions / s.total_submissions) * 100) : 0;
    });
    res.json(students);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/students/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const student = db.prepare('SELECT u.*, b.name as batch_name FROM users u LEFT JOIN batches b ON b.id = u.batch_id WHERE u.id = ?').get(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    const { password: _, ...safeStudent } = student;

    const categoryBreakdown = db.prepare(`
      SELECT c.name, c.icon,
        COUNT(p.id) as attempted,
        SUM(CASE WHEN p.status = 'mastered' THEN 1 ELSE 0 END) as mastered,
        SUM(CASE WHEN p.last_result = 'correct' THEN 1 ELSE 0 END) as correct,
        SUM(CASE WHEN p.last_result = 'almost_correct' THEN 1 ELSE 0 END) as almost_correct,
        SUM(CASE WHEN p.last_result = 'wrong' THEN 1 ELSE 0 END) as wrong
      FROM student_sentence_progress p
      JOIN sentences s ON s.id = p.sentence_id
      JOIN categories c ON c.id = s.category_id
      WHERE p.user_id = ? GROUP BY c.id
    `).all(req.params.id);

    const commonMistakes = db.prepare(`
      SELECT mistake_type, COUNT(*) as count FROM submissions
      WHERE user_id = ? AND mistake_type IS NOT NULL AND result_type != 'correct'
      GROUP BY mistake_type ORDER BY count DESC LIMIT 5
    `).all(req.params.id);

    const recentSubmissions = db.prepare(`
      SELECT sub.*, s.bangla_sentence, c.name as category_name
      FROM submissions sub JOIN sentences s ON s.id = sub.sentence_id
      LEFT JOIN categories c ON c.id = s.category_id
      WHERE sub.user_id = ? ORDER BY sub.submitted_at DESC LIMIT 50
    `).all(req.params.id);

    res.json({ student: safeStudent, categoryBreakdown, commonMistakes, recentSubmissions });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/students/:id/reset', authenticate, requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM student_sentence_progress WHERE user_id = ?').run(req.params.id);
    db.prepare('DELETE FROM submissions WHERE user_id = ?').run(req.params.id);
    db.prepare('UPDATE users SET total_xp = 0, level = 1, streak = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ============================================
// SETTINGS
// ============================================
router.get('/settings', authenticate, requireAdmin, (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM settings').all();
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/settings', authenticate, requireAdmin, (req, res) => {
  try {
    const { settings } = req.body;
    const update = db.prepare('INSERT OR REPLACE INTO settings (key, value, description) VALUES (?, ?, COALESCE((SELECT description FROM settings WHERE key = ?), ?))');
    settings.forEach(s => update.run(s.key, s.value, s.key, s.key));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// LEVELS
// ============================================
router.get('/levels', authenticate, requireAdmin, (req, res) => {
  try { res.json(db.prepare('SELECT * FROM levels ORDER BY level_number').all()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/levels', authenticate, requireAdmin, (req, res) => {
  try {
    const { levels } = req.body;
    const upsert = db.prepare('INSERT OR REPLACE INTO levels (level_number, name, min_xp, max_xp, badge) VALUES (?, ?, ?, ?, ?)');
    levels.forEach(l => upsert.run(l.level_number, l.name, l.min_xp, l.max_xp, l.badge));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ============================================
// IMPROVED CSV/XLSX UPLOAD (Preview + Validate)
// ============================================

// Step 1: Upload and preview
router.post('/upload/preview', authenticate, requireAdmin, upload.single('file'), (req, res) => {
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
      return res.status(400).json({ error: 'Unsupported format. Use CSV or XLSX.' });
    }

    // Validate each row
    const validated = rows.map((row, idx) => {
      const errors = [];
      const warnings = [];
      const bangla = row.bangla_sentence || row.bangla || '';

      if (!bangla) errors.push('Missing bangla_sentence');

      // Check at least one answer
      const answers = [];
      for (let i = 1; i <= 5; i++) {
        const ans = row[`correct_answer_${i}`];
        if (ans && ans.trim()) answers.push(ans.trim());
      }
      if (answers.length === 0) errors.push('No correct answers provided');

      // Check category exists
      if (row.category) {
        const cat = db.prepare('SELECT id FROM categories WHERE name = ?').get(row.category);
        if (!cat) warnings.push(`Category "${row.category}" not found`);
      } else {
        warnings.push('No category specified');
      }

      // Check subcategory
      if (row.subcategory && row.category) {
        const cat = db.prepare('SELECT id FROM categories WHERE name = ?').get(row.category);
        if (cat) {
          const sub = db.prepare('SELECT id FROM subcategories WHERE name = ? AND category_id = ?').get(row.subcategory, cat.id);
          if (!sub) warnings.push(`Subcategory "${row.subcategory}" not found`);
        }
      }

      // Check for duplicates
      if (bangla) {
        const existing = db.prepare('SELECT id FROM sentences WHERE bangla_sentence = ?').get(bangla);
        if (existing) warnings.push('Duplicate: sentence already exists');
      }

      // Validate difficulty
      if (row.difficulty && !['Easy', 'Medium', 'Hard'].includes(row.difficulty)) {
        warnings.push(`Invalid difficulty "${row.difficulty}"`);
      }

      // Validate checking_mode
      if (row.checking_mode && !['exact', 'flexible', 'ai'].includes(row.checking_mode)) {
        warnings.push(`Invalid checking_mode "${row.checking_mode}"`);
      }

      return {
        row_number: idx + 2,
        bangla_sentence: bangla,
        answers_count: answers.length,
        category: row.category || '',
        subcategory: row.subcategory || '',
        difficulty: row.difficulty || 'Easy',
        has_advanced: !!(row.advanced_version),
        has_hint: !!(row.hint),
        has_required_words: !!(row.required_words),
        is_duplicate: !!db.prepare('SELECT id FROM sentences WHERE bangla_sentence = ?').get(bangla),
        errors,
        warnings,
        valid: errors.length === 0,
        raw: row,
      };
    });

    const summary = {
      total: validated.length,
      valid: validated.filter(r => r.valid).length,
      invalid: validated.filter(r => !r.valid).length,
      duplicates: validated.filter(r => r.is_duplicate).length,
      with_warnings: validated.filter(r => r.warnings.length > 0).length,
    };

    // Keep file path for confirm step
    res.json({ file_id: path.basename(filePath), ext, summary, rows: validated });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Step 2: Confirm import
router.post('/upload/confirm', authenticate, requireAdmin, (req, res) => {
  try {
    const { file_id, ext, duplicate_action, rows_to_import } = req.body;
    // duplicate_action: 'skip' | 'update' | 'import_new' | 'merge_answers'

    if (!file_id) return res.status(400).json({ error: 'File ID required' });

    const filePath = path.join(__dirname, '..', '..', 'uploads', file_id);
    if (!fs.existsSync(filePath)) return res.status(400).json({ error: 'Upload expired. Please re-upload.' });

    let rows = [];
    if (ext === '.csv') {
      const content = fs.readFileSync(filePath, 'utf-8');
      rows = parse(content, { columns: true, skip_empty_lines: true, trim: true });
    } else {
      const workbook = XLSX.readFile(filePath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet);
    }

    fs.unlinkSync(filePath); // Clean up

    let imported = 0, updated = 0, skipped = 0, merged = 0;
    const errors = [];

    const insertSentence = db.prepare(`
      INSERT INTO sentences (bangla_sentence, advanced_version, explanation, hint, category_id, subcategory_id, difficulty, checking_mode, grammar_pattern, mistake_focus, required_words, optional_words, forbidden_words, synonym_group, partial_match_enabled, correct_similarity_threshold, partial_similarity_threshold, review_after_correct_days, review_after_wrong_days, is_active, is_premium, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertAnswer = db.prepare('INSERT INTO sentence_answers (sentence_id, correct_answer, normalized_answer, sort_order) VALUES (?, ?, ?, ?)');

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      try {
        // Skip if user selected specific rows
        if (rows_to_import && !rows_to_import.includes(idx)) { skipped++; continue; }

        const bangla = row.bangla_sentence || row.bangla;
        if (!bangla) { skipped++; continue; }

        const answers = [];
        for (let i = 1; i <= 5; i++) {
          const ans = row[`correct_answer_${i}`];
          if (ans && ans.trim()) answers.push(ans.trim());
        }
        if (answers.length === 0) { skipped++; continue; }

        // Find category/subcategory
        let categoryId = null, subcategoryId = null;
        if (row.category) {
          const cat = db.prepare('SELECT id FROM categories WHERE name = ?').get(row.category);
          categoryId = cat?.id || null;
        }
        if (row.subcategory && categoryId) {
          const sub = db.prepare('SELECT id FROM subcategories WHERE name = ? AND category_id = ?').get(row.subcategory, categoryId);
          subcategoryId = sub?.id || null;
        }

        // Handle duplicates
        const existing = db.prepare('SELECT id FROM sentences WHERE bangla_sentence = ?').get(bangla);
        const dupAction = duplicate_action || 'skip';

        if (existing) {
          if (dupAction === 'skip') { skipped++; continue; }
          else if (dupAction === 'update') {
            // Update existing sentence
            db.prepare(`UPDATE sentences SET advanced_version = ?, explanation = ?, hint = ?, category_id = COALESCE(?, category_id), subcategory_id = COALESCE(?, subcategory_id), difficulty = COALESCE(?, difficulty), checking_mode = COALESCE(?, checking_mode), grammar_pattern = ?, required_words = ?, forbidden_words = ?, tags = ? WHERE id = ?`)
              .run(row.advanced_version || null, row.explanation || null, row.hint || null, categoryId, subcategoryId, row.difficulty || null, row.checking_mode || null, row.grammar_pattern || null, row.required_words || null, row.forbidden_words || null, row.tags || null, existing.id);
            // Replace answers
            db.prepare('DELETE FROM sentence_answers WHERE sentence_id = ?').run(existing.id);
            answers.forEach((ans, i) => insertAnswer.run(existing.id, ans, normalizeFlexible(ans), i));
            updated++;
            continue;
          } else if (dupAction === 'merge_answers') {
            // Only add new answers
            const existingAnswers = db.prepare('SELECT correct_answer FROM sentence_answers WHERE sentence_id = ?').all(existing.id).map(a => normalizeFlexible(a.correct_answer));
            let addedCount = existingAnswers.length;
            answers.forEach(ans => {
              if (!existingAnswers.includes(normalizeFlexible(ans))) {
                insertAnswer.run(existing.id, ans, normalizeFlexible(ans), addedCount++);
              }
            });
            merged++;
            continue;
          }
          // 'import_new' falls through to insert below
        }

        // Insert new sentence
        const result = insertSentence.run(
          bangla, row.advanced_version || null, row.explanation || null, row.hint || null,
          categoryId, subcategoryId, row.difficulty || 'Easy', row.checking_mode || 'flexible',
          row.grammar_pattern || null, row.mistake_focus || null,
          row.required_words || null, row.optional_words || null,
          row.forbidden_words || null, row.synonym_group || null,
          (row.partial_match_enabled === 'No' || row.partial_match_enabled === '0') ? 0 : 1,
          row.correct_similarity_threshold ? parseInt(row.correct_similarity_threshold) : 90,
          row.partial_similarity_threshold ? parseInt(row.partial_similarity_threshold) : 70,
          row.review_after_correct_days ? parseInt(row.review_after_correct_days) : null,
          row.review_after_wrong_days ? parseInt(row.review_after_wrong_days) : null,
          (row.is_active === 'No' || row.is_active === '0') ? 0 : 1,
          (row.is_premium === 'Yes' || row.is_premium === '1') ? 1 : 0,
          row.tags || null
        );
        answers.forEach((ans, i) => insertAnswer.run(result.lastInsertRowid, ans, normalizeFlexible(ans), i));
        imported++;
      } catch (rowErr) {
        errors.push(`Row ${idx + 2}: ${rowErr.message}`);
      }
    }

    res.json({ success: true, imported, updated, merged, skipped, total: rows.length, errors: errors.slice(0, 20) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// Legacy single-step upload (backward compatible)
router.post('/upload', authenticate, requireAdmin, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    let rows = [];
    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext === '.csv') {
      rows = parse(fs.readFileSync(filePath, 'utf-8'), { columns: true, skip_empty_lines: true, trim: true });
    } else if (ext === '.xlsx' || ext === '.xls') {
      const wb = XLSX.readFile(filePath);
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    } else { fs.unlinkSync(filePath); return res.status(400).json({ error: 'Use CSV or XLSX' }); }
    fs.unlinkSync(filePath);

    let imported = 0; const errors = [];
    const ins = db.prepare('INSERT INTO sentences (bangla_sentence, advanced_version, explanation, hint, category_id, subcategory_id, difficulty, checking_mode, grammar_pattern, required_words, forbidden_words, partial_match_enabled, is_active, is_premium, tags) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    const insAns = db.prepare('INSERT INTO sentence_answers (sentence_id, correct_answer, normalized_answer, sort_order) VALUES (?,?,?,?)');

    rows.forEach((row, idx) => {
      try {
        const bangla = row.bangla_sentence || row.bangla;
        if (!bangla) { errors.push(`Row ${idx+2}: Missing bangla`); return; }
        let catId = null, subId = null;
        if (row.category) { const c = db.prepare('SELECT id FROM categories WHERE name = ?').get(row.category); catId = c?.id; }
        if (row.subcategory && catId) { const s = db.prepare('SELECT id FROM subcategories WHERE name = ? AND category_id = ?').get(row.subcategory, catId); subId = s?.id; }
        const r = ins.run(bangla, row.advanced_version||null, row.explanation||null, row.hint||null, catId, subId, row.difficulty||'Easy', row.checking_mode||'flexible', row.grammar_pattern||null, row.required_words||null, row.forbidden_words||null, 1, 1, (row.is_premium==='Yes'||row.is_premium==='1')?1:0, row.tags||null);
        for (let i=1;i<=5;i++) { const a=row[`correct_answer_${i}`]; if(a&&a.trim()) insAns.run(r.lastInsertRowid, a.trim(), normalizeFlexible(a.trim()), i-1); }
        imported++;
      } catch(e) { errors.push(`Row ${idx+2}: ${e.message}`); }
    });
    res.json({ success: true, imported, total: rows.length, errors: errors.slice(0,20) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// EXPORT
// ============================================
router.get('/export', authenticate, requireAdmin, (req, res) => {
  try {
    const sentences = db.prepare('SELECT s.*, c.name as category_name, sc.name as subcategory_name FROM sentences s LEFT JOIN categories c ON c.id = s.category_id LEFT JOIN subcategories sc ON sc.id = s.subcategory_id ORDER BY s.id').all();
    const getAnswers = db.prepare('SELECT correct_answer FROM sentence_answers WHERE sentence_id = ? ORDER BY sort_order');
    const csvRows = sentences.map(s => {
      const answers = getAnswers.all(s.id).map(a => a.correct_answer);
      return { id: s.id, bangla_sentence: s.bangla_sentence, correct_answer_1: answers[0]||'', correct_answer_2: answers[1]||'', correct_answer_3: answers[2]||'', correct_answer_4: answers[3]||'', correct_answer_5: answers[4]||'', advanced_version: s.advanced_version||'', explanation: s.explanation||'', hint: s.hint||'', category: s.category_name||'', subcategory: s.subcategory_name||'', difficulty: s.difficulty||'', is_premium: s.is_premium?'Yes':'No', is_active: s.is_active?'Yes':'No', checking_mode: s.checking_mode||'flexible', grammar_pattern: s.grammar_pattern||'', required_words: s.required_words||'', forbidden_words: s.forbidden_words||'', tags: s.tags||'' };
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=sentences_export.csv');
    const { stringify } = require('csv-stringify/sync');
    res.send(stringify(csvRows, { header: true }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/export/students', authenticate, requireAdmin, (req, res) => {
  try {
    const students = db.prepare(`SELECT u.name, u.email, u.phone, u.total_xp, u.level, u.streak, u.last_active_at, b.name as batch_name, (SELECT COUNT(*) FROM submissions WHERE user_id = u.id) as total_attempts, (SELECT SUM(is_correct) FROM submissions WHERE user_id = u.id) as correct_answers, (SELECT COUNT(*) FROM student_sentence_progress WHERE user_id = u.id AND status = 'mastered') as mastered FROM users u LEFT JOIN batches b ON b.id = u.batch_id WHERE u.role = 'student' ORDER BY u.total_xp DESC`).all();
    students.forEach(s => { s.accuracy = s.total_attempts > 0 ? Math.round((s.correct_answers/s.total_attempts)*100)+'%' : '0%'; });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=students_export.csv');
    const { stringify } = require('csv-stringify/sync');
    res.send(stringify(students, { header: true }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ============================================
// BATCHES
// ============================================
router.get('/batches', authenticate, requireAdmin, (req, res) => {
  try {
    const batches = db.prepare('SELECT b.*, (SELECT COUNT(*) FROM users WHERE batch_id = b.id) as student_count FROM batches b ORDER BY b.id DESC').all();
    res.json(batches);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/batches', authenticate, requireAdmin, (req, res) => {
  try {
    const { name, course_name, start_date } = req.body;
    const result = db.prepare('INSERT INTO batches (name, course_name, start_date) VALUES (?, ?, ?)').run(name, course_name, start_date);
    res.json({ id: result.lastInsertRowid, success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// SENTENCE REPORTS
// ============================================
router.get('/sentence-report/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const sentenceId = req.params.id;
    const sentence = db.prepare('SELECT * FROM sentences WHERE id = ?').get(sentenceId);
    if (!sentence) return res.status(404).json({ error: 'Not found' });

    const stats = db.prepare(`
      SELECT COUNT(*) as total_attempts,
        SUM(CASE WHEN result_type = 'correct' THEN 1 ELSE 0 END) as correct,
        SUM(CASE WHEN result_type = 'almost_correct' THEN 1 ELSE 0 END) as almost_correct,
        SUM(CASE WHEN result_type = 'wrong' THEN 1 ELSE 0 END) as wrong,
        ROUND(AVG(similarity_score), 1) as avg_similarity
      FROM submissions WHERE sentence_id = ?
    `).get(sentenceId);

    const commonWrong = db.prepare(`
      SELECT submitted_answer, COUNT(*) as count FROM submissions
      WHERE sentence_id = ? AND result_type = 'wrong'
      GROUP BY submitted_answer ORDER BY count DESC LIMIT 10
    `).all(sentenceId);

    const commonMistakes = db.prepare(`
      SELECT mistake_type, COUNT(*) as count FROM submissions
      WHERE sentence_id = ? AND mistake_type IS NOT NULL AND result_type != 'correct'
      GROUP BY mistake_type ORDER BY count DESC
    `).all(sentenceId);

    const masteryRate = db.prepare(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN status = 'mastered' THEN 1 ELSE 0 END) as mastered
      FROM student_sentence_progress WHERE sentence_id = ?
    `).get(sentenceId);

    const reviewRequests = db.prepare(`
      SELECT COUNT(*) as count FROM review_queue WHERE sentence_id = ?
    `).get(sentenceId).count;

    res.json({ sentence, stats, commonWrong, commonMistakes, masteryRate, reviewRequests });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// BATCH REPORTS
// ============================================
router.get('/batch-report/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const batchId = req.params.id;
    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
    if (!batch) return res.status(404).json({ error: 'Not found' });

    const students = db.prepare(`
      SELECT u.id, u.name, u.total_xp, u.streak, u.last_active_at,
        (SELECT COUNT(*) FROM submissions WHERE user_id = u.id) as attempts,
        (SELECT SUM(is_correct) FROM submissions WHERE user_id = u.id) as correct,
        (SELECT COUNT(*) FROM student_sentence_progress WHERE user_id = u.id AND status = 'mastered') as mastered
      FROM users u WHERE u.batch_id = ? AND u.role = 'student'
      ORDER BY u.total_xp DESC
    `).all(batchId);

    const batchAccuracy = students.length > 0
      ? Math.round(students.reduce((sum, s) => sum + (s.attempts > 0 ? (s.correct / s.attempts) * 100 : 0), 0) / students.length)
      : 0;

    const weakTenses = db.prepare(`
      SELECT c.name, COUNT(sub.id) as attempts,
        SUM(CASE WHEN sub.result_type = 'wrong' THEN 1 ELSE 0 END) as wrong_count
      FROM submissions sub
      JOIN sentences s ON s.id = sub.sentence_id
      JOIN categories c ON c.id = s.category_id
      JOIN users u ON u.id = sub.user_id
      WHERE u.batch_id = ?
      GROUP BY c.id ORDER BY (wrong_count * 1.0 / attempts) DESC LIMIT 5
    `).all(batchId);

    const inactive = students.filter(s => {
      if (!s.last_active_at) return true;
      const lastDate = new Date(s.last_active_at);
      return (Date.now() - lastDate.getTime()) > 3 * 86400000;
    });

    res.json({ batch, students, batchAccuracy, weakTenses, inactive });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
