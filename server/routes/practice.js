const express = require('express');
const db = require('../database');
const { authenticate } = require('../middleware/auth');
const { checkAnswer, normalizeFlexible } = require('../utils/answerChecker');

const router = express.Router();

function getSetting(key, defaultVal = '') {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultVal;
}

function getSettingInt(key, defaultVal = 0) {
  return parseInt(getSetting(key, String(defaultVal)));
}

function getUserLevel(xp) {
  const level = db.prepare('SELECT * FROM levels WHERE min_xp <= ? ORDER BY level_number DESC LIMIT 1').get(xp);
  return level || { level_number: 1, name: 'Starter Speaker', badge: '🌱' };
}

// ============================================
// GET NEXT SENTENCE (Priority-based)
// ============================================
router.get('/next', authenticate, (req, res) => {
  try {
    const { category_id, subcategory_id, mode } = req.query;
    const userId = req.user.id;
    const user = db.prepare('SELECT premium_status FROM users WHERE id = ?').get(userId);
    let sentence;

    if (mode === 'review' || mode === 'needs_practice') {
      // Not Matched / Needs Practice sentences — show immediately (no wait for next_review_at)
      sentence = db.prepare(`
        SELECT s.*, c.name as category_name, sc.name as subcategory_name
        FROM sentences s
        LEFT JOIN categories c ON s.category_id = c.id
        LEFT JOIN subcategories sc ON s.subcategory_id = sc.id
        INNER JOIN student_sentence_progress p ON p.sentence_id = s.id AND p.user_id = ?
        WHERE s.is_active = 1 AND p.status IN ('not_matched','needs_practice')
        ORDER BY p.last_attempted_at DESC LIMIT 1
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
      // Normal practice with priority: due > needs_practice > new
      let whereExtra = '';
      const params = [userId];
      if (category_id) { whereExtra += ' AND s.category_id = ?'; params.push(category_id); }
      if (subcategory_id) { whereExtra += ' AND s.subcategory_id = ?'; params.push(subcategory_id); }

      // 1. Due today first
      sentence = db.prepare(`
        SELECT s.*, c.name as category_name, sc.name as subcategory_name
        FROM sentences s
        LEFT JOIN categories c ON s.category_id = c.id
        LEFT JOIN subcategories sc ON s.subcategory_id = sc.id
        INNER JOIN student_sentence_progress p ON p.sentence_id = s.id AND p.user_id = ?
        WHERE s.is_active = 1 AND p.next_review_at <= datetime('now') AND p.status != 'mastered'
        ${whereExtra}
        ORDER BY CASE p.status WHEN 'not_matched' THEN 1 WHEN 'needs_practice' THEN 2 ELSE 3 END,
                 p.next_review_at ASC LIMIT 1
      `).get(...params);

      // 2. New sentences
      if (!sentence) {
        sentence = db.prepare(`
          SELECT s.*, c.name as category_name, sc.name as subcategory_name
          FROM sentences s
          LEFT JOIN categories c ON s.category_id = c.id
          LEFT JOIN subcategories sc ON s.subcategory_id = sc.id
          LEFT JOIN student_sentence_progress p ON p.sentence_id = s.id AND p.user_id = ?
          WHERE s.is_active = 1 AND p.id IS NULL
          ${whereExtra}
          ORDER BY s.sort_order ASC, s.id ASC LIMIT 1
        `).get(...params);
      }
    }

    if (!sentence) {
      return res.json({ completed: true, message: 'আজকের জন্য আর কোনো sentence নেই। দারুণ কাজ করেছেন! 🎉' });
    }

    // Premium check
    if (sentence.is_premium && !user.premium_status) {
      const premiumCta = getSetting('premium_cta_text', 'এই practice set Premium students-দের জন্য।');
      return res.json({ premium_locked: true, message: premiumCta });
    }

    // Build response based on practice_mode and homework_mode
    const response = {
      id: sentence.id,
      bangla_sentence: sentence.bangla_sentence,
      category_name: sentence.category_name,
      subcategory_name: sentence.subcategory_name,
      difficulty: sentence.difficulty,
      practice_mode: sentence.practice_mode || 'typing',
      homework_mode: sentence.homework_mode || 'learning',
    };

    // Learning mode: include hints
    if (sentence.homework_mode === 'learning') {
      if (sentence.structure_hint) response.structure_hint = sentence.structure_hint;
      if (sentence.first_word_hint) response.first_word_hint = sentence.first_word_hint;
      if (sentence.fill_blank_hint) response.fill_blank_hint = sentence.fill_blank_hint;
    }

    // Word bank mode: include word bank words
    if (sentence.practice_mode === 'word_bank' || sentence.practice_mode === 'mixed') {
      if (sentence.word_bank_words) {
        response.word_bank = sentence.word_bank_words.split(',').map(w => w.trim()).filter(Boolean);
      }
    }

    // Fill blank mode: include fill blank hint
    if (sentence.practice_mode === 'fill_blank' || sentence.practice_mode === 'mixed') {
      if (sentence.fill_blank_hint) response.fill_blank_hint = sentence.fill_blank_hint;
    }

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET HINT (for learning mode)
// ============================================
router.get('/:sentenceId/hint', authenticate, (req, res) => {
  try {
    const sentence = db.prepare('SELECT structure_hint, first_word_hint, fill_blank_hint, word_bank_words FROM sentences WHERE id = ?').get(req.params.sentenceId);
    res.json({
      structure_hint: sentence?.structure_hint || null,
      first_word_hint: sentence?.first_word_hint || null,
      fill_blank_hint: sentence?.fill_blank_hint || null,
      word_bank: sentence?.word_bank_words ? sentence.word_bank_words.split(',').map(w => w.trim()) : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// SUBMIT ANSWER (2-tier: correct / not_matched)
// ============================================
router.post('/submit', authenticate, (req, res) => {
  try {
    const { sentence_id, answer } = req.body;
    const userId = req.user.id;

    if (!sentence_id || !answer) return res.status(400).json({ error: 'Sentence ID and answer required' });

    const sentence = db.prepare('SELECT * FROM sentences WHERE id = ?').get(sentence_id);
    if (!sentence) return res.status(404).json({ error: 'Sentence not found' });

    // Get accepted answers
    const acceptedAnswers = db.prepare('SELECT accepted_answer FROM sentence_answers WHERE sentence_id = ? ORDER BY sort_order')
      .all(sentence_id).map(a => a.accepted_answer);

    // Check answer
    const { result, matchedAnswer } = checkAnswer(answer, acceptedAnswers, sentence.checking_mode || 'flexible');

    // XP calculation with anti-cheat
    const xpPerCorrect = getSettingInt('xp_per_correct', 5);
    const antiCheat = getSetting('anti_cheat_same_day', '1') !== '0';
    const retryXpEnabled = getSetting('retry_xp_enabled', '0') === '1';
    let xpEarned = 0;

    if (result === 'correct') {
      if (antiCheat) {
        // Check if already earned XP for this sentence today
        const todayXp = db.prepare(`
          SELECT id FROM submissions WHERE user_id = ? AND sentence_id = ? 
          AND xp_earned > 0 AND date(submitted_at) = date('now')
        `).get(userId, sentence_id);
        if (!todayXp) xpEarned = xpPerCorrect;
      } else {
        xpEarned = xpPerCorrect;
      }

      // If retry after seeing answer in same session, reduce/no XP
      if (!retryXpEnabled) {
        const recentNotMatched = db.prepare(`
          SELECT id FROM submissions WHERE user_id = ? AND sentence_id = ? 
          AND result = 'not_matched' AND date(submitted_at) = date('now')
        `).get(userId, sentence_id);
        if (recentNotMatched) xpEarned = 0;
      }
    }

    // Save submission
    db.prepare(`
      INSERT INTO submissions (user_id, sentence_id, submitted_answer, normalized_answer, result, xp_earned)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, sentence_id, answer, normalizeFlexible(answer), result, xpEarned);

    // Update student progress
    const reviewCorrectDays = sentence.review_after_correct_days || getSettingInt('revision_after_correct_days', 7);
    const reviewNotMatchedDays = sentence.review_after_not_matched_days || getSettingInt('revision_after_not_matched_days', 1);
    const masteryRequired = getSettingInt('mastery_required_correct_reviews', 2);

    let progress = db.prepare('SELECT * FROM student_sentence_progress WHERE user_id = ? AND sentence_id = ?').get(userId, sentence_id);

    if (!progress) {
      const nextReview = result === 'correct'
        ? new Date(Date.now() + reviewCorrectDays * 86400000).toISOString()
        : new Date(Date.now() + reviewNotMatchedDays * 86400000).toISOString();

      db.prepare(`
        INSERT INTO student_sentence_progress (user_id, sentence_id, status, attempts_count, correct_count, not_matched_count, last_answer, last_result, next_review_at, xp_earned_total, last_attempted_at)
        VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(userId, sentence_id, result === 'correct' ? 'correct' : 'not_matched',
        result === 'correct' ? 1 : 0,
        result === 'not_matched' ? 1 : 0,
        answer, result, nextReview, xpEarned);
    } else {
      const newCorrect = progress.correct_count + (result === 'correct' ? 1 : 0);
      const newNotMatched = progress.not_matched_count + (result === 'not_matched' ? 1 : 0);
      let newStatus = result === 'correct' ? 'correct' : 'needs_practice';
      let masteredAt = null;
      let nextReview;

      if (result === 'correct') {
        if (newCorrect >= masteryRequired && progress.status !== 'mastered') {
          newStatus = 'mastered';
          masteredAt = new Date().toISOString();
          // Mastery bonus
          const masteryBonus = getSettingInt('xp_mastery_bonus', 5);
          xpEarned += masteryBonus;
        }
        nextReview = new Date(Date.now() + reviewCorrectDays * 86400000).toISOString();
      } else {
        nextReview = new Date(Date.now() + reviewNotMatchedDays * 86400000).toISOString();
      }

      db.prepare(`
        UPDATE student_sentence_progress SET status = ?, attempts_count = attempts_count + 1,
        correct_count = ?, not_matched_count = ?, last_answer = ?, last_result = ?,
        next_review_at = ?, mastered_at = COALESCE(?, mastered_at),
        xp_earned_total = xp_earned_total + ?,
        last_attempted_at = datetime('now'), updated_at = datetime('now')
        WHERE user_id = ? AND sentence_id = ?
      `).run(newStatus, newCorrect, newNotMatched, answer, result, nextReview, masteredAt, xpEarned, userId, sentence_id);
    }

    // Update user XP & level
    if (xpEarned > 0) {
      db.prepare('UPDATE users SET total_xp = total_xp + ? WHERE id = ?').run(xpEarned, userId);
      const updatedUser = db.prepare('SELECT total_xp FROM users WHERE id = ?').get(userId);
      const newLevel = getUserLevel(updatedUser.total_xp);
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
        const streakUser = db.prepare('SELECT streak FROM users WHERE id = ?').get(userId);
        if (streakUser.streak === 7) {
          const streakBonus = getSettingInt('xp_streak_bonus', 25);
          db.prepare('UPDATE users SET total_xp = total_xp + ? WHERE id = ?').run(streakBonus, userId);
          xpEarned += streakBonus;
        }
      } else {
        db.prepare("UPDATE users SET streak = 1, last_active_at = datetime('now') WHERE id = ?").run(userId);
      }
    } else {
      db.prepare("UPDATE users SET last_active_at = datetime('now') WHERE id = ?").run(userId);
    }

    // Build response
    const showAnswer = getSetting('show_answer_after_not_matched', '1') !== '0';
    const feedbackCorrect = getSetting('feedback_correct_bn', 'সঠিক হয়েছে! দারুণ কাজ করেছেন।');
    const feedbackNotMatched = getSetting('feedback_not_matched_bn', 'আপনার উত্তরটি এই practice-এর expected format-এর সাথে মেলেনি।');

    const response = {
      result,
      xp_earned: xpEarned,
      submitted_answer: answer,
    };

    if (result === 'correct') {
      response.feedback = feedbackCorrect;
      response.motivational = 'আপনি XP পেয়েছেন। চালিয়ে যান! 🎉';
      if (sentence.advanced_version) {
        response.advanced_version = sentence.advanced_version;
      }
    } else {
      response.feedback = feedbackNotMatched;
      if (showAnswer) {
        response.accepted_answers = acceptedAnswers;
      }
      if (sentence.advanced_version) {
        response.advanced_version = sentence.advanced_version;
      }
      if (sentence.explanation) {
        response.explanation = sentence.explanation;
      }
      if (sentence.structure_hint) {
        response.structure_hint = sentence.structure_hint;
      }
      response.review_note = 'এই sentence টি আগামীকাল আবার practice-এ আসবে।';
      response.encouragement = 'Expected answers দেখে structure বুঝে আবার practice করুন।';
    }

    // Check if mastered
    const updatedProgress = db.prepare('SELECT status FROM student_sentence_progress WHERE user_id = ? AND sentence_id = ?').get(userId, sentence_id);
    if (updatedProgress?.status === 'mastered') {
      response.mastered = true;
      response.motivational = 'অসাধারণ! আপনি এই sentence টি master করেছেন! 🏆';
    }

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET PRACTICE STATS
// ============================================
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
        SUM(CASE WHEN p.status IN ('not_matched','needs_practice') THEN 1 ELSE 0 END) as not_matched,
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
