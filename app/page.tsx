'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [siteUrl, setSiteUrl] = useState('');
  const [competitorUrl, setCompetitorUrl] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, competitorUrl: competitorUrl || undefined, keyword: keyword || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start analysis');
      }

      const { id } = await res.json();
      router.push(`/analysis/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-20">
      <div className="text-center mb-10">
        <h1 className="text-2xl font-bold text-brand-charcoal mb-3">
          Therapist Website Analyzer
        </h1>
        <p className="text-gray-500 text-sm">
          Analyze any therapist website for SEO performance, technical health, and HIPAA compliance risks.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-10 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Target Website URL <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            placeholder="https://example-therapy.com"
            required
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-brand-sky focus:border-brand-sky outline-none transition-shadow"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Competitor URL <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="url"
            value={competitorUrl}
            onChange={(e) => setCompetitorUrl(e.target.value)}
            placeholder="https://top-ranking-competitor.com"
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-brand-sky focus:border-brand-sky outline-none transition-shadow"
          />
          <p className="text-xs text-gray-400 mt-1.5">
            Provide a top-ranking competitor to enable side-by-side SEO comparison.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Target Keyword <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder='e.g. "anxiety therapist Columbus OH"'
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-brand-sky focus:border-brand-sky outline-none transition-shadow"
          />
        </div>

        {error && (
          <div className="bg-brand-rose-light/30 text-brand-rose-dark text-sm rounded-md px-4 py-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-charcoal-light text-white font-medium py-3.5 rounded-md hover:bg-brand-charcoal disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
        >
          {loading ? 'Starting Analysis...' : 'Run Analysis'}
        </button>
      </form>
    </div>
  );
}
