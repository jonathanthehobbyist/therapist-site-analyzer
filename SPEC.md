# Therapist Website Analyzer — Product Spec

## Overview

A Next.js web application that analyzes therapist websites across three dimensions: **SEO comparison against a top-ranking competitor**, **SEO hygiene**, and **HIPAA risk audit**. Results are displayed in an interactive dashboard with per-category scores. Analyses are saved and trackable over time.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Frontend**: React + Tailwind CSS
- **Backend**: Next.js API routes running as a persistent Node.js server (not serverless)
- **Database**: SQLite via Prisma (file-based, lives on EC2 instance)
- **Scraping**: Playwright (headless Chromium)
- **APIs**:
  - Ahrefs API v3 (Lite subscription)
  - Google PageSpeed Insights API (free)
  - Claude API (`claude-sonnet-4-20250514`) for intelligent HIPAA pattern detection
- **Auth**: None for v1 (internal tool)

---

## Hosting & Infrastructure (AWS)

### Compute

**EC2 t3.medium** (2 vCPU, 4GB RAM)
- Provides sufficient headroom for Playwright/Chromium (~300-500MB per instance) + Next.js concurrently
- Amazon Linux 2023 AMI
- Run Next.js via **PM2** (process manager — auto-restarts on crash, starts on reboot)
- Playwright and its Chromium binary installed directly on the instance

### Networking

- **Elastic IP** assigned to the instance (stable address, survives reboots)
- **Nginx** as reverse proxy on port 80/443 -> forwards to Next.js on port 3000
- **Security Group** rules:
  - Inbound: 80 (HTTP), 443 (HTTPS), 22 (SSH — restricted to your IP only)
  - Outbound: all (needed for scraping and external API calls)
- Optional: point a domain at the Elastic IP and use **Let's Encrypt / Certbot** for free HTTPS

### Storage

- SQLite `.db` file stored at `/home/ec2-user/app/prisma/data/app.db`
- **Automated backups**: cron job runs nightly, copies `.db` to a private **S3 bucket** with 30-day retention
- **EBS volume**: default 20GB gp3 root volume is sufficient

### Estimated Monthly Cost

| Resource | Cost |
|---|---|
| EC2 t3.medium | ~$30/mo |
| Elastic IP (when attached) | Free |
| EBS 20GB gp3 | ~$1.60/mo |
| S3 backup storage | <$0.50/mo |
| Data transfer | ~$1-2/mo |
| **Total** | **~$33-35/mo** |

### Infrastructure Claude Code Should Scaffold

Claude Code should create the following configuration files in the repo:

**`/infra/nginx.conf`**
```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**`/infra/ecosystem.config.js`** (PM2 config)
```js
module.exports = {
  apps: [{
    name: 'therapist-analyzer',
    script: 'node_modules/.bin/next',
    args: 'start',
    cwd: '/home/ec2-user/app',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    restart_delay: 5000,
    max_restarts: 10
  }]
}
```

**`/infra/backup.sh`** (S3 backup cron script)
```bash
#!/bin/bash
DATE=$(date +%Y-%m-%d)
aws s3 cp /home/ec2-user/app/prisma/data/app.db \
  s3://YOUR-BUCKET-NAME/backups/app-$DATE.db
