const express = require('express');
const db = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Student dashboard
router.get('/student', authenticate, (req, res) => {
  try {
    const userId = req.user.id;
    const user = db.prepare('SELECT id, name, total_xp, level, streak, daily_goal, premium_status FROM users WHERE id = ?').get(userId);
    
    // Level info
    const levelInfo = db.prepare('SELECT * FROM levels WHERE level_number = ?').get(user.level);
    const nextLevel = db.prepare('SELECT * FROM levels WHERE level_number = ?').get(user.level + 1);

    // Progress stats
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_attempted,
        SUM(CASE WHEN status = 'correct' THEN 1 ELSE 0 END) as correct_count,
        SUM(CASE WHEN status IN ('not_matched','needs_practice') THEN 1 ELSE 0 END) as not_matched_count,
        SUM(CASE WHEN status = 'mastered' THEN 1 ELSE 0 END) as mastered_count,
        SUM(CASE WHEN next_review_at <= datetime('now') AND status != 'mastered' THEN 1 ELSE 0 END) as due_today
      FROM student_sentence_progress WHERE user_id = ?
    `).get(userId);

    // Today's submissions
    const todayCount = db.prepare(`
      SELECT COUNT(*) as count FROM submissions WHERE user_id = ? AND date(submitted_at) = date('now')
    `).get(userId).count;

    // Total sentences available
    const totalSentences = db.prepare('SELECT COUNT(*) as count FROM sentences WHERE is_active = 1').get().count;

    // New sentences remaining
    const newSentences = totalSentences - (stats.total_attempted || 0);

    // Accuracy
    const totalSubmissions = db.prepare(`
      SELECT COUNT(*) as total, SUM(CASE WHEN result = 'correct' THEN 1 ELSE 0 END) as correct 
      FROM submissions WHERE user_id = ?
    `).get(userId);
    const accuracy = totalSubmissions.total > 0 ? Math.round((totalSubmissions.correct / totalSubmissions.total) * 100) : 0;

    // Category-wise progress
    const categoryProgress = db.prepare(`
      SELECT c.id, c.name, c.icon,
        COUNT(p.id) as attempted,
        SUM(CASE WHEN p.status = 'mastered' THEN 1 ELSE 0 END) as mastered,
        SUM(CASE WHEN p.status IN ('not_matched','needs_practice') THEN 1 ELSE 0 END) as needs_practice,
        (SELECT COUNT(*) FROM sentences WHERE category_id = c.id AND is_active = 1) as total_in_category
      FROM categories c
      LEFT JOIN sentences s ON s.category_id = c.id
      LEFT JOIN student_sentence_progress p ON p.sentence_id = s.id AND p.user_id = ?
      WHERE c.is_active = 1
      GROUP BY c.id
      ORDER BY c.sort_order
    `).all(userId);

    // Weak areas (categories with most not_matched)
    const weakAreas = db.prepare(`
      SELECT c.name, c.icon,
        COUNT(p.id) as attempted,
        SUM(CASE WHEN p.last_result = 'not_matched' THEN 1 ELSE 0 END) as not_matched_count
      FROM student_sentence_progress p
      JOIN sentences s ON s.id = p.sentence_id
      JOIN categories c ON c.id = s.category_id
      WHERE p.user_id = ? AND p.attempts_count > 0
      GROUP BY c.id
      HAVING not_matched_count > 0
      ORDER BY (not_matched_count * 1.0 / attempted) DESC
      LIMIT 3
    `).all(userId);

    // Homework
    const pendingHomework = db.prepare(`
      SELECT h.*, hs.title, hs.due_date
      FROM homework_assignments h
      JOIN homework_sets hs ON hs.id = h.homework_id
      WHERE h.user_id = ? AND h.status IN ('assigned','in_progress') AND hs.is_active = 1
      ORDER BY hs.due_date ASC
    `).all(userId);

    res.json({
      user,
      levelInfo,
      nextLevel,
      stats: {
        ...stats,
        new_sentences: newSentences,
        total_sentences: totalSentences,
        today_practiced: todayCount,
        accuracy,
      },
      categoryProgress,
      weakAreas,
      pendingHomework,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Leaderboard
router.get('/leaderboard', authenticate, (req, res) => {
  try {
    const enabled = db.prepare("SELECT value FROM settings WHERE key = 'leaderboard_enabled'").get();
    if (enabled?.value !== '1') return res.json({ enabled: false, users: [] });

    const { batch_id } = req.query;
    let where = "role = 'student'";
    const params = [];
    if (batch_id) { where += ' AND batch_id = ?'; params.push(batch_id); }

    const users = db.prepare(`
      SELECT id, name, total_xp, level, streak,
        (SELECT COUNT(*) FROM student_sentence_progress WHERE user_id = users.id AND status = 'mastered') as mastered_count
      FROM users WHERE ${where}
      ORDER BY total_xp DESC LIMIT 50
    `).all(...params);

    // Add level info
    const getLevel = db.prepare('SELECT name, badge FROM levels WHERE level_number = ?');
    users.forEach(u => {
      const lvl = getLevel.get(u.level);
      u.level_name = lvl?.name || 'Starter Speaker';
      u.level_badge = lvl?.badge || '🌱';
    });

    res.json({ enabled: true, users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mistake notebook (Not Matched sentences)
router.get('/mistakes', authenticate, (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const mistakes = db.prepare(`
      SELECT s.bangla_sentence, s.advanced_version, s.explanation, s.structure_hint, s.id as sentence_id,
        c.name as category_name, sc.name as subcategory_name,
        p.not_matched_count, p.last_answer, p.status
      FROM student_sentence_progress p
      JOIN sentences s ON s.id = p.sentence_id
      LEFT JOIN categories c ON c.id = s.category_id
      LEFT JOIN subcategories sc ON sc.id = s.subcategory_id
      WHERE p.user_id = ? AND p.not_matched_count > 0
      ORDER BY p.not_matched_count DESC, p.updated_at DESC
      LIMIT ? OFFSET ?
    `).all(userId, parseInt(limit), offset);

    // Get accepted answers for each
    const getAnswers = db.prepare('SELECT accepted_answer FROM sentence_answers WHERE sentence_id = ? ORDER BY sort_order');
    mistakes.forEach(m => {
      m.accepted_answers = getAnswers.all(m.sentence_id).map(a => a.accepted_answer);
    });

    const total = db.prepare(`
      SELECT COUNT(*) as count FROM student_sentence_progress WHERE user_id = ? AND not_matched_count > 0
    `).get(userId).count;

    res.json({ mistakes, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
