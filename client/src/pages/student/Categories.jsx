import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { StudentLayout } from '../../components/Layout';
import { api } from '../../utils/api';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleSelectCategory = async (cat) => {
    setSelectedCat(cat);
    try {
      const subs = await api.getSubcategories(cat.id);
      setSubcategories(subs);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <StudentLayout><div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-brand-red border-t-transparent rounded-full"></div></div></StudentLayout>;

  return (
    <StudentLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-navy">Practice by Category</h1>
        <p className="text-gray-500 text-sm mt-1">Choose a tense or topic to practice</p>
      </div>

      {!selectedCat ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(cat => (
            <button key={cat.id} onClick={() => handleSelectCategory(cat)}
              className="card text-left hover:border-brand-red/30 transition-all group">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">{cat.icon}</span>
                <div>
                  <h3 className="font-semibold text-brand-navy group-hover:text-brand-red transition-colors">{cat.name}</h3>
                  <p className="text-xs text-gray-500">{cat.sentence_count} sentences</p>
                </div>
              </div>
              {cat.is_premium === 1 && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Premium</span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div>
          <button onClick={() => { setSelectedCat(null); setSubcategories([]); }}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-brand-red mb-4">
            ← Back to Categories
          </button>

          <div className="card mb-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{selectedCat.icon}</span>
              <div>
                <h2 className="text-xl font-bold text-brand-navy">{selectedCat.name}</h2>
                <p className="text-sm text-gray-500">{selectedCat.description}</p>
              </div>
            </div>
          </div>

          {/* Start all practice */}
          <Link to={`/practice?category_id=${selectedCat.id}`}
            className="card flex items-center gap-3 mb-4 border-brand-red/20 bg-red-50/50 hover:bg-red-50">
            <div className="w-10 h-10 bg-brand-red/10 rounded-lg flex items-center justify-center">✍️</div>
            <div>
              <p className="font-semibold text-brand-navy">Start All Practice</p>
              <p className="text-xs text-gray-500">Practice all sentences in this category</p>
            </div>
          </Link>

          {/* Subcategories */}
          <h3 className="text-lg font-semibold text-brand-navy mb-3">Sub-categories</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {subcategories.map(sub => (
              <Link key={sub.id} to={`/practice?category_id=${selectedCat.id}&subcategory_id=${sub.id}`}
                className="card hover:border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-brand-navy">{sub.name}</p>
                    <p className="text-xs text-gray-500">{sub.sentence_count} sentences | {sub.difficulty}</p>
                  </div>
                  {sub.is_premium === 1 && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">🔒</span>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </StudentLayout>
  );
}