```

**`/infra/setup.sh`** (one-time EC2 bootstrap script)
- Installs Node.js 20, PM2, Nginx, Git
- Installs Playwright system dependencies (`playwright install-deps chromium`)
- Sets up Nginx with the above config
- Enables and starts Nginx
- Configures PM2 to start on system boot (`pm2 startup`)
- Creates the S3 backup cron job in crontab (runs at 2am daily)

**`/infra/deploy.sh`** (redeployment script -- run after pushing changes)
```bash
#!/bin/bash
cd /home/ec2-user/app
git pull origin main
npm ci
npx prisma migrate deploy
npm run build
pm2 restart therapist-analyzer
```

**`/infra/README.md`** with step-by-step instructions:
1. Launch EC2 t3.medium with Amazon Linux 2023
2. Assign Elastic IP
3. Configure Security Group
4. SSH in and run `setup.sh`
5. Clone repo, copy `.env.production`, run `deploy.sh`
6. Create S3 bucket and attach IAM role to EC2 with S3 write access
7. Optional: point domain + run Certbot for HTTPS

---

## Core Features

### 1. URL Input & Analysis Trigger

- Single input screen with two URL fields:
  - **Target site** (the therapist's site to audit)
  - **Competitor URL** (top-ranking site for the target search term)
- Optional: search term / keyword field (used to contextualize SEO comparison)
- "Run Analysis" button triggers all three analysis modules in parallel
- Progress indicator showing which modules are running

---

### 2. SEO Comparison Module

Compare target site vs. competitor across:

**On-Page (via scraping + PageSpeed API)**
- Title tag: presence, length, keyword inclusion
- Meta description: presence, length, keyword inclusion
- H1/H2/H3 structure
- Word count (homepage + key pages)
- Image alt text coverage
- Internal linking structure
- Page load speed (Core Web Vitals via PageSpeed API): LCP, CLS, FID/INP
- Mobile friendliness score

**Technical SEO (via scraping)**
- Sitemap.xml: present, valid, submitted
- Robots.txt: present, not blocking crawlers
- Canonical tags
- Structured data / Schema markup (LocalBusiness, MedicalBusiness, Person, FAQPage)
- HTTPS enforcement
- 404 handling

**Backlink & Authority (via Ahrefs API)**
- Domain Rating (DR)
- Total referring domains
- Total backlinks
- Top anchor text distribution
- Dofollow vs. nofollow ratio

**Display**: Side-by-side comparison table. Green/red/yellow indicators per row. Target vs. competitor values shown.

---

### 3. SEO Hygiene Module

Standalone audit of the target site (not comparative). Flags issues with actionable fix descriptions.

Checks include everything in the SEO comparison list above, plus:
- Duplicate title/meta tags across pages
- Missing or broken canonical tags
- Redirect chains
- Pages blocked by robots.txt unintentionally
- Missing LocalBusiness or MedicalBusiness schema
- NAP consistency (Name, Address, Phone) across the page
- Google Business Profile schema alignment

**Scoring**: 0-100, weighted by impact. Deductions per failed check are documented.

---

### 4. HIPAA Risk Audit Module

Scrape and analyze the site for compliance red flags. Use Claude API to assist with intelligent detection of form implementations and third-party scripts.

**HTML Pre-Processing**: Before sending to the Claude API, strip the full HTML down to only HIPAA-relevant elements:
- `<script>` tags (src attributes and inline content)
- `<form>` elements (action URLs, method, child inputs)
- `<iframe>` embeds (src attributes)
- `<link>` tags (href attributes)
- Cookie-setting scripts
- Any `<meta>` tags referencing analytics or tracking

This reduces token cost significantly while preserving all HIPAA-relevant signals.

**Checks & Severity:**

| Check | Severity |
|---|---|
| Contact form with no visible encryption notice or BAA disclosure | High |
| Contact form using non-HIPAA-compliant provider (detected via form action URL or JS -- e.g. Gravity Forms on non-HIPAA host, Wufoo, Typeform, Google Forms) | High |
| Google Analytics or GA4 present on pages with contact/intake forms | High |
| Meta Pixel present on any page | High |
| SSL/TLS not enforced (HTTP available, mixed content) | High |
| TLS version outdated (TLS 1.0 or 1.1 detected) | Medium |
| Third-party chat widget present (Intercom, Drift, Tidio, HubSpot chat, etc.) | High |
| Non-HIPAA-compliant scheduler embedded (Calendly, Acuity non-HIPAA plan, generic Google Calendar) | High |
| HIPAA-compliant scheduler present (SimplePractice, TherapyNotes, Jane App) -- flag as **pass** | Pass |
| No privacy policy present | Medium |
| Privacy policy doesn't mention HIPAA or PHI | Medium |
| Session recording tools present (Hotjar, FullStory, Microsoft Clarity) | High |

**Output per finding:**
- Severity badge (High / Medium / Low / Pass)
- What was detected (e.g. "Calendly embed found on /contact")
- Why it's a risk (1-2 sentence plain English explanation)
- Recommended fix

**Overall HIPAA Risk Score**: Displayed as a risk level -- **Low / Moderate / High / Critical** -- not a numeric score.

---

### 5. Dashboard UI

**Layout:**
- Top bar: site URL, date of analysis, "Re-run" button, "Share" button (generates public read-only link)
- Three tab sections: **SEO Comparison** | **SEO Hygiene** | **HIPAA Audit**
- Each tab shows the category score/grade prominently at the top

**SEO Comparison Tab:**
- Score: 0-100 with letter grade (A/B/C/D/F)
- Side-by-side comparison table with color-coded pass/fail/warning per row
- Ahrefs metrics shown in a separate "Authority" card

**SEO Hygiene Tab:**
- Score: 0-100 with letter grade
- Grouped findings by category (Technical, On-Page, Local SEO)
- Each finding: icon, label, status, and expandable fix recommendation

**HIPAA Audit Tab:**
- Risk level badge (Low / Moderate / High / Critical) shown prominently
- Findings list sorted by severity
- Each finding is a card with severity badge, description, and fix recommendation
- Green "Pass" cards for compliant items found (e.g. SimplePractice detected)

---

### 6. History & Tracking

- All analyses saved to SQLite database on the EC2 instance
- **History page**: table of all past analyses with site URL, date, SEO score, HIPAA risk level
- Clicking a past analysis loads the full saved dashboard
- **Trend view** (per site): if a site has been analyzed 2+ times, show a simple line chart of SEO score over time and HIPAA risk level changes
- Sites can be named/tagged (e.g. "Client: Jane Smith" or "Competitor: Calm Waters Therapy")

---

## Page Crawl Strategy

**Scope**: Homepage + all pages linked in the site's primary navigation.

**How it works**:
1. Load the homepage with Playwright
2. Extract all links from `<nav>` elements (primary navigation)
3. Filter to same-domain links only
4. Deduplicate and scrape each nav page
5. All modules (SEO, Hygiene, HIPAA) run against the full set of scraped pages

**Future option (not implemented in v1)**: Also crawl pages linked in the `<footer>` element. The scraper should be structured so that adding footer link discovery is a one-line config change (e.g. `{ includeFooterLinks: true }`).

---

## Data Models (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./data/app.db"
}

model Analysis {
  id                  String   @id @default(cuid())
  createdAt           DateTime @default(now())
  siteUrl             String
  competitorUrl       String?
  keyword             String?
  status              String   @default("pending")
  seoComparisonScore  Int?
  seoHygieneScore     Int?
  hipaaRiskLevel      String?
  seoComparisonData   String?
  seoHygieneData      String?
  hipaaData           String?
  pagesScraped        String?
  error               String?
  isPublic            Boolean  @default(false)
  site                Site?    @relation(fields: [siteId], references: [id])
  siteId              String?
}

model Site {
  id        String     @id @default(cuid())
  url       String     @unique
  label     String?
  createdAt DateTime   @default(now())
  analyses  Analysis[]
}
```

