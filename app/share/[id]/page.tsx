'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';

// ── Types ──

interface FilmstripFrame { timing: number; data: string; }
interface PageSpeedMetrics { performanceScore: number | null; lcp: number | null; cls: number | null; fid: number | null; fcp: number | null; si: number | null; tbt: number | null; tti: number | null; finalScreenshot: string | null; filmstrip: FilmstripFrame[]; error?: string; }
interface FullPageSpeedData { mobile: PageSpeedMetrics; desktop: PageSpeedMetrics; }
interface LocalSearchData { screenshots: { url: string; caption: string }[]; referralSources?: { name: string; value: number }[]; searchVolumeHistory?: { date: string; volume: number }[]; }

interface Analysis {
  id: string; createdAt: string; siteUrl: string; competitorUrl: string | null; keyword: string | null;
  seoComparisonScore: number | null; seoHygieneScore: number | null; hipaaRiskLevel: string | null;
  seoComparisonData: SeoComparisonData | null; seoHygieneData: SeoHygieneData | null; hipaaData: HipaaData | null;
  pagesScraped: string[] | null; loomUrl: string | null; seoSummary: string | null;
  keywordData: KeywordData | null; pageSpeedData: FullPageSpeedData | null; localSearchData: LocalSearchData | null;
  overviewTitle: string | null; overviewSubtitle: string | null;
  customSeoTitle: string | null; customSeoDesc: string | null;
  customPagespeedTitle: string | null; customPagespeedDesc: string | null;
  customHipaaTitle: string | null; customHipaaDesc: string | null;
  customKeywordsTitle: string | null; customKeywordsDesc: string | null;
  customLocalSearchTitle: string | null; customLocalSearchDesc: string | null;
  sectionModes: Record<string, string> | null;
  site: { label: string | null; url: string } | null;
}

interface KeywordData {
  siteKeywords: { keyword: string; frequency: number; foundIn: string[] }[];
  organicKeywords: { keyword: string; volume: number; position: number; traffic: number; difficulty: number }[];
  relatedKeywords?: { keyword: string; volume: number; difficulty: number; cpc: number }[];
  strikingDistanceKeywords?: { keyword: string; volume: number; position: number; traffic: number; difficulty: number }[];
  topPages?: { url: string; traffic: number; keywords: number; topKeyword: string; topKeywordPosition: number; topKeywordVolume: number; referringDomains: number; urlRating: number; trafficValue: number }[];
}

interface SeoComparisonData { rows: { category: string; check: string; targetValue: string; competitorValue: string; status: string; explanation?: string }[]; }
interface SeoHygieneData { score: number; findings: { category: string; check: string; status: string; description: string; explanation?: string; fix: string | null; weight: number }[]; }
interface HipaaData { riskLevel: string; findings: { severity: string; check: string; description: string; pageUrl: string; whyRisk: string; recommendedFix: string }[]; }

// ── Utilities ──

const SECTIONS = ['Overview', 'Local Search', 'SEO', 'Traffic by Page', 'Page Speed', 'HIPAA Audit', 'Opportunities'] as const;
type Section = typeof SECTIONS[number];
type SectionKey = 'seo' | 'pagespeed' | 'hipaa' | 'keywords' | 'local_search';

function scoreColor(score: number | null, t?: Record<string, string>, type: 'general' | 'seo' = 'general'): string {
  if (score === null) return 'text-gray-400';
  if (type === 'seo') { const warn = parseFloat(t?.threshold_seo_warn || '60'); return score < warn ? 'text-brand-red' : 'text-brand-orange'; }
  const good = parseFloat(t?.threshold_score_good || '90');
  const warn = parseFloat(t?.threshold_score_warn || '50');
  if (score >= good) return 'text-brand-charcoal';
  if (score >= warn) return 'text-brand-orange';
  return 'text-brand-red';
}

function dropoffColor(dropoff: number | null, t?: Record<string, string>): string {
  if (dropoff === null) return 'text-gray-400';
  const good = parseFloat(t?.threshold_dropoff_good || '5');
  const warn = parseFloat(t?.threshold_dropoff_warn || '20');
  if (dropoff <= good) return 'text-brand-charcoal';
  if (dropoff <= warn) return 'text-brand-orange';
  return 'text-brand-red';
}

function kwDifficultyColor(difficulty: number, t?: Record<string, string>): string {
  const hard = parseFloat(t?.threshold_kw_difficulty_hard || '70');
  const medium = parseFloat(t?.threshold_kw_difficulty_medium || '40');
  if (difficulty >= hard) return 'text-brand-red';
  if (difficulty >= medium) return 'text-brand-gold';
  return 'text-brand-charcoal';
}

