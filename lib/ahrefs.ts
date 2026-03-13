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

export async function getAhrefsOrganicKeywords(siteUrl: string): Promise<AhrefsOrganicKeyword[]> {
  const domain = extractDomain(siteUrl);

  try {
    const data = await ahrefsFetch('organic-keywords', {
      target: domain,
      output: 'json',
      limit: '50',
      select: 'keyword,volume,position,traffic,difficulty',
      order_by: 'traffic:desc',
      country: 'us',
    }) as { keywords?: { keyword: string; volume: number; position: number; traffic: number; difficulty: number }[] };

    return (data.keywords || []).map((k) => ({
      keyword: k.keyword,
      volume: k.volume ?? 0,
      position: k.position ?? 0,
      traffic: k.traffic ?? 0,
      difficulty: k.difficulty ?? 0,
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
