/**
 * Google PageSpeed Insights API client.
 * Free tier — no rate limiting needed.
 */

export interface FilmstripFrame {
  timing: number; // ms
  data: string;   // base64 data URI
}

export interface PageSpeedMetrics {
  performanceScore: number | null;
  lcp: number | null; // Largest Contentful Paint (ms)
  cls: number | null; // Cumulative Layout Shift
  fid: number | null; // First Input Delay (ms) / INP
  fcp: number | null; // First Contentful Paint (ms)
  si: number | null;  // Speed Index (ms)
  tbt: number | null; // Total Blocking Time (ms)
  tti: number | null; // Time to Interactive (ms)
  finalScreenshot: string | null; // base64 data URI
  filmstrip: FilmstripFrame[];
  error?: string;
}

// Backward compat — old code uses PageSpeedData
export interface PageSpeedData extends PageSpeedMetrics {
  mobileScore: number | null;
}

export interface FullPageSpeedData {
  mobile: PageSpeedMetrics;
  desktop: PageSpeedMetrics;
}

async function fetchPageSpeed(
  url: string,
  strategy: 'mobile' | 'desktop'
): Promise<PageSpeedMetrics> {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;

  const apiUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  apiUrl.searchParams.set('url', url);
  apiUrl.searchParams.set('strategy', strategy);
  if (apiKey) {
    apiUrl.searchParams.set('key', apiKey);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    const res = await fetch(apiUrl.toString(), { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`PageSpeed API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();

    const lighthouse = data.lighthouseResult;
    if (!lighthouse) {
      throw new Error('No lighthouse data in response');
    }

    const audits = lighthouse.audits || {};
    const categories = lighthouse.categories || {};

    // Extract filmstrip thumbnails
    const filmstrip: FilmstripFrame[] = [];
    const filmstripAudit = audits['screenshot-thumbnails'];
    if (filmstripAudit?.details?.items) {
      for (const item of filmstripAudit.details.items) {
        if (item.data && typeof item.timing === 'number') {
          filmstrip.push({ timing: item.timing, data: item.data });
        }
      }
    }

    // Extract final screenshot
    let finalScreenshot: string | null = null;
    const fsAudit = audits['final-screenshot'];
    if (fsAudit?.details?.data) {
      finalScreenshot = fsAudit.details.data;
    }

    return {
      performanceScore: categories.performance?.score
        ? Math.round(categories.performance.score * 100)
        : null,
      lcp: audits['largest-contentful-paint']?.numericValue ?? null,
      cls: audits['cumulative-layout-shift']?.numericValue ?? null,
      fid: audits['max-potential-fid']?.numericValue ??
        audits['interaction-to-next-paint']?.numericValue ?? null,
      fcp: audits['first-contentful-paint']?.numericValue ?? null,
      si: audits['speed-index']?.numericValue ?? null,
      tbt: audits['total-blocking-time']?.numericValue ?? null,
      tti: audits['interactive']?.numericValue ?? null,
      finalScreenshot,
      filmstrip,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown PageSpeed error';
    console.error(`PageSpeed (${strategy}) fetch failed:`, message);
    return {
      performanceScore: null,
      lcp: null,
      cls: null,
      fid: null,
      fcp: null,
      si: null,
      tbt: null,
      tti: null,
      finalScreenshot: null,
      filmstrip: [],
      error: message,
    };
  }
}

/**
 * Fetch both mobile and desktop PageSpeed data.
 */
export async function getFullPageSpeedData(url: string): Promise<FullPageSpeedData> {
  const [mobile, desktop] = await Promise.all([
    fetchPageSpeed(url, 'mobile'),
    fetchPageSpeed(url, 'desktop'),
  ]);
  return { mobile, desktop };
}

/**
 * Backward-compatible single-strategy fetch (used by seo-hygiene).
 */
export async function getPageSpeedData(
  url: string,
  strategy: 'mobile' | 'desktop' = 'mobile'
): Promise<PageSpeedData> {
  const metrics = await fetchPageSpeed(url, strategy);
  return {
    ...metrics,
    mobileScore: strategy === 'mobile' ? metrics.performanceScore : null,
  };
}
