import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/Layout';
import { api } from '../../utils/api';
import toast from 'react-hot-toast';

export default function Synonyms() {
  const [synonyms, setSynonyms] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('synonyms');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ group_name: '', words: '' });
  const [patternForm, setPatternForm] = useState({ name: '', description: '', expected_structure: '', required_markers: '', forbidden_markers: '', tense_category: '' });
  const [showPatternForm, setShowPatternForm] = useState(false);

  useEffect(() => {
    Promise.all([api.getSynonyms(), api.getPatterns()])
      .then(([s, p]) => { setSynonyms(s); setPatterns(p); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleCreateSynonym = async (e) => {
    e.preventDefault();
    try {
      const group = await api.createSynonym(form);
      setSynonyms([group, ...synonyms]);
      setShowForm(false);
      setForm({ group_name: '', words: '' });
      toast.success('Synonym group created');
    } catch (err) { toast.error(err.message); }
  };

  const handleDeleteSynonym = async (id) => {
    if (!confirm('Delete this synonym group?')) return;
    try { await api.deleteSynonym(id); setSynonyms(s => s.filter(x => x.id !== id)); toast.success('Deleted'); }
    catch (err) { toast.error(err.message); }
  };

  const handleCreatePattern = async (e) => {
    e.preventDefault();
    try {
      const p = await api.createPattern(patternForm);
      setPatterns([...patterns, p]);
      setShowPatternForm(false);
      setPatternForm({ name: '', description: '', expected_structure: '', required_markers: '', forbidden_markers: '', tense_category: '' });
      toast.success('Pattern created');
    } catch (err) { toast.error(err.message); }
  };

  const handleDeletePattern = async (id) => {
    if (!confirm('Delete?')) return;
    try { await api.deletePattern(id); setPatterns(p => p.filter(x => x.id !== id)); toast.success('Deleted'); }
    catch (err) { toast.error(err.message); }
  };

  if (loading) return <AdminLayout><div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-brand-red border-t-transparent rounded-full"></div></div></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-brand-navy mb-6">📖 Synonyms & Grammar Patterns</h1>

      <div className="flex gap-2 mb-6 border-b">
        <button onClick={() => setTab('synonyms')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'synonyms' ? 'border-brand-red text-brand-red' : 'border-transparent text-gray-500'}`}>Synonym Dictionary ({synonyms.length})</button>
        <button onClick={() => setTab('patterns')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'patterns' ? 'border-brand-red text-brand-red' : 'border-transparent text-gray-500'}`}>Grammar Patterns ({patterns.length})</button>
      </div>

      {tab === 'synonyms' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-500">Words in the same group are treated as interchangeable in Flexible Mode.</p>
            <button onClick={() => setShowForm(true)} className="btn-primary text-sm">+ Add Group</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {synonyms.map(s => (
              <div key={s.id} className="card">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm text-brand-navy">{s.group_name}</h3>
                  <button onClick={() => handleDeleteSynonym(s.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {s.words.split(',').map((w, i) => (
                    <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{w.trim()}</span>
                  ))}
                </div>
                <span className={`text-xs mt-2 inline-block ${s.is_active ? 'text-green-600' : 'text-gray-400'}`}>{s.is_active ? 'Active' : 'Inactive'}</span>
              </div>
            ))}
          </div>

          {showForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl w-full max-w-md p-6">
                <h2 className="text-lg font-bold mb-4">Add Synonym Group</h2>
                <form onSubmit={handleCreateSynonym} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Group Name</label>
                    <input type="text" value={form.group_name} onChange={e => setForm({...form, group_name: e.target.value})} className="input-field" placeholder="e.g. learn/study/practice" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Words (comma separated)</label>
                    <input type="text" value={form.words} onChange={e => setForm({...form, words: e.target.value})} className="input-field" placeholder="learn, study, practice" required />
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" className="btn-primary flex-1">Create</button>
                    <button type="button" onClick={() => setShowForm(false)} className="btn-outline">Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'patterns' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-500">Assign patterns to sentences for better mistake detection.</p>
            <button onClick={() => setShowPatternForm(true)} className="btn-primary text-sm">+ Add Pattern</button>
          </div>
          <div className="space-y-2">
            {patterns.map(p => (
              <div key={p.id} className="card flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-brand-navy">{p.name}</h3>
                  <p className="text-xs text-gray-500">{p.expected_structure || p.description || 'No structure defined'}</p>
                  {p.tense_category && <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">{p.tense_category}</span>}
                </div>
                <button onClick={() => handleDeletePattern(p.id)} className="text-xs text-red-500 hover:underline">Delete</button>
              </div>
            ))}
          </div>

          {showPatternForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl w-full max-w-md p-6">
                <h2 className="text-lg font-bold mb-4">Add Grammar Pattern</h2>
                <form onSubmit={handleCreatePattern} className="space-y-3">
                  <div><label className="block text-sm font-medium mb-1">Pattern Name *</label><input type="text" value={patternForm.name} onChange={e => setPatternForm({...patternForm, name: e.target.value})} className="input-field" required /></div>
                  <div><label className="block text-sm font-medium mb-1">Description</label><input type="text" value={patternForm.description} onChange={e => setPatternForm({...patternForm, description: e.target.value})} className="input-field" /></div>
                  <div><label className="block text-sm font-medium mb-1">Expected Structure</label><input type="text" value={patternForm.expected_structure} onChange={e => setPatternForm({...patternForm, expected_structure: e.target.value})} className="input-field" placeholder="Subject + V1 + Object" /></div>
                  <div><label className="block text-sm font-medium mb-1">Tense Category</label><input type="text" value={patternForm.tense_category} onChange={e => setPatternForm({...patternForm, tense_category: e.target.value})} className="input-field" placeholder="Present Simple" /></div>
                  <div className="flex gap-3"><button type="submit" className="btn-primary flex-1">Create</button><button type="button" onClick={() => setShowPatternForm(false)} className="btn-outline">Cancel</button></div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
