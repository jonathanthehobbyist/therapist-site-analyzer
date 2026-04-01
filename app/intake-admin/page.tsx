'use client';

import { useState, useEffect } from 'react';

interface Submission {
  id: string;
  createdAt: string;
  siteUrl: string;
  email: string;
  status: string;
  ipAddress: string;
  analysisId: string | null;
}

export default function IntakeAdminPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/intake/admin')
      .then((r) => r.json())
      .then((data) => { setSubmissions(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleAction(id: string, action: 'approve' | 'reject') {
    setActing(id);
    const res = await fetch('/api/intake/admin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    const data = await res.json();

    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, status: action === 'approve' ? 'approved' : 'rejected', analysisId: data.analysisId || s.analysisId }
          : s
      )
    );
    setActing(null);
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 text-center">
        <p className="text-gray-400">Loading submissions...</p>
      </div>
    );
  }

  const pending = submissions.filter((s) => s.status === 'pending');
  const handled = submissions.filter((s) => s.status !== 'pending');

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-brand-charcoal-light mb-8">Intake Submissions</h1>

      {submissions.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-16 text-center">
          <p className="text-gray-400">No submissions yet.</p>
        </div>
      ) : (
        <>
          {/* Pending */}
          {pending.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-brand-charcoal mb-3">Pending Review ({pending.length})</h2>
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-5 py-3.5 font-medium text-gray-500 text-xs">Website</th>
                      <th className="text-left px-5 py-3.5 font-medium text-gray-500 text-xs">Email</th>
                      <th className="text-left px-5 py-3.5 font-medium text-gray-500 text-xs">Submitted</th>
                      <th className="px-5 py-3.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pending.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-5 py-4">
                          <a href={s.siteUrl} target="_blank" rel="noopener noreferrer" className="text-brand-sky hover:text-brand-sky-vivid transition-colors">
                            {s.siteUrl.replace(/^https?:\/\//, '')}
                          </a>
                        </td>
                        <td className="px-5 py-4 text-brand-charcoal">{s.email}</td>
                        <td className="px-5 py-4 text-brand-charcoal">
                          {new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleAction(s.id, 'approve')}
                              disabled={acting === s.id}
                              className="px-3 py-1.5 text-xs font-medium bg-brand-sage-dark text-white rounded-md hover:bg-brand-charcoal transition-colors disabled:opacity-50"
                            >
                              {acting === s.id ? '...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => handleAction(s.id, 'reject')}
                              disabled={acting === s.id}
                              className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-brand-rose transition-colors disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Handled */}
          {handled.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-brand-charcoal mb-3">Previous ({handled.length})</h2>
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-5 py-3.5 font-medium text-gray-500 text-xs">Website</th>
                      <th className="text-left px-5 py-3.5 font-medium text-gray-500 text-xs">Email</th>
                      <th className="text-left px-5 py-3.5 font-medium text-gray-500 text-xs">Submitted</th>
                      <th className="text-left px-5 py-3.5 font-medium text-gray-500 text-xs">Status</th>
                      <th className="px-5 py-3.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {handled.map((s) => (
                      <tr key={s.id} className={s.status === 'rejected' ? 'opacity-50' : ''}>
                        <td className="px-5 py-4 text-brand-charcoal">{s.siteUrl.replace(/^https?:\/\//, '')}</td>
                        <td className="px-5 py-4 text-brand-charcoal">{s.email}</td>
                        <td className="px-5 py-4 text-brand-charcoal">
                          {new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-xs font-medium capitalize ${s.status === 'approved' ? 'text-brand-sage-dark' : 'text-gray-400'}`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {s.analysisId && (
                            <a href={`/analysis/${s.analysisId}`} className="text-sm text-brand-sky hover:text-brand-sky-vivid transition-colors">
                              View Analysis
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
