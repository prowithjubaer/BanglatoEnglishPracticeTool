import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/Layout';
import { api } from '../../utils/api';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAdminDashboard().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <AdminLayout><div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-brand-red border-t-transparent rounded-full"></div></div></AdminLayout>;
  if (!data) return <AdminLayout><p>Failed to load</p></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-brand-navy mb-6">Admin Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <p className="text-sm text-gray-500">Total Students</p>
          <p className="text-2xl font-bold text-brand-navy">{data.totalStudents}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Active Today</p>
          <p className="text-2xl font-bold text-green-600">{data.activeToday}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Total Sentences</p>
          <p className="text-2xl font-bold text-blue-600">{data.totalSentences}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Active Sentences</p>
          <p className="text-2xl font-bold text-purple-600">{data.activeSentences}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Total Submissions</p>
          <p className="text-2xl font-bold text-brand-navy">{data.totalSubmissions}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Today's Submissions</p>
          <p className="text-2xl font-bold text-amber-600">{data.todaySubmissions}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Correct Rate</p>
          <p className="text-2xl font-bold text-green-600">{data.correctRate}%</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Active Homework</p>
          <p className="text-2xl font-bold text-brand-red">{data.totalHomework}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Difficult Sentences */}
        <div className="card">
          <h2 className="text-lg font-semibold text-brand-navy mb-4">🔴 Most Difficult Sentences</h2>
          {data.hardSentences.length === 0 ? <p className="text-gray-400 text-sm">No data yet</p> : (
            <div className="space-y-2">
              {data.hardSentences.slice(0, 7).map(s => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <p className="text-sm font-bangla text-gray-700 truncate max-w-[250px]">{s.bangla_sentence}</p>
                  <div className="text-right">
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{s.accuracy}%</span>
                    <p className="text-xs text-gray-400">{s.attempts} attempts</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="card">
          <h2 className="text-lg font-semibold text-brand-navy mb-4">📋 Recent Activity</h2>
          {data.recentActivity.length === 0 ? <p className="text-gray-400 text-sm">No activity yet</p> : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {data.recentActivity.map((a, idx) => (
                <div key={idx} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${a.is_correct ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {a.is_correct ? '✓' : '✗'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{a.name}</p>
                    <p className="text-xs text-gray-400 font-bangla truncate">{a.bangla_sentence}</p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{new Date(a.submitted_at).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
