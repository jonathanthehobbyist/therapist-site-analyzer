'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Search, AlertTriangle, Wrench, ExternalLink, Upload, X, ImageIcon } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface FilmstripFrame {
  timing: number;
  data: string;
}

interface PageSpeedMetrics {
  performanceScore: number | null;
  lcp: number | null;
  cls: number | null;
  fid: number | null;
  fcp: number | null;
  si: number | null;
  tbt: number | null;
  tti: number | null;
  finalScreenshot: string | null;
  filmstrip: FilmstripFrame[];
  error?: string;
}

interface FullPageSpeedData {
  mobile: PageSpeedMetrics;
  desktop: PageSpeedMetrics;
}

interface Analysis {
  id: string;
  createdAt: string;
  siteUrl: string;
  competitorUrl: string | null;
  keyword: string | null;
  status: string;
  seoComparisonScore: number | null;
  seoHygieneScore: number | null;
  hipaaRiskLevel: string | null;
  seoComparisonData: SeoComparisonData | null;
  seoHygieneData: SeoHygieneData | null;
  hipaaData: HipaaData | null;
  pagesScraped: string[] | null;
  error: string | null;
  isPublic: boolean;
  sharePasscode: string | null;
  loomUrl: string | null;
  overviewTitle: string | null;
  overviewSubtitle: string | null;
  customSeoTitle: string | null;
  customSeoDesc: string | null;
  customPagespeedTitle: string | null;
  customPagespeedDesc: string | null;
  customHipaaTitle: string | null;
  customHipaaDesc: string | null;
  customKeywordsTitle: string | null;
  customKeywordsDesc: string | null;
  customLocalSearchTitle: string | null;
  customLocalSearchDesc: string | null;
  localSearchData: LocalSearchData | null;
  seoSummary: string | null;
  keywordData: KeywordData | null;
  pageSpeedData: FullPageSpeedData | null;
  progress: number;
  progressLabel: string | null;
}

interface KeywordData {
  siteKeywords: { keyword: string; frequency: number; foundIn: string[] }[];
  organicKeywords: { keyword: string; volume: number; position: number; traffic: number; difficulty: number }[];
  relatedKeywords?: { keyword: string; volume: number; difficulty: number; cpc: number }[];
  strikingDistanceKeywords?: { keyword: string; volume: number; position: number; traffic: number; difficulty: number }[];
  topPages?: { url: string; traffic: number; keywords: number; topKeyword: string; topKeywordPosition: number; topKeywordVolume: number; referringDomains: number; urlRating: number; trafficValue: number }[];
}

interface SeoComparisonData {
  rows: { category: string; check: string; targetValue: string; competitorValue: string; status: string; explanation?: string }[];
  targetAhrefs: Record<string, unknown>;
  competitorAhrefs: Record<string, unknown>;
  targetPageSpeed: Record<string, unknown>;
  competitorPageSpeed: Record<string, unknown>;
}

interface SeoHygieneData {
  score: number;
  findings: { category: string; check: string; status: string; description: string; explanation?: string; fix: string | null; weight: number }[];
}

interface HipaaData {
  riskLevel: string;
  findings: { severity: string; check: string; description: string; pageUrl: string; whyRisk: string; recommendedFix: string }[];
}

interface LocalSearchData {
  screenshots: { url: string; caption: string }[];
}

const SECTIONS = ['Overview', 'SEO', 'Page Speed', 'HIPAA Audit', 'Opportunities', 'Local Search'] as const;
type Section = typeof SECTIONS[number];

function letterGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function scoreColor(score: number | null, t?: Record<string, string>, type: 'general' | 'seo' = 'general'): string {
  if (score === null) return 'text-gray-400';
  if (type === 'seo') {
    const warn = parseFloat(t?.threshold_seo_warn || '60');
    return score < warn ? 'text-brand-red' : 'text-brand-orange';
  }
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

const STATUS_ICON: Record<string, string> = {
  pass: 'text-brand-charcoal',
  fail: 'text-brand-rose',
  warning: 'text-brand-gold',
};

const SEVERITY_COLORS: Record<string, string> = {
  high: 'bg-white border border-brand-rose text-brand-rose',
  medium: 'bg-white border border-brand-gold text-brand-gold',
  low: 'bg-white border border-brand-sky text-brand-charcoal-light',
  pass: 'bg-white border border-brand-sage text-brand-sage-dark',
};

const RISK_COLORS: Record<string, string> = {
  Low: 'bg-white border border-brand-sage text-brand-sage-dark',
  Moderate: 'bg-white border border-brand-gold text-brand-gold',
  High: 'bg-white border border-brand-rose text-brand-rose-dark',
};

export default function AnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [rerunning, setRerunning] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>('Overview');
  const [isShared, setIsShared] = useState(false);
  const [error, setError] = useState('');
  const [sectionDescs, setSectionDescs] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setSectionDescs);
  }, []);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    async function poll() {
      try {
        const res = await fetch(`/api/analysis/${id}`);
        if (!res.ok) throw new Error('Analysis not found');
        const data = await res.json();
        if (data.hipaaRiskLevel === 'Critical') data.hipaaRiskLevel = 'High';
        setAnalysis(data);
        setIsShared(data.isPublic);

        // Stop polling when complete or errored
        if (data.status === 'complete' || data.status === 'error') {
          clearInterval(intervalId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analysis');
        clearInterval(intervalId);
      }
    }

    poll();
    intervalId = setInterval(poll, 3000);

    return () => clearInterval(intervalId);
  }, [id]);

  async function rerunAnalysis() {
    if (!analysis || rerunning) return;
    setRerunning(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl: analysis.siteUrl,
          competitorUrl: analysis.competitorUrl || undefined,
          keyword: analysis.keyword || undefined,
        }),
      });
      const data = await res.json();
      if (data.id) router.push(`/analysis/${data.id}`);
    } catch {
      setRerunning(false);
    }
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  // Pending / Running states
  if (analysis.status === 'pending' || analysis.status === 'running') {
    const progress = analysis.progress || 0;
    const ageMs = Date.now() - new Date(analysis.createdAt).getTime();
    const isStuck = ageMs > 10 * 60 * 1000; // 10 minutes

    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="bg-white rounded-lg shadow-sm p-14">
          <h2 className="text-xl font-bold text-brand-charcoal mb-8">
            Analyzing {analysis.siteUrl}
          </h2>

          <div className="w-full bg-gray-100 rounded-full h-2.5 mb-3 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-700 ease-out ${isStuck ? 'bg-brand-gold' : 'bg-brand-sky-vivid'}`}
              style={{ width: `${Math.max(progress, 2)}%` }}
            />
          </div>
          <div className="flex justify-between items-center mb-8">
            <p className="text-sm text-gray-500">
              {isStuck ? 'This analysis appears to be stuck.' : (analysis.progressLabel || 'Starting analysis...')}
            </p>
            <span className="text-sm font-medium text-gray-500">{progress}%</span>
          </div>

          {isStuck ? (
            <div>
              <p className="text-sm text-gray-500 mb-4">
                It&apos;s been more than 10 minutes — something may have gone wrong. You can try running it again.
              </p>
              <button
                onClick={rerunAnalysis}
                disabled={rerunning}
                className="px-5 py-2.5 text-sm font-medium bg-brand-charcoal text-white rounded-lg hover:bg-brand-charcoal-light transition-colors disabled:opacity-50"
              >
                {rerunning ? 'Re-running...' : 'Re-run Analysis'}
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              This typically takes 30-90 seconds.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Error state
  if (analysis.status === 'error') {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="bg-white rounded-lg shadow-sm p-14">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-red-500 text-2xl font-bold">!</span>
          </div>
          <h2 className="text-xl font-bold text-brand-charcoal mb-2">Analysis Failed</h2>
          <p className="text-sm text-gray-500 mb-6">{analysis.error}</p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={rerunAnalysis}
              disabled={rerunning}
              className="px-5 py-2.5 text-sm font-medium bg-brand-charcoal text-white rounded-lg hover:bg-brand-charcoal-light transition-colors disabled:opacity-50"
            >
              {rerunning ? 'Re-running...' : 'Re-run Analysis'}
            </button>
            <a href="/" className="text-sm text-gray-400 hover:text-brand-charcoal transition-colors">Back to home</a>
          </div>
        </div>
      </div>
    );
  }

  // Complete — show dashboard
  const hasComparison = analysis.seoComparisonData !== null;

  const mobileScore = analysis.pageSpeedData?.mobile?.performanceScore ?? null;

  const sidebarItems: { section: Section; label: string; score?: string; scoreColor?: string; sublabel?: string; icon?: React.ReactNode }[] = [
    {
      section: 'Overview',
      label: analysis.overviewTitle || 'Overview',
      sublabel: isShared ? 'Shared' : 'Not shared',
      icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-7-7l7 7-7 7" /></svg>,
    },
    {
      section: 'SEO',
      label: 'Can Google Find Your Site?',
      score: analysis.seoHygieneScore !== null ? `${analysis.seoHygieneScore}` : undefined,
      scoreColor: scoreColor(analysis.seoHygieneScore, sectionDescs, 'seo'),
      sublabel: 'Hygiene & Comparison',
    },
    {
      section: 'Page Speed',
      label: 'Website Loading Time',
      score: mobileScore !== null ? `${mobileScore}` : undefined,
      scoreColor: scoreColor(mobileScore, sectionDescs),
      sublabel: 'Core Web Vitals',
    },
    {
      section: 'HIPAA Audit',
      label: 'HIPAA Audit',
      score: analysis.hipaaRiskLevel || undefined,
      scoreColor: analysis.hipaaRiskLevel === 'Moderate'
        ? 'text-brand-gold'
        : analysis.hipaaRiskLevel === 'Low'
        ? 'text-brand-charcoal'
        : 'text-brand-rose',
      sublabel: 'Compliance Risk',
    },
    {
      section: 'Opportunities',
      label: 'Opportunities',
      score: analysis.keywordData?.strikingDistanceKeywords
        ? `${analysis.keywordData.strikingDistanceKeywords.length}`
        : undefined,
      scoreColor: 'text-brand-charcoal',
      sublabel: 'Striking Distance Keywords',
    },
    {
      section: 'Local Search',
      label: 'Local Search',
      sublabel: 'How clients find you',
    },
  ];

  return (
    <div className="flex min-h-[calc(100vh-49px)] bg-brand-bg">
      {/* Sidebar */}
      <aside className="w-72 shrink-0 bg-white flex flex-col fixed top-0 bottom-0 left-0 pt-[49px]" style={{ boxShadow: 'none' }}>
        <div className="absolute top-0 bottom-0 -right-10 w-10 pointer-events-none" style={{ background: 'radial-gradient(ellipse at left center, rgba(0,0,0,0.07) 0%, transparent 60%)' }} />
        <div className="px-8 py-6 border-b border-gray-100">
          <h1 className="text-sm font-bold text-brand-charcoal truncate">{analysis.siteUrl}</h1>
          <p className="text-xs text-gray-400 mt-1">
            {new Date(analysis.createdAt).toLocaleDateString(undefined, {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
            {analysis.pagesScraped && (
              <span> &middot; {analysis.pagesScraped.length} pages</span>
            )}
          </p>
        </div>

        <nav className="flex-1 py-4 px-4">
          {sidebarItems.map((item) => (
            <button
              key={item.section}
              onClick={() => setActiveSection(item.section)}
              className={`w-full text-left px-4 py-3.5 rounded-lg transition-colors cursor-pointer ${
                activeSection === item.section
                  ? 'bg-gray-100'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${
                  activeSection === item.section ? 'text-brand-charcoal' : 'text-gray-500'
                }`}>{item.label}</span>
                {item.icon && <span className={activeSection === item.section ? 'text-brand-charcoal' : 'text-gray-400'}>{item.icon}</span>}
                {item.score && (
                  <span className={`text-sm font-bold ${item.scoreColor} ${activeSection === item.section ? 'bg-white rounded px-2 py-0.5 shadow-[0_1px_8px_-2px_rgba(0,0,0,0.10)]' : 'px-2 py-0.5'}`}>{item.score}</span>
                )}
              </div>
              {item.sublabel && (
                <p className="text-xs text-gray-400 mt-0.5">{item.sublabel}</p>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto ml-72">
        <div className="px-8 py-8 max-w-4xl">
          {/* Overview section */}
          {activeSection === 'Overview' && (
            <div className="space-y-3">
              <div className="bg-white rounded-lg border border-gray-200 p-8">
                <OverviewHeading
                  analysisId={id}
                  title={analysis.overviewTitle || 'Overview'}
                  subtitle={analysis.overviewSubtitle || 'A walkthrough of your website audit results.'}
                  onSave={(t, s) => setAnalysis(prev => prev ? { ...prev, overviewTitle: t, overviewSubtitle: s } : prev)}
                />
                <LoomVideo
                  analysisId={id}
                  loomUrl={analysis.loomUrl}
                  onUpdate={(url) => setAnalysis(prev => prev ? { ...prev, loomUrl: url || null } : prev)}
                />
              </div>
              <div className="flex items-center justify-between">
                <ShareToggle analysisId={id} isPublic={analysis.isPublic} passcode={analysis.sharePasscode} onToggle={setIsShared} />
                <button
                  onClick={rerunAnalysis}
                  disabled={rerunning}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-brand-charcoal transition-colors cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M20.49 9A9 9 0 005.64 5.64L4 4m16 16l-1.64-1.64A9 9 0 014.51 15" />
                  </svg>
                  {rerunning ? 'Re-running...' : 'Re-run Analysis'}
                </button>
              </div>
            </div>
          )}

          {/* SEO section */}
          {activeSection === 'SEO' && (
            <div className="space-y-3">
              {/* Hero card */}
              <SectionHero
                score={analysis.seoHygieneScore}
                scoreUnit={`/\u200a100`}
                scoreColor={scoreColor(analysis.seoHygieneScore, sectionDescs, 'seo')}
                scoreLabel={sectionDescs.seo_score_label || 'SEO Hygiene'}
                scoreLabelKey="seo_score_label"
                scoreSubtext={sectionDescs.seo_score_subtext || 'How well your site follows on-page SEO best practices'}
                scoreSubtextKey="seo_score_subtext"
                title={sectionDescs.seo_title || 'What is SEO?'}
                titleKey="seo_title"
                settingKey="seo_description"
                description={sectionDescs.seo_description || ''}
                onSave={(updates) => setSectionDescs(prev => ({ ...prev, ...updates }))}
                analysisId={id}
                customTitle={analysis.customSeoTitle}
                customDesc={analysis.customSeoDesc}
                customTitleField="customSeoTitle"
                customDescField="customSeoDesc"
                onCustomSave={(t, d) => setAnalysis(prev => prev ? { ...prev, customSeoTitle: t, customSeoDesc: d } : prev)}
                templateTitle={sectionDescs.template_seo_title}
                templateDesc={sectionDescs.template_seo_description}
              />

              {/* Comparison score card */}
              {hasComparison && analysis.seoComparisonScore !== null && (
                <div className="bg-white rounded-lg border border-gray-200 p-6 flex items-center gap-6">
                  <span className={`text-3xl font-bold ${scoreColor(analysis.seoComparisonScore, sectionDescs, 'seo')}`}>
                    {analysis.seoComparisonScore}<span className="text-lg font-normal text-gray-400 ml-0.5">{` /\u200a100`}</span>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-brand-charcoal">vs Competitor</p>
                    <p className="text-xs text-gray-400">How your SEO stacks up against your competitor</p>
                  </div>
                </div>
              )}

              {/* Hygiene findings */}
              {analysis.seoHygieneData && (
                <div>
                  <SeoHygieneTab data={analysis.seoHygieneData} sectionDescs={sectionDescs} onSaveDescs={(updates) => setSectionDescs(prev => ({ ...prev, ...updates }))} />
                </div>
              )}

              {/* Comparison table */}
              {hasComparison && analysis.seoComparisonData && (
                <div className="border-t border-gray-100 pt-6">
                  <h2 className="text-lg font-semibold text-brand-charcoal mb-4">SEO Comparison</h2>
                  <SeoComparisonTab data={analysis.seoComparisonData} />
                </div>
              )}
            </div>
          )}

          {/* Page Speed section */}
          {activeSection === 'Page Speed' && (
            <div className="space-y-3">
              <SectionHero
                score={mobileScore}
                scoreUnit={`/\u200a100`}
                scoreColor={scoreColor(mobileScore, sectionDescs)}
                scoreLabel="Performance"
                scoreSubtext="Google Lighthouse mobile performance score"
                title={sectionDescs.pagespeed_title || 'Why Page Speed Matters'}
                titleKey="pagespeed_title"
                settingKey="pagespeed_description"
                description={sectionDescs.pagespeed_description || ''}
                onSave={(updates) => setSectionDescs(prev => ({ ...prev, ...updates }))}
                analysisId={id}
                customTitle={analysis.customPagespeedTitle}
                customDesc={analysis.customPagespeedDesc}
                customTitleField="customPagespeedTitle"
                customDescField="customPagespeedDesc"
                onCustomSave={(t, d) => setAnalysis(prev => prev ? { ...prev, customPagespeedTitle: t, customPagespeedDesc: d } : prev)}
                templateTitle={sectionDescs.template_pagespeed_title}
                templateDesc={sectionDescs.template_pagespeed_description}
              />
              {analysis.pageSpeedData && <PageSpeedTab data={analysis.pageSpeedData} sectionDescs={sectionDescs} onSaveDescs={(updates) => setSectionDescs(prev => ({ ...prev, ...updates }))} />}
            </div>
          )}

          {/* HIPAA section */}
          {activeSection === 'HIPAA Audit' && (
            <div className="space-y-3">
              <SectionHero
                riskLevel={analysis.hipaaRiskLevel}
                scoreLabel="HIPAA Compliance"
                scoreSubtext="Risk level based on your website audit"
                title={sectionDescs.hipaa_title || 'What is HIPAA Compliance?'}
                titleKey="hipaa_title"
                settingKey="hipaa_description"
                description={sectionDescs.hipaa_description || ''}
                onSave={(updates) => setSectionDescs(prev => ({ ...prev, ...updates }))}
                analysisId={id}
                customTitle={analysis.customHipaaTitle}
                customDesc={analysis.customHipaaDesc}
                customTitleField="customHipaaTitle"
                customDescField="customHipaaDesc"
                onCustomSave={(t, d) => setAnalysis(prev => prev ? { ...prev, customHipaaTitle: t, customHipaaDesc: d } : prev)}
                templateTitle={sectionDescs.template_hipaa_title}
                templateDesc={sectionDescs.template_hipaa_description}
              />
              {analysis.hipaaData && <HipaaTab data={analysis.hipaaData} sectionDescs={sectionDescs} onSaveDescs={(updates) => setSectionDescs(prev => ({ ...prev, ...updates }))} />}
            </div>
          )}

          {/* Opportunities section */}
          {activeSection === 'Opportunities' && (
            <div className="space-y-3">
              <SectionHero
                score={analysis.keywordData?.strikingDistanceKeywords?.length ?? null}
                scoreColor="text-brand-charcoal"
                scoreLabel="Opportunities"
                scoreSubtext="Keywords ranking 3–10, close to top of page 1"
                title={sectionDescs.keywords_title || 'Why Keywords Matter'}
                titleKey="keywords_title"
                settingKey="keywords_description"
                description={sectionDescs.keywords_description || ''}
                onSave={(updates) => setSectionDescs(prev => ({ ...prev, ...updates }))}
                analysisId={id}
                customTitle={analysis.customKeywordsTitle}
                customDesc={analysis.customKeywordsDesc}
                customTitleField="customKeywordsTitle"
                customDescField="customKeywordsDesc"
                onCustomSave={(t, d) => setAnalysis(prev => prev ? { ...prev, customKeywordsTitle: t, customKeywordsDesc: d } : prev)}
                templateTitle={sectionDescs.template_keywords_title}
                templateDesc={sectionDescs.template_keywords_description}
              />
              {analysis.keywordData && <KeywordsTab data={analysis.keywordData} sectionDescs={sectionDescs} onSaveDescs={(updates) => setSectionDescs(prev => ({ ...prev, ...updates }))} />}
            </div>
          )}

          {/* Local Search section */}
          {activeSection === 'Local Search' && (
            <div className="space-y-3">
              <SectionHero
                scoreLabel="Local Search"
                scoreSubtext="How clients discover your practice"
                title={sectionDescs.local_search_title || 'Local Search Visibility'}
                titleKey="local_search_title"
                settingKey="local_search_description"
                description={sectionDescs.local_search_description || ''}
                onSave={(updates) => setSectionDescs(prev => ({ ...prev, ...updates }))}
                analysisId={id}
                customTitle={analysis.customLocalSearchTitle}
                customDesc={analysis.customLocalSearchDesc}
                customTitleField="customLocalSearchTitle"
                customDescField="customLocalSearchDesc"
                onCustomSave={(t, d) => setAnalysis(prev => prev ? { ...prev, customLocalSearchTitle: t, customLocalSearchDesc: d } : prev)}
                templateTitle={sectionDescs.template_local_search_title}
                templateDesc={sectionDescs.template_local_search_description}
              />
              <LocalSearchTab
                data={analysis.localSearchData}
                analysisId={id}
                onUpdate={(data) => setAnalysis(prev => prev ? { ...prev, localSearchData: data } : prev)}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function SeoComparisonTab({ data }: { data: SeoComparisonData }) {
  const categories = [...new Set(data.rows.map((r) => r.category))];

  return (
    <div className="divide-y divide-gray-100">
      {categories.map((category) => (
        <div key={category} className="py-6">
          <h2 className="text-lg font-semibold text-brand-charcoal mb-4">
            {category}
          </h2>
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
              {data.rows
                .filter((r) => r.category === category)
                .map((row, i) => (
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

type Finding = SeoHygieneData['findings'][number];

function SeoSummaryBlock({ analysisId, initial }: { analysisId: string; initial: string }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(initial);

  async function save() {
    await fetch(`/api/analysis/${analysisId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seoSummary: text }),
    });
    setSaved(text);
    setEditing(false);
  }

  function cancel() {
    setText(saved);
    setEditing(false);
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-brand-charcoal">Summary</h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-brand-sky resize-y"
          />
          <div className="flex gap-2 mt-3 justify-end">
            <button
              onClick={cancel}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="px-4 py-2 text-xs font-medium bg-brand-charcoal-light text-white rounded-md hover:bg-brand-charcoal transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{saved}</p>
      )}
    </div>
  );
}

function OverviewHeading({ analysisId, title, subtitle, onSave }: {
  analysisId: string; title: string; subtitle: string; onSave: (title: string, subtitle: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [editSubtitle, setEditSubtitle] = useState(subtitle);

  useEffect(() => { setEditTitle(title); }, [title]);
  useEffect(() => { setEditSubtitle(subtitle); }, [subtitle]);

  async function save() {
    await fetch(`/api/analysis/${analysisId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overviewTitle: editTitle, overviewSubtitle: editSubtitle }),
    });
    onSave(editTitle, editSubtitle);
    setEditing(false);
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        {editing ? (
          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
            className="text-lg font-semibold text-brand-charcoal border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-sky w-full mr-4" />
        ) : (
          <h2 className="text-lg font-semibold text-brand-charcoal">{editTitle}</h2>
        )}
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer shrink-0">Edit</button>
        )}
      </div>
      {editing ? (
        <div>
          <textarea value={editSubtitle} onChange={(e) => setEditSubtitle(e.target.value)} rows={2}
            className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-brand-sky resize-y" />
          <div className="flex gap-2 mt-2 justify-end">
            <button onClick={() => { setEditTitle(title); setEditSubtitle(subtitle); setEditing(false); }}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600">Cancel</button>
            <button onClick={save} className="px-4 py-2 text-xs font-medium bg-brand-charcoal-light text-white rounded-md hover:bg-brand-charcoal transition-colors">Save</button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500 leading-relaxed">{editSubtitle}</p>
      )}
    </div>
  );
}

function EditableTitle({
  title, titleKey, sectionDescs, onSaveDescs,
}: {
  title: string; titleKey: string;
  sectionDescs: Record<string, string>; onSaveDescs: (updates: Record<string, string>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(sectionDescs[titleKey] || title);

  useEffect(() => { setEditTitle(sectionDescs[titleKey] || title); }, [sectionDescs[titleKey], title]);

  async function save() {
    const updates = { [titleKey]: editTitle };
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
    onSaveDescs(updates);
    setEditing(false);
  }

  return (
    <div className="flex items-center justify-between mb-4">
      {editing ? (
        <div className="flex items-center gap-2 w-full">
          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
            className="text-lg font-semibold text-brand-charcoal border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-sky flex-1" />
          <button onClick={save} className="px-3 py-1.5 text-xs font-medium bg-brand-charcoal-light text-white rounded-md hover:bg-brand-charcoal transition-colors">Save</button>
          <button onClick={() => { setEditTitle(sectionDescs[titleKey] || title); setEditing(false); }}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600">Cancel</button>
        </div>
      ) : (
        <>
          <h2 className="text-lg font-semibold text-brand-charcoal">{editTitle}</h2>
          <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer shrink-0">Edit</button>
        </>
      )}
    </div>
  );
}

function EditableHeading({
  title, titleKey, subtitle, subtitleKey, sectionDescs, onSaveDescs,
}: {
  title: string; titleKey: string; subtitle: string; subtitleKey: string;
  sectionDescs: Record<string, string>; onSaveDescs: (updates: Record<string, string>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(sectionDescs[titleKey] || title);
  const [editSubtitle, setEditSubtitle] = useState(sectionDescs[subtitleKey] || subtitle);

  useEffect(() => { setEditTitle(sectionDescs[titleKey] || title); }, [sectionDescs[titleKey], title]);
  useEffect(() => { setEditSubtitle(sectionDescs[subtitleKey] || subtitle); }, [sectionDescs[subtitleKey], subtitle]);

  async function save() {
    const updates = { [titleKey]: editTitle, [subtitleKey]: editSubtitle };
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
    onSaveDescs(updates);
    setEditing(false);
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        {editing ? (
          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
            className="text-lg font-semibold text-brand-charcoal border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-sky w-full mr-4" />
        ) : (
          <h2 className="text-lg font-semibold text-brand-charcoal">{editTitle}</h2>
        )}
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer shrink-0">Edit</button>
        )}
      </div>
      {editing ? (
        <div>
          <textarea value={editSubtitle} onChange={(e) => setEditSubtitle(e.target.value)} rows={2}
            className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-brand-sky resize-y" />
          <div className="flex gap-2 mt-2 justify-end">
            <button onClick={() => { setEditTitle(sectionDescs[titleKey] || title); setEditSubtitle(sectionDescs[subtitleKey] || subtitle); setEditing(false); }}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600">Cancel</button>
            <button onClick={save} className="px-4 py-2 text-xs font-medium bg-brand-charcoal-light text-white rounded-md hover:bg-brand-charcoal transition-colors">Save</button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500 leading-relaxed">{editSubtitle}</p>
      )}
    </div>
  );
}

function SectionHero({
  score,
  riskLevel,
  scoreUnit,
  scoreColor: scoreColorOverride,
  scoreLabel,
  scoreLabelKey,
  scoreSubtext,
  scoreSubtextKey,
  title,
  titleKey,
  settingKey,
  description,
  onSave,
  analysisId,
  customTitle,
  customDesc,
  customTitleField,
  customDescField,
  onCustomSave,
  templateTitle,
  templateDesc,
}: {
  score?: number | null;
  riskLevel?: string | null;
  scoreUnit?: string;
  scoreColor?: string;
  scoreLabel: string;
  scoreLabelKey?: string;
  scoreSubtext: string;
  scoreSubtextKey?: string;
  title: string;
  titleKey: string;
  settingKey: string;
  description: string;
  onSave: (updates: Record<string, string>) => void;
  analysisId: string;
  customTitle: string | null;
  customDesc: string | null;
  customTitleField: string;
  customDescField: string;
  onCustomSave: (title: string | null, desc: string | null) => void;
  templateTitle?: string;
  templateDesc?: string;
}) {
  const isCustom = customDesc !== null;
  const [mode, setMode] = useState<'default' | 'custom'>(isCustom ? 'custom' : 'default');
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState((mode === 'custom' && customTitle !== null ? customTitle : title) || '');
  const [text, setText] = useState((mode === 'custom' && customDesc !== null ? customDesc : description) || '');
  const [editScoreLabel, setEditScoreLabel] = useState(scoreLabel);
  const [editScoreSubtext, setEditScoreSubtext] = useState(scoreSubtext);

  // Sync mode when custom data loads from API
  useEffect(() => {
    if (customDesc !== null && mode === 'default') setMode('custom');
  }, [customDesc]);

  // Sync when data loads from API
  useEffect(() => {
    if (mode === 'default') { setText(description || ''); setEditTitle(title || ''); }
  }, [description, title, mode]);
  useEffect(() => {
    if (mode === 'custom') {
      setText((customDesc !== null ? customDesc : (templateDesc || description)) || '');
      setEditTitle((customTitle !== null ? customTitle : (templateTitle || title)) || '');
    }
  }, [customDesc, customTitle, mode, description, title, templateDesc, templateTitle]);
  useEffect(() => { setEditScoreLabel(scoreLabel); }, [scoreLabel]);
  useEffect(() => { setEditScoreSubtext(scoreSubtext); }, [scoreSubtext]);

  function handleModeSwitch(newMode: 'default' | 'custom') {
    if (newMode === mode) return;
    setEditing(false);
    setMode(newMode);
    if (newMode === 'custom') {
      // Pre-populate with custom values, then template, then defaults
      setText((customDesc !== null ? customDesc : (templateDesc || description)) || '');
      setEditTitle((customTitle !== null ? customTitle : (templateTitle || title)) || '');
    } else {
      setText(description || '');
      setEditTitle(title || '');
    }
  }

  async function save() {
    if (mode === 'default') {
      const updates: Record<string, string> = { [settingKey]: text, [titleKey]: editTitle };
      if (scoreLabelKey) updates[scoreLabelKey] = editScoreLabel;
      if (scoreSubtextKey) updates[scoreSubtextKey] = editScoreSubtext;
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      onSave(updates);
    } else {
      // Save custom per-analysis
      const body: Record<string, string> = { [customTitleField]: editTitle, [customDescField]: text };
      await fetch(`/api/analysis/${analysisId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      onCustomSave(editTitle, text);
    }
    setEditing(false);
  }

  async function revertToDefault() {
    // Clear custom fields
    await fetch(`/api/analysis/${analysisId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [customTitleField]: null, [customDescField]: null }),
    });
    onCustomSave(null, null);
    setMode('default');
    setText(description);
    setEditTitle(title);
    setEditing(false);
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 px-8 py-10 flex gap-8">
      {/* Score — 1/3 */}
      <div className="w-1/3 flex flex-col justify-center border-r border-gray-100 mx-auto px-8">
        {riskLevel ? (
          <span className={`text-2xl font-bold ${
            riskLevel === 'Moderate' ? 'text-brand-gold' :
            riskLevel === 'Low' ? 'text-brand-charcoal' :
            'text-brand-rose'
          }`}>{riskLevel}</span>
        ) : (
          <span className={`text-4xl font-bold ${scoreColorOverride || 'text-brand-orange'}`}>
            {score ?? '—'}{!riskLevel && scoreUnit && <span className="text-xl font-normal text-gray-400">{scoreUnit}</span>}
          </span>
        )}
        {editing && !!scoreLabelKey ? (
          <input value={editScoreLabel} onChange={(e) => setEditScoreLabel(e.target.value)}
            className="text-sm font-semibold text-brand-charcoal mt-2 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-sky w-full" />
        ) : (
          <p className="text-sm font-semibold text-brand-charcoal mt-2">{editScoreLabel}</p>
        )}
        {editing && !!scoreSubtextKey ? (
          <input value={editScoreSubtext} onChange={(e) => setEditScoreSubtext(e.target.value)}
            className="text-xs text-gray-400 mt-0.5 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-sky w-full" />
        ) : (
          <p className="text-xs text-gray-400 mt-0.5">{editScoreSubtext}</p>
        )}
      </div>
      {/* Description — 2/3 */}
      <div className="w-2/3 flex flex-col justify-center">
        <div className="flex items-center justify-between mb-2">
          {editing ? (
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="text-lg font-semibold text-brand-charcoal border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-sky w-full mr-4"
            />
          ) : (
            <h2 className="text-lg font-semibold text-brand-charcoal">{editTitle}</h2>
          )}
          <div className="flex items-center gap-2 shrink-0">
            {/* Default / Custom toggle */}
            <div className="flex rounded-md border border-gray-200 text-[11px] overflow-hidden">
              <button
                onClick={() => handleModeSwitch('default')}
                className={`px-2.5 py-1 transition-colors ${mode === 'default' ? 'bg-brand-charcoal text-white' : 'text-gray-400 hover:text-gray-600'}`}
              >Default</button>
              <button
                onClick={() => handleModeSwitch('custom')}
                className={`px-2.5 py-1 transition-colors ${mode === 'custom' ? 'bg-brand-charcoal text-white' : 'text-gray-400 hover:text-gray-600'}`}
              >Custom</button>
            </div>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                Edit
              </button>
            )}
          </div>
        </div>
        {editing ? (
          <div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-brand-sky resize-y"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-gray-400">
                {mode === 'default' ? 'Saves across all analyses' : 'Saves to this analysis only'}
              </span>
              <div className="flex gap-2">
                {mode === 'custom' && customDesc !== null && (
                  <button onClick={revertToDefault} className="px-3 py-1.5 text-xs text-brand-red hover:text-red-700">
                    Revert to Default
                  </button>
                )}
                <button
                  onClick={() => { setText(mode === 'custom' ? (customDesc !== null ? customDesc : (templateDesc || description)) : description); setEditTitle(mode === 'custom' ? (customTitle !== null ? customTitle : (templateTitle || title)) : title); setEditing(false); }}
                  className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  className="px-4 py-2 text-xs font-medium bg-brand-charcoal-light text-white rounded-md hover:bg-brand-charcoal transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 leading-relaxed">{text}</p>
        )}
      </div>
    </div>
  );
}

function FindingCard({ finding, sectionDescs, onSaveDescs }: { finding: Finding; sectionDescs?: Record<string, string>; onSaveDescs?: (updates: Record<string, string>) => void }) {
  const checkKey = `finding_check_${finding.check.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const descKey = `finding_desc_${finding.check.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const displayCheck = sectionDescs?.[checkKey] || finding.check;
  const displayDesc = sectionDescs?.[descKey] || finding.description;

  const [editing, setEditing] = useState(false);
  const [editCheck, setEditCheck] = useState(displayCheck);
  const [editDesc, setEditDesc] = useState(displayDesc);

  useEffect(() => { setEditCheck(sectionDescs?.[checkKey] || finding.check); }, [sectionDescs?.[checkKey], finding.check]);
  useEffect(() => { setEditDesc(sectionDescs?.[descKey] || finding.description); }, [sectionDescs?.[descKey], finding.description]);

  async function save() {
    const updates = { [checkKey]: editCheck, [descKey]: editDesc };
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
    onSaveDescs?.(updates);
    setEditing(false);
  }

  return (
    <div className="flex items-start gap-3 pt-4 pb-5">
      <span className={`mt-0.5 font-bold text-sm ${STATUS_ICON[finding.status]}`}>
        {finding.status === 'pass' ? '\u2713' : finding.status === 'fail' ? '\u2717' : '\u26A0'}
      </span>
      <div className="flex-1">
        {editing ? (
          <div className="space-y-2">
            <input value={editCheck} onChange={(e) => setEditCheck(e.target.value)}
              className="font-medium text-brand-charcoal text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-sky w-full" />
            <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2}
              className="w-full text-sm text-gray-600 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-sky resize-y" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setEditCheck(displayCheck); setEditDesc(displayDesc); setEditing(false); }}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600">Cancel</button>
              <button onClick={save} className="px-3 py-1.5 text-xs font-medium bg-brand-charcoal-light text-white rounded-md hover:bg-brand-charcoal transition-colors">Save</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="font-medium text-brand-charcoal text-sm">{editCheck}</span>
              {onSaveDescs && (
                <button onClick={() => setEditing(true)} className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">Edit</button>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-0.5">{editDesc}</p>
            {finding.explanation && (
              <p className="text-xs text-gray-600 mt-1">{finding.explanation}</p>
            )}
            {finding.fix && (
              <p className="text-xs text-brand-rose mt-1">Fix: {finding.fix}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ExpandableList({ items, label, limit = 3, sectionDescs, onSaveDescs }: { items: Finding[]; label: string; limit?: number; sectionDescs?: Record<string, string>; onSaveDescs?: (updates: Record<string, string>) => void }) {
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
            <FindingCard finding={finding} sectionDescs={sectionDescs} onSaveDescs={onSaveDescs} />
          </div>
        );
      })}
      {showingExpander && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full py-2.5 text-sm font-medium text-brand-charcoal-light hover:text-brand-charcoal bg-gray-100 hover:bg-gray-200 rounded-md transition-colors cursor-pointer"
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

function SeoHygieneTab({ data, sectionDescs, onSaveDescs }: { data: SeoHygieneData; sectionDescs: Record<string, string>; onSaveDescs: (updates: Record<string, string>) => void }) {
  const categories = [...new Set(data.findings.map((f) => f.category))];

  const settingsKeyMap: Record<string, string> = {
    'On-Page': 'seo_onpage_title',
    'Technical': 'seo_technical_title',
    'Local SEO': 'seo_local_title',
  };

  return (
    <div className="space-y-3">
      {categories.map((category) => {
        const catFindings = data.findings.filter((f) => f.category === category);
        const titleKey = settingsKeyMap[category] || `seo_${category.toLowerCase().replace(/\s+/g, '_')}_title`;
        const displayTitle = sectionDescs[titleKey] || category;

        if (category === 'On-Page') {
          const checkTypes = [...new Set(catFindings.map((f) => f.check))];
          return (
            <div key={category} className="bg-white rounded-lg border border-gray-200 p-6">
              <EditableTitle title={displayTitle} titleKey={titleKey} sectionDescs={sectionDescs} onSaveDescs={onSaveDescs} />
              <div className="space-y-5">
                {checkTypes.map((checkType) => {
                  const group = catFindings.filter((f) => f.check === checkType);
                  return (
                    <div key={checkType}>
                      {group.length > 1 && (
                        <p className="text-xs font-medium text-gray-600 mb-2">{checkType} ({group.length})</p>
                      )}
                      <ExpandableList items={group} label={checkType} limit={3} sectionDescs={sectionDescs} onSaveDescs={onSaveDescs} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        return (
          <div key={category} className="bg-white rounded-lg border border-gray-200 p-6">
            <EditableTitle title={displayTitle} titleKey={titleKey} sectionDescs={sectionDescs} onSaveDescs={onSaveDescs} />
            <ExpandableList items={catFindings} label={category} limit={3} sectionDescs={sectionDescs} onSaveDescs={onSaveDescs} />
          </div>
        );
      })}
    </div>
  );
}

function generatePasscode(): string {
  const chars = '0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function ShareToggle({ analysisId, isPublic: initialPublic, passcode: initialPasscode, onToggle }: { analysisId: string; isPublic: boolean; passcode: string | null; onToggle?: (isPublic: boolean) => void }) {
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [copied, setCopied] = useState(false);
  const [passcode, setPasscode] = useState(initialPasscode || '');
  const [passcodeSaved, setPasscodeSaved] = useState(!!initialPasscode);
  const [editingPasscode, setEditingPasscode] = useState(false);

  async function toggle() {
    const next = !isPublic;
    let newPasscode = passcode;
    if (next && !passcodeSaved) {
      // Auto-generate passcode when enabling share
      newPasscode = generatePasscode();
      setPasscode(newPasscode);
    }
    await fetch(`/api/share/${analysisId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isPublic: next,
        sharePasscode: next ? newPasscode : passcode || null,
      }),
    });
    if (next && !passcodeSaved) setPasscodeSaved(true);
    setIsPublic(next);
    onToggle?.(next);
  }

  function copyLink() {
    const url = `${window.location.origin}/share/${analysisId}`;
    const text = passcodeSaved
      ? `Link: ${url}\nPasscode: ${passcode}`
      : `Link: ${url}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function savePasscode() {
    await fetch(`/api/share/${analysisId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublic, sharePasscode: passcode.trim() || null }),
    });
    setPasscodeSaved(!!passcode.trim());
    setEditingPasscode(false);
  }

  async function removePasscode() {
    await fetch(`/api/share/${analysisId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublic, sharePasscode: null }),
    });
    setPasscode('');
    setPasscodeSaved(false);
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-gray-500">Share</span>
          <button
            onClick={toggle}
            role="switch"
            aria-checked={isPublic}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              isPublic ? 'bg-brand-sage' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                isPublic ? 'translate-x-4.5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </label>
        {isPublic && (
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-charcoal-light hover:text-brand-charcoal transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        )}
      </div>
      {isPublic && (
        <div className="flex items-center gap-3">
          {editingPasscode ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter passcode..."
                autoFocus
                className="w-36 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-sky"
              />
              <button onClick={savePasscode} className="text-xs font-medium text-brand-charcoal-light hover:text-brand-charcoal">Save</button>
              <button onClick={() => { setPasscode(initialPasscode || ''); setEditingPasscode(false); }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          ) : passcodeSaved ? (
            <div className="flex items-center gap-2">
              <svg className="w-3 h-3 text-brand-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <span className="text-xs text-gray-500">Passcode: <span className="font-mono font-medium text-brand-charcoal">{passcode}</span></span>
              <button onClick={() => setEditingPasscode(true)} className="text-xs text-gray-400 hover:text-gray-600">Change</button>
              <button onClick={removePasscode} className="text-xs text-gray-400 hover:text-brand-red">Remove</button>
            </div>
          ) : (
            <button
              onClick={async () => {
                const code = generatePasscode();
                setPasscode(code);
                await fetch(`/api/share/${analysisId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ isPublic, sharePasscode: code }),
                });
                setPasscodeSaved(true);
              }}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              Add passcode
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function LoomVideo({ analysisId, loomUrl: initialUrl, onUpdate }: { analysisId: string; loomUrl: string | null; onUpdate: (url: string | null) => void }) {
  const [loomUrl, setLoomUrl] = useState(initialUrl || '');
  const [showInput, setShowInput] = useState(false);
  const hasVideo = !!initialUrl;

  async function save() {
    const url = loomUrl.trim();
    await fetch(`/api/analysis/${analysisId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loomUrl: url }),
    });
    onUpdate(url || null);
    setShowInput(false);
  }

  async function remove() {
    await fetch(`/api/analysis/${analysisId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loomUrl: '' }),
    });
    setLoomUrl('');
    onUpdate(null);
  }

  if (hasVideo) {
    return (
      <div>
        <div className="aspect-video rounded-lg overflow-hidden">
          <iframe
            src={initialUrl!.replace('/share/', '/embed/')}
            frameBorder="0"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
        <div className="flex justify-end mt-3">
          <button
            onClick={remove}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-red transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Remove video
          </button>
        </div>
      </div>
    );
  }

  if (showInput) {
    return (
      <div className="aspect-video bg-gray-50 rounded-lg flex items-center justify-center">
        <div className="w-full max-w-md space-y-3 px-8">
          <input
            type="url"
            placeholder="Paste Loom URL..."
            value={loomUrl}
            onChange={(e) => setLoomUrl(e.target.value)}
            autoFocus
            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-sky"
          />
          <div className="flex gap-2 justify-center">
            <button
              onClick={save}
              disabled={!loomUrl.trim()}
              className="px-4 py-2 text-xs font-medium bg-brand-charcoal text-white rounded-md hover:bg-brand-charcoal-light disabled:opacity-50 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => { setShowInput(false); setLoomUrl(''); }}
              className="px-4 py-2 text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="aspect-video bg-gray-50 rounded-lg flex items-center justify-center">
      <button
        onClick={() => setShowInput(true)}
        className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-brand-charcoal-light bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:text-brand-charcoal transition-colors cursor-pointer shadow-sm"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add a Loom video
      </button>
    </div>
  );
}

function HipaaFindingCard({ finding, isLast, sectionDescs, onSaveDescs }: {
  finding: HipaaData['findings'][number]; isLast: boolean;
  sectionDescs: Record<string, string>; onSaveDescs: (updates: Record<string, string>) => void;
}) {
  const checkKey = `hipaa_check_${finding.check.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const descKey = `hipaa_desc_${finding.check.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const displayCheck = sectionDescs[checkKey] || finding.check;
  const displayDesc = sectionDescs[descKey] || finding.description;

  const [editing, setEditing] = useState(false);
  const [editCheck, setEditCheck] = useState(displayCheck);
  const [editDesc, setEditDesc] = useState(displayDesc);

  useEffect(() => { setEditCheck(sectionDescs[checkKey] || finding.check); }, [sectionDescs[checkKey], finding.check]);
  useEffect(() => { setEditDesc(sectionDescs[descKey] || finding.description); }, [sectionDescs[descKey], finding.description]);

  async function save() {
    const updates = { [checkKey]: editCheck, [descKey]: editDesc };
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
    onSaveDescs(updates);
    setEditing(false);
  }

  return (
    <div className={`pt-6 pb-7 ${!isLast ? 'border-b border-gray-100' : ''}`}>
      <span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize inline-block ${SEVERITY_COLORS[finding.severity]}`}>
        {finding.severity}
      </span>
      {editing ? (
        <div className="mt-2 space-y-2">
          <input value={editCheck} onChange={(e) => setEditCheck(e.target.value)}
            className="font-medium text-sm text-brand-charcoal border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-sky w-full" />
          <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2}
            className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-sky resize-y" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setEditCheck(displayCheck); setEditDesc(displayDesc); setEditing(false); }}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600">Cancel</button>
            <button onClick={save} className="px-3 py-1.5 text-xs font-medium bg-brand-charcoal-light text-white rounded-md hover:bg-brand-charcoal transition-colors">Save</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mt-2">
            <span className="font-semibold text-base text-brand-charcoal">{editCheck}</span>
            <button onClick={() => setEditing(true)} className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">Edit</button>
          </div>
          <div className="flex gap-2 mt-4">
            <Search className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700">{editDesc}</p>
          </div>
          {finding.whyRisk && finding.severity !== 'pass' && (
            <div className="flex gap-2 mt-5">
              <AlertTriangle className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
              <p className="text-sm text-gray-600">{finding.whyRisk}</p>
            </div>
          )}
          {finding.recommendedFix && finding.severity !== 'pass' && (
            <div className="flex gap-2 mt-5">
              <Wrench className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700"><span className="font-semibold">Fix:</span> {finding.recommendedFix}</p>
            </div>
          )}
          {finding.pageUrl && (
            <div className="flex gap-2 mt-5">
              <ExternalLink className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
              <p className="text-sm text-gray-600">Page: {finding.pageUrl}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function HipaaTab({ data, sectionDescs, onSaveDescs }: { data: HipaaData; sectionDescs: Record<string, string>; onSaveDescs: (updates: Record<string, string>) => void }) {
  const sortedFindings = [...data.findings].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2, pass: 3 };
    return (order[a.severity as keyof typeof order] ?? 4) - (order[b.severity as keyof typeof order] ?? 4);
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-8">
      <EditableTitle title={sectionDescs.hipaa_findings_title || 'Findings'} titleKey="hipaa_findings_title" sectionDescs={sectionDescs} onSaveDescs={onSaveDescs} />
      {sortedFindings.map((finding, i) => (
        <HipaaFindingCard key={i} finding={finding} isLast={i === sortedFindings.length - 1} sectionDescs={sectionDescs} onSaveDescs={onSaveDescs} />
      ))}
    </div>
  );
}

function cwvRating(metric: string, value: number | null, t?: Record<string, string>): { label: string; color: string } {
  if (value === null) return { label: '—', color: 'text-gray-400' };
  const metricMap: Record<string, { goodKey: string; warnKey: string; goodDefault: number; warnDefault: number }> = {
    lcp: { goodKey: 'threshold_lcp_good', warnKey: 'threshold_lcp_warn', goodDefault: 2500, warnDefault: 4000 },
    cls: { goodKey: 'threshold_cls_good', warnKey: 'threshold_cls_warn', goodDefault: 0.1, warnDefault: 0.25 },
    fid: { goodKey: 'threshold_fid_good', warnKey: 'threshold_fid_warn', goodDefault: 200, warnDefault: 500 },
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

function MetricCard({ label, metric, value, sectionDescs, onSaveDescs }: { label: string; metric: string; value: number | null; sectionDescs?: Record<string, string>; onSaveDescs?: (updates: Record<string, string>) => void }) {
  const rating = cwvRating(metric, value, sectionDescs);
  const displayValue = metric === 'cls' ? (value !== null ? value.toFixed(3) : '—') : formatMs(value);
  const titleKey = `metric_label_${metric}`;
  const displayLabel = sectionDescs?.[titleKey] || label;

  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(displayLabel);

  useEffect(() => { setEditLabel(sectionDescs?.[titleKey] || label); }, [sectionDescs?.[titleKey], label]);

  async function save() {
    const updates = { [titleKey]: editLabel };
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
    onSaveDescs?.(updates);
    setEditing(false);
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      {editing ? (
        <div className="flex items-center gap-2 mb-1">
          <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)}
            className="text-xs text-brand-charcoal border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-sky flex-1" />
          <button onClick={save} className="text-[10px] font-medium bg-brand-charcoal-light text-white rounded-md px-2 py-1 hover:bg-brand-charcoal transition-colors">Save</button>
          <button onClick={() => { setEditLabel(displayLabel); setEditing(false); }} className="text-[10px] text-gray-400 hover:text-gray-600">Cancel</button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 mb-1">
          <p className="text-xs text-brand-charcoal">{editLabel}</p>
          {onSaveDescs && (
            <button onClick={() => setEditing(true)} className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">Edit</button>
          )}
        </div>
      )}
      <p className={`text-2xl font-bold ${rating.color}`}>{displayValue}</p>
      <p className={`text-xs font-medium mt-1 ${rating.color}`}>{rating.label}</p>
    </div>
  );
}

function PageSpeedScoreCard({
  score,
  scoreLabel,
  title,
  titleKey,
  subtitle,
  subtitleKey,
  sectionDescs,
  onSaveDescs,
}: {
  score: number | null;
  scoreLabel: string;
  title: string;
  titleKey: string;
  subtitle: string;
  subtitleKey: string;
  sectionDescs: Record<string, string>;
  onSaveDescs: (updates: Record<string, string>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(sectionDescs[titleKey] || title);
  const [editSubtitle, setEditSubtitle] = useState(sectionDescs[subtitleKey] || subtitle);

  useEffect(() => { setEditTitle(sectionDescs[titleKey] || title); }, [sectionDescs[titleKey], title]);
  useEffect(() => { setEditSubtitle(sectionDescs[subtitleKey] || subtitle); }, [sectionDescs[subtitleKey], subtitle]);

  const sc = scoreColor(score, sectionDescs);

  async function save() {
    const updates = { [titleKey]: editTitle, [subtitleKey]: editSubtitle };
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
    onSaveDescs(updates);
    setEditing(false);
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Score */}
      <div className="flex items-center mb-6">
        <span className={`text-4xl font-bold ${sc}`}>
          {score ?? '—'}<span className="text-lg font-normal text-gray-400 ml-0.5">{` /\u200a100`}</span>
        </span>
      </div>
      {/* Title + subtitle */}
      <div>
        <div className="flex items-center justify-between">
          {editing ? (
            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
              className="text-sm font-semibold text-brand-charcoal border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-sky w-full mr-4" />
          ) : (
            <h3 className="text-sm font-semibold text-brand-charcoal">{editTitle}</h3>
          )}
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer shrink-0">Edit</button>
          )}
        </div>
        {editing ? (
          <div className="mt-2">
            <textarea value={editSubtitle} onChange={(e) => setEditSubtitle(e.target.value)} rows={2}
              className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-brand-sky resize-y" />
            <div className="flex gap-2 mt-2 justify-end">
              <button onClick={() => { setEditTitle(sectionDescs[titleKey] || title); setEditSubtitle(sectionDescs[subtitleKey] || subtitle); setEditing(false); }}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600">Cancel</button>
              <button onClick={save} className="px-4 py-2 text-xs font-medium bg-brand-charcoal-light text-white rounded-md hover:bg-brand-charcoal transition-colors">Save</button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">{editSubtitle}</p>
        )}
      </div>
    </div>
  );
}

function SpeedScoreCard({
  score,
  scoreLabel,
  title,
  titleKey,
  subtitle,
  subtitleKey,
  sectionDescs,
  onSaveDescs,
}: {
  score: number | null;
  scoreLabel: string;
  title: string;
  titleKey: string;
  subtitle: string;
  subtitleKey: string;
  sectionDescs: Record<string, string>;
  onSaveDescs: (updates: Record<string, string>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(sectionDescs[titleKey] || title);
  const [editSubtitle, setEditSubtitle] = useState(sectionDescs[subtitleKey] || subtitle);

  useEffect(() => { setEditTitle(sectionDescs[titleKey] || title); }, [sectionDescs[titleKey], title]);
  useEffect(() => { setEditSubtitle(sectionDescs[subtitleKey] || subtitle); }, [sectionDescs[subtitleKey], subtitle]);

  // Estimate user drop-off from performance score
  // Based on Google research: poor performance exponentially increases bounce
  const dropoff = score !== null
    ? Math.round(score >= 90 ? (100 - score) * 0.3 : score >= 50 ? 5 + (90 - score) * 0.6 : 29 + (50 - score) * 0.8)
    : null;
  const dc = dropoffColor(dropoff, sectionDescs);

  async function save() {
    const updates = { [titleKey]: editTitle, [subtitleKey]: editSubtitle };
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    onSaveDescs(updates);
    setEditing(false);
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Drop-off hero */}
      <div className="flex items-center mb-6">
        <span className={`text-4xl font-bold ${dc}`}>
          -{dropoff ?? '—'}<span className="text-xl font-semibold ml-0.5">%</span>
        </span>
        <span className="text-sm text-gray-400 ml-auto">estimated</span>
      </div>
      {/* Label */}
      <div className="mb-1">
        <span className="text-sm text-brand-charcoal">{scoreLabel}</span>
      </div>
      {/* Title + subtitle */}
      <div>
        <div className="flex items-center justify-between">
          {editing ? (
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="text-sm font-semibold text-brand-charcoal border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-sky w-full mr-4"
            />
          ) : (
            <h3 className="text-sm font-semibold text-brand-charcoal">{editTitle}</h3>
          )}
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer shrink-0"
            >
              Edit
            </button>
          )}
        </div>
        {editing ? (
          <div className="mt-2">
            <textarea
              value={editSubtitle}
              onChange={(e) => setEditSubtitle(e.target.value)}
              rows={2}
              className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-brand-sky resize-y"
            />
            <div className="flex gap-2 mt-2 justify-end">
              <button
                onClick={() => { setEditTitle(sectionDescs[titleKey] || title); setEditSubtitle(sectionDescs[subtitleKey] || subtitle); setEditing(false); }}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="px-4 py-2 text-xs font-medium bg-brand-charcoal-light text-white rounded-md hover:bg-brand-charcoal transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">{editSubtitle}</p>
        )}
      </div>
    </div>
  );
}

function PageSpeedTab({ data, sectionDescs, onSaveDescs }: { data: FullPageSpeedData; sectionDescs: Record<string, string>; onSaveDescs: (updates: Record<string, string>) => void }) {
  // Use mobile filmstrip (more relevant for most users)
  const filmstrip = data.mobile.filmstrip.length > 0 ? data.mobile.filmstrip : data.desktop.filmstrip;

  return (
    <div className="space-y-3">
      {/* Desktop + Mobile score boxes side by side */}
      <div className="grid grid-cols-2 gap-3">
        <SpeedScoreCard
          score={data.desktop.performanceScore}
          scoreLabel="Desktop"
          title="Desktop Performance"
          titleKey="pagespeed_desktop_title"
          subtitle="How fast your site loads on a desktop computer with a broadband connection."
          subtitleKey="pagespeed_desktop_subtitle"
          sectionDescs={sectionDescs}
          onSaveDescs={onSaveDescs}
        />
        <SpeedScoreCard
          score={data.mobile.performanceScore}
          scoreLabel="Mobile"
          title="Mobile Performance"
          titleKey="pagespeed_mobile_title"
          subtitle="How fast your site loads on a phone with a typical 4G connection. Most of your potential clients will visit on mobile."
          subtitleKey="pagespeed_mobile_subtitle"
          sectionDescs={sectionDescs}
          onSaveDescs={onSaveDescs}
        />
      </div>

      {/* Desktop + Mobile performance scores */}
      <div className="grid grid-cols-2 gap-3">
        <PageSpeedScoreCard
          score={data.desktop.performanceScore}
          scoreLabel="Desktop"
          title="Desktop Score"
          titleKey="pagespeed_desktop_score_title"
          subtitle="Google Lighthouse performance score for desktop."
          subtitleKey="pagespeed_desktop_score_subtitle"
          sectionDescs={sectionDescs}
          onSaveDescs={onSaveDescs}
        />
        <PageSpeedScoreCard
          score={data.mobile.performanceScore}
          scoreLabel="Mobile"
          title="Mobile Score"
          titleKey="pagespeed_mobile_score_title"
          subtitle="Google Lighthouse performance score for mobile."
          subtitleKey="pagespeed_mobile_score_subtitle"
          sectionDescs={sectionDescs}
          onSaveDescs={onSaveDescs}
        />
      </div>

      {/* Filmstrip loading progression */}
      {filmstrip.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 overflow-hidden">
          <EditableHeading
            title={sectionDescs.pagespeed_filmstrip_title || 'Loading Timeline'}
            titleKey="pagespeed_filmstrip_title"
            subtitle={sectionDescs.pagespeed_filmstrip_subtitle || 'How your site loads over time on mobile — each frame shows what a visitor sees.'}
            subtitleKey="pagespeed_filmstrip_subtitle"
            sectionDescs={sectionDescs}
            onSaveDescs={onSaveDescs}
          />
          <div className="relative pb-8">
            {/* Right edge shadow — fades on all edges for soft look */}
            <div className="absolute right-0 top-0 bottom-0 w-12 z-30 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse at right center, rgba(0,0,0,0.18) 0%, transparent 70%)',
              }}
            />
            <div className="flex gap-3 overflow-x-auto pt-6 pb-8 pl-1 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {filmstrip.map((frame, i) => {
                // Frames under ~2KB are blank/white screens
                const isBlank = frame.data.length < 3000;
                const nextTiming = filmstrip[i + 1]?.timing ?? Infinity;

                // Drop-off lines: render after the frame whose timing is just before the threshold
                const maxTiming = filmstrip[filmstrip.length - 1]?.timing ?? 0;
                const dropOffLines: { ms: number; label: string; color: string }[] = [];
                if (frame.timing <= 3000 && nextTiming > 3000) {
                  dropOffLines.push({ ms: 3000, label: '~10% of visitors leave', color: '#EDA125' });
                }
                if (maxTiming >= 5000 && frame.timing <= 5000 && nextTiming > 5000) {
                  dropOffLines.push({ ms: 5000, label: '~50% of visitors leave', color: '#E53E3E' });
                }

                return (
                  <div key={i} className="flex items-start shrink-0 gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-[140px] h-56 rounded-lg overflow-hidden relative ${isBlank ? 'bg-white' : 'bg-gray-50'}`} style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.14)' }}>
                        {!isBlank && (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={frame.data}
                              alt={`Page at ${formatMs(frame.timing)}`}
                              className="w-full h-full object-cover object-top"
                            />
                          </>
                        )}
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

      {/* Core Web Vitals detail tables */}
      {[
        { key: 'mobile' as const, label: 'Mobile Metrics', metrics: data.mobile },
        { key: 'desktop' as const, label: 'Desktop Metrics', metrics: data.desktop },
      ].map(({ key, label, metrics }) => (
        !metrics.error && (
          <div key={key} className="bg-white rounded-lg border border-gray-200 p-8">
            <h2 className="text-lg font-semibold text-brand-charcoal mb-5">{label}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <MetricCard label="Largest Contentful Paint" metric="lcp" value={metrics.lcp} sectionDescs={sectionDescs} onSaveDescs={onSaveDescs} />
              <MetricCard label="Cumulative Layout Shift" metric="cls" value={metrics.cls} sectionDescs={sectionDescs} onSaveDescs={onSaveDescs} />
              <MetricCard label="Total Blocking Time" metric="tbt" value={metrics.tbt} sectionDescs={sectionDescs} onSaveDescs={onSaveDescs} />
              <MetricCard label="First Contentful Paint" metric="fcp" value={metrics.fcp} sectionDescs={sectionDescs} onSaveDescs={onSaveDescs} />
              <MetricCard label="Speed Index" metric="si" value={metrics.si} sectionDescs={sectionDescs} onSaveDescs={onSaveDescs} />
              <MetricCard label="Time to Interactive" metric="tti" value={metrics.tti} sectionDescs={sectionDescs} onSaveDescs={onSaveDescs} />
            </div>
          </div>
        )
      ))}
    </div>
  );
}

function KeywordsTab({ data, sectionDescs, onSaveDescs }: { data: KeywordData; sectionDescs: Record<string, string>; onSaveDescs: (updates: Record<string, string>) => void }) {
  const SOURCE_LABELS: Record<string, string> = {
    title: 'Page Title',
    'meta description': 'Meta Desc',
    h1: 'H1',
    h2: 'H2',
    h3: 'H3',
    body: 'Body',
    'alt text': 'Alt Text',
  };

  return (
    <div className="space-y-3">
      {/* Site Keywords (legacy — hidden when empty) */}
      {data.siteKeywords.length > 0 && (
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <h2 className="text-lg font-semibold text-brand-charcoal mb-2">Keywords Found on Your Site</h2>
        <p className="text-sm text-gray-500 mb-5">Most prominent keywords extracted from your website, ranked by prominence.</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="pb-2 font-medium">Keyword</th>
                <th className="pb-2 font-medium text-right">Prominence</th>
                <th className="pb-2 font-medium text-right">Found In</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.siteKeywords.map((kw, i) => (
                <tr key={i}>
                  <td className="py-3 font-medium text-brand-charcoal">{kw.keyword}</td>
                  <td className="py-3 text-right text-gray-600">{kw.frequency}</td>
                  <td className="py-3 text-right">
                    <div className="flex flex-wrap gap-1 justify-end">
                      {kw.foundIn.map((source) => (
                        <span key={source} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                          {SOURCE_LABELS[source] || source}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>
      )}

      {/* Empty state */}
      {(!data.strikingDistanceKeywords || data.strikingDistanceKeywords.length === 0) &&
       (!data.topPages || data.topPages.length === 0) &&
       data.organicKeywords.length === 0 &&
       data.siteKeywords.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-sm">We weren&apos;t able to find keyword or ranking data for this site. This usually means the site is new, has very low traffic, or isn&apos;t yet indexed by major SEO tools.</p>
          <p className="text-gray-400 text-xs mt-3">Try re-running the analysis later, or check that the URL is correct.</p>
        </div>
      )}

      {/* Striking Distance Keywords */}
      {data.strikingDistanceKeywords && data.strikingDistanceKeywords.length > 0 && (
        <div className="bg-white rounded-lg border border-brand-gold/30 p-8">
          <EditableHeading
            title="Low-Hanging Fruit"
            titleKey="opportunities_striking_title"
            subtitle="Keywords ranking positions 3–10 — close to the top of page 1. Small improvements here can drive significant traffic gains."
            subtitleKey="opportunities_striking_subtitle"
            sectionDescs={sectionDescs}
            onSaveDescs={onSaveDescs}
          />
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="pb-2 font-medium">Keyword</th>
                <th className="pb-2 font-medium text-right">Position</th>
                <th className="pb-2 font-medium text-right">Volume</th>
                <th className="pb-2 font-medium text-right">Traffic</th>
                <th className="pb-2 font-medium text-right">KD</th>
                <th className="pb-2 font-medium text-right">Gap to #3</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.strikingDistanceKeywords.map((kw, i) => (
                <tr key={i}>
                  <td className="py-3 font-medium text-brand-charcoal">{kw.keyword}</td>
                  <td className="py-3 text-right text-gray-600">#{kw.position}</td>
                  <td className="py-3 text-right text-gray-600">{kw.volume.toLocaleString()}</td>
                  <td className="py-3 text-right text-gray-600">{kw.traffic.toLocaleString()}</td>
                  <td className={`py-3 text-right font-medium ${kwDifficultyColor(kw.difficulty, sectionDescs)}`}>{kw.difficulty}</td>
                  <td className="py-3 text-right">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      kw.position <= 5 ? 'bg-brand-sage-light text-brand-sage-dark' : 'bg-brand-gold-light text-brand-charcoal'
                    }`}>
                      {kw.position - 3 === 0 ? 'At #3' : `${kw.position - 3} away`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Top Pages */}
      {data.topPages && data.topPages.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <EditableHeading
            title="Top Pages by Traffic"
            titleKey="opportunities_toppages_title"
            subtitle="Your highest-traffic pages and the keywords driving visitors to them."
            subtitleKey="opportunities_toppages_subtitle"
            sectionDescs={sectionDescs}
            onSaveDescs={onSaveDescs}
          />
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
                {data.topPages.map((page, i) => {
                  let shortUrl: string;
                  try { shortUrl = new URL(page.url).pathname || '/'; } catch { shortUrl = page.url; }
                  return (
                    <tr key={i}>
                      <td className="py-3 font-medium text-brand-charcoal max-w-[180px] truncate" title={page.url}>{shortUrl}</td>
                      <td className="py-3 text-right text-gray-600">{page.traffic.toLocaleString()}</td>
                      <td className="py-3 text-right text-gray-600">{page.keywords.toLocaleString()}</td>
                      <td className="py-3 text-right">
                        <span className={`font-medium ${page.urlRating >= 20 ? 'text-brand-sage-dark' : page.urlRating >= 10 ? 'text-brand-gold' : 'text-gray-400'}`}>{page.urlRating}</span>
                      </td>
                      <td className="py-3 text-right text-gray-600">{page.referringDomains.toLocaleString()}</td>
                      <td className="py-3 text-right text-xs max-w-[160px] truncate" title={`${page.topKeyword} (${page.topKeywordVolume.toLocaleString()} vol/mo)`}>
                        <span className="text-gray-600">{page.topKeyword}</span>
                        <span className="text-gray-400 ml-1">#{page.topKeywordPosition}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Related Keywords from Ahrefs */}
      {data.relatedKeywords && data.relatedKeywords.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <h2 className="text-lg font-semibold text-brand-charcoal mb-2">Related Keywords (from Ahrefs)</h2>
          <p className="text-sm text-gray-500 mb-5">Keyword opportunities related to your top terms — potential targets to expand your reach.</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="pb-2 font-medium">Keyword</th>
                <th className="pb-2 font-medium text-right">Volume</th>
                <th className="pb-2 font-medium text-right">KD</th>
                <th className="pb-2 font-medium text-right">CPC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.relatedKeywords.map((kw, i) => (
                <tr key={i}>
                  <td className="py-3 font-medium text-brand-charcoal">{kw.keyword}</td>
                  <td className="py-3 text-right text-gray-600">{kw.volume.toLocaleString()}</td>
                  <td className={`py-3 text-right font-medium ${kwDifficultyColor(kw.difficulty, sectionDescs)}`}>{kw.difficulty}</td>
                  <td className="py-3 text-right text-gray-600">${kw.cpc.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Static data for Local Search charts ──

const REFERRAL_SOURCES = [
  { name: 'Google Search', value: 46, color: '#4285F4' },
  { name: 'Google Maps', value: 22, color: '#34A853' },
  { name: 'Insurance Directory', value: 14, color: '#FBBC05' },
  { name: 'Psychology Today', value: 10, color: '#2D8BC9' },
  { name: 'Referral / Word of Mouth', value: 5, color: '#9B59B6' },
  { name: 'Social Media', value: 3, color: '#E4405F' },
];

const SEARCH_TREND_DATA = [
  { month: 'Oct', googleSearch: 62, googleMaps: 28, direct: 10 },
  { month: 'Nov', googleSearch: 58, googleMaps: 31, direct: 11 },
  { month: 'Dec', googleSearch: 45, googleMaps: 25, direct: 8 },
  { month: 'Jan', googleSearch: 70, googleMaps: 35, direct: 12 },
  { month: 'Feb', googleSearch: 75, googleMaps: 38, direct: 14 },
  { month: 'Mar', googleSearch: 82, googleMaps: 42, direct: 15 },
];

function LocalSearchTab({ data, analysisId, onUpdate }: {
  data: LocalSearchData | null;
  analysisId: string;
  onUpdate: (data: LocalSearchData) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [screenshots, setScreenshots] = useState<{ url: string; caption: string }[]>(data?.screenshots || []);
  const [editingCaption, setEditingCaption] = useState<number | null>(null);
  const [captionText, setCaptionText] = useState('');

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('analysisId', analysisId);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) throw new Error('Upload failed');
      const { url } = await res.json();
      const updated = [...screenshots, { url, caption: '' }];
      setScreenshots(updated);
      await saveScreenshots(updated);
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  }

  async function removeScreenshot(index: number) {
    const updated = screenshots.filter((_, i) => i !== index);
    setScreenshots(updated);
    await saveScreenshots(updated);
  }

  async function saveCaption(index: number) {
    const updated = screenshots.map((s, i) => i === index ? { ...s, caption: captionText } : s);
    setScreenshots(updated);
    setEditingCaption(null);
    await saveScreenshots(updated);
  }

  async function saveScreenshots(updated: { url: string; caption: string }[]) {
    const localSearchData = { screenshots: updated };
    onUpdate(localSearchData);
    await fetch(`/api/analysis/${analysisId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localSearchData }),
    });
  }

  return (
    <div className="space-y-3">
      {/* How Clients Find Therapists — Donut Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <h2 className="text-lg font-semibold text-brand-charcoal mb-1">How Clients Find Therapists</h2>
        <p className="text-sm text-gray-500 mb-6">National average breakdown of how therapy clients discover their provider online.</p>
        <div className="flex items-center gap-8">
          <div className="w-56 h-56 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={REFERRAL_SOURCES}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="value"
                  stroke="none"
                >
                  {REFERRAL_SOURCES.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2.5">
            {REFERRAL_SOURCES.map((source, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: source.color }} />
                <span className="text-sm text-brand-charcoal flex-1">{source.name}</span>
                <span className="text-sm font-semibold text-brand-charcoal">{source.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Search Trends — Line Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <h2 className="text-lg font-semibold text-brand-charcoal mb-1">Local Search Trends</h2>
        <p className="text-sm text-gray-500 mb-6">How visitors are finding therapy practices over the last 6 months (industry average).</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={SEARCH_TREND_DATA}>
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} width={30} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '13px' }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '13px', paddingTop: '8px' }} />
              <Line type="monotone" dataKey="googleSearch" name="Google Search" stroke="#4285F4" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="googleMaps" name="Google Maps" stroke="#34A853" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="direct" name="Direct" stroke="#9B59B6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Search Result Screenshots */}
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <h2 className="text-lg font-semibold text-brand-charcoal mb-1">Search Result Screenshots</h2>
        <p className="text-sm text-gray-500 mb-6">Upload screenshots showing how your practice appears in Google search results.</p>

        {/* Upload area */}
        <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer transition-colors ${uploading ? 'border-brand-sky bg-brand-sky/5' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = '';
            }}
            disabled={uploading}
          />
          {uploading ? (
            <p className="text-sm text-brand-sky">Uploading...</p>
          ) : (
            <>
              <Upload className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">Drop an image here or click to upload</p>
              <p className="text-xs text-gray-400 mt-1">PNG, JPG, or WebP up to 5MB</p>
            </>
          )}
        </label>

        {/* Uploaded screenshots */}
        {screenshots.length > 0 && (
          <div className="mt-6 space-y-4">
            {screenshots.map((shot, i) => (
              <div key={i} className="relative border border-gray-100 rounded-lg overflow-hidden">
                <img src={shot.url} alt={shot.caption || 'Search result screenshot'} className="w-full" />
                <button
                  onClick={() => removeScreenshot(i)}
                  className="absolute top-2 right-2 w-7 h-7 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-sm transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
                <div className="p-3 bg-gray-50 border-t border-gray-100">
                  {editingCaption === i ? (
                    <div className="flex gap-2">
                      <input
                        value={captionText}
                        onChange={(e) => setCaptionText(e.target.value)}
                        className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-sky"
                        placeholder="Add a caption..."
                        autoFocus
                      />
                      <button onClick={() => saveCaption(i)} className="text-xs font-medium text-white bg-brand-charcoal-light px-3 py-1 rounded hover:bg-brand-charcoal transition-colors">Save</button>
                      <button onClick={() => setEditingCaption(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                    </div>
                  ) : (
                    <p
                      className="text-sm text-gray-500 cursor-pointer hover:text-gray-700"
                      onClick={() => { setEditingCaption(i); setCaptionText(shot.caption); }}
                    >
                      {shot.caption || 'Click to add a caption...'}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
