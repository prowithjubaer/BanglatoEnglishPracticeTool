const express = require('express');
const db = require('../database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { normalizeFlexible } = require('../utils/answerChecker');

const router = express.Router();

// Get sentences (admin with pagination, filters)
router.get('/admin', authenticate, requireAdmin, (req, res) => {
  try {
    const { page = 1, limit = 20, category_id, subcategory_id, difficulty, is_premium, is_active, search } = req.query;
    const offset = (page - 1) * limit;
    
    let where = '1=1';
    const params = [];

    if (category_id) { where += ' AND s.category_id = ?'; params.push(category_id); }
    if (subcategory_id) { where += ' AND s.subcategory_id = ?'; params.push(subcategory_id); }
    if (difficulty) { where += ' AND s.difficulty = ?'; params.push(difficulty); }
    if (is_premium !== undefined) { where += ' AND s.is_premium = ?'; params.push(is_premium); }
    if (is_active !== undefined) { where += ' AND s.is_active = ?'; params.push(is_active); }
    if (search) { where += ' AND s.bangla_sentence LIKE ?'; params.push(`%${search}%`); }

    const total = db.prepare(`SELECT COUNT(*) as count FROM sentences s WHERE ${where}`).get(...params).count;
    
    const sentences = db.prepare(`
      SELECT s.*, c.name as category_name, sc.name as subcategory_name
      FROM sentences s
      LEFT JOIN categories c ON s.category_id = c.id
      LEFT JOIN subcategories sc ON s.subcategory_id = sc.id
      WHERE ${where}
      ORDER BY s.id DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    // Get answers for each sentence
    const getAnswers = db.prepare('SELECT * FROM sentence_answers WHERE sentence_id = ? ORDER BY sort_order');
    sentences.forEach(s => {
      s.answers = getAnswers.all(s.id);
    });

    res.json({ sentences, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single sentence with answers (admin)
router.get('/admin/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const sentence = db.prepare(`
      SELECT s.*, c.name as category_name, sc.name as subcategory_name
      FROM sentences s
      LEFT JOIN categories c ON s.category_id = c.id
      LEFT JOIN subcategories sc ON s.subcategory_id = sc.id
      WHERE s.id = ?
    `).get(req.params.id);
    if (!sentence) return res.status(404).json({ error: 'Sentence not found' });
    sentence.answers = db.prepare('SELECT * FROM sentence_answers WHERE sentence_id = ? ORDER BY sort_order').all(sentence.id);
    res.json(sentence);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create sentence (admin)
router.post('/', authenticate, requireAdmin, (req, res) => {
  try {
    const { bangla_sentence, answers, advanced_version, explanation, hint, category_id, subcategory_id, difficulty, checking_mode, is_premium, tags } = req.body;
    if (!bangla_sentence || !answers || answers.length === 0) {
      return res.status(400).json({ error: 'Bangla sentence and at least one answer required' });
    }

    const result = db.prepare(`
      INSERT INTO sentences (bangla_sentence, advanced_version, explanation, hint, category_id, subcategory_id, difficulty, checking_mode, is_premium, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(bangla_sentence, advanced_version || null, explanation || null, hint || null,
      category_id || null, subcategory_id || null, difficulty || 'Easy', checking_mode || 'flexible',
      is_premium ? 1 : 0, tags || null);

    const insertAnswer = db.prepare('INSERT INTO sentence_answers (sentence_id, correct_answer, normalized_answer, sort_order) VALUES (?, ?, ?, ?)');
    answers.forEach((ans, idx) => {
      insertAnswer.run(result.lastInsertRowid, ans, normalizeFlexible(ans), idx);
    });

    const sentence = db.prepare('SELECT * FROM sentences WHERE id = ?').get(result.lastInsertRowid);
    sentence.answers = db.prepare('SELECT * FROM sentence_answers WHERE sentence_id = ?').all(sentence.id);
    res.json(sentence);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update sentence (admin)
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { bangla_sentence, answers, advanced_version, explanation, hint, category_id, subcategory_id, difficulty, checking_mode, is_active, is_premium, tags } = req.body;

    db.prepare(`
      UPDATE sentences SET bangla_sentence = COALESCE(?, bangla_sentence), advanced_version = ?,
      explanation = ?, hint = ?, category_id = COALESCE(?, category_id),
      subcategory_id = COALESCE(?, subcategory_id), difficulty = COALESCE(?, difficulty),
      checking_mode = COALESCE(?, checking_mode), is_active = COALESCE(?, is_active),
      is_premium = COALESCE(?, is_premium), tags = ?
      WHERE id = ?
    `).run(bangla_sentence, advanced_version, explanation, hint, category_id, subcategory_id, difficulty, checking_mode, is_active, is_premium, tags, req.params.id);

    if (answers && answers.length > 0) {
      db.prepare('DELETE FROM sentence_answers WHERE sentence_id = ?').run(req.params.id);
      const insertAnswer = db.prepare('INSERT INTO sentence_answers (sentence_id, correct_answer, normalized_answer, sort_order) VALUES (?, ?, ?, ?)');
      answers.forEach((ans, idx) => {
        insertAnswer.run(req.params.id, ans, normalizeFlexible(ans), idx);
      });
    }

    const sentence = db.prepare('SELECT * FROM sentences WHERE id = ?').get(req.params.id);
    sentence.answers = db.prepare('SELECT * FROM sentence_answers WHERE sentence_id = ?').all(sentence.id);
    res.json(sentence);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete sentence (admin)
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM sentences WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk operations (admin)
router.post('/bulk', authenticate, requireAdmin, (req, res) => {
  try {
    const { action, ids, data } = req.body;
    if (!ids || ids.length === 0) return res.status(400).json({ error: 'No IDs provided' });

    const placeholders = ids.map(() => '?').join(',');
    
    switch (action) {
      case 'delete':
        db.prepare(`DELETE FROM sentences WHERE id IN (${placeholders})`).run(...ids);
        break;
      case 'activate':
        db.prepare(`UPDATE sentences SET is_active = 1 WHERE id IN (${placeholders})`).run(...ids);
        break;
      case 'deactivate':
        db.prepare(`UPDATE sentences SET is_active = 0 WHERE id IN (${placeholders})`).run(...ids);
        break;
      case 'set_category':
        if (data?.category_id) {
          db.prepare(`UPDATE sentences SET category_id = ? WHERE id IN (${placeholders})`).run(data.category_id, ...ids);
        }
        break;
      case 'set_subcategory':
        if (data?.subcategory_id) {
          db.prepare(`UPDATE sentences SET subcategory_id = ? WHERE id IN (${placeholders})`).run(data.subcategory_id, ...ids);
        }
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
    res.json({ success: true, affected: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
