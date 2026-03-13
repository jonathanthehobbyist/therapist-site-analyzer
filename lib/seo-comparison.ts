import { ScrapedPage, ScrapeResult } from './scraper';
import { AhrefsData } from './ahrefs';
import { PageSpeedData } from './pagespeed';

export interface SeoComparisonRow {
  category: string;
  check: string;
  targetValue: string;
  competitorValue: string;
  status: 'pass' | 'fail' | 'warning'; // relative to competitor
  explanation: string;
}

export interface SeoComparisonResult {
  rows: SeoComparisonRow[];
  targetAhrefs: AhrefsData;
  competitorAhrefs: AhrefsData;
  targetPageSpeed: PageSpeedData;
  competitorPageSpeed: PageSpeedData;
}

export function buildSeoComparison(
  target: ScrapeResult,
  competitor: ScrapeResult,
  targetAhrefs: AhrefsData,
  competitorAhrefs: AhrefsData,
  targetPageSpeed: PageSpeedData,
  competitorPageSpeed: PageSpeedData,
  keyword?: string
): SeoComparisonResult {
  const targetHome = target.pages[0];
  const compHome = competitor.pages[0];
  const rows: SeoComparisonRow[] = [];

  // --- On-Page ---

  // Title tag
  rows.push({ ...comparePresence('On-Page', 'Title Tag', targetHome.title, compHome.title), explanation: 'Without a title tag, Google makes one up — and it\'s almost never what you\'d want patients to see as their first impression in search results.' });

  rows.push({ ...compareLength('On-Page', 'Title Length', targetHome.title.length, compHome.title.length, 30, 60), explanation: 'Google cuts off titles after ~60 characters. Too short wastes valuable keyword space; too long gets truncated and looks incomplete to searchers.' });

  if (keyword) {
    rows.push({ ...compareKeywordInclusion('On-Page', 'Keyword in Title', targetHome.title, compHome.title, keyword), explanation: 'Google matches search queries to title tags. If your keyword isn\'t in the title, Google is far less likely to show your page for that search.' });
  }

  // Meta description
  rows.push({ ...comparePresence('On-Page', 'Meta Description', targetHome.metaDescription, compHome.metaDescription), explanation: 'Without a meta description, Google grabs random text from your page. This often shows cookie notices or nav text — not the professional first impression you want.' });

  rows.push({ ...compareLength('On-Page', 'Meta Description Length', targetHome.metaDescription.length, compHome.metaDescription.length, 120, 160), explanation: 'Google shows ~155 characters. Too short and you\'re giving away free ad space to competitors. Too long and Google chops it off mid-sentence.' });

  if (keyword) {
    rows.push({ ...compareKeywordInclusion('On-Page', 'Keyword in Meta Description', targetHome.metaDescription, compHome.metaDescription, keyword), explanation: 'Google bolds matching keywords in descriptions. This makes your listing visually pop, increasing the chance someone clicks on you instead of the next result.' });
  }

  // Heading structure
  const targetH1Count = targetHome.headings.filter((h) => h.tag === 'h1').length;
  const compH1Count = compHome.headings.filter((h) => h.tag === 'h1').length;
  rows.push({
    category: 'On-Page',
    check: 'H1 Tags',
    targetValue: String(targetH1Count),
    competitorValue: String(compH1Count),
    status: targetH1Count === 1 ? 'pass' : targetH1Count === 0 ? 'fail' : 'warning',
    explanation: 'Google uses the H1 as a primary signal for what the page is about. Without one, Google guesses — and often ranks you for the wrong searches.',
  });

  const targetHeadingCount = targetHome.headings.length;
  const compHeadingCount = compHome.headings.length;
  rows.push({
    category: 'On-Page',
    check: 'Total Headings',
    targetValue: String(targetHeadingCount),
    competitorValue: String(compHeadingCount),
    status: targetHeadingCount >= compHeadingCount * 0.7 ? 'pass' : 'warning',
    explanation: 'Google uses headings to understand how your content is organized. More well-structured headings help Google identify specific topics on the page, which can earn you featured snippets.',
  });

  // Word count
  rows.push({
    category: 'On-Page',
    check: 'Word Count (Homepage)',
    targetValue: String(targetHome.wordCount),
    competitorValue: String(compHome.wordCount),
    status: targetHome.wordCount >= compHome.wordCount * 0.7 ? 'pass' : 'warning',
    explanation: 'Google associates more content with more authority on a topic. If your competitor has significantly more content, Google sees them as the deeper resource and ranks them higher.',
  });

  // Image alt text
  const targetAltCoverage = getAltCoverage(targetHome);
  const compAltCoverage = getAltCoverage(compHome);
  rows.push({
    category: 'On-Page',
    check: 'Image Alt Text Coverage',
    targetValue: `${targetAltCoverage}%`,
    competitorValue: `${compAltCoverage}%`,
    status: targetAltCoverage >= 90 ? 'pass' : targetAltCoverage >= 70 ? 'warning' : 'fail',
    explanation: 'Google can\'t see images — it reads alt text instead. Missing alt text means your images are invisible to Google, losing you traffic from Google Image search.',
  });

  // Internal links
  rows.push({
    category: 'On-Page',
    check: 'Internal Links',
    targetValue: String(targetHome.internalLinks.length),
    competitorValue: String(compHome.internalLinks.length),
    status: targetHome.internalLinks.length >= compHome.internalLinks.length * 0.5 ? 'pass' : 'warning',
    explanation: 'Internal links are how Google discovers and connects pages on your site. Fewer links means Google may miss pages entirely or treat them as less important.',
  });

  // --- Page Speed ---
  rows.push({
    category: 'Performance',
    check: 'Performance Score',
    targetValue: targetPageSpeed.performanceScore !== null ? `${targetPageSpeed.performanceScore}/100` : 'N/A',
    competitorValue: competitorPageSpeed.performanceScore !== null ? `${competitorPageSpeed.performanceScore}/100` : 'N/A',
    status: (targetPageSpeed.performanceScore ?? 0) >= (competitorPageSpeed.performanceScore ?? 0) ? 'pass' : 'warning',
    explanation: 'Google directly uses page speed in rankings. A faster site means higher rankings, especially on mobile where most therapy searches happen.',
  });

  rows.push({
    category: 'Performance',
    check: 'LCP (Largest Contentful Paint)',
    targetValue: targetPageSpeed.lcp !== null ? `${(targetPageSpeed.lcp / 1000).toFixed(1)}s` : 'N/A',
    competitorValue: competitorPageSpeed.lcp !== null ? `${(competitorPageSpeed.lcp / 1000).toFixed(1)}s` : 'N/A',
    status: (targetPageSpeed.lcp ?? 9999) <= (competitorPageSpeed.lcp ?? 9999) ? 'pass' : 'warning',
    explanation: 'Google measures how long until the main content is visible. If it takes too long, visitors leave before seeing anything — and Google notices that bounce rate.',
  });

  rows.push({
    category: 'Performance',
    check: 'CLS (Cumulative Layout Shift)',
    targetValue: targetPageSpeed.cls !== null ? targetPageSpeed.cls.toFixed(3) : 'N/A',
    competitorValue: competitorPageSpeed.cls !== null ? competitorPageSpeed.cls.toFixed(3) : 'N/A',
    status: (targetPageSpeed.cls ?? 1) <= 0.1 ? 'pass' : (targetPageSpeed.cls ?? 1) <= 0.25 ? 'warning' : 'fail',
    explanation: 'Google penalizes pages where content jumps around as it loads. It frustrates users and signals a poor experience, pushing you down in rankings.',
  });

  // --- Technical ---
  rows.push({
    category: 'Technical',
    check: 'Sitemap.xml',
    targetValue: target.sitemapExists ? 'Present' : 'Missing',
    competitorValue: competitor.sitemapExists ? 'Present' : 'Missing',
    status: target.sitemapExists ? 'pass' : 'fail',
    explanation: 'Without a sitemap, Google has to discover your pages by following links. Some pages may never get found, meaning they\'ll never appear in search results.',
  });

  rows.push({
    category: 'Technical',
    check: 'Robots.txt',
    targetValue: target.robotsTxtExists ? 'Present' : 'Missing',
    competitorValue: competitor.robotsTxtExists ? 'Present' : 'Missing',
    status: target.robotsTxtExists ? 'pass' : 'fail',
    explanation: 'Google looks for robots.txt to know which pages matter. Without one, Google has no guidance and may waste crawl time on pages that don\'t help your rankings.',
  });

  rows.push({
    category: 'Technical',
    check: 'Canonical Tag',
    targetValue: targetHome.canonicalUrl ? 'Present' : 'Missing',
    competitorValue: compHome.canonicalUrl ? 'Present' : 'Missing',
    status: targetHome.canonicalUrl ? 'pass' : 'warning',
    explanation: 'Without a canonical tag, Google may see multiple versions of the same page and split your ranking power between them. Each version ranks weaker than one consolidated page would.',
  });

  rows.push({
    category: 'Technical',
    check: 'HTTPS',
    targetValue: target.httpsEnforced ? 'Yes' : 'No',
    competitorValue: competitor.httpsEnforced ? 'Yes' : 'No',
    status: target.httpsEnforced ? 'pass' : 'fail',
    explanation: 'Google directly penalizes non-HTTPS sites in rankings. Browsers also show "Not Secure" warnings that scare away potential patients before they even read your content.',
  });

  rows.push({
    category: 'Technical',
    check: '404 Handling',
    targetValue: target.handles404 ? 'Proper' : 'Missing',
    competitorValue: competitor.handles404 ? 'Proper' : 'Missing',
    status: target.handles404 ? 'pass' : 'warning',
    explanation: 'Without proper 404s, Google keeps trying to index broken pages, wasting the limited attention it gives your site on URLs that don\'t exist.',
  });

  // Schema markup
  const targetHasSchema = targetHome.schemaMarkup.length > 0;
  const compHasSchema = compHome.schemaMarkup.length > 0;
  rows.push({
    category: 'Technical',
    check: 'Structured Data (JSON-LD)',
    targetValue: targetHasSchema ? `${targetHome.schemaMarkup.length} found` : 'None',
    competitorValue: compHasSchema ? `${compHome.schemaMarkup.length} found` : 'None',
    status: targetHasSchema ? 'pass' : 'fail',
    explanation: 'Google uses structured data to show rich results — star ratings, hours, contact info right in the listing. Without it, your listing is plain text while competitors get enhanced results that steal your clicks.',
  });

  // --- Authority (Ahrefs) ---
  if (!targetAhrefs.error) {
    rows.push({
      category: 'Authority',
      check: 'Domain Rating',
      targetValue: targetAhrefs.domainRating !== null ? String(targetAhrefs.domainRating) : 'N/A',
      competitorValue: competitorAhrefs.domainRating !== null ? String(competitorAhrefs.domainRating) : 'N/A',
      status: (targetAhrefs.domainRating ?? 0) >= (competitorAhrefs.domainRating ?? 0) * 0.8 ? 'pass' : 'warning',
      explanation: 'Google ranks sites it trusts. Domain Rating measures that trust based on who links to you. A lower DR means Google sees your site as less authoritative, making it harder to outrank competitors.',
    });

    rows.push({
      category: 'Authority',
      check: 'Referring Domains',
      targetValue: targetAhrefs.referringDomains !== null ? String(targetAhrefs.referringDomains) : 'N/A',
      competitorValue: competitorAhrefs.referringDomains !== null ? String(competitorAhrefs.referringDomains) : 'N/A',
      status: (targetAhrefs.referringDomains ?? 0) >= (competitorAhrefs.referringDomains ?? 0) * 0.5 ? 'pass' : 'warning',
      explanation: 'Google treats each unique website linking to you as a "vote of confidence." More unique sites linking to you signals to Google that your practice is a trusted, credible resource.',
    });

    rows.push({
      category: 'Authority',
      check: 'Total Backlinks',
      targetValue: targetAhrefs.totalBacklinks !== null ? String(targetAhrefs.totalBacklinks) : 'N/A',
      competitorValue: competitorAhrefs.totalBacklinks !== null ? String(competitorAhrefs.totalBacklinks) : 'N/A',
      status: (targetAhrefs.totalBacklinks ?? 0) >= (competitorAhrefs.totalBacklinks ?? 0) * 0.5 ? 'pass' : 'warning',
      explanation: 'Google sees backlinks as endorsements. More links from quality sites tells Google your content is worth recommending to searchers.',
    });
  }

  return {
    rows,
    targetAhrefs,
    competitorAhrefs,
    targetPageSpeed,
    competitorPageSpeed,
  };
}

