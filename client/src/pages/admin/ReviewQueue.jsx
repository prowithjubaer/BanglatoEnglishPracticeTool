import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/Layout';
import { api } from '../../utils/api';
import toast from 'react-hot-toast';

export default function ReviewQueue() {
  const [data, setData] = useState({ reviews: [], total: 0, pending_count: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [page, setPage] = useState(1);
  const [reviewing, setReviewing] = useState(null);
  const [form, setForm] = useState({ admin_result: '', admin_feedback: '', admin_mistake_type: '', admin_xp_awarded: 0, add_as_correct_answer: false });

  const load = () => {
    setLoading(true);
    api.getReviewQueue({ status: filter, page, limit: 15 }).then(setData).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter, page]);

  const handleReview = async (e) => {
    e.preventDefault();
    if (!form.admin_result) { toast.error('Select a result'); return; }
    try {
      await api.submitReview(reviewing.id, form);
      toast.success('Review submitted');
      setReviewing(null);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const handleDismiss = async (id) => {
    try { await api.dismissReview(id); toast.success('Dismissed'); load(); }
    catch (err) { toast.error(err.message); }
  };

  const openReview = (review) => {
    setReviewing(review);
    setForm({ admin_result: '', admin_feedback: '', admin_mistake_type: '', admin_xp_awarded: 0, add_as_correct_answer: false });
  };

  if (loading) return <AdminLayout><div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-brand-red border-t-transparent rounded-full"></div></div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">📩 Teacher Review Queue</h1>
          <p className="text-sm text-gray-500">{data.pending_count} pending reviews</p>
        </div>
        <div className="flex gap-2">
          {['pending', 'reviewed', 'all'].map(f => (
            <button key={f} onClick={() => { setFilter(f); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === f ? 'bg-brand-red text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f === 'pending' ? `Pending (${data.pending_count})` : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {data.reviews.length === 0 ? (
        <div className="text-center py-16"><div className="text-5xl mb-4">✅</div><p className="text-gray-500">No reviews {filter === 'pending' ? 'pending' : 'found'}.</p></div>
      ) : (
        <div className="space-y-3">
          {data.reviews.map(r => (
            <div key={r.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bangla text-lg text-brand-navy font-medium">{r.bangla_sentence}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{r.category_name || 'Uncategorized'}</span>
                    <span className="text-xs text-gray-500">by {r.student_name}</span>
                    <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</span>
                    {r.original_result && <span className={`text-xs px-2 py-0.5 rounded-full ${r.original_result === 'almost_correct' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>Auto: {r.original_result}</span>}
                    {r.similarity_score && <span className="text-xs text-gray-500">Sim: {r.similarity_score}%</span>}
                  </div>
                </div>
                {r.status === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => openReview(r)} className="btn-primary text-xs py-1.5 px-3">Review</button>
                    <button onClick={() => handleDismiss(r.id)} className="text-xs text-gray-400 hover:text-red-500">Dismiss</button>
                  </div>
                )}
                {r.status === 'reviewed' && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">{r.admin_result}</span>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Student's Answer:</p>
                  <p className="text-sm font-medium text-red-700">{r.student_answer}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Correct Answers:</p>
                  {r.correct_answers?.map((a, i) => <p key={i} className="text-sm text-green-700">✓ {a}</p>)}
                </div>
              </div>

              {r.admin_feedback && (
                <div className="mt-2 bg-blue-50 rounded-lg p-2">
                  <p className="text-xs text-blue-700"><strong>Admin feedback:</strong> {r.admin_feedback}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data.pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Prev</button>
          <span className="px-3 py-1 text-sm">Page {page}/{data.pages}</span>
          <button onClick={() => setPage(p => Math.min(data.pages, p+1))} disabled={page >= data.pages} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Next</button>
        </div>
      )}

      {/* Review Modal */}
      {reviewing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-brand-navy mb-4">Review Submission</h2>
            
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="font-bangla text-brand-navy font-medium">{reviewing.bangla_sentence}</p>
              <p className="text-sm text-red-600 mt-2"><strong>Student:</strong> {reviewing.student_answer}</p>
              <div className="mt-2">
                <p className="text-xs text-gray-500">Correct formats:</p>
                {reviewing.correct_answers?.map((a, i) => <p key={i} className="text-xs text-green-700">✓ {a}</p>)}
              </div>
            </div>

            <form onSubmit={handleReview} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Your Decision *</label>
                <div className="flex gap-2">
                  {[['correct', '✅ Correct', 'bg-green-100 border-green-300 text-green-700'], ['almost_correct', '🟡 Almost', 'bg-amber-100 border-amber-300 text-amber-700'], ['wrong', '❌ Wrong', 'bg-red-100 border-red-300 text-red-700']].map(([val, label, cls]) => (
                    <button key={val} type="button" onClick={() => setForm({...form, admin_result: val})}
                      className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${form.admin_result === val ? cls + ' ring-2 ring-offset-1' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Feedback to Student</label>
                <textarea value={form.admin_feedback} onChange={e => setForm({...form, admin_feedback: e.target.value})} className="input-field text-sm" rows={2} placeholder="Optional feedback..." />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Mistake Type</label>
                  <select value={form.admin_mistake_type} onChange={e => setForm({...form, admin_mistake_type: e.target.value})} className="input-field text-sm">
                    <option value="">Select</option>
                    <option value="tense_mistake">Tense Mistake</option>
                    <option value="verb_form_mistake">Verb Form</option>
                    <option value="subject_verb_agreement">Subject-Verb Agreement</option>
                    <option value="article_mistake">Article Mistake</option>
                    <option value="preposition_mistake">Preposition</option>
                    <option value="spelling_mistake">Spelling</option>
                    <option value="word_order_mistake">Word Order</option>
                    <option value="missing_word">Missing Word</option>
                    <option value="meaning_changed">Meaning Changed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Award XP</label>
                  <input type="number" min="0" max="10" value={form.admin_xp_awarded} onChange={e => setForm({...form, admin_xp_awarded: parseInt(e.target.value) || 0})} className="input-field text-sm" />
                </div>
              </div>

              {form.admin_result === 'correct' && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.add_as_correct_answer} onChange={e => setForm({...form, add_as_correct_answer: e.target.checked})} className="rounded" />
                  <span className="text-sm text-gray-700">Add student's answer as new accepted correct format</span>
                </label>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">Submit Review</button>
                <button type="button" onClick={() => setReviewing(null)} className="btn-outline">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
