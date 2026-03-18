'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface Analysis {
  id: string;
  createdAt: string;
  siteUrl: string;
  competitorUrl: string | null;
  keyword: string | null;
  seoComparisonScore: number | null;
  seoHygieneScore: number | null;
  hipaaRiskLevel: string | null;
  seoComparisonData: SeoComparisonData | null;
  seoHygieneData: SeoHygieneData | null;
  hipaaData: HipaaData | null;
  pagesScraped: string[] | null;
  loomUrl: string | null;
  seoSummary: string | null;
  keywordData: KeywordData | null;
  site: { label: string | null; url: string } | null;
}

interface KeywordData {
  siteKeywords: { keyword: string; frequency: number; foundIn: string[] }[];
  organicKeywords: { keyword: string; volume: number; position: number; traffic: number; difficulty: number }[];
  relatedKeywords?: { keyword: string; volume: number; difficulty: number; cpc: number }[];
}

interface SeoComparisonData {
  rows: { category: string; check: string; targetValue: string; competitorValue: string; status: string; explanation?: string }[];
}

interface SeoHygieneData {
  score: number;
  findings: { category: string; check: string; status: string; description: string; explanation?: string; fix: string | null; weight: number }[];
}

interface HipaaData {
  riskLevel: string;
  findings: { severity: string; check: string; description: string; pageUrl: string; whyRisk: string; recommendedFix: string }[];
}

const STATUS_ICON: Record<string, string> = {
  pass: 'text-brand-charcoal',
  fail: 'text-brand-rose',
  warning: 'text-brand-gold',
};

const SEVERITY_COLORS: Record<string, string> = {
  high: 'bg-brand-rose-light text-brand-rose-dark',
  medium: 'bg-brand-gold-light text-brand-charcoal',
  low: 'bg-brand-sky-light text-brand-charcoal-light',
  pass: 'bg-brand-sage-light text-brand-sage-dark',
};

const RISK_COLORS: Record<string, string> = {
  Low: 'bg-brand-sage-light text-brand-sage-dark',
  Moderate: 'bg-brand-gold-light text-brand-charcoal',
  High: 'bg-brand-rose-light text-brand-rose-dark',
};

function letterGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

const TABS = ['SEO Comparison', 'SEO Hygiene', 'HIPAA Audit', 'Keywords'] as const;
type Tab = typeof TABS[number];

function toLoomEmbed(url: string): string {
  // Convert https://www.loom.com/share/abc123 → https://www.loom.com/embed/abc123
  try {
    const u = new URL(url);
    if (u.hostname.includes('loom.com') && u.pathname.startsWith('/share/')) {
      return url.replace('/share/', '/embed/');
    }
  } catch {}
  return url;
}

