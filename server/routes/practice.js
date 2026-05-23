const express = require('express');
const db = require('../database');
const { authenticate } = require('../middleware/auth');
const { checkAnswer, getActiveSynonymGroups } = require('../utils/answerChecker');

const router = express.Router();

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function getSettingInt(key, defaultVal = 0) {
  return parseInt(getSetting(key) || String(defaultVal));
}

function getUserLevel(xp) {
  const level = db.prepare('SELECT * FROM levels WHERE min_xp <= ? ORDER BY level_number DESC LIMIT 1').get(xp);
  return level || { level_number: 1, name: 'Beginner', badge: '🌱' };
}

// ============================================
// GET NEXT SENTENCE (Priority-based)
// ============================================
router.get('/next', authenticate, (req, res) => {
  try {
    const { category_id, subcategory_id, mode } = req.query;
    const userId = req.user.id;
    
    // Check premium
    const user = db.prepare('SELECT premium_status FROM users WHERE id = ?').get(userId);
    let sentence;

    if (mode === 'review') {
      // Wrong + Almost Correct sentences needing review
      sentence = db.prepare(`
        SELECT s.*, c.name as category_name, sc.name as subcategory_name
        FROM sentences s
        LEFT JOIN categories c ON s.category_id = c.id
        LEFT JOIN subcategories sc ON s.subcategory_id = sc.id
        INNER JOIN student_sentence_progress p ON p.sentence_id = s.id AND p.user_id = ?
        WHERE s.is_active = 1 AND p.status IN ('wrong','needs_review','almost_correct') 
          AND (p.next_review_at IS NULL OR p.next_review_at <= datetime('now'))
        ORDER BY CASE p.status WHEN 'wrong' THEN 1 WHEN 'almost_correct' THEN 2 ELSE 3 END,
                 p.next_review_at ASC LIMIT 1
      `).get(userId);
    } else if (mode === 'due') {
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
      // Normal practice with priority: due > wrong > almost_correct > new
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
        ORDER BY CASE p.status WHEN 'wrong' THEN 1 WHEN 'needs_review' THEN 2 WHEN 'almost_correct' THEN 3 ELSE 4 END,
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
          ORDER BY s.id ASC LIMIT 1
        `).get(...params);
      }
    }

    if (!sentence) {
      return res.json({ completed: true, message: 'No more sentences available. Great work!' });
    }

    // Premium check
    if (sentence.is_premium && !user.premium_status) {
      const premiumCta = getSetting('premium_cta_text');
      return res.json({ premium_locked: true, message: premiumCta });
    }

    // Return sentence (without revealing answers)
    res.json({
      id: sentence.id,
      bangla_sentence: sentence.bangla_sentence,
      category_name: sentence.category_name,
      subcategory_name: sentence.subcategory_name,
      difficulty: sentence.difficulty,
      grammar_pattern: sentence.grammar_pattern,
      show_hint: !!sentence.hint,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET HINT
// ============================================
router.get('/:sentenceId/hint', authenticate, (req, res) => {
  try {
    const sentence = db.prepare('SELECT hint FROM sentences WHERE id = ?').get(req.params.sentenceId);
    res.json({ hint: sentence?.hint || 'No hint available.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// SUBMIT ANSWER (3-tier result)
// ============================================
router.post('/submit', authenticate, (req, res) => {
  try {
    const { sentence_id, answer } = req.body;
    const userId = req.user.id;

    if (!sentence_id || !answer) return res.status(400).json({ error: 'Sentence ID and answer required' });

    const sentence = db.prepare('SELECT * FROM sentences WHERE id = ?').get(sentence_id);
    if (!sentence) return res.status(404).json({ error: 'Sentence not found' });

    const correctAnswers = db.prepare('SELECT correct_answer FROM sentence_answers WHERE sentence_id = ? ORDER BY sort_order')
      .all(sentence_id).map(a => a.correct_answer);

    // Get settings
    const almostCorrectEnabled = getSetting('almost_correct_enabled') !== '0';
    const synonymEnabled = getSetting('synonym_matching_enabled') !== '0';
    const globalCorrectThreshold = getSettingInt('correct_similarity_threshold', 90);
    const globalPartialThreshold = getSettingInt('partial_similarity_threshold', 70);

    // Get synonym groups if enabled
    const synonymGroups = synonymEnabled ? getActiveSynonymGroups() : [];

    // Determine thresholds (sentence-level overrides global)
    const correctThreshold = sentence.correct_similarity_threshold || globalCorrectThreshold;
    const partialThreshold = sentence.partial_similarity_threshold || globalPartialThreshold;

    // Run answer check
    const result = checkAnswer(answer, correctAnswers, {
      checkingMode: sentence.checking_mode || 'flexible',
      partialMatchEnabled: sentence.partial_match_enabled !== 0,
      correctThreshold,
      partialThreshold,
      requiredWords: sentence.required_words || '',
      forbiddenWords: sentence.forbidden_words || '',
      grammarPattern: sentence.grammar_pattern || '',
      synonymGroups,
      almostCorrectEnabled,
    });

    // XP Calculation with anti-cheat
    const xpCorrect = getSettingInt('xp_per_correct', 5);
    const xpAlmostCorrect = getSettingInt('xp_per_almost_correct', 2);
    const antiCheat = getSetting('anti_cheat_same_day') !== '0';

    let xpEarned = 0;

    if (antiCheat) {
      // Check if already earned XP for this sentence today
      const todayXp = db.prepare(`
        SELECT id FROM submissions WHERE user_id = ? AND sentence_id = ? 
        AND xp_earned > 0 AND date(submitted_at) = date('now')
      `).get(userId, sentence_id);

      if (!todayXp) {
        if (result.resultType === 'correct') xpEarned = xpCorrect;
        else if (result.resultType === 'almost_correct') xpEarned = xpAlmostCorrect;
      }
    } else {
      if (result.resultType === 'correct') xpEarned = xpCorrect;
      else if (result.resultType === 'almost_correct') xpEarned = xpAlmostCorrect;
    }

    // Retry XP protection: if student just saw correct answer and retries, reduce XP
    const retryXpBehavior = getSetting('retry_xp_behavior') || 'reduce';
    if (retryXpBehavior !== 'full') {
      const recentWrongSubmission = db.prepare(`
        SELECT id FROM submissions WHERE user_id = ? AND sentence_id = ? 
        AND result_type = 'wrong' AND date(submitted_at) = date('now')
      `).get(userId, sentence_id);
      
      if (recentWrongSubmission && result.resultType === 'correct') {
        // Reduce XP if retrying after seeing answer
        if (retryXpBehavior === 'reduce') xpEarned = Math.max(1, Math.floor(xpEarned / 2));
        else if (retryXpBehavior === 'none') xpEarned = 0;
      }
    }

    // Determine primary mistake type for storage
    const primaryMistake = result.mistakeTypes.length > 0 ? result.mistakeTypes[0] : null;

    // Save submission
    const submissionResult = db.prepare(`
      INSERT INTO submissions (user_id, sentence_id, submitted_answer, result_type, is_correct, similarity_score, mistake_type, xp_earned)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, sentence_id, answer, result.resultType, result.isCorrect ? 1 : 0, 
      result.similarity, primaryMistake, xpEarned);

    // Update student progress
    const revisionCorrectDays = sentence.review_after_correct_days || getSettingInt('revision_after_correct_days', 7);
    const revisionAlmostDays = getSettingInt('revision_after_almost_correct_days', 2);
    const revisionWrongDays = sentence.review_after_wrong_days || getSettingInt('revision_after_wrong_days', 1);
    const masteryRequired = getSettingInt('mastery_required_correct_reviews', 2);

    let progress = db.prepare('SELECT * FROM student_sentence_progress WHERE user_id = ? AND sentence_id = ?').get(userId, sentence_id);

    if (!progress) {
      const nextReview = result.resultType === 'correct'
        ? new Date(Date.now() + revisionCorrectDays * 86400000).toISOString()
        : result.resultType === 'almost_correct'
          ? new Date(Date.now() + revisionAlmostDays * 86400000).toISOString()
          : new Date(Date.now() + revisionWrongDays * 86400000).toISOString();

      db.prepare(`
        INSERT INTO student_sentence_progress (user_id, sentence_id, status, attempts_count, correct_count, almost_correct_count, wrong_count, last_answer, last_result, last_mistake_type, next_review_at, last_attempted_at)
        VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(userId, sentence_id, result.resultType,
        result.resultType === 'correct' ? 1 : 0,
        result.resultType === 'almost_correct' ? 1 : 0,
        result.resultType === 'wrong' ? 1 : 0,
        answer, result.resultType, primaryMistake, nextReview);
    } else {
      const newCorrect = progress.correct_count + (result.resultType === 'correct' ? 1 : 0);
      const newAlmost = progress.almost_correct_count + (result.resultType === 'almost_correct' ? 1 : 0);
      const newWrong = progress.wrong_count + (result.resultType === 'wrong' ? 1 : 0);
      
      let newStatus = result.resultType;
      let masteredAt = null;
      let nextReview;

      if (result.resultType === 'correct') {
        if (newCorrect >= masteryRequired && progress.status !== 'mastered') {
          newStatus = 'mastered';
          masteredAt = new Date().toISOString();
          const masteryBonus = getSettingInt('xp_mastery_bonus', 5);
          xpEarned += masteryBonus;
        }
        nextReview = new Date(Date.now() + revisionCorrectDays * 86400000).toISOString();
      } else if (result.resultType === 'almost_correct') {
        newStatus = 'almost_correct';
        nextReview = new Date(Date.now() + revisionAlmostDays * 86400000).toISOString();
      } else {
        newStatus = 'needs_review';
        nextReview = new Date(Date.now() + revisionWrongDays * 86400000).toISOString();
      }

      db.prepare(`
        UPDATE student_sentence_progress SET status = ?, attempts_count = attempts_count + 1,
        correct_count = ?, almost_correct_count = ?, wrong_count = ?, 
        last_answer = ?, last_result = ?, last_mistake_type = ?,
        next_review_at = ?, mastered_at = COALESCE(?, mastered_at), 
        last_attempted_at = datetime('now'), updated_at = datetime('now')
        WHERE user_id = ? AND sentence_id = ?
      `).run(newStatus, newCorrect, newAlmost, newWrong, answer, result.resultType, primaryMistake, nextReview, masteredAt, userId, sentence_id);
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
        const streakUser = db.prepare('SELECT streak FROM users WHERE id = ?').get(userId);
        if (streakUser.streak === 7) {
          const streakBonus = getSettingInt('xp_streak_bonus_7', 25);
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
    const showAnswer = getSetting('show_answer_after_wrong') !== '0';
    const showAdvanced = getSetting('show_advanced_after_submit') !== '0';
    const feedbackCorrect = getSetting('feedback_correct_bn') || 'সঠিক হয়েছে! দারুণ কাজ করেছেন।';
    const feedbackAlmost = getSetting('feedback_almost_correct_bn') || 'প্রায় সঠিক হয়েছে, তবে একটু ভুল আছে।';
    const feedbackWrong = getSetting('feedback_wrong_bn') || 'এবার সঠিক হয়নি। চিন্তার কিছু নেই।';
    const reviewRequestEnabled = getSetting('review_request_enabled') !== '0';

    const response = {
      result_type: result.resultType,
      is_correct: result.isCorrect,
      xp_earned: xpEarned,
      similarity_score: result.similarity,
      submitted_answer: answer,
      submission_id: submissionResult.lastInsertRowid,
      mistake_types: result.mistakeTypes,
      review_request_enabled: reviewRequestEnabled,
    };

    if (result.resultType === 'correct') {
      response.feedback = feedbackCorrect;
      response.motivational = 'Keep going! You are doing great! 🎉';
      if (showAdvanced && sentence.advanced_version) {
        response.advanced_version = sentence.advanced_version;
      }
    } else if (result.resultType === 'almost_correct') {
      response.feedback = feedbackAlmost;
      response.closest_correct = result.matchedAnswer;
      if (showAdvanced && sentence.advanced_version) {
        response.advanced_version = sentence.advanced_version;
      }
      if (sentence.explanation) response.explanation = sentence.explanation;
      response.review_note = `This sentence will come again in ${revisionAlmostDays} day(s) for revision.`;
      // Show what's missing
      if (result.details.missingWords?.length > 0) {
        response.missing_words = result.details.missingWords;
      }
    } else {
      response.feedback = feedbackWrong;
      if (showAnswer) {
        response.correct_answers = correctAnswers;
        response.closest_correct = result.matchedAnswer;
      }
      if (showAdvanced && sentence.advanced_version) {
        response.advanced_version = sentence.advanced_version;
      }
      if (sentence.explanation) response.explanation = sentence.explanation;
      response.review_note = 'This sentence will come again tomorrow for revision.';
      if (result.details.missingWords?.length > 0) {
        response.missing_words = result.details.missingWords;
      }
      if (result.details.foundForbidden?.length > 0) {
        response.forbidden_words_used = result.details.foundForbidden;
      }
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
        SUM(CASE WHEN p.status = 'almost_correct' THEN 1 ELSE 0 END) as almost_correct,
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
