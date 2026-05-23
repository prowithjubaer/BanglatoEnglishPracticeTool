import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/Layout';
import { api } from '../../utils/api';
import toast from 'react-hot-toast';

export default function ManageHomework() {
  const [homeworks, setHomeworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [categories, setCategories] = useState([]);
  const [batches, setBatches] = useState([]);
  const [sentences, setSentences] = useState([]);
  const [form, setForm] = useState({
    title: '', description: '', category_id: '', subcategory_id: '', batch_id: '',
    start_date: '', due_date: '', xp_bonus: 10, allow_late: 1, show_answer_after_wrong: 1, sentence_ids: []
  });

  useEffect(() => {
    Promise.all([
      api.getHomeworkAdmin(),
      api.getCategoriesAdmin(),
      api.getBatches()
    ]).then(([hw, cats, btch]) => {
      setHomeworks(hw);
      setCategories(cats);
      setBatches(btch);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const loadSentencesForCategory = async (catId) => {
    if (!catId) { setSentences([]); return; }
    try {
      const data = await api.getSentencesAdmin({ category_id: catId, limit: 100 });
      setSentences(data.sentences);
    } catch (err) {}
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.createHomework(form);
      toast.success('Homework created');
      setShowForm(false);
      const hw = await api.getHomeworkAdmin();
      setHomeworks(hw);
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this homework?')) return;
    try {
      await api.deleteHomework(id);
      toast.success('Deleted');
      setHomeworks(h => h.filter(x => x.id !== id));
    } catch (err) { toast.error(err.message); }
  };

  if (loading) return <AdminLayout><div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-brand-red border-t-transparent rounded-full"></div></div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-brand-navy">Manage Homework</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm">+ Create Homework</button>
      </div>

      <div className="space-y-3">
        {homeworks.length === 0 ? (
          <p className="text-center py-10 text-gray-400">No homework created yet</p>
        ) : homeworks.map(hw => (
          <div key={hw.id} className="card flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-brand-navy">{hw.title}</h3>
              <p className="text-xs text-gray-500">
                {hw.sentence_count} sentences | {hw.assigned_count} assigned | {hw.completed_count} completed
                {hw.due_date && ` | Due: ${hw.due_date}`}
              </p>
              {hw.category_name && <span className="text-xs text-blue-600">{hw.category_name}</span>}
            </div>
            <div className="flex gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${hw.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{hw.is_active ? 'Active' : 'Inactive'}</span>
              <button onClick={() => handleDelete(hw.id)} className="text-xs text-red-600 hover:underline">Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Create Homework</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="input-field" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select value={form.category_id} onChange={e => { setForm({...form, category_id: e.target.value}); loadSentencesForCategory(e.target.value); }} className="input-field">
                    <option value="">Select</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Batch (auto-assign)</label>
                  <select value={form.batch_id} onChange={e => setForm({...form, batch_id: e.target.value})} className="input-field">
                    <option value="">Select</option>
                    {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date</label>
                  <input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Due Date</label>
                  <input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} className="input-field" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Bonus XP</label>
                  <input type="number" value={form.xp_bonus} onChange={e => setForm({...form, xp_bonus: parseInt(e.target.value)})} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Allow Late</label>
                  <select value={form.allow_late} onChange={e => setForm({...form, allow_late: parseInt(e.target.value)})} className="input-field">
                    <option value={1}>Yes</option><option value={0}>No</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Show Answer</label>
                  <select value={form.show_answer_after_wrong} onChange={e => setForm({...form, show_answer_after_wrong: parseInt(e.target.value)})} className="input-field">
                    <option value={1}>Yes</option><option value={0}>No</option>
                  </select>
                </div>
              </div>

              {sentences.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1">Select Sentences ({form.sentence_ids.length} selected)</label>
                  <div className="border rounded-lg max-h-40 overflow-y-auto p-2">
                    {sentences.map(s => (
                      <label key={s.id} className="flex items-center gap-2 py-1 hover:bg-gray-50 px-2 rounded cursor-pointer">
                        <input type="checkbox" checked={form.sentence_ids.includes(s.id)}
                          onChange={e => setForm({...form, sentence_ids: e.target.checked ? [...form.sentence_ids, s.id] : form.sentence_ids.filter(x => x !== s.id)})} />
                        <span className="text-sm font-bangla truncate">{s.bangla_sentence}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">Create Homework</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-outline">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
