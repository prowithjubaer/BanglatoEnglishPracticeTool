const express = require('express');
const db = require('../database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { normalizeFlexible } = require('../utils/answerChecker');

const router = express.Router();

// ============================================
// STUDENT: Request teacher review
// ============================================
router.post('/request', authenticate, (req, res) => {
  try {
    const { submission_id } = req.body;
    const userId = req.user.id;

    if (!submission_id) return res.status(400).json({ error: 'Submission ID required' });

    // Verify submission belongs to user
    const submission = db.prepare('SELECT * FROM submissions WHERE id = ? AND user_id = ?').get(submission_id, userId);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    // Check if already requested
    const existing = db.prepare('SELECT id FROM review_queue WHERE submission_id = ?').get(submission_id);
    if (existing) return res.status(400).json({ error: 'Review already requested for this submission' });

    // Add to review queue
    db.prepare(`
      INSERT INTO review_queue (submission_id, user_id, sentence_id, student_answer)
      VALUES (?, ?, ?, ?)
    `).run(submission_id, userId, submission.sentence_id, submission.submitted_answer);

    // Mark submission as review requested
    db.prepare('UPDATE submissions SET review_requested = 1 WHERE id = ?').run(submission_id);

    res.json({ success: true, message: 'Review request submitted. Your teacher will check it soon.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ADMIN: Get review queue
// ============================================
router.get('/queue', authenticate, requireAdmin, (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const where = status === 'all' ? '1=1' : 'rq.status = ?';
    const params = status === 'all' ? [] : [status];

    const total = db.prepare(`SELECT COUNT(*) as count FROM review_queue rq WHERE ${where}`).get(...params).count;

    const reviews = db.prepare(`
      SELECT rq.*, 
        u.name as student_name, u.email as student_email,
        s.bangla_sentence, s.advanced_version, s.explanation, s.grammar_pattern,
        s.checking_mode, s.required_words, s.forbidden_words,
        c.name as category_name, sc.name as subcategory_name,
        sub.result_type as original_result, sub.similarity_score
      FROM review_queue rq
      JOIN users u ON u.id = rq.user_id
      JOIN sentences s ON s.id = rq.sentence_id
      JOIN submissions sub ON sub.id = rq.submission_id
      LEFT JOIN categories c ON c.id = s.category_id
      LEFT JOIN subcategories sc ON sc.id = s.subcategory_id
      WHERE ${where}
      ORDER BY rq.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    // Get correct answers for each
    const getAnswers = db.prepare('SELECT correct_answer FROM sentence_answers WHERE sentence_id = ? ORDER BY sort_order');
    reviews.forEach(r => {
      r.correct_answers = getAnswers.all(r.sentence_id).map(a => a.correct_answer);
    });

    res.json({
      reviews,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      pending_count: db.prepare("SELECT COUNT(*) as count FROM review_queue WHERE status = 'pending'").get().count,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ADMIN: Review a submission
// ============================================
router.post('/review/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const reviewId = req.params.id;
    const { admin_result, admin_feedback, admin_mistake_type, admin_xp_awarded, add_as_correct_answer } = req.body;

    if (!admin_result || !['correct', 'almost_correct', 'wrong'].includes(admin_result)) {
      return res.status(400).json({ error: 'Valid result type required (correct/almost_correct/wrong)' });
    }

    const review = db.prepare('SELECT * FROM review_queue WHERE id = ?').get(reviewId);
    if (!review) return res.status(404).json({ error: 'Review not found' });

    // Update review queue
    db.prepare(`
      UPDATE review_queue SET 
        status = 'reviewed', admin_result = ?, admin_feedback = ?,
        admin_mistake_type = ?, admin_xp_awarded = ?, add_as_correct_answer = ?,
        reviewed_by = ?, reviewed_at = datetime('now')
      WHERE id = ?
    `).run(admin_result, admin_feedback || null, admin_mistake_type || null, 
      admin_xp_awarded || 0, add_as_correct_answer ? 1 : 0, req.user.id, reviewId);

    // Update original submission
    db.prepare(`
      UPDATE submissions SET result_type = ?, is_correct = ?, mistake_type = ?
      WHERE id = ?
    `).run(admin_result, admin_result === 'correct' ? 1 : 0, admin_mistake_type || null, review.submission_id);

    // Award XP if admin grants it
    const xpToAward = admin_xp_awarded || 0;
    if (xpToAward > 0) {
      db.prepare('UPDATE users SET total_xp = total_xp + ? WHERE id = ?').run(xpToAward, review.user_id);
      // Update level
      const user = db.prepare('SELECT total_xp FROM users WHERE id = ?').get(review.user_id);
      const newLevel = db.prepare('SELECT level_number FROM levels WHERE min_xp <= ? ORDER BY level_number DESC LIMIT 1').get(user.total_xp);
      if (newLevel) {
        db.prepare('UPDATE users SET level = ? WHERE id = ?').run(newLevel.level_number, review.user_id);
      }
    }

    // Update student progress based on admin decision
    const progress = db.prepare('SELECT * FROM student_sentence_progress WHERE user_id = ? AND sentence_id = ?').get(review.user_id, review.sentence_id);
    if (progress) {
      if (admin_result === 'correct') {
        const masteryRequired = parseInt((db.prepare("SELECT value FROM settings WHERE key = 'mastery_required_correct_reviews'").get() || {}).value || '2');
        const newCorrectCount = progress.correct_count + 1;
        let newStatus = 'correct';
        let masteredAt = null;
        
        if (newCorrectCount >= masteryRequired) {
          newStatus = 'mastered';
          masteredAt = new Date().toISOString();
        }

        const reviewDays = parseInt((db.prepare("SELECT value FROM settings WHERE key = 'revision_after_correct_days'").get() || {}).value || '7');
        const nextReview = new Date(Date.now() + reviewDays * 86400000).toISOString();

        db.prepare(`
          UPDATE student_sentence_progress SET status = ?, correct_count = ?, 
          last_result = 'correct', next_review_at = ?, mastered_at = COALESCE(?, mastered_at),
          updated_at = datetime('now')
          WHERE user_id = ? AND sentence_id = ?
        `).run(newStatus, newCorrectCount, nextReview, masteredAt, review.user_id, review.sentence_id);
      } else if (admin_result === 'almost_correct') {
        const reviewDays = parseInt((db.prepare("SELECT value FROM settings WHERE key = 'revision_after_almost_correct_days'").get() || {}).value || '2');
        const nextReview = new Date(Date.now() + reviewDays * 86400000).toISOString();

        db.prepare(`
          UPDATE student_sentence_progress SET status = 'almost_correct', 
          almost_correct_count = almost_correct_count + 1, last_result = 'almost_correct',
          last_mistake_type = ?, next_review_at = ?, updated_at = datetime('now')
          WHERE user_id = ? AND sentence_id = ?
        `).run(admin_mistake_type || null, nextReview, review.user_id, review.sentence_id);
      }
      // If wrong, keep existing wrong status (no change needed)
    }

    // If admin says to add student answer as new correct format
    if (add_as_correct_answer && admin_result === 'correct') {
      const existingCount = db.prepare('SELECT COUNT(*) as count FROM sentence_answers WHERE sentence_id = ?').get(review.sentence_id).count;
      db.prepare('INSERT INTO sentence_answers (sentence_id, correct_answer, normalized_answer, sort_order) VALUES (?, ?, ?, ?)')
        .run(review.sentence_id, review.student_answer, normalizeFlexible(review.student_answer), existingCount);
    }

    res.json({ success: true, message: 'Review submitted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ADMIN: Dismiss review
// ============================================
router.post('/dismiss/:id', authenticate, requireAdmin, (req, res) => {
  try {
    db.prepare("UPDATE review_queue SET status = 'dismissed', reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?")
      .run(req.user.id, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ADMIN: Bulk review
// ============================================
router.post('/bulk-review', authenticate, requireAdmin, (req, res) => {
  try {
    const { ids, admin_result, admin_feedback } = req.body;
    if (!ids || ids.length === 0) return res.status(400).json({ error: 'No IDs provided' });

    const update = db.prepare(`
      UPDATE review_queue SET status = 'reviewed', admin_result = ?, admin_feedback = ?,
      reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?
    `);

    for (const id of ids) {
      update.run(admin_result || 'wrong', admin_feedback || null, req.user.id, id);
    }

    res.json({ success: true, count: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ADMIN: Get review stats
// ============================================
router.get('/stats', authenticate, requireAdmin, (req, res) => {
  try {
    const stats = {
      pending: db.prepare("SELECT COUNT(*) as count FROM review_queue WHERE status = 'pending'").get().count,
      reviewed: db.prepare("SELECT COUNT(*) as count FROM review_queue WHERE status = 'reviewed'").get().count,
      dismissed: db.prepare("SELECT COUNT(*) as count FROM review_queue WHERE status = 'dismissed'").get().count,
      today: db.prepare("SELECT COUNT(*) as count FROM review_queue WHERE date(created_at) = date('now')").get().count,
    };
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ADMIN: Synonym Groups CRUD
// ============================================
router.get('/synonyms', authenticate, requireAdmin, (req, res) => {
  try {
    const groups = db.prepare('SELECT * FROM synonym_groups ORDER BY id DESC').all();
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/synonyms', authenticate, requireAdmin, (req, res) => {
  try {
    const { group_name, words } = req.body;
    if (!group_name || !words) return res.status(400).json({ error: 'Group name and words required' });
    const result = db.prepare('INSERT INTO synonym_groups (group_name, words) VALUES (?, ?)').run(group_name, words);
    const group = db.prepare('SELECT * FROM synonym_groups WHERE id = ?').get(result.lastInsertRowid);
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/synonyms/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { group_name, words, is_active } = req.body;
    db.prepare('UPDATE synonym_groups SET group_name = COALESCE(?, group_name), words = COALESCE(?, words), is_active = COALESCE(?, is_active) WHERE id = ?')
      .run(group_name, words, is_active, req.params.id);
    const group = db.prepare('SELECT * FROM synonym_groups WHERE id = ?').get(req.params.id);
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/synonyms/:id', authenticate, requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM synonym_groups WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ADMIN: Grammar Patterns CRUD
// ============================================
router.get('/patterns', authenticate, requireAdmin, (req, res) => {
  try {
    const patterns = db.prepare('SELECT * FROM grammar_patterns ORDER BY name').all();
    res.json(patterns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/patterns', authenticate, requireAdmin, (req, res) => {
  try {
    const { name, description, expected_structure, required_markers, forbidden_markers, tense_category } = req.body;
    if (!name) return res.status(400).json({ error: 'Pattern name required' });
    const result = db.prepare(
      'INSERT INTO grammar_patterns (name, description, expected_structure, required_markers, forbidden_markers, tense_category) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(name, description || null, expected_structure || null, required_markers || null, forbidden_markers || null, tense_category || null);
    const pattern = db.prepare('SELECT * FROM grammar_patterns WHERE id = ?').get(result.lastInsertRowid);
    res.json(pattern);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/patterns/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { name, description, expected_structure, required_markers, forbidden_markers, tense_category, is_active } = req.body;
    db.prepare(`
      UPDATE grammar_patterns SET name = COALESCE(?, name), description = ?, expected_structure = ?,
      required_markers = ?, forbidden_markers = ?, tense_category = ?, is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(name, description, expected_structure, required_markers, forbidden_markers, tense_category, is_active, req.params.id);
    const pattern = db.prepare('SELECT * FROM grammar_patterns WHERE id = ?').get(req.params.id);
    res.json(pattern);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/patterns/:id', authenticate, requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM grammar_patterns WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
