import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/Layout';
import { api } from '../../utils/api';
import toast from 'react-hot-toast';

export default function Settings() {
  const [settings, setSettings] = useState([]);
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('settings');

  useEffect(() => {
    Promise.all([api.getSettings(), api.getLevels()])
      .then(([s, l]) => { setSettings(s); setLevels(l); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSaveSettings = async () => {
    try {
      await api.updateSettings({ settings: settings.map(s => ({ key: s.key, value: s.value })) });
      toast.success('Settings saved');
    } catch (err) { toast.error(err.message); }
  };

  const handleSaveLevels = async () => {
    try {
      await api.updateLevels({ levels });
      toast.success('Levels saved');
    } catch (err) { toast.error(err.message); }
  };

  const updateSetting = (key, value) => {
    setSettings(s => s.map(x => x.key === key ? {...x, value} : x));
  };

  if (loading) return <AdminLayout><div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-brand-red border-t-transparent rounded-full"></div></div></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-brand-navy mb-6">⚙️ Settings</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        <button onClick={() => setTab('settings')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'settings' ? 'border-brand-red text-brand-red' : 'border-transparent text-gray-500'}`}>General Settings</button>
        <button onClick={() => setTab('levels')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'levels' ? 'border-brand-red text-brand-red' : 'border-transparent text-gray-500'}`}>Levels & XP</button>
      </div>

      {tab === 'settings' && (
        <div className="card">
          <div className="space-y-4">
            {settings.map(s => (
              <div key={s.key} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-sm text-brand-navy">{s.key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
                  <p className="text-xs text-gray-400">{s.description}</p>
                </div>
                <input type="text" value={s.value} onChange={e => updateSetting(s.key, e.target.value)}
                  className="input-field max-w-xs text-sm text-right" />
              </div>
            ))}
          </div>
          <button onClick={handleSaveSettings} className="btn-primary mt-6">Save Settings</button>
        </div>
      )}

      {tab === 'levels' && (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Level</th>
                  <th className="text-left py-2 px-3">Name</th>
                  <th className="text-left py-2 px-3">Min XP</th>
                  <th className="text-left py-2 px-3">Max XP</th>
                  <th className="text-left py-2 px-3">Badge</th>
                </tr>
              </thead>
              <tbody>
                {levels.map((l, idx) => (
                  <tr key={l.id} className="border-b">
                    <td className="py-2 px-3 font-bold">{l.level_number}</td>
                    <td className="py-2 px-3">
                      <input type="text" value={l.name} onChange={e => { const upd = [...levels]; upd[idx].name = e.target.value; setLevels(upd); }} className="input-field text-sm py-1" />
                    </td>
                    <td className="py-2 px-3">
                      <input type="number" value={l.min_xp} onChange={e => { const upd = [...levels]; upd[idx].min_xp = parseInt(e.target.value); setLevels(upd); }} className="input-field text-sm py-1 w-24" />
                    </td>
                    <td className="py-2 px-3">
                      <input type="number" value={l.max_xp} onChange={e => { const upd = [...levels]; upd[idx].max_xp = parseInt(e.target.value); setLevels(upd); }} className="input-field text-sm py-1 w-24" />
                    </td>
                    <td className="py-2 px-3">
                      <input type="text" value={l.badge} onChange={e => { const upd = [...levels]; upd[idx].badge = e.target.value; setLevels(upd); }} className="input-field text-sm py-1 w-16" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={handleSaveLevels} className="btn-primary mt-6">Save Levels</button>
        </div>
      )}
    </AdminLayout>
  );
}
