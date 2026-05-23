import React, { useState } from 'react';
import { AdminLayout } from '../../components/Layout';
import { api } from '../../utils/api';
import toast from 'react-hot-toast';

export default function Upload() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const handleUpload = async () => {
    if (!file) { toast.error('Select a file'); return; }
    setUploading(true);
    setResult(null);
    try {
      const data = await api.uploadFile(file);
      setResult(data);
      if (data.imported > 0) toast.success(`Imported ${data.imported} sentences!`);
      else toast.error('No sentences imported');
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await api.exportSentences();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sentences_export.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Exported');
    } catch (err) { toast.error('Export failed'); }
  };

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-brand-navy mb-6">📤 Upload / Export Sentences</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload */}
        <div className="card">
          <h2 className="text-lg font-semibold text-brand-navy mb-4">Import from CSV/XLSX</h2>
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center mb-4">
            <input type="file" accept=".csv,.xlsx,.xls" onChange={e => setFile(e.target.files[0])}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-red/10 file:text-brand-red hover:file:bg-brand-red/20" />
            {file && <p className="mt-2 text-sm text-gray-600">Selected: {file.name}</p>}
          </div>
          <button onClick={handleUpload} disabled={!file || uploading} className="btn-primary w-full disabled:opacity-50">
            {uploading ? 'Uploading...' : 'Upload & Import'}
          </button>

          {result && (
            <div className="mt-4 p-4 rounded-lg bg-gray-50">
              <p className="font-medium text-brand-navy">Import Result:</p>
              <p className="text-sm text-green-600">✓ Imported: {result.imported} / {result.total}</p>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-red-600 font-medium">Errors:</p>
                  <ul className="text-xs text-red-500 max-h-32 overflow-y-auto">
                    {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Export */}
        <div className="card">
          <h2 className="text-lg font-semibold text-brand-navy mb-4">Export Sentences</h2>
          <p className="text-sm text-gray-600 mb-4">Download all sentences as a CSV file. You can edit and re-upload.</p>
          <button onClick={handleExport} className="btn-outline w-full">📥 Export All Sentences (CSV)</button>

          <div className="mt-6 bg-blue-50 rounded-lg p-4">
            <h3 className="font-medium text-blue-800 mb-2">📋 CSV Format</h3>
            <p className="text-xs text-blue-700 mb-2">Required columns for upload:</p>
            <code className="text-xs bg-white rounded p-2 block overflow-x-auto text-gray-700">
              bangla_sentence, correct_answer_1, correct_answer_2, correct_answer_3, correct_answer_4, correct_answer_5, advanced_version, explanation, hint, category, subcategory, difficulty, is_premium, is_active, checking_mode, tags
            </code>
            <p className="text-xs text-blue-600 mt-2">
              <strong>Note:</strong> Only bangla_sentence and at least one correct_answer are required. Others are optional.
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
