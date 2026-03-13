import { ScrapedPage } from './scraper';
import { AhrefsOrganicKeyword, AhrefsRelatedKeyword } from './ahrefs';

export interface SiteKeyword {
  keyword: string;
  frequency: number;
  foundIn: string[]; // e.g. ['title', 'h1', 'meta description', 'body']
}

export interface KeywordData {
  siteKeywords: SiteKeyword[];
  organicKeywords: AhrefsOrganicKeyword[];
  relatedKeywords: AhrefsRelatedKeyword[];
}

// Common stop words to filter out
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'can', 'shall', 'not', 'no', 'nor',
  'so', 'if', 'then', 'than', 'that', 'this', 'these', 'those', 'it',
  'its', 'i', 'me', 'my', 'we', 'us', 'our', 'you', 'your', 'he', 'she',
  'him', 'her', 'his', 'they', 'them', 'their', 'what', 'which', 'who',
  'whom', 'how', 'when', 'where', 'why', 'all', 'each', 'every', 'both',
  'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same',
  'also', 'just', 'about', 'above', 'after', 'again', 'any', 'because',
  'before', 'between', 'during', 'here', 'there', 'once', 'over', 'under',
  'very', 'up', 'down', 'out', 'off', 'into', 'through', 'get', 'got',
  'make', 'made', 'go', 'going', 'come', 'take', 'know', 'see', 'look',
  'like', 'want', 'give', 'use', 'find', 'tell', 'ask', 'work', 'seem',
  'feel', 'try', 'leave', 'call', 'need', 'keep', 'let', 'begin', 'show',
  'hear', 'play', 'run', 'move', 'live', 'believe', 'happen', 'set',
  'well', 'back', 'still', 'even', 'new', 'now', 'way', 'many', 'much',
  'long', 'great', 'right', 'too', 'around', 'help', 'click', 'read',
  'learn', 'contact', 'home', 'page', 'site', 'website', 'www', 'com',
  'http', 'https',
]);

function extractWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Extract n-grams (1-3 words) from text, filtering stop words from unigrams.
 */
function extractPhrases(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);

  const phrases: string[] = [];

  // Unigrams (filtered)
  for (const w of words) {
    if (w.length > 2 && !STOP_WORDS.has(w)) {
      phrases.push(w);
    }
  }

  // Bigrams and trigrams
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (bigram.length > 5) phrases.push(bigram);

    if (i < words.length - 2) {
      const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      if (trigram.length > 8) phrases.push(trigram);
    }
  }

  return phrases;
}

/**
 * Analyze scraped pages to extract the most prominent keywords and phrases.
 */
export function extractSiteKeywords(pages: ScrapedPage[]): SiteKeyword[] {
  // Track keyword occurrences with weighted scoring and source tracking
  const keywordMap = new Map<string, { score: number; sources: Set<string> }>();

  function addKeyword(phrase: string, source: string, weight: number) {
    const existing = keywordMap.get(phrase);
    if (existing) {
      existing.score += weight;
      existing.sources.add(source);
    } else {
      keywordMap.set(phrase, { score: weight, sources: new Set([source]) });
    }
  }

  for (const page of pages) {
    // Title tags (highest weight)
    for (const phrase of extractPhrases(page.title)) {
      addKeyword(phrase, 'title', 5);
    }

    // Meta description
    for (const phrase of extractPhrases(page.metaDescription)) {
      addKeyword(phrase, 'meta description', 4);
    }

    // H1 headings
    for (const h of page.headings.filter((h) => h.tag === 'h1')) {
      for (const phrase of extractPhrases(h.text)) {
        addKeyword(phrase, 'h1', 4);
      }
    }

    // H2 headings
    for (const h of page.headings.filter((h) => h.tag === 'h2')) {
      for (const phrase of extractPhrases(h.text)) {
        addKeyword(phrase, 'h2', 3);
      }
    }

    // H3 headings
    for (const h of page.headings.filter((h) => h.tag === 'h3')) {
      for (const phrase of extractPhrases(h.text)) {
        addKeyword(phrase, 'h3', 2);
      }
    }

    // Body text (from HTML stripped of tags) — lower weight
    const bodyText = page.html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ');

    for (const phrase of extractPhrases(bodyText)) {
      addKeyword(phrase, 'body', 1);
    }

    // Image alt text
    for (const img of page.images) {
      if (img.alt) {
        for (const phrase of extractPhrases(img.alt)) {
          addKeyword(phrase, 'alt text', 2);
        }
      }
    }
  }

  // Convert to sorted array, filter out low-value entries
  return Array.from(keywordMap.entries())
    .map(([keyword, { score, sources }]) => ({
      keyword,
      frequency: score,
      foundIn: Array.from(sources),
    }))
    .filter((k) => k.frequency >= 3) // Must appear with meaningful weight
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 30); // Top 30 keywords
}
