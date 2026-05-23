const express = require('express');
const db = require('../database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all categories (with subcategories and counts)
router.get('/', authenticate, (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM sentences s WHERE s.category_id = c.id AND s.is_active = 1) as sentence_count,
        (SELECT COUNT(*) FROM subcategories sc WHERE sc.category_id = c.id AND sc.is_active = 1) as subcategory_count
      FROM categories c WHERE c.is_active = 1 ORDER BY c.sort_order
    `).all();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all categories for admin (including inactive)
router.get('/admin', authenticate, requireAdmin, (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM sentences s WHERE s.category_id = c.id) as sentence_count,
        (SELECT COUNT(*) FROM subcategories sc WHERE sc.category_id = c.id) as subcategory_count
      FROM categories c ORDER BY c.sort_order
    `).all();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get subcategories for a category
router.get('/:categoryId/subcategories', authenticate, (req, res) => {
  try {
    const subcategories = db.prepare(`
      SELECT sc.*, 
        (SELECT COUNT(*) FROM sentences s WHERE s.subcategory_id = sc.id AND s.is_active = 1) as sentence_count
      FROM subcategories sc 
      WHERE sc.category_id = ? AND sc.is_active = 1 
      ORDER BY sc.sort_order
    `).all(req.params.categoryId);
    res.json(subcategories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create category (admin)
router.post('/', authenticate, requireAdmin, (req, res) => {
  try {
    const { name, description, icon, sort_order, is_premium } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const result = db.prepare(
      'INSERT INTO categories (name, description, icon, sort_order, is_premium) VALUES (?, ?, ?, ?, ?)'
    ).run(name, description || '', icon || '📚', sort_order || 0, is_premium ? 1 : 0);
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    res.json(cat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update category (admin)
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { name, description, icon, sort_order, is_active, is_premium } = req.body;
    db.prepare(`
      UPDATE categories SET name = COALESCE(?, name), description = COALESCE(?, description), 
      icon = COALESCE(?, icon), sort_order = COALESCE(?, sort_order),
      is_active = COALESCE(?, is_active), is_premium = COALESCE(?, is_premium)
      WHERE id = ?
    `).run(name, description, icon, sort_order, is_active, is_premium, req.params.id);
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    res.json(cat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete category (admin)
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create subcategory (admin)
router.post('/subcategories', authenticate, requireAdmin, (req, res) => {
  try {
    const { category_id, name, description, difficulty, sort_order, is_premium } = req.body;
    if (!category_id || !name) return res.status(400).json({ error: 'category_id and name required' });
    const result = db.prepare(
      'INSERT INTO subcategories (category_id, name, description, difficulty, sort_order, is_premium) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(category_id, name, description || '', difficulty || 'Easy', sort_order || 0, is_premium ? 1 : 0);
    const sc = db.prepare('SELECT * FROM subcategories WHERE id = ?').get(result.lastInsertRowid);
    res.json(sc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update subcategory (admin)
router.put('/subcategories/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { name, description, difficulty, sort_order, is_active, is_premium } = req.body;
    db.prepare(`
      UPDATE subcategories SET name = COALESCE(?, name), description = COALESCE(?, description),
      difficulty = COALESCE(?, difficulty), sort_order = COALESCE(?, sort_order),
      is_active = COALESCE(?, is_active), is_premium = COALESCE(?, is_premium)
      WHERE id = ?
    `).run(name, description, difficulty, sort_order, is_active, is_premium, req.params.id);
    const sc = db.prepare('SELECT * FROM subcategories WHERE id = ?').get(req.params.id);
    res.json(sc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete subcategory (admin)
router.delete('/subcategories/:id', authenticate, requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM subcategories WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
