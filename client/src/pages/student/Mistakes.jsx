import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { StudentLayout } from '../../components/Layout';
import { api } from '../../utils/api';

export default function Mistakes() {
  const [data, setData] = useState({ mistakes: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const loadMistakes = () => {
    setLoading(true);
    api.getMistakes({ page, limit: 20 })
      .then(d => setData(d || { mistakes: [], total: 0, pages: 1 }))
      .catch(err => {
        console.error('Mistakes load error:', err);
        setData({ mistakes: [], total: 0, pages: 1 });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadMistakes(); }, [page]);

  if (loading) return <StudentLayout><div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-brand-red border-t-transparent rounded-full"></div></div></StudentLayout>;

  return (
    <StudentLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">📕 Mistake Notebook</h1>
          <p className="text-sm text-gray-500 font-bangla">{data.total} টি sentence-এ ভুল হয়েছে</p>
        </div>
        <Link to="/practice?mode=needs_practice" className="btn-primary text-sm">
          🔄 Review Practice
        </Link>
      </div>

      {data.mistakes.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-brand-navy mb-2 font-bangla">কোনো ভুল নেই!</h2>
          <p className="text-gray-500 font-bangla">দারুণ! Practice চালিয়ে যান।</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.mistakes.map((m, idx) => (
            <div key={idx} className="card">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="font-bangla text-lg text-brand-navy font-medium">{m.bangla_sentence}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {m.category_name && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{m.category_name}</span>}
                    {m.subcategory_name && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{m.subcategory_name}</span>}
                    <span className="text-xs text-orange-600">📝 {m.not_matched_count} বার মেলেনি</span>
                    {m.status === 'mastered' && <span className="text-xs text-green-600 font-medium">✓ এখন Mastered</span>}
                  </div>
                </div>
                <Link to={`/practice?mode=needs_practice`} className="text-xs bg-brand-red/10 text-brand-red px-3 py-1.5 rounded-lg font-medium hover:bg-brand-red/20 whitespace-nowrap ml-2">
                  আবার করুন
                </Link>
              </div>
              
              {m.last_answer && (
                <div className="bg-orange-50 rounded-lg p-3 mb-2">
                  <p className="text-xs text-gray-500 font-bangla">আপনার শেষ উত্তর:</p>
                  <p className="text-sm text-orange-700">{m.last_answer}</p>
                </div>
              )}
              
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 font-bangla">Expected answers:</p>
                {(m.accepted_answers || []).map((a, i) => (
                  <p key={i} className="text-sm text-green-700">✓ {a}</p>
                ))}
              </div>

              {m.structure_hint && (
                <div className="mt-2 bg-indigo-50 rounded-lg p-2">
                  <p className="text-xs text-indigo-600">📐 Structure: {m.structure_hint}</p>
                </div>
              )}

              {m.advanced_version && (
                <p className="text-xs text-purple-600 mt-2">🌟 {m.advanced_version}</p>
              )}
            </div>
          ))}

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Prev</button>
              <span className="px-3 py-1 text-sm">Page {page} / {data.pages}</span>
              <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page >= data.pages} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Next</button>
            </div>
          )}
        </div>
      )}
    </StudentLayout>
  );
}