Note: SQLite doesn't support `Json` type natively. JSON data is stored as `String` and parsed in application code. Prisma is configured with WAL journal mode for concurrent read/write support during polling.

---

## Prisma SQLite Configuration

In `prisma/schema.prisma`, the datasource uses WAL mode for concurrency:

```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./data/app.db"
}
```

WAL mode is enabled at connection time in the Prisma client setup (`lib/db.ts`):

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Enable WAL mode for concurrent read/write (critical for polling pattern)
prisma.$executeRawUnsafe('PRAGMA journal_mode=WAL;');
```

---

## Ahrefs API Rate Limiting

Ahrefs Lite plan: 1 request/second, monthly quota.

Implement a throttled queue in `/lib/ahrefs.ts`:

```typescript
// Simple token-bucket throttle: max 1 request per second
// All Ahrefs API calls go through this queue to prevent 429s
// Each analysis uses ~6 API calls (3 endpoints x 2 sites)
```

The queue should:
- Enforce minimum 1-second delay between requests
- Retry on 429 with exponential backoff (max 3 retries)
- If quota exhausted, complete analysis without Ahrefs data and flag the module as "Ahrefs data unavailable — monthly quota reached"

---

## Environment Variables Required

```
AHREFS_API_KEY=
GOOGLE_PAGESPEED_API_KEY=
ANTHROPIC_API_KEY=
```

---

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/analyze` | POST | Triggers full analysis, returns analysis ID immediately |
| `/api/analysis/[id]` | GET | Returns saved analysis by ID (client polls until status is "complete") |
| `/api/analyses` | GET | Returns list of all past analyses |
| `/api/share/[id]` | GET | Public read-only view of an analysis |

---

## Implementation Notes for Claude Code

1. **Scraping**: Use Playwright in a single browser instance per analysis run. Scrape target and competitor sequentially (homepage + nav pages each). Capture: full HTML, all `<script>` src tags, form `action` attributes, cookies set, and network requests (to detect analytics/pixel calls).

2. **HIPAA detection strategy**: Pre-process the scraped HTML to extract only HIPAA-relevant elements (scripts, forms, iframes, links, meta tags). Pass the filtered content to the Claude API with a structured prompt asking it to identify HIPAA-relevant third-party tools, form implementations, and tracking pixels. Return findings as structured JSON.

3. **Ahrefs API endpoints to use** (all calls go through the throttled queue):
   - `site-explorer/domain-rating` — DR
   - `site-explorer/backlinks-stats` — total backlinks + referring domains
   - `site-explorer/anchors` — anchor text distribution

4. **Scoring logic**: Define `scoreSEOComparison(data)`, `scoreSEOHygiene(data)`, and `scoreHIPAA(data)` functions in `/lib/scoring.ts` so weights are easy to tune independently.

5. **Sharing**: Shared links are fully static reads from the DB — no re-analysis triggered. Toggling `isPublic: true` on the Analysis record enables the `/api/share/[id]` route.

6. **Long-running requests**: Analysis can take 30-90 seconds. Implement as a **polling pattern** — `/api/analyze` returns a job ID immediately, client polls `/api/analysis/[id]` every 3 seconds until status is `complete`.

7. **Error handling**: If Ahrefs returns a 429 or a site times out, complete the analysis with available data and flag which modules failed with a visible warning in the dashboard.

8. **Playwright on EC2**: Ensure `setup.sh` runs `npx playwright install chromium --with-deps` and that the Next.js process has permission to execute the Chromium binary.

9. **Page crawl structure**: The scraper module should accept a config object with `{ includeNavLinks: true, includeFooterLinks: false }` so footer link crawling can be enabled later with a single flag change.

---

## Out of Scope for v1

- User authentication / multi-user support
- Email reports
- Automated scheduled re-analysis
- CMS-specific recommendations (WordPress, Squarespace, etc.)
- Competitor keyword gap analysis (Ahrefs Lite limitation)
- RDS / managed database (revisit if moving to multi-user SaaS)
- Footer link crawling (structured for easy addition later)
