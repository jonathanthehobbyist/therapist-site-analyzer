'use client';

import { useState, useEffect, useMemo } from 'react';

interface AnalysisSummary {
  id: string;
  createdAt: string;
  siteUrl: string;
  competitorUrl: string | null;
  status: string;
  seoComparisonScore: number | null;
  seoHygieneScore: number | null;
  hipaaRiskLevel: string | null;
  site: { label: string | null } | null;
  isPublic: boolean;
  shareViews: number;
}

const RISK_COLORS: Record<string, string> = {
  Low: 'bg-brand-sage-light text-brand-sage-dark',
  Moderate: 'bg-brand-gold-light text-brand-charcoal',
  High: 'bg-brand-rose-light text-brand-rose-dark',
};

export default function HistoryPage() {
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/analyses')
      .then((res) => res.json())
      .then((data) => {
        setAnalyses(data);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return analyses;
    const q = search.toLowerCase();
    return analyses.filter(
      (a) =>
        a.siteUrl.toLowerCase().includes(q) ||
        a.competitorUrl?.toLowerCase().includes(q) ||
        a.site?.label?.toLowerCase().includes(q)
    );
  }, [analyses, search]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 text-center">
        <p className="text-gray-400">Loading history...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8 gap-4">
        <h1 className="text-2xl font-bold text-brand-charcoal-light">Analysis History</h1>
        <input
          type="text"
          placeholder="Search by URL or label..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-sky w-72 transition-shadow"
        />
      </div>

      {analyses.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-16 text-center">
          <p className="text-gray-400">No analyses yet. Run your first one!</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-16 text-center">
          <p className="text-gray-400">No results matching &ldquo;{search}&rdquo;</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {search.trim() && (
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Showing {filtered.length} of {analyses.length} analyses
              </p>
              <button
                onClick={() => setSearch('')}
                className="text-xs text-brand-charcoal-light hover:text-brand-charcoal font-medium"
              >
                Clear filter
              </button>
            </div>
          )}
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3.5 font-medium text-gray-500 text-xs">Site</th>
                <th className="text-left px-5 py-3.5 font-medium text-gray-500 text-xs">Date</th>
                <th className="text-left px-5 py-3.5 font-medium text-gray-500 text-xs">SEO Score</th>
                <th className="text-left px-5 py-3.5 font-medium text-gray-500 text-xs">Hygiene</th>
                <th className="text-left px-5 py-3.5 font-medium text-gray-500 text-xs">HIPAA</th>
                <th className="text-left px-5 py-3.5 font-medium text-gray-500 text-xs">Opened</th>
                <th className="text-left px-5 py-3.5 font-medium text-gray-500 text-xs">Status</th>
                <th className="px-5 py-3.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium text-brand-charcoal">{a.siteUrl}</p>
                    {a.site?.label && (
                      <p className="text-xs text-gray-400 mt-0.5">{a.site.label}</p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-brand-charcoal">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4 text-brand-charcoal">
                    {a.seoComparisonScore !== null ? `${a.seoComparisonScore}/100` : '\u2014'}
                  </td>
                  <td className="px-5 py-4 text-brand-charcoal">
                    {a.seoHygieneScore !== null ? `${a.seoHygieneScore}/100` : '\u2014'}
                  </td>
                  <td className="px-5 py-4 text-brand-charcoal">
                    {a.hipaaRiskLevel || '\u2014'}
                  </td>
                  <td className="px-5 py-4 text-brand-charcoal">
                    {a.isPublic ? a.shareViews : 'Not shared'}
                  </td>
                  <td className="px-5 py-4 text-brand-charcoal capitalize">
                    {a.status}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <a href={`/analysis/${a.id}`} className="text-sm text-brand-sky hover:text-brand-sky-vivid transition-colors">
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