function cwvRating(metric: string, value: number | null, t?: Record<string, string>): { label: string; color: string } {
  if (value === null) return { label: '—', color: 'text-gray-400' };
  const metricMap: Record<string, { goodKey: string; warnKey: string; goodDefault: number; warnDefault: number }> = {
    lcp: { goodKey: 'threshold_lcp_good', warnKey: 'threshold_lcp_warn', goodDefault: 2500, warnDefault: 4000 },
    cls: { goodKey: 'threshold_cls_good', warnKey: 'threshold_cls_warn', goodDefault: 0.1, warnDefault: 0.25 },
    fcp: { goodKey: 'threshold_fcp_good', warnKey: 'threshold_fcp_warn', goodDefault: 1800, warnDefault: 3000 },
    tbt: { goodKey: 'threshold_tbt_good', warnKey: 'threshold_tbt_warn', goodDefault: 200, warnDefault: 600 },
    si: { goodKey: 'threshold_si_good', warnKey: 'threshold_si_warn', goodDefault: 3400, warnDefault: 5800 },
    tti: { goodKey: 'threshold_fid_good', warnKey: 'threshold_fid_warn', goodDefault: 200, warnDefault: 500 },
  };
  const m = metricMap[metric];
  if (!m) return { label: '', color: 'text-gray-600' };
  const good = t?.[m.goodKey] ? parseFloat(t[m.goodKey]) : m.goodDefault;
  const warn = t?.[m.warnKey] ? parseFloat(t[m.warnKey]) : m.warnDefault;
  if (value <= good) return { label: 'Good', color: 'text-brand-charcoal' };
  if (value <= warn) return { label: 'Needs Work', color: 'text-brand-orange' };
  return { label: 'Poor', color: 'text-brand-red' };
}

