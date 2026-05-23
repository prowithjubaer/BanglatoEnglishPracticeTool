import React, { useState, useEffect } from 'react';
import { StudentLayout } from '../../components/Layout';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function Leaderboard() {
  const [data, setData] = useState({ enabled: false, users: [] });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    api.getLeaderboard().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <StudentLayout><div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-brand-red border-t-transparent rounded-full"></div></div></StudentLayout>;

  if (!data.enabled) {
    return (
      <StudentLayout>
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🏆</div>
          <p className="text-gray-500">Leaderboard is currently disabled.</p>
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <h1 className="text-2xl font-bold text-brand-navy mb-6">🏆 Leaderboard</h1>

      <div className="max-w-2xl mx-auto">
        {/* Top 3 */}
        {data.users.length >= 3 && (
          <div className="flex items-end justify-center gap-4 mb-8">
            {[1, 0, 2].map(idx => {
              const u = data.users[idx];
              if (!u) return null;
              const rank = idx === 0 ? 2 : idx === 1 ? 1 : 3;
              const heights = { 1: 'h-28', 2: 'h-20', 3: 'h-16' };
              const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
              return (
                <div key={u.id} className="flex flex-col items-center">
                  <div className="w-12 h-12 bg-brand-navy rounded-full flex items-center justify-center text-white font-bold mb-2">
                    {u.name[0]?.toUpperCase()}
                  </div>
                  <p className="text-xs font-medium text-gray-700 mb-1 max-w-[80px] truncate">{u.name}</p>
                  <p className="text-lg">{medals[rank]}</p>
                  <div className={`w-20 ${heights[rank]} bg-gradient-to-t from-brand-red to-pink-400 rounded-t-lg flex items-center justify-center`}>
                    <span className="text-white font-bold text-sm">{u.total_xp} XP</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Full list */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="divide-y">
            {data.users.map((u, idx) => (
              <div key={u.id} className={`flex items-center gap-4 px-4 py-3 ${u.id === user?.id ? 'bg-brand-red/5' : ''}`}>
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                  idx === 1 ? 'bg-gray-100 text-gray-600' :
                  idx === 2 ? 'bg-amber-100 text-amber-700' : 'bg-gray-50 text-gray-500'
                }`}>
                  {idx + 1}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-brand-navy text-sm">
                    {u.name} {u.id === user?.id && <span className="text-xs text-brand-red">(You)</span>}
                  </p>
                  <p className="text-xs text-gray-500">{u.level_badge} {u.level_name} | 🔥 {u.streak} streak | {u.mastered_count} mastered</p>
                </div>
                <span className="font-bold text-brand-navy">{u.total_xp} <span className="text-xs text-gray-400">XP</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}
