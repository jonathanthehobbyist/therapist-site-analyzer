/**
 * Ahrefs API client with rate-limiting throttle.
 * Lite plan: 1 request/second, monthly quota.
 * All Ahrefs calls go through the throttled queue.
 */

export interface AhrefsData {
  domainRating: number | null;
  totalBacklinks: number | null;
  referringDomains: number | null;
  dofollowBacklinks: number | null;
  nofollowBacklinks: number | null;
  topAnchors: { anchor: string; backlinks: number }[];
  error?: string;
}

// Simple token-bucket throttle: max 1 request per 1.1 seconds
let lastRequestTime = 0;
const MIN_INTERVAL_MS = 1100;

async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

async function ahrefsFetch(endpoint: string, params: Record<string, string>, base = 'site-explorer'): Promise<unknown> {
  const apiKey = process.env.AHREFS_API_KEY;
  if (!apiKey) {
    throw new Error('AHREFS_API_KEY not configured');
  }

  await throttle();

  const url = new URL(`https://api.ahrefs.com/v3/${base}/${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  let lastError: Error | null = null;

  // Retry up to 3 times with exponential backoff on 429
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });

    if (res.ok) {
      return res.json();
    }

    if (res.status === 429) {
      const backoff = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
      console.warn(`Ahrefs 429 — retrying in ${backoff}ms (attempt ${attempt + 1}/3)`);
      await new Promise((resolve) => setTimeout(resolve, backoff));
      lastError = new Error(`Ahrefs rate limit (429) after ${attempt + 1} attempts`);
      continue;
    }

    throw new Error(`Ahrefs API error: ${res.status} ${res.statusText}`);
  }

  throw lastError || new Error('Ahrefs request failed');
}

export interface AhrefsOrganicKeyword {
  keyword: string;
  volume: number;
  position: number;
  traffic: number;
  difficulty: number;
}

export async function getStrikingDistanceKeywords(siteUrl: string): Promise<AhrefsOrganicKeyword[]> {
  const domain = extractDomain(siteUrl);
  const date = new Date().toISOString().split('T')[0];
  const where = JSON.stringify({
    and: [
      { field: 'best_position', is: ['gte', 3] },
      { field: 'best_position', is: ['lte', 10] },
    ],
  });

  try {
    const data = await ahrefsFetch('organic-keywords', {
      target: domain,
      output: 'json',
      limit: '20',
      select: 'keyword,volume,best_position,sum_traffic,keyword_difficulty',
      order_by: 'volume:desc',
      country: 'us',
      date,
      where,
    }) as { keywords?: { keyword: string; volume: number; best_position: number; sum_traffic: number; keyword_difficulty: number }[] };

    return (data.keywords || []).map((k) => ({
      keyword: k.keyword,
      volume: k.volume ?? 0,
      position: k.best_position ?? 0,
      traffic: k.sum_traffic ?? 0,
      difficulty: k.keyword_difficulty ?? 0,
    }));
  } catch (err) {
    console.error('Ahrefs striking distance keywords fetch failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

export async function getAhrefsOrganicKeywords(siteUrl: string): Promise<AhrefsOrganicKeyword[]> {
  const domain = extractDomain(siteUrl);
  const date = new Date().toISOString().split('T')[0];

  try {
    const data = await ahrefsFetch('organic-keywords', {
      target: domain,
      output: 'json',
      limit: '50',
      select: 'keyword,volume,best_position,sum_traffic,keyword_difficulty',
      order_by: 'sum_traffic:desc',
      country: 'us',
      date,
    }) as { keywords?: { keyword: string; volume: number; best_position: number; sum_traffic: number; keyword_difficulty: number }[] };

    return (data.keywords || []).map((k) => ({
      keyword: k.keyword,
      volume: k.volume ?? 0,
      position: k.best_position ?? 0,
      traffic: k.sum_traffic ?? 0,
      difficulty: k.keyword_difficulty ?? 0,
    }));
  } catch (err) {
    console.error('Ahrefs organic keywords fetch failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

export interface AhrefsRelatedKeyword {
  keyword: string;
  volume: number;
  difficulty: number;
  cpc: number;
}

export async function getAhrefsRelatedKeywords(seeds: string[]): Promise<AhrefsRelatedKeyword[]> {
  if (seeds.length === 0) return [];

  try {
    // Use top 3 seeds to get related terms
    const topSeeds = seeds.slice(0, 3);
    const allRelated: AhrefsRelatedKeyword[] = [];

    for (const seed of topSeeds) {
      try {
        const data = await ahrefsFetch('related-terms', {
          keyword: seed,
          output: 'json',
          limit: '20',
          select: 'keyword,volume,difficulty,cpc',
          country: 'us',
        }, 'keywords-explorer');
        console.log(`Ahrefs related-terms response for "${seed}":`, JSON.stringify(data).slice(0, 500));

        const parsed = data as { terms?: { keyword: string; volume: number; difficulty: number; cpc: number }[] };
        // Also check common Ahrefs response shapes
        const terms = parsed.terms || (data as { keywords?: typeof parsed.terms }).keywords || [];

        if (terms.length > 0) {
          for (const t of terms) {
            if (!allRelated.some(r => r.keyword === t.keyword)) {
              allRelated.push({
                keyword: t.keyword,
                volume: t.volume ?? 0,
                difficulty: t.difficulty ?? 0,
                cpc: t.cpc ?? 0,
              });
            }
          }
        }
      } catch (err) {
        console.warn(`Ahrefs related terms failed for "${seed}":`, err instanceof Error ? err.message : err);
      }
    }

    // Sort by volume descending, return top 30
    return allRelated.sort((a, b) => b.volume - a.volume).slice(0, 30);
  } catch (err) {
    console.error('Ahrefs related keywords fetch failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

export interface TopPage {
  url: string;
  traffic: number;
  keywords: number;
  topKeyword: string;
  topKeywordPosition: number;
  topKeywordVolume: number;
  referringDomains: number;
  urlRating: number;
  trafficValue: number;
}

export async function getTopPages(siteUrl: string): Promise<TopPage[]> {
  const domain = extractDomain(siteUrl);
  const date = new Date().toISOString().split('T')[0];

  try {
    const data = await ahrefsFetch('top-pages', {
      target: domain,
      output: 'json',
      limit: '10',
      select: 'url,sum_traffic,keywords,top_keyword,top_keyword_best_position,top_keyword_volume,referring_domains,ur,value',
      country: 'us',
      order_by: 'sum_traffic:desc',
      date,
    }) as { pages?: { url: string; sum_traffic: number; keywords: number; top_keyword: string; top_keyword_best_position: number; top_keyword_volume: number; referring_domains: number; ur: number; value: number }[] };

    return (data.pages || []).map((p) => ({
      url: p.url,
      traffic: p.sum_traffic ?? 0,
      keywords: p.keywords ?? 0,
      topKeyword: p.top_keyword ?? '',
      topKeywordPosition: p.top_keyword_best_position ?? 0,
      topKeywordVolume: p.top_keyword_volume ?? 0,
      referringDomains: p.referring_domains ?? 0,
      urlRating: p.ur ?? 0,
      trafficValue: p.value ?? 0,
    }));
  } catch (err) {
    console.error('Ahrefs top pages fetch failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

export interface VolumeHistoryPoint {
  date: string;
  volume: number;
}

export async function getKeywordVolumeHistory(keyword: string, country = 'us'): Promise<VolumeHistoryPoint[]> {
  try {
    const dateTo = new Date().toISOString().split('T')[0];
    const dateFrom = new Date();
    dateFrom.setFullYear(dateFrom.getFullYear() - 10);
    const dateFromStr = dateFrom.toISOString().split('T')[0];

    const data = await ahrefsFetch('overview', {
      keywords: keyword,
      country,
      output: 'json',
      select: 'keyword,volume_monthly_history',
      volume_monthly_date_from: dateFromStr,
      volume_monthly_date_to: dateTo,
    }, 'keywords-explorer') as { keywords?: { keyword: string; volume_monthly_history: { date: string; volume: number }[] }[] };

    console.log(`Ahrefs volume history for "${keyword}": ${data.keywords?.[0]?.volume_monthly_history?.length ?? 0} data points`);

    return (data.keywords?.[0]?.volume_monthly_history || []).map((v) => ({
      date: v.date,
      volume: v.volume ?? 0,
    }));
  } catch (err) {
    console.error('Ahrefs volume history fetch failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export async function getAhrefsData(siteUrl: string): Promise<AhrefsData> {
  const domain = extractDomain(siteUrl);

  try {
    // Fetch all three endpoints sequentially (throttled)
    const [drData, backlinksData, anchorsData] = await Promise.all([
      ahrefsFetch('domain-rating', { target: domain, output: 'json' }).catch(() => null),
      // Sequential due to throttle — Promise.all still works since throttle() serializes
      ahrefsFetch('backlinks-stats', { target: domain, output: 'json' }).catch(() => null),
      ahrefsFetch('anchors', {
        target: domain,
        output: 'json',
        limit: '10',
        order_by: 'backlinks:desc',
      }).catch(() => null),
    ]);

    const dr = drData as { domain_rating?: number } | null;
    const bl = backlinksData as {
      live?: number;
      all_time?: number;
      live_refdomains?: number;
      dofollow?: number;
      nofollow?: number;
    } | null;
    const an = anchorsData as {
      anchors?: { anchor: string; backlinks: number }[];
    } | null;

    return {
      domainRating: dr?.domain_rating ?? null,
      totalBacklinks: bl?.live ?? bl?.all_time ?? null,
      referringDomains: bl?.live_refdomains ?? null,
      dofollowBacklinks: bl?.dofollow ?? null,
      nofollowBacklinks: bl?.nofollow ?? null,
      topAnchors: an?.anchors?.slice(0, 10) ?? [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown Ahrefs error';
    console.error('Ahrefs data fetch failed:', message);
    return {
      domainRating: null,
      totalBacklinks: null,
      referringDomains: null,
      dofollowBacklinks: null,
      nofollowBacklinks: null,
      topAnchors: [],
      error: message,
    };
  }
}
