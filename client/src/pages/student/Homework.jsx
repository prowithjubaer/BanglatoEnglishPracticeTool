import React, { useState, useEffect } from 'react';
import { StudentLayout } from '../../components/Layout';
import { api } from '../../utils/api';
import toast from 'react-hot-toast';

export default function Homework() {
  const [homeworks, setHomeworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePractice, setActivePractice] = useState(null);
  const [sentences, setSentences] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [hwStats, setHwStats] = useState({ correct: 0, wrong: 0, total: 0 });

  useEffect(() => {
    api.getStudentHomework().then(setHomeworks).catch(console.error).finally(() => setLoading(false));
  }, []);

  const startHomework = async (hw) => {
    try {
      const sents = await api.getHomeworkSentences(hw.homework_id);
      setSentences(sents);
      setActivePractice(hw);
      setCurrentIdx(0);
      setHwStats({ correct: 0, wrong: 0, total: sents.length });
    } catch (err) {
      toast.error('Failed to load homework');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!answer.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.submitAnswer({ sentence_id: sentences[currentIdx].id, answer: answer.trim() });
      setResult(res);
      if (res.is_correct) setHwStats(p => ({...p, correct: p.correct + 1}));
      else setHwStats(p => ({...p, wrong: p.wrong + 1}));
    } catch (err) {
      toast.error('Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const nextQuestion = async () => {
    if (currentIdx + 1 >= sentences.length) {
      // Complete homework
      try {
        await api.completeHomework(activePractice.homework_id, {
          score: hwStats.correct * 5,
          total_questions: hwStats.total,
          correct_answers: hwStats.correct,
        });
        toast.success('Homework completed! 🎉');
      } catch (err) {}
      setActivePractice(null);
      setSentences([]);
      // Refresh list
      const updated = await api.getStudentHomework();
      setHomeworks(updated);
      return;
    }
    setCurrentIdx(p => p + 1);
    setAnswer('');
    setResult(null);
  };

  if (loading) return <StudentLayout><div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-brand-red border-t-transparent rounded-full"></div></div></StudentLayout>;

  // Active practice mode
  if (activePractice && sentences.length > 0) {
    const current = sentences[currentIdx];
    return (
      <StudentLayout>
        <div className="max-w-2xl mx-auto">
          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>{activePractice.title}</span>
              <span>{currentIdx + 1} / {sentences.length}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-brand-red h-2 rounded-full transition-all" style={{width: `${((currentIdx + 1) / sentences.length) * 100}%`}}></div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b">
              <p className="text-xs text-gray-500 mb-2">HOMEWORK - Translate to English</p>
              <p className="text-xl font-bangla text-brand-navy font-semibold">{current.bangla_sentence}</p>
            </div>
            <div className="p-6">
              {!result ? (
                <form onSubmit={handleSubmit}>
                  <input type="text" value={answer} onChange={e => setAnswer(e.target.value)}
                    placeholder="Type your English translation..." className="input-field text-lg mb-4" autoFocus />
                  <button type="submit" disabled={!answer.trim() || submitting} className="btn-primary w-full disabled:opacity-50">
                    {submitting ? 'Checking...' : 'Submit'}
                  </button>
                </form>
              ) : (
                <div>
                  <div className={`rounded-xl p-4 mb-4 ${result.is_correct ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <p className="font-bold text-lg">{result.is_correct ? '✅ Correct!' : '❌ Wrong'}</p>
                    <p className="font-bangla text-sm mt-1">{result.feedback}</p>
                    {!result.is_correct && result.correct_answers && (
                      <div className="mt-2">
                        {result.correct_answers.map((a, i) => <p key={i} className="text-green-700 text-sm">✓ {a}</p>)}
                      </div>
                    )}
                  </div>
                  {result.advanced_version && (
                    <div className="bg-purple-50 rounded-lg p-3 mb-4">
                      <p className="text-xs text-purple-600 mb-1">🌟 Advanced:</p>
                      <p className="text-purple-800 text-sm font-medium">{result.advanced_version}</p>
                    </div>
                  )}
                  <button onClick={nextQuestion} className="btn-primary w-full">
                    {currentIdx + 1 >= sentences.length ? 'Complete Homework ✓' : 'Next →'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-center gap-4 mt-4 text-sm">
            <span className="text-green-600">✅ {hwStats.correct}</span>
            <span className="text-red-500">❌ {hwStats.wrong}</span>
          </div>
        </div>
      </StudentLayout>
    );
  }

  // Homework list
  const pending = homeworks.filter(h => h.status === 'assigned' || h.status === 'in_progress');
  const completed = homeworks.filter(h => h.status === 'completed');

  return (
    <StudentLayout>
      <h1 className="text-2xl font-bold text-brand-navy mb-6">📝 My Homework</h1>

      {pending.length === 0 && completed.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📚</div>
          <p className="text-gray-500">No homework assigned yet.</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-brand-navy mb-3">Pending</h2>
              <div className="space-y-3">
                {pending.map(hw => (
                  <div key={hw.homework_id} className="card flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-brand-navy">{hw.title}</p>
                      <p className="text-xs text-gray-500">{hw.total_sentences} sentences | Due: {hw.due_date || 'No deadline'}</p>
                      {hw.category_name && <span className="text-xs text-blue-600">{hw.category_name}</span>}
                    </div>
                    <button onClick={() => startHomework(hw)} className="btn-primary text-sm py-2 px-4">
                      {hw.status === 'in_progress' ? 'Continue' : 'Start'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-brand-navy mb-3">Completed</h2>
              <div className="space-y-2">
                {completed.map(hw => (
                  <div key={hw.homework_id} className="card flex items-center justify-between opacity-80">
                    <div>
                      <p className="font-medium text-gray-700">{hw.title}</p>
                      <p className="text-xs text-gray-500">Score: {hw.correct_answers}/{hw.total_questions} | Accuracy: {hw.accuracy}%</p>
                    </div>
                    <span className="text-green-600 text-sm font-medium">✓ Done</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </StudentLayout>
  );
}
