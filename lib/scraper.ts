import { chromium, Browser, Page } from 'playwright';

export interface ScrapedPage {
  url: string;
  html: string;
  title: string;
  metaDescription: string;
  headings: { tag: string; text: string }[];
  images: { src: string; alt: string | null }[];
  internalLinks: string[];
  externalLinks: string[];
  scripts: { src: string | null; inline: string | null }[];
  forms: { action: string | null; method: string | null; inputs: string[] }[];
  iframes: { src: string | null }[];
  metaTags: { name: string | null; property: string | null; content: string | null }[];
  canonicalUrl: string | null;
  schemaMarkup: string[];
  wordCount: number;
  networkRequests: string[];
  navLinks: string[];
  footerLinks: string[];
}

export interface ScrapeResult {
  pages: ScrapedPage[];
  sitemapExists: boolean;
  sitemapContent: string | null;
  robotsTxtExists: boolean;
  robotsTxtContent: string | null;
  httpsEnforced: boolean;
  tlsVersion: string | null;
  handles404: boolean;
}

interface ScrapeConfig {
  includeNavLinks: boolean;
  includeFooterLinks: boolean; // future option
}

const DEFAULT_CONFIG: ScrapeConfig = {
  includeNavLinks: true,
  includeFooterLinks: false,
};

export async function scrapeSite(
  siteUrl: string,
  config: ScrapeConfig = DEFAULT_CONFIG
): Promise<ScrapeResult> {
  const browser = await chromium.launch({ headless: true });

  try {
    const baseUrl = new URL(siteUrl);
    const origin = baseUrl.origin;

    // Scrape homepage first
    const homepage = await scrapePage(browser, siteUrl);

    // Discover nav links (captured by Playwright from the rendered DOM)
    let navUrls: string[] = [];
    if (config.includeNavLinks) {
      navUrls = homepage.navLinks.filter(
        (u) => u.startsWith(origin) && !u.includes('#')
      );
    }

    if (config.includeFooterLinks) {
      const footerUrls = homepage.footerLinks.filter(
        (u) => u.startsWith(origin) && !u.includes('#')
      );
      navUrls.push(...footerUrls);
    }

    // Deduplicate and filter out the homepage itself
    const uniqueUrls = [...new Set(navUrls)].filter(
      (u) => normalizeUrl(u) !== normalizeUrl(siteUrl)
    );

    // Scrape nav pages sequentially (memory safety)
    const pages: ScrapedPage[] = [homepage];
    for (const url of uniqueUrls) {
      try {
        const page = await scrapePage(browser, url);
        pages.push(page);
      } catch (err) {
        console.error(`Failed to scrape ${url}:`, err);
      }
    }

    // Check sitemap, robots.txt, HTTPS, 404 handling
    const [sitemap, robotsTxt, httpsCheck, notFoundCheck] = await Promise.all([
      checkSitemap(browser, origin),
      checkRobotsTxt(browser, origin),
      checkHttpsEnforced(origin),
      check404Handling(browser, origin),
    ]);

    return {
      pages,
      sitemapExists: sitemap.exists,
      sitemapContent: sitemap.content,
      robotsTxtExists: robotsTxt.exists,
      robotsTxtContent: robotsTxt.content,
      httpsEnforced: httpsCheck,
      tlsVersion: null, // Would need TLS library to detect version
      handles404: notFoundCheck,
    };
  } finally {
    await browser.close();
  }
}