export default function SharePage() {
  const params = useParams();
  const id = params.id as string;

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('SEO Hygiene');
  const [error, setError] = useState('');
  const [needsPasscode, setNeedsPasscode] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');

  function loadAnalysis() {
    fetch(`/api/share/${id}`)
      .then(async (res) => {
        if (res.status === 403) {
          const data = await res.json();
          if (data.requiresPasscode) {
            setNeedsPasscode(true);
            return;
          }
        }
        if (!res.ok) throw new Error('Report not found or not public');
        return res.json();
      })
      .then((data) => { if (data) setAnalysis(data); })
      .catch((err) => setError(err.message));
  }

  useEffect(() => { loadAnalysis(); }, [id]);

  async function submitPasscode(e: React.FormEvent) {
    e.preventDefault();
    setPasscodeError('');
    const res = await fetch(`/api/share/${id}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    });
    if (!res.ok) {
      setPasscodeError('Incorrect passcode');
      return;
    }
    setNeedsPasscode(false);
    loadAnalysis();
  }

  if (needsPasscode) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-0.5 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-sage" />
              <span className="w-2.5 h-2.5 rounded-full bg-brand-sky" />
              <span className="w-2.5 h-2.5 rounded-full bg-brand-gold" />
            </div>
            <h1 className="text-xl font-bold text-brand-charcoal">This report is protected</h1>
            <p className="text-sm text-gray-500 mt-1">Enter the passcode to view this analysis.</p>
          </div>
          <form onSubmit={submitPasscode} className="bg-white rounded-lg shadow-sm p-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Passcode</label>
              <input
                type="text"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                autoFocus
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-center tracking-widest focus:ring-2 focus:ring-brand-sky focus:border-brand-sky outline-none transition-shadow"
              />
            </div>
            {passcodeError && (
              <div className="bg-brand-rose-light/30 text-brand-rose-dark text-sm rounded-md px-4 py-3">
                {passcodeError}
              </div>
            )}
            <button
              type="submit"
              className="w-full bg-brand-charcoal-light text-white font-medium py-3 rounded-md hover:bg-brand-charcoal transition-colors text-sm"
            >
              View Report
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm p-14 text-center max-w-md">
          <p className="text-red-500 mb-4">{error}</p>
          <p className="text-sm text-gray-400">This report may not exist or is no longer shared.</p>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <p className="text-gray-400">Loading report...</p>
      </div>
    );
  }

  const practiceName = analysis.site?.label || new URL(analysis.siteUrl).hostname;
  const hasComparison = analysis.seoComparisonData !== null;

  if (!hasComparison && activeTab === 'SEO Comparison') {
    setActiveTab('SEO Hygiene');
  }

  function handleShareLogout() {
    document.cookie = `share-${id}=; path=/; max-age=0`;
    window.location.reload();
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Nav bar */}
      <nav className="bg-white px-6 py-3 fixed top-0 left-0 right-0 z-50" style={{ boxShadow: '0 2px 8px -2px rgba(0,0,0,0.08)' }}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-bold tracking-tight">
            <span className="flex items-center gap-0.5">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-sage" />
              <span className="w-2.5 h-2.5 rounded-full bg-brand-sky" />
              <span className="w-2.5 h-2.5 rounded-full bg-brand-gold" />
            </span>
            <span className="text-brand-charcoal">Practice Persona</span>
          </span>
          <button
            onClick={handleShareLogout}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Header with practice name */}
      <div className="bg-white shadow-sm px-8 py-5 mt-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-brand-charcoal-light">{practiceName}</h1>
            <p className="text-xs text-gray-400">Website Analysis Report</p>
          </div>
          <p className="text-xs text-gray-400">
            {new Date(analysis.createdAt).toLocaleDateString(undefined, {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Loom video */}
        {analysis.loomUrl && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
              <iframe
                src={toLoomEmbed(analysis.loomUrl)}
                allowFullScreen
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
              />
            </div>
          </div>
        )}

        {/* Summary */}
        {analysis.seoSummary && (
          <div className="bg-white rounded-lg shadow-sm p-8 mb-6">
            <h2 className="text-lg font-semibold text-brand-charcoal mb-3">Summary</h2>
            <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{analysis.seoSummary}</p>
          </div>
        )}

        {/* Tabs with scores */}
        <div className="flex gap-2 mb-0">
          {hasComparison && (
            <button
              onClick={() => setActiveTab('SEO Comparison')}
              className={`flex-1 px-8 py-6 text-center transition-all rounded-t-xl cursor-pointer ${
                activeTab === 'SEO Comparison'
                  ? 'bg-white shadow-sm'
                  : 'bg-transparent text-gray-400 hover:text-brand-charcoal hover:bg-white/30'
              }`}
            >
              {analysis.seoComparisonScore !== null && (
                <span className={`block text-3xl font-bold ${analysis.seoComparisonScore < 60 ? 'text-brand-red' : 'text-brand-orange'}`}>{analysis.seoComparisonScore}<span className="text-lg font-normal text-gray-400">/100</span></span>
              )}
              <span className="block text-sm font-semibold text-brand-charcoal mt-1">SEO Comparison</span>
              <span className="block text-xs text-gray-400 mt-0.5">SEO Score</span>
            </button>
          )}
          <button
            onClick={() => setActiveTab('SEO Hygiene')}
            className={`flex-1 px-8 py-6 text-center transition-all rounded-t-xl cursor-pointer ${
              activeTab === 'SEO Hygiene'
                ? 'bg-white shadow-sm'
                : 'bg-transparent text-gray-400 hover:text-brand-charcoal hover:bg-white/30'
            }`}
          >
            {analysis.seoHygieneScore !== null && (
              <span className={`block text-3xl font-bold ${analysis.seoHygieneScore < 60 ? 'text-brand-red' : 'text-brand-orange'}`}>{analysis.seoHygieneScore}<span className="text-lg font-normal text-gray-400">/100</span></span>
            )}
            <span className="block text-sm font-semibold text-brand-charcoal mt-1">SEO Hygiene</span>
            <span className="block text-xs text-gray-400 mt-0.5">SEO Score</span>
          </button>
          <button
            onClick={() => setActiveTab('HIPAA Audit')}
            className={`flex-1 px-8 py-6 text-center transition-all rounded-t-xl cursor-pointer ${
              activeTab === 'HIPAA Audit'
                ? 'bg-white shadow-sm'
                : 'bg-transparent text-gray-400 hover:text-brand-charcoal hover:bg-white/30'
            }`}
          >
            {analysis.hipaaRiskLevel && (
              <span className={`inline-block text-xl font-bold px-3 py-1 rounded-lg border-2 ${
                analysis.hipaaRiskLevel === 'High' ? 'text-brand-rose border-brand-rose-light' :
                analysis.hipaaRiskLevel === 'Moderate' ? 'text-brand-gold border-brand-gold-light' :
                'text-brand-sage border-brand-sage-light'
              }`}>{analysis.hipaaRiskLevel}</span>
            )}
            <span className="block text-sm font-semibold text-brand-charcoal mt-1">HIPAA Audit</span>
            <span className="block text-xs text-gray-400 mt-0.5">Compliance Risk Level</span>
          </button>
          <button
            onClick={() => setActiveTab('Keywords')}
            className={`flex-1 px-8 py-6 text-center transition-all rounded-t-xl cursor-pointer ${
              activeTab === 'Keywords'
                ? 'bg-white shadow-sm'
                : 'bg-transparent text-gray-400 hover:text-brand-charcoal hover:bg-white/30'
            }`}
          >
            {analysis.keywordData && (
              <span className="block text-3xl font-bold text-brand-charcoal">{analysis.keywordData.siteKeywords.length + analysis.keywordData.organicKeywords.length}</span>
            )}
            <span className="block text-sm font-semibold text-brand-charcoal mt-1">Keywords</span>
            <span className="block text-xs text-gray-400 mt-0.5">On-Site & Organic</span>
          </button>
        </div>

        {/* Tab content */}
        <div className="bg-white rounded-b-2xl shadow-sm">
          {activeTab === 'SEO Comparison' && analysis.seoComparisonData && (
            <ComparisonTab data={analysis.seoComparisonData} />
          )}
          {activeTab === 'SEO Hygiene' && analysis.seoHygieneData && (
            <HygieneTab data={analysis.seoHygieneData} />
          )}
          {activeTab === 'HIPAA Audit' && analysis.hipaaData && (
            <HipaaTab data={analysis.hipaaData} />
          )}
          {activeTab === 'Keywords' && analysis.keywordData && (
            <ShareKeywordsTab data={analysis.keywordData} />
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-10">
          Generated by Practice Persona
        </p>
      </div>
    </div>
  );
}

function ComparisonTab({ data }: { data: SeoComparisonData }) {
  const categories = [...new Set(data.rows.map((r) => r.category))];
  return (
    <div className="divide-y divide-gray-100">
      {categories.map((category) => (
        <div key={category} className="px-10 py-6">
          <h2 className="text-lg font-semibold text-brand-charcoal mb-4">{category}</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="pb-2 font-medium">Check</th>
                <th className="pb-2 font-medium">Target</th>
                <th className="pb-2 font-medium">Competitor</th>
                <th className="pb-2 font-medium w-16">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.rows.filter((r) => r.category === category).map((row, i) => (
                <tr key={i} className="group">
                  <td className="py-2.5 text-brand-charcoal">
                    <div>{row.check}</div>
                    {row.explanation && (
                      <p className="text-xs text-gray-600 mt-0.5 max-w-md hidden group-hover:block">{row.explanation}</p>
                    )}
                  </td>
                  <td className="py-2.5 text-gray-600">{row.targetValue}</td>
                  <td className="py-2.5 text-gray-600">{row.competitorValue}</td>
                  <td className="py-2.5">
                    <span className={`font-medium capitalize ${STATUS_ICON[row.status]}`}>
                      {row.status === 'pass' ? 'Pass' : row.status === 'fail' ? 'Fail' : 'Warn'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

type HygieneFinding = SeoHygieneData['findings'][number];

function HygieneFindingCard({ finding }: { finding: HygieneFinding }) {
  return (
    <div className="flex items-start gap-3 pt-4 pb-5">
      <span className={`mt-0.5 font-bold text-sm ${STATUS_ICON[finding.status]}`}>
        {finding.status === 'pass' ? '\u2713' : finding.status === 'fail' ? '\u2717' : '\u26A0'}
      </span>
      <div className="flex-1">
        <span className="font-medium text-brand-charcoal text-sm">{finding.check}</span>
        <p className="text-sm text-gray-600 mt-0.5">{finding.description}</p>
        {finding.explanation && (
          <p className="text-xs text-gray-600 mt-1">{finding.explanation}</p>
        )}
        {finding.fix && (
          <p className="text-xs text-brand-rose mt-1">Fix: {finding.fix}</p>
        )}
      </div>
    </div>
  );
}

function ShareExpandableList({ items, label, limit = 3 }: { items: HygieneFinding[]; label: string; limit?: number }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, limit);
  const hiddenCount = items.length - limit;

  const showingExpander = hiddenCount > 0 && !expanded;

  return (
    <div>
      {visible.map((finding, i) => {
        const isLast = i === visible.length - 1;
        const hideBorder = isLast && showingExpander;
        return (
          <div key={i} className={hideBorder ? '' : 'border-b border-gray-100'}>
            <HygieneFindingCard finding={finding} />
          </div>
        );
      })}
      {showingExpander && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full py-2.5 text-sm font-medium text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
        >
          Show {hiddenCount} more {label} finding{hiddenCount > 1 ? 's' : ''}
        </button>
      )}
      {expanded && hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(false)}
          className="w-full py-2 text-xs text-gray-600 hover:text-gray-800"
        >
          Show less
        </button>
      )}
    </div>
  );
}

function HygieneTab({ data }: { data: SeoHygieneData }) {
  const categories = [...new Set(data.findings.map((f) => f.category))];
  return (
    <div className="divide-y divide-gray-100">
      {categories.map((category) => {
        const catFindings = data.findings.filter((f) => f.category === category);

        if (category === 'On-Page') {
          const checkTypes = [...new Set(catFindings.map((f) => f.check))];
          return (
            <div key={category} className="px-10 py-6">
              <h2 className="text-lg font-semibold text-brand-charcoal mb-4">{category}</h2>
              <div className="space-y-5">
                {checkTypes.map((checkType) => {
                  const group = catFindings.filter((f) => f.check === checkType);
                  return (
                    <div key={checkType}>
                      {group.length > 1 && (
                        <p className="text-xs font-medium text-gray-600 mb-2">{checkType} ({group.length})</p>
                      )}
                      <ShareExpandableList items={group} label={checkType} limit={3} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        return (
          <div key={category} className="px-10 py-6">
            <h2 className="text-lg font-semibold text-brand-charcoal mb-4">{category}</h2>
            <ShareExpandableList items={catFindings} label={category} limit={3} />
          </div>
        );
      })}
    </div>
  );
}

function HipaaTab({ data }: { data: HipaaData }) {
  const sorted = [...data.findings].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2, pass: 3 };
    return (order[a.severity as keyof typeof order] ?? 4) - (order[b.severity as keyof typeof order] ?? 4);
  });
  return (
    <div className="px-10 py-6">
      <div className="flex items-center gap-4 mb-6">
        <span className={`px-4 py-2 rounded-lg text-sm font-bold ${RISK_COLORS[data.riskLevel] || 'bg-gray-100'}`}>
          {data.riskLevel} Risk
        </span>
        <span className="text-sm text-gray-600">
          {data.findings.filter((f) => f.severity === 'high').length} high,{' '}
          {data.findings.filter((f) => f.severity === 'medium').length} medium,{' '}
          {data.findings.filter((f) => f.severity === 'pass').length} passed
        </span>
      </div>
      <div>
        {sorted.map((finding, i) => (
          <div key={i} className={`pt-4 pb-5 ${i < sorted.length - 1 ? 'border-b border-gray-100' : ''}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${SEVERITY_COLORS[finding.severity]}`}>
                {finding.severity}
              </span>
              <span className="font-medium text-sm text-brand-charcoal">{finding.check}</span>
            </div>
            <p className="text-sm text-gray-700 mt-1">{finding.description}</p>
            {finding.whyRisk && finding.severity !== 'pass' && (
              <p className="text-xs text-gray-600 mt-1">{finding.whyRisk}</p>
            )}
            {finding.recommendedFix && finding.severity !== 'pass' && (
              <p className="text-xs text-brand-rose mt-1">Fix: {finding.recommendedFix}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ShareKeywordsTab({ data }: { data: KeywordData }) {
  const SOURCE_LABELS: Record<string, string> = {
    title: 'Page Title',
    'meta description': 'Meta Description',
    h1: 'Main Heading',
    h2: 'Subheading',
    h3: 'Subheading',
    body: 'Page Content',
    'alt text': 'Image Alt Text',
  };

  return (
    <div className="divide-y divide-gray-100">
      <div className="px-10 py-6">
        <h2 className="text-lg font-semibold text-brand-charcoal mb-2">Keywords Found on Your Site</h2>
        <p className="text-sm text-gray-600 mb-5">The most prominent keywords and phrases from your website content, ranked by prominence.</p>
        {data.siteKeywords.length === 0 ? (
          <p className="text-sm text-gray-600">No significant keywords detected.</p>
        ) : (
          <div>
            {data.siteKeywords.map((kw, i) => (
              <div key={i} className={`pt-4 pb-5 ${i < data.siteKeywords.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-brand-charcoal">{kw.keyword}</span>
                  <span className="text-xs text-gray-600 ml-4 shrink-0">prominence: {kw.frequency}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {kw.foundIn.map((source) => (
                    <span key={source} className="text-xs px-2 py-0.5 rounded bg-brand-sky-light text-brand-charcoal-light">
                      {SOURCE_LABELS[source] || source}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-10 py-6">
        <h2 className="text-lg font-semibold text-brand-charcoal mb-2">Organic Keywords (from Ahrefs)</h2>
        <p className="text-sm text-gray-600 mb-5">Keywords your site currently ranks for in Google search results, sorted by estimated traffic.</p>
        {data.organicKeywords.length === 0 ? (
          <p className="text-sm text-gray-600">No organic keyword data available.</p>
        ) : (
          <div>
            <div className="grid grid-cols-12 gap-4 text-xs text-gray-500 font-medium pb-2 border-b border-gray-100">
              <div className="col-span-5">Keyword</div>
              <div className="col-span-2 text-right">Position</div>
              <div className="col-span-2 text-right">Volume</div>
              <div className="col-span-2 text-right">Traffic</div>
              <div className="col-span-1 text-right">KD</div>
            </div>
            {data.organicKeywords.map((kw, i) => (
              <div key={i} className={`grid grid-cols-12 gap-4 pt-3 pb-4 ${i < data.organicKeywords.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <div className="col-span-5 font-medium text-brand-charcoal text-sm">{kw.keyword}</div>
                <div className="col-span-2 text-right text-sm text-gray-600">#{kw.position}</div>
                <div className="col-span-2 text-right text-sm text-gray-600">{kw.volume.toLocaleString()}</div>
                <div className="col-span-2 text-right text-sm text-gray-600">{kw.traffic.toLocaleString()}</div>
                <div className={`col-span-1 text-right text-sm font-medium ${kw.difficulty >= 70 ? 'text-brand-red' : kw.difficulty >= 40 ? 'text-brand-gold' : 'text-brand-charcoal'}`}>{kw.difficulty}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
