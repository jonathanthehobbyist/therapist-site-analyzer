import { prisma } from './db';
import { scrapeSite } from './scraper';
import { analyzeHipaa, HipaaFinding } from './hipaa';
import { getAhrefsData, getAhrefsOrganicKeywords, getAhrefsRelatedKeywords, getStrikingDistanceKeywords, getTopPages, getKeywordVolumeHistory } from './ahrefs';
import { extractSiteKeywords, KeywordData } from './keywords';
import { getPageSpeedData, getFullPageSpeedData } from './pagespeed';
import { buildSeoComparison } from './seo-comparison';
import { analyzeSeoHygiene } from './seo-hygiene';
import { scoreSEOComparison } from './scoring';

async function setProgress(analysisId: string, progress: number, progressLabel: string) {
  await prisma.analysis.update({
    where: { id: analysisId },
    data: { progress, progressLabel },
  });
}

/**
 * Run the full analysis pipeline.
 * Called asynchronously after the API returns the analysis ID.
 */
export async function runAnalysis(analysisId: string): Promise<void> {
  try {
    // Mark as running
    await prisma.analysis.update({
      where: { id: analysisId },
      data: { status: 'running', progress: 0, progressLabel: 'Starting analysis...' },
    });

    const analysis = await prisma.analysis.findUnique({ where: { id: analysisId } });
    if (!analysis) throw new Error('Analysis not found');

    const { siteUrl, competitorUrl, keyword } = analysis;

    // 1. Scrape target site (homepage + nav pages discovered from DOM)
    await setProgress(analysisId, 5, 'Scraping your website...');
    console.log(`[${analysisId}] Scraping target: ${siteUrl}`);
    const targetScrape = await scrapeSite(siteUrl);
    const pagesScraped = targetScrape.pages.map((p) => p.url);
    console.log(`[${analysisId}] Scraped ${pagesScraped.length} pages: ${pagesScraped.join(', ')}`);

    // 2. Scrape competitor (if provided)
    let competitorScrape = null;
    if (competitorUrl) {
      await setProgress(analysisId, 20, 'Scraping competitor website...');
      console.log(`[${analysisId}] Scraping competitor: ${competitorUrl}`);
      competitorScrape = await scrapeSite(competitorUrl);
    }

    // 3. Run PageSpeed for target (and competitor if provided)
    await setProgress(analysisId, 35, 'Measuring page speed...');
    console.log(`[${analysisId}] Running PageSpeed analysis...`);
    const targetPageSpeed = await getPageSpeedData(siteUrl);
    const fullPageSpeed = await getFullPageSpeedData(siteUrl);
    const competitorPageSpeed = competitorUrl
      ? await getPageSpeedData(competitorUrl)
      : null;

    // 4. Run Ahrefs for target (and competitor if provided)
    await setProgress(analysisId, 50, 'Checking backlinks & authority...');
    console.log(`[${analysisId}] Fetching Ahrefs data...`);
    const targetAhrefs = await getAhrefsData(siteUrl);
    const competitorAhrefs = competitorUrl
      ? await getAhrefsData(competitorUrl)
      : null;

    // 5. Build SEO Comparison (only if competitor provided)
    let seoComparisonData = null;
    let seoComparisonScore = null;
    if (competitorScrape && competitorPageSpeed && competitorAhrefs) {
      await setProgress(analysisId, 65, 'Comparing SEO metrics...');
      console.log(`[${analysisId}] Building SEO comparison...`);
      const comparison = buildSeoComparison(
        targetScrape,
        competitorScrape,
        targetAhrefs,
        competitorAhrefs,
        targetPageSpeed,
        competitorPageSpeed,
        keyword || undefined
      );
      seoComparisonData = comparison;
      seoComparisonScore = scoreSEOComparison(comparison.rows);
    }

    // 6. Run SEO Hygiene analysis
    await setProgress(analysisId, 75, 'Auditing SEO hygiene...');
    console.log(`[${analysisId}] Running SEO hygiene analysis...`);
    const hygiene = analyzeSeoHygiene(targetScrape, targetPageSpeed);

    // 7. Run HIPAA analysis
    await setProgress(analysisId, 85, 'Running HIPAA compliance audit...');
    console.log(`[${analysisId}] Running HIPAA analysis...`);
    const hipaa = await analyzeHipaa(targetScrape.pages);

    // 8. Keyword analysis
    await setProgress(analysisId, 88, 'Analyzing keywords...');
    console.log(`[${analysisId}] Fetching Ahrefs organic keywords...`);
    const organicKeywords = await getAhrefsOrganicKeywords(siteUrl);
    console.log(`[${analysisId}] Fetching striking distance keywords (positions 3-10)...`);
    const strikingDistanceKeywords = await getStrikingDistanceKeywords(siteUrl);
    console.log(`[${analysisId}] Got ${strikingDistanceKeywords.length} striking distance keywords`);
    console.log(`[${analysisId}] Fetching top pages...`);
    const topPages = await getTopPages(siteUrl);
    console.log(`[${analysisId}] Got ${topPages.length} top pages`);
    const keywordData: KeywordData = { siteKeywords: [], organicKeywords, relatedKeywords: [], strikingDistanceKeywords, topPages };

    // 8b. Fetch search volume history for "therapy"
    await setProgress(analysisId, 90, 'Fetching search volume trends...');
    console.log(`[${analysisId}] Fetching volume history for "therapy"...`);
    const searchVolumeHistory = await getKeywordVolumeHistory('therapy');
    console.log(`[${analysisId}] Got ${searchVolumeHistory.length} volume history points`);

    // 9. Generate summary (mix of SEO + HIPAA)
    const seoSummary = generateSummary(hygiene.score, hygiene.findings, hipaa.riskLevel, hipaa.findings);

    // 10. Save results
    await setProgress(analysisId, 95, 'Saving results...');
    console.log(`[${analysisId}] Saving results...`);
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: 'complete',
        progress: 100,
        progressLabel: 'Complete',
        seoComparisonScore,
        seoHygieneScore: hygiene.score,
        hipaaRiskLevel: hipaa.riskLevel,
        seoComparisonData: seoComparisonData ? JSON.stringify(seoComparisonData) : null,
        seoHygieneData: JSON.stringify(hygiene),
        hipaaData: JSON.stringify(hipaa),
        pagesScraped: JSON.stringify(pagesScraped),
        seoSummary,
        keywordData: JSON.stringify(keywordData),
        pageSpeedData: JSON.stringify(fullPageSpeed),
        localSearchData: searchVolumeHistory.length > 0
          ? JSON.stringify({ screenshots: [], searchVolumeHistory })
          : undefined,
      },
    });

    // 9. Upsert the Site record and link
    const domain = new URL(siteUrl).hostname;
    let site = await prisma.site.findUnique({ where: { url: domain } });
    if (!site) {
      site = await prisma.site.create({ data: { url: domain } });
    }
    await prisma.analysis.update({
      where: { id: analysisId },
      data: { siteId: site.id },
    });

    console.log(`[${analysisId}] Analysis complete.`);
  } catch (err) {
    console.error(`[${analysisId}] Analysis failed:`, err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    await prisma.analysis.update({
      where: { id: analysisId },
      data: { status: 'error', error: message },
    });
  }
}

