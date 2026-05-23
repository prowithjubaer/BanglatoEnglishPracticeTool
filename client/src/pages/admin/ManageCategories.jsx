import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/Layout';
import { api } from '../../utils/api';
import toast from 'react-hot-toast';

export default function ManageCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', icon: '📚', sort_order: 0, is_premium: 0 });
  const [showSubForm, setShowSubForm] = useState(false);
  const [subForm, setSubForm] = useState({ category_id: '', name: '', difficulty: 'Easy', sort_order: 0, is_premium: 0 });

  const loadCategories = () => {
    api.getCategoriesAdmin().then(setCategories).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadCategories(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.updateCategory(editing.id, form);
        toast.success('Updated');
      } else {
        await api.createCategory(form);
        toast.success('Created');
      }
      setShowForm(false);
      setEditing(null);
      loadCategories();
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this category? All subcategories will also be deleted.')) return;
    try {
      await api.deleteCategory(id);
      toast.success('Deleted');
      loadCategories();
    } catch (err) { toast.error(err.message); }
  };

  const handleSubSave = async (e) => {
    e.preventDefault();
    try {
      await api.createSubcategory(subForm);
      toast.success('Subcategory created');
      setShowSubForm(false);
      loadCategories();
    } catch (err) { toast.error(err.message); }
  };

  if (loading) return <AdminLayout><div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-brand-red border-t-transparent rounded-full"></div></div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-brand-navy">Manage Categories</h1>
        <div className="flex gap-2">
          <button onClick={() => { setForm({ name: '', description: '', icon: '📚', sort_order: 0, is_premium: 0 }); setEditing(null); setShowForm(true); }} className="btn-primary text-sm">+ Category</button>
          <button onClick={() => { setSubForm({ category_id: categories[0]?.id || '', name: '', difficulty: 'Easy', sort_order: 0, is_premium: 0 }); setShowSubForm(true); }} className="btn-outline text-sm">+ Subcategory</button>
        </div>
      </div>

      <div className="space-y-4">
        {categories.map(cat => (
          <div key={cat.id} className="card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{cat.icon}</span>
                <div>
                  <h3 className="font-semibold text-brand-navy">{cat.name}</h3>
                  <p className="text-xs text-gray-500">{cat.sentence_count} sentences | {cat.subcategory_count} subcategories | Order: {cat.sort_order}</p>
                </div>
                {cat.is_premium === 1 && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Premium</span>}
                {cat.is_active === 0 && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setForm(cat); setEditing(cat); setShowForm(true); }} className="text-xs text-blue-600 hover:underline">Edit</button>
                <button onClick={() => handleDelete(cat.id)} className="text-xs text-red-600 hover:underline">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Category Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Edit' : 'Add'} Category</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input type="text" value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} className="input-field" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Icon</label>
                  <input type="text" value={form.icon || ''} onChange={e => setForm({...form, icon: e.target.value})} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Order</label>
                  <input type="number" value={form.sort_order} onChange={e => setForm({...form, sort_order: parseInt(e.target.value)})} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Premium</label>
                  <select value={form.is_premium} onChange={e => setForm({...form, is_premium: parseInt(e.target.value)})} className="input-field">
                    <option value={0}>Free</option><option value={1}>Premium</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary flex-1">Save</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-outline">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subcategory Form Modal */}
      {showSubForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Add Subcategory</h2>
            <form onSubmit={handleSubSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Category *</label>
                <select value={subForm.category_id} onChange={e => setSubForm({...subForm, category_id: e.target.value})} className="input-field" required>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input type="text" value={subForm.name} onChange={e => setSubForm({...subForm, name: e.target.value})} className="input-field" required />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Difficulty</label>
                  <select value={subForm.difficulty} onChange={e => setSubForm({...subForm, difficulty: e.target.value})} className="input-field">
                    <option>Easy</option><option>Medium</option><option>Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Order</label>
                  <input type="number" value={subForm.sort_order} onChange={e => setSubForm({...subForm, sort_order: parseInt(e.target.value)})} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Premium</label>
                  <select value={subForm.is_premium} onChange={e => setSubForm({...subForm, is_premium: parseInt(e.target.value)})} className="input-field">
                    <option value={0}>Free</option><option value={1}>Premium</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary flex-1">Create</button>
                <button type="button" onClick={() => setShowSubForm(false)} className="btn-outline">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
