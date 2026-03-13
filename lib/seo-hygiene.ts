import { ScrapedPage, ScrapeResult } from './scraper';
import { PageSpeedData } from './pagespeed';

export interface HygieneFinding {
  category: 'Technical' | 'On-Page' | 'Local SEO';
  check: string;
  status: 'pass' | 'fail' | 'warning';
  description: string;
  explanation: string;
  fix: string | null;
  weight: number; // points deducted if failed (out of 100)
}

export interface SeoHygieneResult {
  score: number;
  findings: HygieneFinding[];
}

export function analyzeSeoHygiene(
  scrapeResult: ScrapeResult,
  pageSpeedData: PageSpeedData
): SeoHygieneResult {
  const findings: HygieneFinding[] = [];
  const pages = scrapeResult.pages;
  const homepage = pages[0];

  // --- Technical Checks ---

  findings.push({
    category: 'Technical',
    check: 'Sitemap.xml',
    status: scrapeResult.sitemapExists ? 'pass' : 'fail',
    description: scrapeResult.sitemapExists
      ? 'Sitemap.xml found and accessible'
      : 'No sitemap.xml found at /sitemap.xml',
    explanation: 'Without a sitemap, Google has to guess which pages exist on your site. Some pages may never get found or indexed, meaning they\'ll never show up in search results.',
    fix: scrapeResult.sitemapExists ? null : 'Create a sitemap.xml and submit it to Google Search Console.',
    weight: 8,
  });

  findings.push({
    category: 'Technical',
    check: 'Robots.txt',
    status: scrapeResult.robotsTxtExists ? 'pass' : 'fail',
    description: scrapeResult.robotsTxtExists
      ? 'Robots.txt found'
      : 'No robots.txt found',
    explanation: 'Google looks for robots.txt to understand which pages it should and shouldn\'t crawl. Without one, Google has no guidance and may waste time on pages that don\'t matter.',
    fix: scrapeResult.robotsTxtExists ? null : 'Create a robots.txt file to guide search engine crawlers.',
    weight: 5,
  });

  findings.push({
    category: 'Technical',
    check: 'HTTPS',
    status: scrapeResult.httpsEnforced ? 'pass' : 'fail',
    description: scrapeResult.httpsEnforced
      ? 'Site uses HTTPS'
      : 'Site does not enforce HTTPS',
    explanation: 'Google directly penalizes non-HTTPS sites in rankings. Browsers also show a "Not Secure" warning, which scares away potential patients before they even read your content.',
    fix: scrapeResult.httpsEnforced ? null : 'Install an SSL certificate and redirect all HTTP traffic to HTTPS.',
    weight: 10,
  });

  findings.push({
    category: 'Technical',
    check: '404 Handling',
    status: scrapeResult.handles404 ? 'pass' : 'warning',
    description: scrapeResult.handles404
      ? 'Custom 404 page returns proper status code'
      : 'Site does not return 404 status for missing pages',
    explanation: 'Without proper 404s, Google keeps trying to index broken pages. This wastes your "crawl budget" — the limited attention Google gives your site — on URLs that don\'t exist.',
    fix: scrapeResult.handles404 ? null : 'Configure your server to return a 404 status code for non-existent pages.',
    weight: 3,
  });

  // Canonical tags
  const pagesWithCanonical = pages.filter((p) => p.canonicalUrl);
  const pagesWithoutCanonical = pages.filter((p) => !p.canonicalUrl);
  findings.push({
    category: 'Technical',
    check: 'Canonical Tags',
    status: pagesWithoutCanonical.length === 0 ? 'pass' : pagesWithoutCanonical.length <= 1 ? 'warning' : 'fail',
    description:
      pagesWithoutCanonical.length === 0
        ? 'All pages have canonical tags'
        : `${pagesWithoutCanonical.length} of ${pages.length} pages missing canonical tags`,
    explanation: 'Without canonical tags, Google may see duplicate versions of the same page and split your ranking power between them. This means each version ranks weaker than a single consolidated page would.',
    fix:
      pagesWithoutCanonical.length === 0
        ? null
        : 'Add <link rel="canonical"> to all pages to prevent duplicate content issues.',
    weight: 5,
  });

  // Structured data
  const allSchemaTypes = pages.flatMap((p) =>
    p.schemaMarkup.map((s) => {
      try {
        const parsed = JSON.parse(s);
        return parsed['@type'] || 'Unknown';
      } catch {
        return 'Unknown';
      }
    })
  );
  const hasLocalBusiness =
    allSchemaTypes.some((t) => t === 'LocalBusiness' || t === 'MedicalBusiness');
  findings.push({
    category: 'Technical',
    check: 'Structured Data (Schema.org)',
    status: allSchemaTypes.length > 0 ? (hasLocalBusiness ? 'pass' : 'warning') : 'fail',
    description:
      allSchemaTypes.length > 0
        ? `Found schema types: ${[...new Set(allSchemaTypes)].join(', ')}${
            !hasLocalBusiness ? ' (missing LocalBusiness/MedicalBusiness)' : ''
          }`
        : 'No structured data (JSON-LD) found on any page',
    explanation: 'Google uses structured data to show rich results — star ratings, hours, contact info directly in search listings. Without it, your listing is plain text while competitors get eye-catching enhanced results that steal your clicks.',
    fix:
      allSchemaTypes.length > 0 && hasLocalBusiness
        ? null
        : 'Add LocalBusiness or MedicalBusiness JSON-LD schema markup to improve local search visibility.',
    weight: 8,
  });

  // Performance
  if (pageSpeedData.performanceScore !== null) {
    findings.push({
      category: 'Technical',
      check: 'Page Speed Score',
      status:
        pageSpeedData.performanceScore >= 90
          ? 'pass'
          : pageSpeedData.performanceScore >= 50
            ? 'warning'
            : 'fail',
      description: `Performance score: ${pageSpeedData.performanceScore}/100`,
      explanation: 'Google measures how fast your site loads and uses it directly in rankings. Slow sites get pushed down in results, and most visitors leave if a page takes more than 3 seconds to load.',
      fix:
        pageSpeedData.performanceScore >= 90
          ? null
          : 'Optimize images, enable caching, minimize JavaScript, and consider a CDN.',
      weight: 7,
    });
  }

  // --- On-Page Checks ---

  // Title tags
  for (const page of pages) {
    if (!page.title) {
      findings.push({
        category: 'On-Page',
        check: 'Title Tag',
        status: 'fail',
        description: `Missing title tag on ${page.url}`,
        explanation: 'The title tag is the clickable headline in Google results. Without one, Google makes up its own — and it\'s almost never what you\'d want potential patients to see.',
        fix: 'Add a unique, descriptive <title> tag to every page.',
        weight: 5,
      });
    }
  }

  // Duplicate titles
  const titles = pages.map((p) => p.title).filter(Boolean);
  const duplicateTitles = titles.filter((t, i) => titles.indexOf(t) !== i);
  if (duplicateTitles.length > 0) {
    findings.push({
      category: 'On-Page',
      check: 'Duplicate Title Tags',
      status: 'fail',
      description: `${duplicateTitles.length} duplicate title tag(s) found across pages`,
      explanation: 'Google sees identical titles and thinks these pages are duplicates. It can\'t tell which one to rank, so both end up competing against each other instead of ranking for different searches.',
      fix: 'Each page should have a unique title tag that describes its specific content.',
      weight: 5,
    });
  }

  // Meta descriptions
  for (const page of pages) {
    if (!page.metaDescription) {
      findings.push({
        category: 'On-Page',
        check: 'Meta Description',
        status: 'fail',
        description: `Missing meta description on ${page.url}`,
        explanation: 'Google shows the meta description below your title in results. Without one, Google grabs random text from the page — often something awkward like cookie notices or navigation text.',
        fix: 'Add a meta description (120-160 characters) to every page.',
        weight: 4,
      });
    }
  }

  // Duplicate meta descriptions
  const metaDescs = pages.map((p) => p.metaDescription).filter(Boolean);
  const duplicateDescs = metaDescs.filter((d, i) => metaDescs.indexOf(d) !== i);
  if (duplicateDescs.length > 0) {
    findings.push({
      category: 'On-Page',
      check: 'Duplicate Meta Descriptions',
      status: 'fail',
      description: `${duplicateDescs.length} duplicate meta description(s) found`,
      explanation: 'Identical descriptions make all your pages look the same in Google results. Searchers can\'t tell which page has what they need, so they click on a competitor\'s listing instead.',
      fix: 'Write unique meta descriptions for each page.',
      weight: 4,
    });
  }

  // H1 tags
  for (const page of pages) {
    const h1Count = page.headings.filter((h) => h.tag === 'h1').length;
    if (h1Count === 0) {
      findings.push({
        category: 'On-Page',
        check: 'H1 Tag',
        status: 'fail',
        description: `No H1 tag found on ${page.url}`,
        explanation: 'Google uses the H1 as a primary signal for what the page is about. Without one, Google has to guess — and it often guesses wrong, ranking you for the wrong searches.',
        fix: 'Add exactly one H1 tag per page that describes the main topic.',
        weight: 4,
      });
    } else if (h1Count > 1) {
      findings.push({
        category: 'On-Page',
        check: 'H1 Tag',
        status: 'warning',
        description: `Multiple H1 tags (${h1Count}) on ${page.url}`,
        explanation: 'Multiple H1s confuse Google about what the page is really about. It dilutes the signal, so instead of ranking strongly for one topic, you rank weakly for several.',
        fix: 'Use only one H1 tag per page. Use H2-H6 for subheadings.',
        weight: 2,
      });
    }
  }

  // Image alt text
  const allImages = pages.flatMap((p) => p.images);
  const imagesWithoutAlt = allImages.filter((img) => !img.alt || !img.alt.trim());
  if (allImages.length > 0) {
    const coverage = Math.round(((allImages.length - imagesWithoutAlt.length) / allImages.length) * 100);
    findings.push({
      category: 'On-Page',
      check: 'Image Alt Text',
      status: coverage >= 90 ? 'pass' : coverage >= 70 ? 'warning' : 'fail',
      description: `${coverage}% of images have alt text (${imagesWithoutAlt.length} missing out of ${allImages.length})`,
      explanation: 'Google can\'t "see" images — it relies on alt text to understand them. Missing alt text means missed opportunities to rank in Google Image search, plus it\'s an ADA compliance issue that could expose your practice to legal risk.',
      fix: coverage >= 90 ? null : 'Add descriptive alt text to all images for accessibility and SEO.',
      weight: 5,
    });
  }

  // --- Local SEO Checks ---

  // NAP consistency (basic: check if phone/address patterns appear)
  // Strip <script>, <style>, and HTML tags so we only scan visible text
  const visibleText = pages
    .map((p) => p.html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .join(' ');
  // Require at least one separator (dash, dot, space, or parens) to avoid matching bare digit strings
  const phonePattern = /(\(\d{3}\)\s?\d{3}[-.\s]?\d{4}|\d{3}[-.\s]\d{3}[-.\s]?\d{4}|\d{3}[-.\s]?\d{3}[-.\s]\d{4})/g;
  const phoneMatches = visibleText.match(phonePattern) || [];
  const uniquePhones = [...new Set(phoneMatches.map((p) => p.replace(/[\s\-().]/g, '')))];

  findings.push({
    category: 'Local SEO',
    check: 'Phone Number Presence',
    status: uniquePhones.length > 0 ? 'pass' : 'warning',
    description:
      uniquePhones.length > 0
        ? `Phone number found (${uniquePhones.length} unique format(s))`
        : 'No phone number detected on the site',
    explanation: 'Google uses your phone number to connect your website to your Google Business Profile. Without a visible number, Google can\'t verify you\'re a real local business, which hurts your local search rankings.',
    fix: uniquePhones.length > 0 ? null : 'Add a visible phone number to improve local SEO and user trust.',
    weight: 3,
  });

  if (uniquePhones.length > 1) {
    findings.push({
      category: 'Local SEO',
      check: 'NAP Consistency',
      status: 'warning',
      description: `Multiple phone number formats detected: ${uniquePhones.join(', ')}`,
      explanation: 'Google cross-references your phone number across your site and the web. Inconsistent formats make Google less confident about your business info, which directly lowers your local search rankings.',
      fix: 'Use a consistent phone number format across all pages.',
      weight: 3,
    });
  }

  findings.push({
    category: 'Local SEO',
    check: 'LocalBusiness Schema',
    status: hasLocalBusiness ? 'pass' : 'fail',
    description: hasLocalBusiness
      ? 'LocalBusiness or MedicalBusiness schema markup found'
      : 'No LocalBusiness or MedicalBusiness schema markup detected',
    explanation: 'This is how Google knows you\'re a therapy practice with a physical location. Without it, Google can\'t show your business in Maps, display your hours, or show star ratings — all the things that make local searchers click.',
    fix: hasLocalBusiness
      ? null
      : 'Add LocalBusiness or MedicalBusiness JSON-LD schema with name, address, phone, hours, and services.',
    weight: 7,
  });

  // Calculate score
  const totalWeight = findings.reduce((sum, f) => sum + f.weight, 0);
  const deductions = findings
    .filter((f) => f.status === 'fail')
    .reduce((sum, f) => sum + f.weight, 0);
  const warningDeductions = findings
    .filter((f) => f.status === 'warning')
    .reduce((sum, f) => sum + f.weight * 0.5, 0);

  const rawScore = Math.max(0, 100 - ((deductions + warningDeductions) / totalWeight) * 100);
  const score = Math.round(rawScore);

  return { score, findings };
}
