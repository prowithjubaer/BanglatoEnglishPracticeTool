import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/Layout';
import { api } from '../../utils/api';
import toast from 'react-hot-toast';

export default function Students() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [report, setReport] = useState(null);

  useEffect(() => {
    api.getStudents().then(setStudents).catch(console.error).finally(() => setLoading(false));
  }, []);

  const viewReport = async (student) => {
    try {
      const data = await api.getStudentReport(student.id);
      setReport(data);
      setSelectedStudent(student);
    } catch (err) { toast.error('Failed to load report'); }
  };

  const handleReset = async (id) => {
    if (!confirm('Reset all progress for this student? This cannot be undone.')) return;
    try {
      await api.resetStudent(id);
      toast.success('Progress reset');
      const updated = await api.getStudents();
      setStudents(updated);
      setSelectedStudent(null);
      setReport(null);
    } catch (err) { toast.error(err.message); }
  };

  const handleExport = async () => {
    try {
      const blob = await api.exportStudents();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'students_export.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Exported');
    } catch (err) { toast.error('Export failed'); }
  };

  if (loading) return <AdminLayout><div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-brand-red border-t-transparent rounded-full"></div></div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-brand-navy">Students ({students.length})</h1>
        <button onClick={handleExport} className="btn-outline text-sm">📤 Export CSV</button>
      </div>

      {!selectedStudent ? (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Student</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">XP</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Level</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Streak</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Accuracy</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Mastered</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Last Active</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {students.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-gray-400">{s.email}</p>
                    </td>
                    <td className="px-4 py-3 font-bold">{s.total_xp}</td>
                    <td className="px-4 py-3">{s.level}</td>
                    <td className="px-4 py-3">🔥 {s.streak}</td>
                    <td className="px-4 py-3"><span className={s.accuracy >= 70 ? 'text-green-600' : 'text-red-600'}>{s.accuracy}%</span></td>
                    <td className="px-4 py-3">{s.mastered || 0}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{s.last_active_at ? new Date(s.last_active_at).toLocaleDateString() : 'Never'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => viewReport(s)} className="text-blue-600 hover:underline text-xs mr-2">Report</button>
                      <button onClick={() => handleReset(s.id)} className="text-red-600 hover:underline text-xs">Reset</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          <button onClick={() => { setSelectedStudent(null); setReport(null); }} className="text-sm text-gray-600 hover:text-brand-red mb-4">← Back to all students</button>
          
          <div className="card mb-6">
            <h2 className="text-xl font-bold text-brand-navy">{report.student.name}</h2>
            <p className="text-sm text-gray-500">{report.student.email} | {report.student.phone || 'No phone'}</p>
            <div className="grid grid-cols-4 gap-4 mt-4">
              <div><p className="text-2xl font-bold">{report.student.total_xp}</p><p className="text-xs text-gray-500">Total XP</p></div>
              <div><p className="text-2xl font-bold">{report.student.level}</p><p className="text-xs text-gray-500">Level</p></div>
              <div><p className="text-2xl font-bold">{report.student.streak}</p><p className="text-xs text-gray-500">Streak</p></div>
              <div><p className="text-2xl font-bold">{report.student.premium_status ? 'Premium' : 'Free'}</p><p className="text-xs text-gray-500">Status</p></div>
            </div>
          </div>

          {report.categoryBreakdown.length > 0 && (
            <div className="card mb-6">
              <h3 className="font-semibold text-brand-navy mb-3">Category Breakdown</h3>
              <div className="space-y-2">
                {report.categoryBreakdown.map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm">{c.icon} {c.name}</span>
                    <div className="text-xs text-gray-500">
                      <span className="text-green-600 mr-2">✓{c.correct}</span>
                      <span className="text-red-500 mr-2">✗{c.wrong}</span>
                      <span className="text-purple-600">🏆{c.mastered}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.recentSubmissions.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-brand-navy mb-3">Recent Submissions</h3>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {report.recentSubmissions.slice(0, 20).map((sub, idx) => (
                  <div key={idx} className="flex items-center gap-3 py-1.5 border-b text-sm">
                    <span className={sub.is_correct ? 'text-green-600' : 'text-red-600'}>{sub.is_correct ? '✓' : '✗'}</span>
                    <span className="font-bangla truncate flex-1">{sub.bangla_sentence}</span>
                    <span className="text-xs text-gray-400">{new Date(sub.submitted_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