interface HygieneFinding {
  category: string;
  check: string;
  status: 'pass' | 'fail' | 'warning';
  description: string;
  weight: number;
}

// Plain-language labels for technical SEO checks
const SEO_LABELS: Record<string, string> = {
  'Title Tag': 'Page Title',
  'Meta Description': 'Meta Description',
  'H1 Tag': 'Main Heading',
  'Open Graph Tags': 'Social Sharing Info',
  'Canonical Tag': 'Canonical URL',
  'Sitemap': 'Sitemap',
  'Robots.txt': 'Search Engine Instructions',
  'HTTPS': 'Secure Connection',
  'Mobile Friendly': 'Mobile Friendliness',
  'Page Speed': 'Page Load Speed',
  'Alt Text': 'Image Descriptions',
  'Internal Links': 'Internal Linking',
  'Schema Markup': 'Structured Data',
  'NAP Consistency': 'Business Contact Info',
  'Google Business Profile': 'Google Business Listing',
};

// Plain-language explanations for HIPAA findings
const HIPAA_LABELS: Record<string, string> = {
  high: 'a serious compliance risk',
  medium: 'a moderate compliance concern',
};

function plainLabel(check: string): string {
  return SEO_LABELS[check] || check;
}

function generateSummary(
  seoScore: number,
  seoFindings: HygieneFinding[],
  hipaaRisk: string,
  hipaaFindings: HipaaFinding[],
): string {
  const lines: string[] = [];

  // SEO issues — top 2
  const seoIssues = seoFindings
    .filter((f) => f.status === 'fail' || f.status === 'warning')
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'fail' ? -1 : 1;
      return b.weight - a.weight;
    })
    .slice(0, 2);

  // HIPAA issues — top 2 non-pass
  const hipaaIssues = hipaaFindings
    .filter((f) => f.severity === 'high' || f.severity === 'medium')
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1;
      return 0;
    })
    .slice(0, 2);

  // Intro
  const grade = seoScore >= 90 ? 'strong' : seoScore >= 70 ? 'average' : 'below average';
  lines.push(`Your site scored ${seoScore}/100 for SEO (${grade}) and has a ${hipaaRisk.toLowerCase()} HIPAA risk level. Here are the most important things to address:\n`);

  let n = 1;

  for (const f of seoIssues) {
    lines.push(`${n}. ${plainLabel(f.check)} — ${f.description}`);
    n++;
  }

  for (const f of hipaaIssues) {
    const severity = HIPAA_LABELS[f.severity] || 'a compliance issue';
    lines.push(`${n}. ${f.check} — ${f.description} This is ${severity}.`);
    n++;
  }

  if (n === 1) {
    return `Your site scored ${seoScore}/100 for SEO and has a ${hipaaRisk.toLowerCase()} HIPAA risk level — nice work! No major issues were found.`;
  }

  return lines.join('\n');
}