async function scrapePage(browser: Browser, url: string): Promise<ScrapedPage> {
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  const networkRequests: string[] = [];
  page.on('request', (req) => {
    networkRequests.push(req.url());
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Give JS-rendered content a moment to settle
    await page.waitForTimeout(3000);

    const data = await page.evaluate(() => {
      const getTextContent = (el: Element | null) => el?.textContent?.trim() || '';

      // Title
      const title = document.title || '';

      // Meta description
      const metaDesc =
        document.querySelector('meta[name="description"]')?.getAttribute('content') || '';

      // Headings
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(
        (h) => ({
          tag: h.tagName.toLowerCase(),
          text: getTextContent(h),
        })
      );

      // Images
      const images = Array.from(document.querySelectorAll('img')).map((img) => ({
        src: img.src,
        alt: img.getAttribute('alt'),
      }));

      // Links
      const allLinks = Array.from(document.querySelectorAll('a[href]')).map(
        (a) => (a as HTMLAnchorElement).href
      );
      const origin = window.location.origin;
      const internalLinks = allLinks.filter((l) => l.startsWith(origin));
      const externalLinks = allLinks.filter(
        (l) => l.startsWith('http') && !l.startsWith(origin)
      );

      // Scripts
      const scripts = Array.from(document.querySelectorAll('script')).map((s) => ({
        src: s.src || null,
        inline: s.src ? null : (s.textContent?.substring(0, 2000) || null),
      }));

      // Forms
      const forms = Array.from(document.querySelectorAll('form')).map((f) => ({
        action: f.action || null,
        method: f.method || null,
        inputs: Array.from(f.querySelectorAll('input, textarea, select')).map(
          (i) => `${i.tagName.toLowerCase()}[name="${i.getAttribute('name')}"][type="${i.getAttribute('type')}"]`
        ),
      }));

      // Iframes
      const iframes = Array.from(document.querySelectorAll('iframe')).map((f) => ({
        src: f.src || null,
      }));

      // Meta tags
      const metaTags = Array.from(document.querySelectorAll('meta')).map((m) => ({
        name: m.getAttribute('name'),
        property: m.getAttribute('property'),
        content: m.getAttribute('content'),
      }));

      // Canonical
      const canonicalUrl =
        document.querySelector('link[rel="canonical"]')?.getAttribute('href') || null;

      // Schema markup (JSON-LD)
      const schemaMarkup = Array.from(
        document.querySelectorAll('script[type="application/ld+json"]')
      ).map((s) => s.textContent || '');

      // Word count (visible text)
      const bodyText = document.body?.innerText || '';
      const wordCount = bodyText.split(/\s+/).filter((w) => w.length > 0).length;

      // Nav links — try <nav> elements first, fall back to header links
      let navLinks = Array.from(document.querySelectorAll('nav a[href]')).map(
        (a) => (a as HTMLAnchorElement).href
      );
      if (navLinks.length === 0) {
        // Fallback: links inside <header>, common in SPAs/custom navs
        navLinks = Array.from(document.querySelectorAll('header a[href]')).map(
          (a) => (a as HTMLAnchorElement).href
        );
      }
      if (navLinks.length === 0) {
        // Fallback: links with role="navigation" or aria-label containing "nav"
        navLinks = Array.from(
          document.querySelectorAll('[role="navigation"] a[href], [aria-label*="nav" i] a[href]')
        ).map((a) => (a as HTMLAnchorElement).href);
      }

      // Footer links (for future use)
      const footerLinks = Array.from(document.querySelectorAll('footer a[href]')).map(
        (a) => (a as HTMLAnchorElement).href
      );

      return {
        title,
        metaDescription: metaDesc,
        headings,
        images,
        internalLinks,
        externalLinks,
        scripts,
        forms,
        iframes,
        metaTags,
        canonicalUrl,
        schemaMarkup,
        wordCount,
        navLinks,
        footerLinks,
      };
    });

    const html = await page.content();

    return {
      url,
      html,
      ...data,
      networkRequests,
    };
  } finally {
    await context.close();
  }
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname.replace(/\/$/, '');
  } catch {
    return url;
  }
}

async function checkSitemap(
  browser: Browser,
  origin: string
): Promise<{ exists: boolean; content: string | null }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    const res = await page.goto(`${origin}/sitemap.xml`, { timeout: 10000 });
    if (res && res.status() === 200) {
      const content = await page.content();
      return { exists: true, content };
    }
    return { exists: false, content: null };
  } catch {
    return { exists: false, content: null };
  } finally {
    await context.close();
  }
}

async function checkRobotsTxt(
  browser: Browser,
  origin: string
): Promise<{ exists: boolean; content: string | null }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    const res = await page.goto(`${origin}/robots.txt`, { timeout: 10000 });
    if (res && res.status() === 200) {
      const content = await page.innerText('body');
      return { exists: true, content };
    }
    return { exists: false, content: null };
  } catch {
    return { exists: false, content: null };
  } finally {
    await context.close();
  }
}

async function checkHttpsEnforced(origin: string): Promise<boolean> {
  // If the origin is already HTTPS, check if HTTP redirects to HTTPS
  if (origin.startsWith('https://')) {
    return true; // Basic check - site uses HTTPS
  }
  return false;
}

async function check404Handling(browser: Browser, origin: string): Promise<boolean> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    const res = await page.goto(`${origin}/this-page-definitely-does-not-exist-12345`, {
      timeout: 10000,
    });
    // A proper 404 page returns a 404 status
    return res !== null && res.status() === 404;
  } catch {
    return false;
  } finally {
    await context.close();
  }
}
