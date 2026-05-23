const express = require('express');
const db = require('../database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get student's homework list
router.get('/student', authenticate, (req, res) => {
  try {
    const userId = req.user.id;
    const homework = db.prepare(`
      SELECT ha.*, hs.title, hs.description, hs.due_date, hs.start_date,
        hs.completion_bonus, hs.show_answer_after_submit, hs.allow_late_submission,
        hs.homework_mode, hs.practice_mode,
        (SELECT COUNT(*) FROM homework_sentences WHERE homework_id = hs.id) as total_sentences,
        c.name as category_name, sc.name as subcategory_name
      FROM homework_assignments ha
      JOIN homework_sets hs ON hs.id = ha.homework_id
      LEFT JOIN categories c ON c.id = hs.category_id
      LEFT JOIN subcategories sc ON sc.id = hs.subcategory_id
      WHERE ha.user_id = ? AND hs.is_active = 1
      ORDER BY hs.due_date DESC
    `).all(userId);
    res.json(homework);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get homework sentences for practice
router.get('/:homeworkId/sentences', authenticate, (req, res) => {
  try {
    const userId = req.user.id;
    const homeworkId = req.params.homeworkId;

    // Check assignment
    const assignment = db.prepare('SELECT * FROM homework_assignments WHERE homework_id = ? AND user_id = ?').get(homeworkId, userId);
    if (!assignment) return res.status(403).json({ error: 'Not assigned to this homework' });

    const sentences = db.prepare(`
      SELECT s.id, s.bangla_sentence, s.structure_hint, s.fill_blank_hint, s.first_word_hint,
        s.word_bank_words, s.difficulty, s.checking_mode, s.practice_mode, s.homework_mode,
        c.name as category_name, sc.name as subcategory_name, hsn.sort_order
      FROM homework_sentences hsn
      JOIN sentences s ON s.id = hsn.sentence_id
      LEFT JOIN categories c ON c.id = s.category_id
      LEFT JOIN subcategories sc ON sc.id = s.subcategory_id
      WHERE hsn.homework_id = ?
      ORDER BY hsn.sort_order
    `).all(homeworkId);

    // Mark as in progress
    if (assignment.status === 'assigned') {
      db.prepare("UPDATE homework_assignments SET status = 'in_progress' WHERE id = ?").run(assignment.id);
    }

    res.json(sentences);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Complete homework
router.post('/:homeworkId/complete', authenticate, (req, res) => {
  try {
    const userId = req.user.id;
    const homeworkId = req.params.homeworkId;
    const { score, total_questions, correct_answers } = req.body;

    const accuracy = total_questions > 0 ? Math.round((correct_answers / total_questions) * 100) : 0;

    db.prepare(`
      UPDATE homework_assignments SET status = 'completed', completed_at = datetime('now'),
      score = ?, total_questions = ?, correct_answers = ?, accuracy = ?
      WHERE homework_id = ? AND user_id = ?
    `).run(score || 0, total_questions || 0, correct_answers || 0, accuracy, homeworkId, userId);

    // Award completion bonus XP
    const hw = db.prepare('SELECT completion_bonus FROM homework_sets WHERE id = ?').get(homeworkId);
    if (hw?.completion_bonus) {
      db.prepare('UPDATE users SET total_xp = total_xp + ? WHERE id = ?').run(hw.completion_bonus, userId);
    }

    res.json({ success: true, xp_bonus: hw?.completion_bonus || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Create homework set
router.post('/', authenticate, requireAdmin, (req, res) => {
  try {
    const { title, description, category_id, subcategory_id, batch_id, start_date, due_date, homework_mode, practice_mode, xp_per_correct, completion_bonus, allow_late_submission, allow_retry, shuffle_sentences, show_answer_after_submit, lock_next_until_answered, sentence_ids } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });

    const result = db.prepare(`
      INSERT INTO homework_sets (title, description, category_id, subcategory_id, assigned_by, batch_id, start_date, due_date, homework_mode, practice_mode, xp_per_correct, completion_bonus, allow_late_submission, allow_retry, shuffle_sentences, show_answer_after_submit, lock_next_until_answered)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title, description || null, category_id || null, subcategory_id || null, req.user.id, batch_id || null, start_date || null, due_date || null, homework_mode || 'learning', practice_mode || 'typing', xp_per_correct || 5, completion_bonus || 10, allow_late_submission ? 1 : 0, allow_retry ? 1 : 0, shuffle_sentences ? 1 : 0, show_answer_after_submit !== false ? 1 : 0, lock_next_until_answered ? 1 : 0);

    // Add sentences
    if (sentence_ids && sentence_ids.length > 0) {
      const insertHwSentence = db.prepare('INSERT INTO homework_sentences (homework_id, sentence_id, sort_order) VALUES (?, ?, ?)');
      sentence_ids.forEach((sid, idx) => insertHwSentence.run(result.lastInsertRowid, sid, idx));
    }

    // Auto-assign to batch students
    if (batch_id) {
      const students = db.prepare("SELECT id FROM users WHERE batch_id = ? AND role = 'student'").all(batch_id);
      const insertAssign = db.prepare('INSERT OR IGNORE INTO homework_assignments (homework_id, user_id) VALUES (?, ?)');
      students.forEach(s => insertAssign.run(result.lastInsertRowid, s.id));
    }

    res.json({ id: result.lastInsertRowid, success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: List homework sets
router.get('/admin', authenticate, requireAdmin, (req, res) => {
  try {
    const homeworks = db.prepare(`
      SELECT hs.*, c.name as category_name,
        (SELECT COUNT(*) FROM homework_sentences WHERE homework_id = hs.id) as sentence_count,
        (SELECT COUNT(*) FROM homework_assignments WHERE homework_id = hs.id) as assigned_count,
        (SELECT COUNT(*) FROM homework_assignments WHERE homework_id = hs.id AND status = 'completed') as completed_count
      FROM homework_sets hs
      LEFT JOIN categories c ON c.id = hs.category_id
      ORDER BY hs.created_at DESC
    `).all();
    res.json(homeworks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Assign homework to students
router.post('/:id/assign', authenticate, requireAdmin, (req, res) => {
  try {
    const { user_ids, batch_id } = req.body;
    const homeworkId = req.params.id;
    const insertAssign = db.prepare('INSERT OR IGNORE INTO homework_assignments (homework_id, user_id) VALUES (?, ?)');

    if (user_ids && user_ids.length > 0) {
      user_ids.forEach(uid => insertAssign.run(homeworkId, uid));
    }
    if (batch_id) {
      const students = db.prepare("SELECT id FROM users WHERE batch_id = ? AND role = 'student'").all(batch_id);
      students.forEach(s => insertAssign.run(homeworkId, s.id));
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Delete homework
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM homework_sets WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