// --- Helpers ---

function comparePresence(
  category: string,
  check: string,
  targetVal: string,
  compVal: string
): Omit<SeoComparisonRow, 'explanation'> {
  return {
    category,
    check,
    targetValue: targetVal || 'Missing',
    competitorValue: compVal || 'Missing',
    status: targetVal ? 'pass' : 'fail',
  };
}

function compareLength(
  category: string,
  check: string,
  targetLen: number,
  compLen: number,
  min: number,
  max: number
): Omit<SeoComparisonRow, 'explanation'> {
  const inRange = targetLen >= min && targetLen <= max;
  return {
    category,
    check,
    targetValue: `${targetLen} chars`,
    competitorValue: `${compLen} chars`,
    status: inRange ? 'pass' : 'warning',
  };
}

function compareKeywordInclusion(
  category: string,
  check: string,
  targetText: string,
  compText: string,
  keyword: string
): Omit<SeoComparisonRow, 'explanation'> {
  const kw = keyword.toLowerCase();
  const targetHas = targetText.toLowerCase().includes(kw);
  const compHas = compText.toLowerCase().includes(kw);
  return {
    category,
    check,
    targetValue: targetHas ? 'Yes' : 'No',
    competitorValue: compHas ? 'Yes' : 'No',
    status: targetHas ? 'pass' : 'fail',
  };
}

function getAltCoverage(page: ScrapedPage): number {
  if (page.images.length === 0) return 100;
  const withAlt = page.images.filter((img) => img.alt && img.alt.trim().length > 0).length;
  return Math.round((withAlt / page.images.length) * 100);
}
