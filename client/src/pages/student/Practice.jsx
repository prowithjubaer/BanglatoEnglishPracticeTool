import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StudentLayout } from '../../components/Layout';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const MISTAKE_LABELS = {
  tense_mistake: 'Tense Mistake',
  verb_form_mistake: 'Verb Form Mistake',
  subject_verb_agreement: 'Subject-Verb Agreement',
  article_mistake: 'Article Mistake',
  preposition_mistake: 'Preposition Mistake',
  word_order_mistake: 'Word Order Mistake',
  missing_word: 'Missing Word',
  extra_word: 'Extra Word',
  spelling_mistake: 'Spelling Mistake',
  meaning_changed: 'Meaning Changed',
  capitalization_punctuation_only: 'Capitalization/Punctuation Only',
  forbidden_word_used: 'Forbidden Word Used',
  other: 'Other',
};

export default function Practice() {
  const [searchParams] = useSearchParams();
  const { refreshUser } = useAuth();
  const [sentence, setSentence] = useState(null);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hint, setHint] = useState('');
  const [completed, setCompleted] = useState(false);
  const [premiumLocked, setPremiumLocked] = useState(false);
  const [reviewRequesting, setReviewRequesting] = useState(false);
  const [sessionStats, setSessionStats] = useState({ correct: 0, almost: 0, wrong: 0, xp: 0 });
  const inputRef = useRef(null);

  const mode = searchParams.get('mode') || '';
  const categoryId = searchParams.get('category_id') || '';
  const subcategoryId = searchParams.get('subcategory_id') || '';

  const loadNext = async () => {
    setLoading(true);
    setResult(null);
    setAnswer('');
    setShowHint(false);
    setHint('');
    try {
      const params = {};
      if (mode) params.mode = mode;
      if (categoryId) params.category_id = categoryId;
      if (subcategoryId) params.subcategory_id = subcategoryId;
      const data = await api.getNextSentence(params);
      if (data.completed) { setCompleted(true); setSentence(null); }
      else if (data.premium_locked) { setPremiumLocked(true); setSentence(null); }
      else { setSentence(data); setCompleted(false); setPremiumLocked(false); setTimeout(() => inputRef.current?.focus(), 100); }
    } catch (err) { toast.error('Failed to load sentence'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadNext(); }, [mode, categoryId, subcategoryId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!answer.trim() || !sentence) return;
    setSubmitting(true);
    try {
      const res = await api.submitAnswer({ sentence_id: sentence.id, answer: answer.trim() });
      setResult(res);
      if (res.result_type === 'correct') setSessionStats(p => ({ ...p, correct: p.correct + 1, xp: p.xp + (res.xp_earned || 0) }));
      else if (res.result_type === 'almost_correct') setSessionStats(p => ({ ...p, almost: p.almost + 1, xp: p.xp + (res.xp_earned || 0) }));
      else setSessionStats(p => ({ ...p, wrong: p.wrong + 1 }));
      refreshUser();
    } catch (err) { toast.error('Failed to submit'); }
    finally { setSubmitting(false); }
  };

  const handleHint = async () => {
    if (!sentence) return;
    try { const data = await api.getHint(sentence.id); setHint(data.hint); setShowHint(true); }
    catch (err) { toast.error('Failed to load hint'); }
  };

  const handleReviewRequest = async () => {
    if (!result?.submission_id) return;
    setReviewRequesting(true);
    try {
      await api.requestReview({ submission_id: result.submission_id });
      toast.success('Review request sent to teacher!');
    } catch (err) { toast.error(err.message || 'Failed to request review'); }
    finally { setReviewRequesting(false); }
  };

  if (loading) return <StudentLayout><div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-brand-red border-t-transparent rounded-full"></div></div></StudentLayout>;

  if (premiumLocked) return (
    <StudentLayout>
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-2xl font-bold text-brand-navy mb-3">Premium Content</h2>
        <p className="text-gray-600 mb-6 font-bangla">This practice set is for Premium students. Join Premium Batch to unlock guided practice, homework, correction and fluency tools.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="#" className="btn-primary">Join Premium</a>
          <a href="https://wa.me/+8801XXXXXXXXX" target="_blank" className="btn-outline flex items-center gap-2 justify-center">💬 WhatsApp</a>
        </div>
      </div>
    </StudentLayout>
  );

  if (completed) return (
    <StudentLayout>
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-brand-navy mb-3">All Done!</h2>
        <p className="text-gray-600 mb-2">No more sentences available right now.</p>
        <div className="bg-green-50 rounded-xl p-4 mb-6 inline-block">
          <p className="text-green-700 font-medium">Session: ✅ {sessionStats.correct} | 🟡 {sessionStats.almost} | ❌ {sessionStats.wrong} | ⭐ {sessionStats.xp} XP</p>
        </div>
        <div className="flex gap-3 justify-center">
          <a href="/dashboard" className="btn-primary">Back to Dashboard</a>
          <a href="/categories" className="btn-outline">Try Another Category</a>
        </div>
      </div>
    </StudentLayout>
  );

  return (
    <StudentLayout>
      {/* Session bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 text-sm flex-wrap">
          {sentence?.category_name && <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">{sentence.category_name}</span>}
          {sentence?.subcategory_name && <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">{sentence.subcategory_name}</span>}
          {sentence?.grammar_pattern && <span className="bg-purple-50 text-purple-600 px-2 py-1 rounded-full text-xs">{sentence.grammar_pattern}</span>}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-green-600">✅ {sessionStats.correct}</span>
          <span className="text-amber-500">🟡 {sessionStats.almost}</span>
          <span className="text-red-500">❌ {sessionStats.wrong}</span>
          <span className="text-amber-600">⭐ {sessionStats.xp}</span>
        </div>
      </div>

      {/* Practice Card */}
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Bangla Sentence */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b">
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Translate to English</p>
            <p className="text-xl md:text-2xl font-bangla text-brand-navy font-semibold leading-relaxed">{sentence?.bangla_sentence}</p>
            {sentence?.difficulty && (
              <span className={`inline-block mt-3 text-xs px-2 py-0.5 rounded-full ${sentence.difficulty === 'Easy' ? 'bg-green-100 text-green-700' : sentence.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{sentence.difficulty}</span>
            )}
          </div>

          {/* Answer & Result */}
          <div className="p-6">
            {!result ? (
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <input ref={inputRef} type="text" value={answer} onChange={e => setAnswer(e.target.value)}
                    placeholder="Type your English translation here..." className="input-field text-lg" disabled={submitting} autoComplete="off" />
                </div>
                {showHint && hint && (
                  <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm text-amber-800">💡 <strong>Hint:</strong> {hint}</p>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <button type="submit" disabled={!answer.trim() || submitting} className="btn-primary flex-1 disabled:opacity-50">
                    {submitting ? 'Checking...' : 'Submit Answer'}
                  </button>
                  {sentence?.show_hint && !showHint && (
                    <button type="button" onClick={handleHint} className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">💡 Hint</button>
                  )}
                </div>
              </form>
            ) : (
              <ResultDisplay result={result} onNext={loadNext} onReviewRequest={handleReviewRequest} reviewRequesting={reviewRequesting} />
            )}
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}

// ============================================
// RESULT DISPLAY COMPONENT (3-tier)
// ============================================
function ResultDisplay({ result, onNext, onReviewRequest, reviewRequesting }) {
  const isCorrect = result.result_type === 'correct';
  const isAlmost = result.result_type === 'almost_correct';
  const isWrong = result.result_type === 'wrong';

  return (
    <div>
      {/* Result Banner */}
      {isCorrect && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">✅</span>
            <h3 className="text-lg font-bold text-green-700">Correct!</h3>
            {result.xp_earned > 0 && <span className="ml-auto bg-green-200 text-green-800 px-2 py-0.5 rounded-full text-sm font-bold">+{result.xp_earned} XP</span>}
          </div>
          <p className="text-green-700 font-bangla">{result.feedback}</p>
          {result.mastered && <p className="mt-2 text-green-600 font-medium">🏆 You've mastered this sentence!</p>}
        </div>
      )}

      {isAlmost && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🟡</span>
            <h3 className="text-lg font-bold text-amber-700">Almost Correct!</h3>
            {result.xp_earned > 0 && <span className="ml-auto bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full text-sm font-bold">+{result.xp_earned} XP</span>}
          </div>
          <p className="text-amber-700 font-bangla mb-3">{result.feedback}</p>
          
          {/* Student's answer vs closest correct */}
          <div className="bg-white rounded-lg p-3 mb-2">
            <p className="text-xs text-gray-500 mb-1">Your answer:</p>
            <p className="text-amber-700">{result.submitted_answer}</p>
          </div>
          {result.closest_correct && (
            <div className="bg-white rounded-lg p-3 mb-2">
              <p className="text-xs text-gray-500 mb-1">Closest correct format:</p>
              <p className="text-green-700 font-medium">✓ {result.closest_correct}</p>
            </div>
          )}

          {/* Similarity score */}
          {result.similarity_score !== undefined && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-gray-500">Similarity:</span>
              <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-32">
                <div className="bg-amber-500 h-2 rounded-full" style={{width: `${result.similarity_score}%`}}></div>
              </div>
              <span className="text-xs font-bold text-amber-600">{result.similarity_score}%</span>
            </div>
          )}
        </div>
      )}

      {isWrong && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">❌</span>
            <h3 className="text-lg font-bold text-red-700">Not Correct</h3>
          </div>
          <p className="text-red-700 font-bangla mb-3">{result.feedback}</p>
          
          <div className="bg-white rounded-lg p-3 mb-3">
            <p className="text-xs text-gray-500 mb-1">Your answer:</p>
            <p className="text-red-600 line-through">{result.submitted_answer}</p>
          </div>

          {result.correct_answers && (
            <div className="bg-white rounded-lg p-3 mb-3">
              <p className="text-xs text-gray-500 mb-1">Correct formats:</p>
              {result.correct_answers.map((a, i) => <p key={i} className="text-green-700 font-medium">✓ {a}</p>)}
            </div>
          )}

          {result.similarity_score !== undefined && result.similarity_score > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-gray-500">Similarity:</span>
              <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-32">
                <div className="bg-red-400 h-2 rounded-full" style={{width: `${result.similarity_score}%`}}></div>
              </div>
              <span className="text-xs font-bold text-red-500">{result.similarity_score}%</span>
            </div>
          )}
        </div>
      )}

      {/* Mistake Types */}
      {result.mistake_types && result.mistake_types.length > 0 && !isCorrect && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
          <p className="text-xs text-orange-700 font-medium mb-1">আপনার ভুলের ধরন:</p>
          <div className="flex flex-wrap gap-1.5">
            {result.mistake_types.map((mt, i) => (
              <span key={i} className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">
                {MISTAKE_LABELS[mt] || mt}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Missing/Forbidden words */}
      {result.missing_words && result.missing_words.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <p className="text-xs text-yellow-700 font-medium mb-1">Missing required words:</p>
          <div className="flex flex-wrap gap-1.5">
            {result.missing_words.map((w, i) => <span key={i} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-medium">{w}</span>)}
          </div>
        </div>
      )}
      {result.forbidden_words_used && result.forbidden_words_used.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-xs text-red-700 font-medium mb-1">Forbidden words used:</p>
          <div className="flex flex-wrap gap-1.5">
            {result.forbidden_words_used.map((w, i) => <span key={i} className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-medium">{w}</span>)}
          </div>
        </div>
      )}

      {/* Advanced Version */}
      {result.advanced_version && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
          <p className="text-xs text-purple-600 mb-1 font-medium">🌟 Advanced Version:</p>
          <p className="text-purple-800 font-medium">{result.advanced_version}</p>
        </div>
      )}

      {/* Explanation */}
      {result.explanation && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-xs text-blue-600 mb-1 font-medium">📖 Explanation:</p>
          <p className="text-blue-800 text-sm">{result.explanation}</p>
        </div>
      )}

      {/* Review note */}
      {result.review_note && <p className="text-xs text-gray-500 mb-4 italic">{result.review_note}</p>}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button onClick={onNext} className="btn-primary flex-1">Next Sentence →</button>
        
        {/* Teacher Review Request Button */}
        {result.review_request_enabled && !isCorrect && (
          <button onClick={onReviewRequest} disabled={reviewRequesting}
            className="px-4 py-2.5 border border-blue-200 rounded-lg text-sm text-blue-600 hover:bg-blue-50 disabled:opacity-50 whitespace-nowrap">
            {reviewRequesting ? '...' : '📩 স্যার, চেক করুন'}
          </button>
        )}
      </div>
    </div>
  );
}
