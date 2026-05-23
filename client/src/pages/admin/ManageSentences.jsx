import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/Layout';
import { api } from '../../utils/api';
import toast from 'react-hot-toast';

export default function ManageSentences() {
  const [sentences, setSentences] = useState([]);
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ category_id: '', search: '' });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSentence, setEditingSentence] = useState(null);
  const [form, setForm] = useState({ bangla_sentence: '', answers: [''], advanced_version: '', explanation: '', hint: '', category_id: '', subcategory_id: '', difficulty: 'Easy', checking_mode: 'flexible', is_premium: 0, tags: '' });
  const [subcategories, setSubcategories] = useState([]);
  const [selected, setSelected] = useState([]);

  const loadSentences = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (filters.category_id) params.category_id = filters.category_id;
      if (filters.search) params.search = filters.search;
      const data = await api.getSentencesAdmin(params);
      setSentences(data.sentences);
      setTotal(data.total);
    } catch (err) { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadSentences(); }, [page, filters]);
  useEffect(() => { api.getCategoriesAdmin().then(setCategories).catch(console.error); }, []);

  const loadSubcategories = async (catId) => {
    if (!catId) { setSubcategories([]); return; }
    try {
      const subs = await api.getSubcategories(catId);
      setSubcategories(subs);
    } catch (err) {}
  };

  const openForm = (sentence = null) => {
    if (sentence) {
      setForm({
        bangla_sentence: sentence.bangla_sentence,
        answers: sentence.answers?.map(a => a.correct_answer) || [''],
        advanced_version: sentence.advanced_version || '',
        explanation: sentence.explanation || '',
        hint: sentence.hint || '',
        category_id: sentence.category_id || '',
        subcategory_id: sentence.subcategory_id || '',
        difficulty: sentence.difficulty || 'Easy',
        checking_mode: sentence.checking_mode || 'flexible',
        is_premium: sentence.is_premium || 0,
        tags: sentence.tags || '',
      });
      setEditingSentence(sentence);
      if (sentence.category_id) loadSubcategories(sentence.category_id);
    } else {
      setForm({ bangla_sentence: '', answers: [''], advanced_version: '', explanation: '', hint: '', category_id: '', subcategory_id: '', difficulty: 'Easy', checking_mode: 'flexible', is_premium: 0, tags: '' });
      setEditingSentence(null);
    }
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form, answers: form.answers.filter(a => a.trim()) };
    if (!payload.bangla_sentence || payload.answers.length === 0) {
      toast.error('Bangla sentence and at least one answer required');
      return;
    }
    try {
      if (editingSentence) {
        await api.updateSentence(editingSentence.id, payload);
        toast.success('Sentence updated');
      } else {
        await api.createSentence(payload);
        toast.success('Sentence created');
      }
      setShowForm(false);
      loadSentences();
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this sentence?')) return;
    try {
      await api.deleteSentence(id);
      toast.success('Deleted');
      loadSentences();
    } catch (err) { toast.error(err.message); }
  };

  const handleBulkAction = async (action) => {
    if (selected.length === 0) { toast.error('Select sentences first'); return; }
    if (action === 'delete' && !confirm(`Delete ${selected.length} sentences?`)) return;
    try {
      await api.bulkSentences({ action, ids: selected });
      toast.success(`${action} completed for ${selected.length} sentences`);
      setSelected([]);
      loadSentences();
    } catch (err) { toast.error(err.message); }
  };

  const pages = Math.ceil(total / 15);

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Manage Sentences</h1>
          <p className="text-sm text-gray-500">{total} total sentences</p>
        </div>
        <button onClick={() => openForm()} className="btn-primary text-sm">+ Add Sentence</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input type="text" placeholder="Search Bangla..." value={filters.search}
          onChange={e => { setFilters({...filters, search: e.target.value}); setPage(1); }}
          className="input-field max-w-xs text-sm" />
        <select value={filters.category_id} onChange={e => { setFilters({...filters, category_id: e.target.value}); setPage(1); }}
          className="input-field max-w-xs text-sm">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {selected.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-500">{selected.length} selected</span>
            <button onClick={() => handleBulkAction('activate')} className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full hover:bg-green-200">Activate</button>
            <button onClick={() => handleBulkAction('deactivate')} className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full hover:bg-amber-200">Deactivate</button>
            <button onClick={() => handleBulkAction('delete')} className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full hover:bg-red-200">Delete</button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-3 text-left"><input type="checkbox" onChange={e => setSelected(e.target.checked ? sentences.map(s => s.id) : [])} /></th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">Bangla Sentence</th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">Category</th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">Difficulty</th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">Mode</th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sentences.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3"><input type="checkbox" checked={selected.includes(s.id)} onChange={e => setSelected(e.target.checked ? [...selected, s.id] : selected.filter(x => x !== s.id))} /></td>
                  <td className="px-3 py-3 font-bangla max-w-[300px] truncate">{s.bangla_sentence}</td>
                  <td className="px-3 py-3 text-xs">{s.category_name || '-'}</td>
                  <td className="px-3 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${s.difficulty === 'Easy' ? 'bg-green-100 text-green-700' : s.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{s.difficulty}</span></td>
                  <td className="px-3 py-3 text-xs">{s.checking_mode}</td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{s.is_active ? 'Active' : 'Inactive'}</span>
                    {s.is_premium === 1 && <span className="ml-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Premium</span>}
                  </td>
                  <td className="px-3 py-3">
                    <button onClick={() => openForm(s)} className="text-blue-600 hover:underline text-xs mr-2">Edit</button>
                    <button onClick={() => handleDelete(s.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sentences.length === 0 && <p className="text-center py-8 text-gray-400">No sentences found</p>}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Prev</button>
          <span className="px-3 py-1 text-sm">Page {page}/{pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p+1))} disabled={page >= pages} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Next</button>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editingSentence ? 'Edit' : 'Add'} Sentence</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Bangla Sentence *</label>
                <textarea value={form.bangla_sentence} onChange={e => setForm({...form, bangla_sentence: e.target.value})} className="input-field font-bangla" rows={2} required />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Correct Answers * (one per line)</label>
                {form.answers.map((ans, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input type="text" value={ans} onChange={e => { const a = [...form.answers]; a[idx] = e.target.value; setForm({...form, answers: a}); }} className="input-field text-sm" placeholder={`Answer ${idx+1}`} />
                    {form.answers.length > 1 && <button type="button" onClick={() => setForm({...form, answers: form.answers.filter((_, i) => i !== idx)})} className="text-red-500 px-2">✕</button>}
                  </div>
                ))}
                <button type="button" onClick={() => setForm({...form, answers: [...form.answers, '']})} className="text-sm text-blue-600 hover:underline">+ Add answer</button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Advanced Version</label>
                <input type="text" value={form.advanced_version} onChange={e => setForm({...form, advanced_version: e.target.value})} className="input-field text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select value={form.category_id} onChange={e => { setForm({...form, category_id: e.target.value, subcategory_id: ''}); loadSubcategories(e.target.value); }} className="input-field text-sm">
                    <option value="">Select</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Subcategory</label>
                  <select value={form.subcategory_id} onChange={e => setForm({...form, subcategory_id: e.target.value})} className="input-field text-sm">
                    <option value="">Select</option>
                    {subcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Difficulty</label>
                  <select value={form.difficulty} onChange={e => setForm({...form, difficulty: e.target.value})} className="input-field text-sm">
                    <option>Easy</option><option>Medium</option><option>Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Checking Mode</label>
                  <select value={form.checking_mode} onChange={e => setForm({...form, checking_mode: e.target.value})} className="input-field text-sm">
                    <option value="exact">Exact</option><option value="flexible">Flexible</option><option value="ai">AI/Semantic</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Premium</label>
                  <select value={form.is_premium} onChange={e => setForm({...form, is_premium: parseInt(e.target.value)})} className="input-field text-sm">
                    <option value={0}>Free</option><option value={1}>Premium</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Explanation/Note</label>
                <textarea value={form.explanation} onChange={e => setForm({...form, explanation: e.target.value})} className="input-field text-sm" rows={2} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Hint</label>
                <input type="text" value={form.hint} onChange={e => setForm({...form, hint: e.target.value})} className="input-field text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tags (comma separated)</label>
                <input type="text" value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} className="input-field text-sm" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">{editingSentence ? 'Update' : 'Create'} Sentence</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-outline">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