function formatMs(value: number | null): string {
  if (value === null) return '—';
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${Math.round(value)}ms`;
}

function autoDetectMode(section: SectionKey, analysis: Analysis): 'default' | 'custom' {
  switch (section) {
    case 'seo': return (analysis.seoHygieneScore !== null && analysis.seoHygieneScore < 70) ? 'custom' : 'default';
    case 'pagespeed': { const mobile = analysis.pageSpeedData?.mobile?.performanceScore ?? null; return (mobile !== null && mobile < 50) ? 'custom' : 'default'; }
    case 'hipaa': return (analysis.hipaaRiskLevel === 'High') ? 'custom' : 'default';
    case 'keywords': return (!analysis.keywordData?.strikingDistanceKeywords?.length) ? 'custom' : 'default';
    case 'local_search': return 'default';
  }
}

function resolveMode(section: SectionKey, analysis: Analysis): 'default' | 'custom' {
  const mode = analysis.sectionModes?.[section] || 'auto';
  if (mode === 'auto') return autoDetectMode(section, analysis);
  return mode as 'default' | 'custom';
}

const STATUS_ICON: Record<string, string> = { pass: 'text-brand-charcoal', fail: 'text-brand-rose', warning: 'text-brand-gold' };
const SEVERITY_COLORS: Record<string, string> = {
  high: 'bg-white border border-brand-rose text-brand-rose',
  medium: 'bg-white border border-brand-gold text-brand-gold',
  low: 'bg-white border border-brand-sky text-brand-charcoal-light',
  pass: 'bg-white border border-brand-sage text-brand-sage-dark',
};

const RANK_COLORS = ['#4285F4', '#34A853', '#FBBC05', '#E4405F', '#9B59B6', '#2D8BC9', '#6366F1', '#14B8A6', '#F97316', '#EC4899'];
const REFERRAL_SOURCES = [
  { name: 'Google Search', value: 46 }, { name: 'Google Maps', value: 22 }, { name: 'Insurance Directory', value: 14 },
  { name: 'Psychology Today', value: 10 }, { name: 'Referral / Word of Mouth', value: 5 }, { name: 'Social Media', value: 3 },
];
const SEARCH_TREND_FALLBACK = [
  { month: 'Oct', volume: 673000 }, { month: 'Nov', volume: 673000 }, { month: 'Dec', volume: 550000 },
  { month: 'Jan', volume: 823000 }, { month: 'Feb', volume: 823000 }, { month: 'Mar', volume: 823000 },
];

// ── Main Page ──

export default function SharePage() {
  const params = useParams();
  const id = params.id as string;

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [sectionDescs, setSectionDescs] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState<Section>('Overview');
  const [error, setError] = useState('');
  const [needsPasscode, setNeedsPasscode] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => { if (!d.error) setSectionDescs(d); });
  }, []);

  function loadAnalysis() {
    fetch(`/api/share/${id}`)
      .then(async (res) => {
        if (res.status === 403) { const data = await res.json(); if (data.requiresPasscode) { setNeedsPasscode(true); return; } }
        if (!res.ok) throw new Error('Report not found or not public');
        return res.json();
      })
      .then((data) => { if (data) { if (data.hipaaRiskLevel === 'Critical') data.hipaaRiskLevel = 'High'; setAnalysis(data); } })
      .catch((err) => setError(err.message));
  }

  useEffect(() => { loadAnalysis(); }, [id]);

  async function submitPasscode(e: React.FormEvent) {
    e.preventDefault();
    setPasscodeError('');
    const res = await fetch(`/api/share/${id}/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passcode }) });
    if (!res.ok) { setPasscodeError('Incorrect passcode'); return; }
    setNeedsPasscode(false);
    loadAnalysis();
  }

  // ── Passcode gate ──
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
              <input type="text" value={passcode} onChange={(e) => setPasscode(e.target.value)} autoFocus
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-center tracking-widest focus:ring-2 focus:ring-brand-sky focus:border-brand-sky outline-none transition-shadow" />
            </div>
            {passcodeError && <div className="bg-brand-rose-light/30 text-brand-rose-dark text-sm rounded-md px-4 py-3">{passcodeError}</div>}
            <button type="submit" className="w-full bg-brand-charcoal-light text-white font-medium py-3 rounded-md hover:bg-brand-charcoal transition-colors text-sm">View Report</button>
          </form>
        </div>
      </div>
    );
  }

  if (error) return <div className="min-h-screen bg-brand-bg flex items-center justify-center"><div className="bg-white rounded-lg shadow-sm p-14 text-center max-w-md"><p className="text-red-500 mb-4">{error}</p><p className="text-sm text-gray-400">This report may not exist or is no longer shared.</p></div></div>;
  if (!analysis) return <div className="min-h-screen bg-brand-bg flex items-center justify-center"><p className="text-gray-400">Loading report...</p></div>;

  const mobileScore = analysis.pageSpeedData?.mobile?.performanceScore ?? null;
  const hasComparison = analysis.seoComparisonData !== null;

  const sidebarItems: { section: Section; label: string; score?: string; scoreColor?: string; sublabel?: string }[] = [
    { section: 'Overview', label: analysis.overviewTitle || 'Overview', sublabel: 'Analysis summary' },
    { section: 'Local Search', label: analysis.customLocalSearchTitle || 'Local Search', sublabel: 'How clients find you' },
    { section: 'SEO', label: 'Can Google Find Your Site?', score: analysis.seoHygieneScore !== null ? `${analysis.seoHygieneScore}/100` : undefined, scoreColor: scoreColor(analysis.seoHygieneScore, sectionDescs, 'seo'), sublabel: 'Hygiene & Comparison' },
    { section: 'Traffic by Page', label: 'Traffic by Page', score: analysis.keywordData?.topPages?.length ? `${analysis.keywordData.topPages.length}` : undefined, sublabel: 'Top pages & keywords' },
    { section: 'Page Speed', label: 'Website Loading Time', score: mobileScore !== null ? `${mobileScore}/100` : undefined, scoreColor: scoreColor(mobileScore, sectionDescs), sublabel: 'Core Web Vitals' },
    { section: 'HIPAA Audit', label: 'HIPAA Audit', score: analysis.hipaaRiskLevel || undefined, scoreColor: analysis.hipaaRiskLevel === 'Moderate' ? 'text-brand-gold' : analysis.hipaaRiskLevel === 'Low' ? 'text-brand-charcoal' : 'text-brand-rose', sublabel: 'Compliance Risk' },
    { section: 'Opportunities', label: 'Opportunities', score: analysis.keywordData?.strikingDistanceKeywords ? `${analysis.keywordData.strikingDistanceKeywords.length}` : undefined, sublabel: 'Striking Distance Keywords' },
  ];

  // Helper for hero display text
  function heroTitle(section: SectionKey, defaultTitle: string, templateKey: string): string {
    const mode = resolveMode(section, analysis!);
    return mode === 'custom' ? (sectionDescs[templateKey] || defaultTitle) : defaultTitle;
  }
  function heroDesc(section: SectionKey, defaultDesc: string, templateKey: string): string {
    const mode = resolveMode(section, analysis!);
    return mode === 'custom' ? (sectionDescs[templateKey] || defaultDesc) : defaultDesc;
  }

  return (
    <div className="flex min-h-screen bg-brand-bg">
      {/* Sidebar */}
      <aside className="w-72 shrink-0 bg-white flex flex-col fixed top-0 bottom-0 left-0" style={{ boxShadow: 'none' }}>
        <div className="absolute top-0 bottom-0 -right-10 w-10 pointer-events-none" style={{ background: 'radial-gradient(ellipse at left center, rgba(0,0,0,0.07) 0%, transparent 60%)' }} />
        <div className="px-8 py-6 border-b border-gray-100">
          <div className="flex items-center gap-0.5 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-sage" />
            <span className="w-2.5 h-2.5 rounded-full bg-brand-sky" />
            <span className="w-2.5 h-2.5 rounded-full bg-brand-gold" />
          </div>
          <h1 className="text-sm font-bold text-brand-charcoal truncate">{analysis.site?.label || analysis.siteUrl}</h1>
          <p className="text-xs text-gray-400 mt-1">
            {new Date(analysis.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            {analysis.pagesScraped && <span> &middot; {analysis.pagesScraped.length} pages</span>}
          </p>
        </div>
        <nav className="flex-1 py-4 px-4 overflow-y-auto">
          {sidebarItems.map((item) => {
            const isActive = activeSection === item.section;
            const isOverview = item.section === 'Overview';
            const bgClass = isActive ? (isOverview ? 'bg-brand-sage-dark' : 'bg-gray-100') : 'hover:bg-gray-50';
            const textClass = isActive ? (isOverview ? 'text-white' : 'text-brand-charcoal') : 'text-gray-500';
            return (
            <button key={item.section} onClick={() => setActiveSection(item.section)}
              className={`w-full text-left px-4 py-3.5 rounded-lg transition-colors cursor-pointer ${bgClass}`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${textClass}`}>{item.label}</span>
                {item.score && (
                  <span className={`text-sm ${activeSection === item.section ? 'bg-white rounded px-2 py-0.5 shadow-[0_1px_8px_-2px_rgba(0,0,0,0.10)]' : 'px-2 py-0.5'}`}>
                    {item.score.includes('/') ? (
                      <><span className={`font-bold ${item.scoreColor}`}>{item.score.split('/')[0]}</span><span className="font-normal text-gray-400">/{item.score.split('/')[1]}</span></>
                    ) : (
                      <span className={`font-bold ${item.scoreColor}`}>{item.score}</span>
                    )}
                  </span>
                )}
              </div>
              {item.sublabel && <p className={`text-xs mt-0.5 ${isActive && isOverview ? 'text-white/70' : 'text-gray-400'}`}>{item.sublabel}</p>}
            </button>
            );
          })}
        </nav>
        <div className="px-8 py-4 border-t border-gray-100 text-center">
          <span className="text-[10px] text-gray-300">Generated by Practice Persona</span>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto ml-72">
        <div className="px-8 py-8 max-w-4xl">

          {/* Overview */}
          {activeSection === 'Overview' && (
            <div className="space-y-3">
              <div className="bg-white rounded-lg border border-gray-200 p-8">
                <h2 className="text-lg font-semibold text-brand-charcoal mb-2">{analysis.overviewTitle || 'Overview'}</h2>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">{analysis.overviewSubtitle || 'A walkthrough of your website audit results.'}</p>
                {analysis.loomUrl && (
                  <div className="aspect-video rounded-lg overflow-hidden">
                    <iframe src={analysis.loomUrl.replace('/share/', '/embed/')} frameBorder="0" allowFullScreen className="w-full h-full" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Local Search */}
          {activeSection === 'Local Search' && (
            <div className="space-y-3">
              {/* Hero */}
              <div className="bg-white rounded-lg border border-gray-200 px-8 py-10">
                <h2 className="text-lg font-semibold text-brand-charcoal">{analysis.customLocalSearchTitle || 'Local Search'}</h2>
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                  {heroDesc('local_search', sectionDescs.local_search_description || '', 'template_local_search_description')}
                </p>
              </div>
              {/* Screenshots */}
              {analysis.localSearchData?.screenshots && analysis.localSearchData.screenshots.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-8">
                  <div className="space-y-4">
                    {analysis.localSearchData.screenshots.map((shot, i) => (
                      <div key={i} className="border border-gray-100 rounded-lg overflow-hidden">
                        <img src={shot.url} alt={shot.caption || 'Search result screenshot'} className="w-full" />
                        {shot.caption && <div className="p-3 bg-gray-50 border-t border-gray-100"><p className="text-sm text-gray-500">{shot.caption}</p></div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Charts */}
              <ShareLocalSearchCharts data={analysis.localSearchData} sectionDescs={sectionDescs} />
            </div>
          )}

          {/* SEO */}
          {activeSection === 'SEO' && (
            <div className="space-y-3">
              <ReadOnlyHero
                score={analysis.seoHygieneScore} scoreUnit={`/\u200a100`}
                scoreColor={scoreColor(analysis.seoHygieneScore, sectionDescs, 'seo')}
                scoreLabel={sectionDescs.seo_score_label || 'SEO Hygiene'}
                scoreSubtext={sectionDescs.seo_score_subtext || 'How well your site follows on-page SEO best practices'}
                title={heroTitle('seo', sectionDescs.seo_title || 'What is SEO?', 'template_seo_title')}
                description={heroDesc('seo', sectionDescs.seo_description || '', 'template_seo_description')}
              />
              {analysis.seoHygieneData && <ShareSeoHygieneTab data={analysis.seoHygieneData} />}
              {hasComparison && analysis.seoComparisonData && <ShareSeoComparisonTab data={analysis.seoComparisonData} />}
            </div>
          )}

          {/* Traffic by Page */}
          {activeSection === 'Traffic by Page' && (
            <div className="space-y-3">
              {analysis.keywordData?.topPages && analysis.keywordData.topPages.length > 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-8">
                  <h2 className="text-lg font-semibold text-brand-charcoal mb-1">Top Pages by Traffic</h2>
                  <p className="text-sm text-gray-500 mb-5">Your highest-traffic pages and the keywords driving visitors to them.</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                          <th className="pb-2 font-medium">Page</th>
                          <th className="pb-2 font-medium text-right">Traffic</th>
                          <th className="pb-2 font-medium text-right">Keywords</th>
                          <th className="pb-2 font-medium text-right">UR</th>
                          <th className="pb-2 font-medium text-right">Ref. Domains</th>
                          <th className="pb-2 font-medium text-right">Top Keyword</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {analysis.keywordData.topPages.map((page, i) => {
                          let shortUrl: string;
                          try { shortUrl = new URL(page.url).pathname || '/'; } catch { shortUrl = page.url; }
                          return (
                            <tr key={i}>
                              <td className="py-3 font-medium text-brand-charcoal max-w-[180px] truncate" title={page.url}>{shortUrl}</td>
                              <td className="py-3 text-right text-gray-600">{page.traffic.toLocaleString()}</td>
                              <td className="py-3 text-right text-gray-600">{page.keywords.toLocaleString()}</td>
                              <td className="py-3 text-right"><span className={`font-medium ${page.urlRating >= 20 ? 'text-brand-sage-dark' : page.urlRating >= 10 ? 'text-brand-gold' : 'text-gray-400'}`}>{page.urlRating}</span></td>
                              <td className="py-3 text-right text-gray-600">{page.referringDomains.toLocaleString()}</td>
                              <td className="py-3 text-right text-xs max-w-[160px] truncate" title={`${page.topKeyword} (${page.topKeywordVolume.toLocaleString()} vol/mo)`}>
                                <span className="text-gray-600">{page.topKeyword}</span><span className="text-gray-400 ml-1">#{page.topKeywordPosition}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-brand-rose/30 p-10">
                  <div className="flex items-start gap-4">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white border border-brand-rose text-brand-rose shrink-0 mt-0.5">High Concern</span>
                    <div>
                      <p className="text-sm font-medium text-brand-charcoal">No pages are generating organic traffic</p>
                      <p className="text-sm text-gray-500 mt-1 leading-relaxed">Major SEO tools aren&apos;t detecting any meaningful traffic to your website from Google search. This is common for newer sites, but it means potential clients searching for therapy in your area are unlikely to find you online.</p>
                      <p className="text-sm text-gray-500 mt-2 leading-relaxed">A targeted SEO strategy focusing on local keywords and content can change this significantly.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Page Speed */}
          {activeSection === 'Page Speed' && (
            <div className="space-y-3">
              <ReadOnlyHero
                score={mobileScore} scoreUnit={`/\u200a100`}
                scoreColor={scoreColor(mobileScore, sectionDescs)}
                scoreLabel="Performance"
                scoreSubtext="Google Lighthouse mobile performance score"
                title={heroTitle('pagespeed', sectionDescs.pagespeed_title || 'Why Page Speed Matters', 'template_pagespeed_title')}
                description={heroDesc('pagespeed', sectionDescs.pagespeed_description || '', 'template_pagespeed_description')}
              />
              {analysis.pageSpeedData && <SharePageSpeedTab data={analysis.pageSpeedData} sectionDescs={sectionDescs} />}
            </div>
          )}

          {/* HIPAA Audit */}
          {activeSection === 'HIPAA Audit' && (
            <div className="space-y-3">
              <ReadOnlyHero
                riskLevel={analysis.hipaaRiskLevel}
                scoreLabel="HIPAA Compliance"
                scoreSubtext="Risk level based on your website audit"
                title={heroTitle('hipaa', sectionDescs.hipaa_title || 'What is HIPAA Compliance?', 'template_hipaa_title')}
                description={heroDesc('hipaa', sectionDescs.hipaa_description || '', 'template_hipaa_description')}
              />
              {analysis.hipaaData && <ShareHipaaTab data={analysis.hipaaData} />}
            </div>
          )}

          {/* Opportunities */}
          {activeSection === 'Opportunities' && (
            <div className="space-y-3">
              <ReadOnlyHero
                score={analysis.keywordData?.strikingDistanceKeywords?.length ?? null}
                scoreColor="text-brand-charcoal"
                scoreLabel="Opportunities"
                scoreSubtext="Keywords ranking 3–10, close to top of page 1"
                title={heroTitle('keywords', sectionDescs.keywords_title || 'Why Keywords Matter', 'template_keywords_title')}
                description={heroDesc('keywords', sectionDescs.keywords_description || '', 'template_keywords_description')}
              />
              {analysis.keywordData && <ShareKeywordsTab data={analysis.keywordData} sectionDescs={sectionDescs} />}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Read-Only Hero ──

function ReadOnlyHero({ score, riskLevel, scoreUnit, scoreColor: scOverride, scoreLabel, scoreSubtext, title, description }: {
  score?: number | null; riskLevel?: string | null; scoreUnit?: string; scoreColor?: string;
  scoreLabel: string; scoreSubtext: string; title: string; description: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-8 py-10 flex gap-8">
      <div className="w-1/3 flex flex-col justify-center border-r border-gray-100 mx-auto px-8">
        {riskLevel ? (
          <span className={`text-2xl font-bold ${riskLevel === 'Moderate' ? 'text-brand-gold' : riskLevel === 'Low' ? 'text-brand-charcoal' : 'text-brand-rose'}`}>{riskLevel}</span>
        ) : (
          <span className={`text-4xl font-bold ${scOverride || 'text-brand-orange'}`}>
            {score ?? '—'}{!riskLevel && scoreUnit && <span className="text-xl font-normal text-gray-400">{scoreUnit}</span>}
          </span>
        )}
        <p className="text-sm font-semibold text-brand-charcoal mt-2">{scoreLabel}</p>
        <p className="text-xs text-gray-400 mt-0.5">{scoreSubtext}</p>
      </div>
      <div className="w-2/3 flex flex-col justify-center">
        <h2 className="text-lg font-semibold text-brand-charcoal mb-2">{title}</h2>
        <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

// ── SEO Hygiene Tab ──

function ShareSeoHygieneTab({ data }: { data: SeoHygieneData }) {
  const categories = [...new Set(data.findings.map((f) => f.category))];
  return (
    <>
      {categories.map((category) => {
        const findings = data.findings.filter((f) => f.category === category);
        return (
          <div key={category} className="bg-white rounded-lg border border-gray-200 p-8">
            <h2 className="text-lg font-semibold text-brand-charcoal mb-4">{category}</h2>
            {findings.map((finding, i) => (
              <div key={i} className={`flex items-start gap-3 pt-4 pb-5 ${i < findings.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <span className={`mt-0.5 font-bold text-sm ${STATUS_ICON[finding.status]}`}>
                  {finding.status === 'pass' ? '\u2713' : finding.status === 'fail' ? '\u2717' : '\u26A0'}
                </span>
                <div className="flex-1">
                  <span className="font-medium text-brand-charcoal text-sm">{finding.check}</span>
                  <p className="text-sm text-gray-600 mt-0.5">{finding.description}</p>
                  {finding.fix && <p className="text-xs text-brand-rose mt-1">Fix: {finding.fix}</p>}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}

// ── SEO Comparison Tab ──

function ShareSeoComparisonTab({ data }: { data: SeoComparisonData }) {
  const categories = [...new Set(data.rows.map((r) => r.category))];
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-8">
      <h2 className="text-lg font-semibold text-brand-charcoal mb-4">SEO Comparison</h2>
      {categories.map((category) => (
        <div key={category} className="mb-6 last:mb-0">
          <h3 className="text-sm font-semibold text-brand-charcoal mb-3">{category}</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500"><th className="pb-2 font-medium">Check</th><th className="pb-2 font-medium">Your Site</th><th className="pb-2 font-medium">Competitor</th><th className="pb-2 font-medium w-16">Status</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {data.rows.filter((r) => r.category === category).map((row, i) => (
                <tr key={i}>
                  <td className="py-2.5 text-brand-charcoal">{row.check}</td>
                  <td className="py-2.5 text-gray-600">{row.targetValue}</td>
                  <td className="py-2.5 text-gray-600">{row.competitorValue}</td>
                  <td className="py-2.5"><span className={`font-medium capitalize ${STATUS_ICON[row.status]}`}>{row.status === 'pass' ? 'Pass' : row.status === 'fail' ? 'Fail' : 'Warn'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

// ── HIPAA Tab ──

function ShareHipaaTab({ data }: { data: HipaaData }) {
  const sorted = [...data.findings].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2, pass: 3 };
    return (order[a.severity as keyof typeof order] ?? 4) - (order[b.severity as keyof typeof order] ?? 4);
  });
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-8">
      <h2 className="text-lg font-semibold text-brand-charcoal mb-4">Findings</h2>
      {sorted.map((finding, i) => (
        <div key={i} className={`pt-4 pb-5 ${i < sorted.length - 1 ? 'border-b border-gray-100' : ''}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${SEVERITY_COLORS[finding.severity]}`}>{finding.severity}</span>
            <span className="font-medium text-sm text-brand-charcoal">{finding.check}</span>
          </div>
          <p className="text-sm text-gray-700 mt-1">{finding.description}</p>
          {finding.whyRisk && finding.severity !== 'pass' && <p className="text-xs text-gray-600 mt-1">{finding.whyRisk}</p>}
          {finding.recommendedFix && finding.severity !== 'pass' && <p className="text-xs text-brand-rose mt-1">Fix: {finding.recommendedFix}</p>}
        </div>
      ))}
    </div>
  );
}

// ── Page Speed Tab ──

function SharePageSpeedTab({ data, sectionDescs }: { data: FullPageSpeedData; sectionDescs: Record<string, string> }) {
  const filmstrip = data.mobile.filmstrip.length > 0 ? data.mobile.filmstrip : data.desktop.filmstrip;

  const desktopDropoff = data.desktop.performanceScore !== null
    ? Math.round(data.desktop.performanceScore >= 90 ? (100 - data.desktop.performanceScore) * 0.3 : data.desktop.performanceScore >= 50 ? 5 + (90 - data.desktop.performanceScore) * 0.6 : 29 + (50 - data.desktop.performanceScore) * 0.8) : null;
  const mobileDropoff = data.mobile.performanceScore !== null
    ? Math.round(data.mobile.performanceScore >= 90 ? (100 - data.mobile.performanceScore) * 0.3 : data.mobile.performanceScore >= 50 ? 5 + (90 - data.mobile.performanceScore) * 0.6 : 29 + (50 - data.mobile.performanceScore) * 0.8) : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Desktop', score: data.desktop.performanceScore, dropoff: desktopDropoff, title: sectionDescs.pagespeed_desktop_title || 'Desktop Performance', subtitle: sectionDescs.pagespeed_desktop_subtitle || '' },
          { label: 'Mobile', score: data.mobile.performanceScore, dropoff: mobileDropoff, title: sectionDescs.pagespeed_mobile_title || 'Mobile Performance', subtitle: sectionDescs.pagespeed_mobile_subtitle || '' },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center mb-6">
              <span className={`text-4xl font-bold ${dropoffColor(item.dropoff, sectionDescs)}`}>-{item.dropoff ?? '—'}<span className="text-xl font-semibold ml-0.5">%</span></span>
              <span className="text-sm text-gray-400 ml-auto">estimated</span>
            </div>
            <div className="mb-1"><span className="text-sm text-brand-charcoal">{item.label}</span></div>
            <h3 className="text-sm font-semibold text-brand-charcoal">{item.title}</h3>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">{item.subtitle}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Desktop', score: data.desktop.performanceScore, title: sectionDescs.pagespeed_desktop_score_title || 'Desktop Score', subtitle: sectionDescs.pagespeed_desktop_score_subtitle || '' },
          { label: 'Mobile', score: data.mobile.performanceScore, title: sectionDescs.pagespeed_mobile_score_title || 'Mobile Score', subtitle: sectionDescs.pagespeed_mobile_score_subtitle || '' },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center mb-6">
              <span className={`text-4xl font-bold ${scoreColor(item.score, sectionDescs)}`}>{item.score ?? '—'}<span className="text-lg font-normal text-gray-400 ml-0.5">{` /\u200a100`}</span></span>
            </div>
            <h3 className="text-sm font-semibold text-brand-charcoal">{item.title}</h3>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">{item.subtitle}</p>
          </div>
        ))}
      </div>

      {filmstrip.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 overflow-hidden">
          <h2 className="text-lg font-semibold text-brand-charcoal mb-1">{sectionDescs.pagespeed_filmstrip_title || 'Loading Timeline'}</h2>
          <p className="text-sm text-gray-500 mb-5">{sectionDescs.pagespeed_filmstrip_subtitle || 'How your site loads over time on mobile.'}</p>
          <div className="relative pb-8">
            <div className="absolute right-0 top-0 bottom-0 w-12 z-30 pointer-events-none" style={{ background: 'radial-gradient(ellipse at right center, rgba(0,0,0,0.18) 0%, transparent 70%)' }} />
            <div className="flex gap-3 overflow-x-auto pt-6 pb-8 pl-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {filmstrip.map((frame, i) => {
                const isBlank = frame.data.length < 3000;
                const nextTiming = filmstrip[i + 1]?.timing ?? Infinity;
                const maxTiming = filmstrip[filmstrip.length - 1]?.timing ?? 0;
                const dropOffLines: { ms: number; label: string; color: string }[] = [];
                if (frame.timing <= 3000 && nextTiming > 3000) dropOffLines.push({ ms: 3000, label: '~10% of visitors leave', color: '#EDA125' });
                if (maxTiming >= 5000 && frame.timing <= 5000 && nextTiming > 5000) dropOffLines.push({ ms: 5000, label: '~50% of visitors leave', color: '#E53E3E' });
                return (
                  <div key={i} className="flex items-start shrink-0 gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-[140px] h-56 rounded-lg overflow-hidden relative ${isBlank ? 'bg-white' : 'bg-gray-50'}`} style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.14)' }}>
                        {!isBlank && <img src={frame.data} alt={`Page at ${formatMs(frame.timing)}`} className="w-full h-full object-cover object-top" />}
                      </div>
                      <span className="text-xs text-gray-500 mt-2 font-medium">{formatMs(frame.timing)}</span>
                    </div>
                    {dropOffLines.map((line) => (
                      <div key={line.ms} className="shrink-0 relative self-stretch flex flex-col items-center">
                        <div className="absolute top-0 bottom-0 w-px border-l-2 border-dashed" style={{ borderColor: line.color, top: '-24px' }} />
                        <span className="absolute bottom-0 text-[10px] font-semibold whitespace-nowrap bg-white px-1 z-20" style={{ color: line.color }}>{line.label}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {[
        { key: 'mobile' as const, label: 'Mobile Metrics', metrics: data.mobile },
        { key: 'desktop' as const, label: 'Desktop Metrics', metrics: data.desktop },
      ].map(({ key, label, metrics }) => (
        !metrics.error && (
          <div key={key} className="bg-white rounded-lg border border-gray-200 p-8">
            <h2 className="text-lg font-semibold text-brand-charcoal mb-5">{label}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { l: 'Largest Contentful Paint', m: 'lcp', v: metrics.lcp },
                { l: 'Cumulative Layout Shift', m: 'cls', v: metrics.cls },
                { l: 'Total Blocking Time', m: 'tbt', v: metrics.tbt },
                { l: 'First Contentful Paint', m: 'fcp', v: metrics.fcp },
                { l: 'Speed Index', m: 'si', v: metrics.si },
                { l: 'Time to Interactive', m: 'tti', v: metrics.tti },
              ].map((item) => {
                const rating = cwvRating(item.m, item.v, sectionDescs);
                const displayValue = item.m === 'cls' ? (item.v !== null ? item.v.toFixed(3) : '—') : formatMs(item.v);
                const titleKey = `metric_label_${item.m}`;
                return (
                  <div key={item.m} className="bg-white rounded-lg border border-gray-200 p-5">
                    <p className="text-xs text-brand-charcoal mb-1">{sectionDescs[titleKey] || item.l}</p>
                    <p className={`text-2xl font-bold ${rating.color}`}>{displayValue}</p>
                    <p className={`text-xs font-medium mt-1 ${rating.color}`}>{rating.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ))}
    </div>
  );
}

// ── Keywords Tab ──

function ShareKeywordsTab({ data, sectionDescs }: { data: KeywordData; sectionDescs: Record<string, string> }) {
  const hasStriking = data.strikingDistanceKeywords && data.strikingDistanceKeywords.length > 0;
  const hasAny = hasStriking || data.organicKeywords.length > 0 || data.siteKeywords.length > 0;

  return (
    <div className="space-y-3">
      {!hasAny && (
        <div className="bg-white rounded-lg border border-brand-rose/30 p-10">
          <div className="flex items-start gap-4">
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white border border-brand-rose text-brand-rose shrink-0 mt-0.5">High Concern</span>
            <div>
              <p className="text-sm font-medium text-brand-charcoal">No keyword or ranking data found</p>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">Your site doesn&apos;t appear to rank for any keywords in Google search results. This means potential clients searching for therapy services in your area are very unlikely to find your practice through Google.</p>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">Building a keyword strategy around your specialties and location is the highest-impact step you can take to grow your practice online.</p>
            </div>
          </div>
        </div>
      )}

      {!hasStriking && hasAny && (
        <div className="bg-white rounded-lg border border-brand-gold/30 p-10">
          <div className="flex items-start gap-4">
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white border border-brand-gold text-brand-gold shrink-0 mt-0.5">Medium Concern</span>
            <div>
              <p className="text-sm font-medium text-brand-charcoal">No keywords close to page 1</p>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">Your site has some keyword presence, but none are ranking in positions 3–10 — the &ldquo;striking distance&rdquo; range where small improvements can move you to the top of Google&apos;s first page.</p>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">Focusing your content on the keywords you already rank for can help push them into this range.</p>
            </div>
          </div>
        </div>
      )}

      {data.strikingDistanceKeywords && data.strikingDistanceKeywords.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <h2 className="text-lg font-semibold text-brand-charcoal mb-1">{sectionDescs.opportunities_striking_title || 'Low-Hanging Fruit'}</h2>
          <p className="text-sm text-gray-500 mb-5">{sectionDescs.opportunities_striking_subtitle || 'Keywords ranking positions 3–10 — close to the top of page 1.'}</p>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="pb-2 font-medium">Keyword</th><th className="pb-2 font-medium text-right">Position</th>
              <th className="pb-2 font-medium text-right">Volume</th><th className="pb-2 font-medium text-right">Traffic</th>
              <th className="pb-2 font-medium text-right">KD</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {data.strikingDistanceKeywords.map((kw, i) => (
                <tr key={i}>
                  <td className="py-3 font-medium text-brand-charcoal">{kw.keyword}</td>
                  <td className="py-3 text-right text-gray-600">#{kw.position}</td>
                  <td className="py-3 text-right text-gray-600">{kw.volume.toLocaleString()}</td>
                  <td className="py-3 text-right text-gray-600">{kw.traffic.toLocaleString()}</td>
                  <td className={`py-3 text-right font-medium ${kwDifficultyColor(kw.difficulty, sectionDescs)}`}>{kw.difficulty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}

// ── Local Search Charts ──

function ShareLocalSearchCharts({ data, sectionDescs }: { data: LocalSearchData | null; sectionDescs: Record<string, string> }) {
  const trendData = useMemo(() => {
    const history = data?.searchVolumeHistory;
    if (history && history.length > 0) {
      const tenYearsAgo = new Date();
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
      return history.filter((point) => new Date(point.date) >= tenYearsAgo).map((point) => {
        const d = new Date(point.date);
        const isJan = d.getMonth() === 0;
        return { month: isJan ? String(d.getFullYear()) : '', volume: point.volume };
      });
    }
    return SEARCH_TREND_FALLBACK;
  }, [data?.searchVolumeHistory]);

  const sources = useMemo(() => {
    try {
      const raw = sectionDescs.local_search_referral_data;
      if (raw) return JSON.parse(raw) as { name: string; value: number }[];
    } catch { /* ignore */ }
    return data?.referralSources || REFERRAL_SOURCES;
  }, [sectionDescs.local_search_referral_data, data?.referralSources]);

  return (
    <div className="space-y-3">
      {/* Donut chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <h2 className="text-lg font-semibold text-brand-charcoal mb-1">{sectionDescs.local_search_referral_title || 'How Clients Find Therapists'}</h2>
        <p className="text-sm text-gray-500 mb-5">{sectionDescs.local_search_referral_subtitle || 'National average breakdown of how therapy clients discover their provider online.'}</p>
        <div className="flex items-center gap-8">
          <div className="w-56 h-56 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={sources} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" stroke="none">
                {sources.map((_: unknown, i: number) => <Cell key={i} fill={RANK_COLORS[i % RANK_COLORS.length]} />)}
              </Pie></PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2.5">
            {sources.map((source: { name: string; value: number }, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: RANK_COLORS[i % RANK_COLORS.length] }} />
                <span className="text-sm text-brand-charcoal flex-1">{source.name}</span>
                <span className="text-sm font-semibold text-brand-charcoal">{source.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Line chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <h2 className="text-lg font-semibold text-brand-charcoal mb-1">{sectionDescs.local_search_trends_title || 'Search Volume: \u201CTherapy\u201D'}</h2>
        <p className="text-sm text-gray-500 mb-5">{sectionDescs.local_search_trends_subtitle || 'Monthly U.S. search volume for the keyword \u201Ctherapy\u201D (source: Ahrefs).'}</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} width={50} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '13px' }} formatter={(value) => [Number(value).toLocaleString(), 'Search Volume']} />
              <Line type="monotone" dataKey="volume" name="Search Volume" stroke="#4285F4" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
