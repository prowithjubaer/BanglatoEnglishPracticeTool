const express = require('express');
const db = require('../database');
const { authenticate } = require('../middleware/auth');
const { checkAnswer } = require('../utils/answerChecker');

const router = express.Router();

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function getUserLevel(xp) {
  const level = db.prepare('SELECT * FROM levels WHERE min_xp <= ? ORDER BY level_number DESC LIMIT 1').get(xp);
  return level || { level_number: 1, name: 'Beginner', badge: '🌱' };
}

// Get next sentence for practice
router.get('/next', authenticate, (req, res) => {
  try {
    const { category_id, subcategory_id, mode } = req.query;
    const userId = req.user.id;
    let sentence;

    if (mode === 'review') {
      // Due for review
      sentence = db.prepare(`
        SELECT s.*, c.name as category_name, sc.name as subcategory_name
        FROM sentences s
        LEFT JOIN categories c ON s.category_id = c.id
        LEFT JOIN subcategories sc ON s.subcategory_id = sc.id
        INNER JOIN student_sentence_progress p ON p.sentence_id = s.id AND p.user_id = ?
        WHERE s.is_active = 1 AND p.status IN ('wrong','needs_review') 
          AND (p.next_review_at IS NULL OR p.next_review_at <= datetime('now'))
        ORDER BY p.next_review_at ASC LIMIT 1
      `).get(userId);
    } else if (mode === 'due') {
      // Due today
      sentence = db.prepare(`
        SELECT s.*, c.name as category_name, sc.name as subcategory_name
        FROM sentences s
        LEFT JOIN categories c ON s.category_id = c.id
        LEFT JOIN subcategories sc ON s.subcategory_id = sc.id
        INNER JOIN student_sentence_progress p ON p.sentence_id = s.id AND p.user_id = ?
        WHERE s.is_active = 1 AND p.next_review_at <= datetime('now') AND p.status != 'mastered'
        ORDER BY p.next_review_at ASC LIMIT 1
      `).get(userId);
    } else if (mode === 'mastered') {
      // Review mastered
      sentence = db.prepare(`
        SELECT s.*, c.name as category_name, sc.name as subcategory_name
        FROM sentences s
        LEFT JOIN categories c ON s.category_id = c.id
        LEFT JOIN subcategories sc ON s.subcategory_id = sc.id
        INNER JOIN student_sentence_progress p ON p.sentence_id = s.id AND p.user_id = ?
        WHERE s.is_active = 1 AND p.status = 'mastered'
        ORDER BY RANDOM() LIMIT 1
      `).get(userId);
    } else {
      // Normal practice - get new or due sentence
      let whereExtra = '';
      const params = [userId];
      if (category_id) { whereExtra += ' AND s.category_id = ?'; params.push(category_id); }
      if (subcategory_id) { whereExtra += ' AND s.subcategory_id = ?'; params.push(subcategory_id); }

      // First try due sentences
      sentence = db.prepare(`
        SELECT s.*, c.name as category_name, sc.name as subcategory_name
        FROM sentences s
        LEFT JOIN categories c ON s.category_id = c.id
        LEFT JOIN subcategories sc ON s.subcategory_id = sc.id
        INNER JOIN student_sentence_progress p ON p.sentence_id = s.id AND p.user_id = ?
        WHERE s.is_active = 1 AND p.next_review_at <= datetime('now') AND p.status != 'mastered'
        ${whereExtra}
        ORDER BY p.next_review_at ASC LIMIT 1
      `).get(...params);

      // If no due, get new sentence
      if (!sentence) {
        sentence = db.prepare(`
          SELECT s.*, c.name as category_name, sc.name as subcategory_name
          FROM sentences s
          LEFT JOIN categories c ON s.category_id = c.id
          LEFT JOIN subcategories sc ON s.subcategory_id = sc.id
          LEFT JOIN student_sentence_progress p ON p.sentence_id = s.id AND p.user_id = ?
          WHERE s.is_active = 1 AND p.id IS NULL
          ${whereExtra}
          ORDER BY s.id ASC LIMIT 1
        `).get(...params);
      }
    }

    if (!sentence) {
      return res.json({ completed: true, message: 'No more sentences available. Great work!' });
    }

    // Check premium access
    if (sentence.is_premium && !req.user.premium_status) {
      const premiumCta = getSetting('premium_cta_text');
      return res.json({ premium_locked: true, message: premiumCta });
    }

    // Return sentence without answers
    const { answers: _, ...safeSentence } = sentence;
    safeSentence.show_hint = !!sentence.hint;
    res.json(safeSentence);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get hint
router.get('/:sentenceId/hint', authenticate, (req, res) => {
  try {
    const sentence = db.prepare('SELECT hint FROM sentences WHERE id = ?').get(req.params.sentenceId);
    res.json({ hint: sentence?.hint || 'No hint available.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit answer
router.post('/submit', authenticate, (req, res) => {
  try {
    const { sentence_id, answer } = req.body;
    const userId = req.user.id;

    if (!sentence_id || !answer) return res.status(400).json({ error: 'Sentence ID and answer required' });

    // Get sentence and answers
    const sentence = db.prepare('SELECT * FROM sentences WHERE id = ?').get(sentence_id);
    if (!sentence) return res.status(404).json({ error: 'Sentence not found' });

    const correctAnswers = db.prepare('SELECT correct_answer FROM sentence_answers WHERE sentence_id = ? ORDER BY sort_order').all(sentence_id).map(a => a.correct_answer);

    // Check answer
    const { isCorrect } = checkAnswer(answer, correctAnswers, sentence.checking_mode);

    // Anti-cheat: check if already submitted correctly today
    const antiCheat = getSetting('anti_cheat_same_day');
    let xpEarned = 0;
    const xpPerCorrect = parseInt(getSetting('xp_per_correct') || '5');

    if (isCorrect) {
      if (antiCheat === '1') {
        const todaySubmission = db.prepare(`
          SELECT id FROM submissions WHERE user_id = ? AND sentence_id = ? AND is_correct = 1
          AND date(submitted_at) = date('now')
        `).get(userId, sentence_id);
        if (!todaySubmission) xpEarned = xpPerCorrect;
      } else {
        xpEarned = xpPerCorrect;
      }
    }

    // Save submission
    db.prepare(`
      INSERT INTO submissions (user_id, sentence_id, submitted_answer, is_correct, xp_earned)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, sentence_id, answer, isCorrect ? 1 : 0, xpEarned);

    // Update progress
    const revisionCorrectDays = parseInt(getSetting('revision_after_correct_days') || '7');
    const revisionWrongDays = parseInt(getSetting('revision_after_wrong_days') || '1');
    const masteryRequired = parseInt(getSetting('mastery_required_correct_reviews') || '2');

    let progress = db.prepare('SELECT * FROM student_sentence_progress WHERE user_id = ? AND sentence_id = ?').get(userId, sentence_id);

    if (!progress) {
      db.prepare(`
        INSERT INTO student_sentence_progress (user_id, sentence_id, status, attempts_count, correct_count, wrong_count, last_answer, last_result, last_attempted_at)
        VALUES (?, ?, ?, 1, ?, ?, ?, ?, datetime('now'))
      `).run(userId, sentence_id, isCorrect ? 'correct' : 'wrong', isCorrect ? 1 : 0, isCorrect ? 0 : 1, answer, isCorrect ? 'correct' : 'wrong');
      progress = db.prepare('SELECT * FROM student_sentence_progress WHERE user_id = ? AND sentence_id = ?').get(userId, sentence_id);
    } else {
      const newCorrect = progress.correct_count + (isCorrect ? 1 : 0);
      const newWrong = progress.wrong_count + (isCorrect ? 0 : 1);
      let newStatus = isCorrect ? 'correct' : 'needs_review';
      let masteredAt = null;
      let nextReview;

      if (isCorrect) {
        if (newCorrect >= masteryRequired) {
          newStatus = 'mastered';
          masteredAt = new Date().toISOString();
          // Mastery bonus
          if (progress.status !== 'mastered') {
            const masteryBonus = parseInt(getSetting('xp_mastery_bonus') || '5');
            xpEarned += masteryBonus;
          }
        }
        nextReview = new Date(Date.now() + revisionCorrectDays * 86400000).toISOString();
      } else {
        nextReview = new Date(Date.now() + revisionWrongDays * 86400000).toISOString();
      }

      db.prepare(`
        UPDATE student_sentence_progress SET status = ?, attempts_count = attempts_count + 1,
        correct_count = ?, wrong_count = ?, last_answer = ?, last_result = ?,
        next_review_at = ?, mastered_at = COALESCE(?, mastered_at), last_attempted_at = datetime('now'), updated_at = datetime('now')
        WHERE user_id = ? AND sentence_id = ?
      `).run(newStatus, newCorrect, newWrong, answer, isCorrect ? 'correct' : 'wrong', nextReview, masteredAt, userId, sentence_id);
    }

    // Update user XP
    if (xpEarned > 0) {
      db.prepare('UPDATE users SET total_xp = total_xp + ? WHERE id = ?').run(xpEarned, userId);
      // Update level
      const user = db.prepare('SELECT total_xp FROM users WHERE id = ?').get(userId);
      const newLevel = getUserLevel(user.total_xp);
      db.prepare('UPDATE users SET level = ? WHERE id = ?').run(newLevel.level_number, userId);
    }

    // Update streak
    const lastActive = db.prepare('SELECT last_active_at FROM users WHERE id = ?').get(userId);
    const today = new Date().toISOString().split('T')[0];
    const lastDate = lastActive?.last_active_at?.split('T')[0] || lastActive?.last_active_at?.split(' ')[0];
    
    if (lastDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (lastDate === yesterday) {
        db.prepare("UPDATE users SET streak = streak + 1, last_active_at = datetime('now') WHERE id = ?").run(userId);
        // Check streak bonus
        const user = db.prepare('SELECT streak FROM users WHERE id = ?').get(userId);
        if (user.streak === 7) {
          const streakBonus = parseInt(getSetting('xp_streak_bonus_7') || '25');
          db.prepare('UPDATE users SET total_xp = total_xp + ? WHERE id = ?').run(streakBonus, userId);
          xpEarned += streakBonus;
        }
      } else {
        db.prepare("UPDATE users SET streak = 1, last_active_at = datetime('now') WHERE id = ?").run(userId);
      }
    }

    // Build response
    const showAnswer = getSetting('show_answer_after_wrong');
    const showAdvanced = getSetting('show_advanced_after_submit');
    const feedbackCorrect = getSetting('feedback_correct_bn');
    const feedbackWrong = getSetting('feedback_wrong_bn');

    const response = {
      is_correct: isCorrect,
      xp_earned: xpEarned,
      submitted_answer: answer,
      feedback: isCorrect ? feedbackCorrect : feedbackWrong,
    };

    if (isCorrect) {
      if (showAdvanced === '1' && sentence.advanced_version) {
        response.advanced_version = sentence.advanced_version;
      }
      response.motivational = 'Keep going! You are doing great! 🎉';
    } else {
      if (showAnswer === '1') {
        response.correct_answers = correctAnswers;
      }
      if (showAdvanced === '1' && sentence.advanced_version) {
        response.advanced_version = sentence.advanced_version;
      }
      if (sentence.explanation) {
        response.explanation = sentence.explanation;
      }
      response.review_note = 'This sentence will come again tomorrow for revision.';
    }

    // Check if mastered
    const updatedProgress = db.prepare('SELECT status FROM student_sentence_progress WHERE user_id = ? AND sentence_id = ?').get(userId, sentence_id);
    if (updatedProgress?.status === 'mastered') {
      response.mastered = true;
      response.motivational = 'You have mastered this sentence! 🏆';
    }

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get practice stats for a category
router.get('/stats', authenticate, (req, res) => {
  try {
    const userId = req.user.id;
    const { category_id, subcategory_id } = req.query;

    let where = 'p.user_id = ?';
    const params = [userId];
    if (category_id) { where += ' AND s.category_id = ?'; params.push(category_id); }
    if (subcategory_id) { where += ' AND s.subcategory_id = ?'; params.push(subcategory_id); }

    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_attempted,
        SUM(CASE WHEN p.status = 'correct' THEN 1 ELSE 0 END) as correct,
        SUM(CASE WHEN p.status IN ('wrong','needs_review') THEN 1 ELSE 0 END) as wrong,
        SUM(CASE WHEN p.status = 'mastered' THEN 1 ELSE 0 END) as mastered,
        SUM(CASE WHEN p.next_review_at <= datetime('now') AND p.status != 'mastered' THEN 1 ELSE 0 END) as due_today
      FROM student_sentence_progress p
      JOIN sentences s ON s.id = p.sentence_id
      WHERE ${where}
    `).get(...params);

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
