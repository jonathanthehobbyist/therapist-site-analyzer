import Anthropic from '@anthropic-ai/sdk';
import { ScrapedPage } from './scraper';

export interface HipaaFinding {
  severity: 'high' | 'medium' | 'low' | 'pass';
  check: string;
  description: string;
  pageUrl: string;
  whyRisk: string;
  recommendedFix: string;
}

export interface HipaaResult {
  riskLevel: 'Low' | 'Moderate' | 'High';
  findings: HipaaFinding[];
}

/**
 * Pre-process HTML to extract only HIPAA-relevant elements.
 * This dramatically reduces token usage when sending to Claude.
 */
function extractHipaaRelevantContent(page: ScrapedPage): string {
  const sections: string[] = [];

  sections.push(`Page URL: ${page.url}`);

  // Scripts
  if (page.scripts.length > 0) {
    sections.push('--- SCRIPTS ---');
    for (const s of page.scripts) {
      if (s.src) {
        sections.push(`<script src="${s.src}"></script>`);
      } else if (s.inline) {
        // Only include first 500 chars of inline scripts to stay focused
        sections.push(`<script>${s.inline.substring(0, 500)}</script>`);
      }
    }
  }

  // Forms
  if (page.forms.length > 0) {
    sections.push('--- FORMS ---');
    for (const f of page.forms) {
      sections.push(
        `<form action="${f.action}" method="${f.method}">` +
          f.inputs.map((i) => `  ${i}`).join('\n') +
          '</form>'
      );
    }
  }

  // Iframes
  if (page.iframes.length > 0) {
    sections.push('--- IFRAMES ---');
    for (const f of page.iframes) {
      sections.push(`<iframe src="${f.src}"></iframe>`);
    }
  }

  // Meta tags (tracking-related)
  const trackingMeta = page.metaTags.filter(
    (m) =>
      m.name?.includes('facebook') ||
      m.property?.includes('fb:') ||
      m.name?.includes('google') ||
      m.name?.includes('msvalidate') ||
      m.property?.includes('og:') ||
      m.name?.includes('verification')
  );
  if (trackingMeta.length > 0) {
    sections.push('--- META TAGS ---');
    for (const m of trackingMeta) {
      sections.push(
        `<meta name="${m.name}" property="${m.property}" content="${m.content}">`
      );
    }
  }

  // Network requests (filter to known tracking/analytics domains)
  const trackingDomains = [
    'google-analytics.com',
    'googletagmanager.com',
    'facebook.net',
    'facebook.com/tr',
    'hotjar.com',
    'fullstory.com',
    'clarity.ms',
    'intercom.io',
    'drift.com',
    'tidio.co',
    'hubspot.com',
    'calendly.com',
    'acuityscheduling.com',
  ];

  const trackingRequests = page.networkRequests.filter((url) =>
    trackingDomains.some((domain) => url.includes(domain))
  );
  if (trackingRequests.length > 0) {
    sections.push('--- TRACKING NETWORK REQUESTS ---');
    for (const url of trackingRequests) {
      sections.push(url);
    }
  }

  return sections.join('\n');
}

export async function analyzeHipaa(pages: ScrapedPage[]): Promise<HipaaResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      riskLevel: 'High',
      findings: [
        {
          severity: 'high',
          check: 'API Configuration',
          description: 'ANTHROPIC_API_KEY not configured — HIPAA analysis could not run',
          pageUrl: '',
          whyRisk: 'Unable to perform intelligent HIPAA risk detection without the Claude API.',
          recommendedFix: 'Set the ANTHROPIC_API_KEY environment variable.',
        },
      ],
    };
  }

  const client = new Anthropic({ apiKey });

  // Build the filtered content for all pages
  const pagesContent = pages
    .map((page) => extractHipaaRelevantContent(page))
    .join('\n\n===== NEXT PAGE =====\n\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are a HIPAA compliance auditor for therapist/healthcare websites. Analyze the following extracted website data and identify potential HIPAA risk findings.

IMPORTANT TONE GUIDELINES:
- Use soft, non-alarming language throughout. You are advising, not accusing.
- For descriptions, say "We detected what looks like..." or "It appears that..." rather than stating things definitively.
- For whyRisk, say "this may violate" or "this could pose a risk" rather than "this violates."
- For recommendedFix, frame as helpful suggestions: "Consider removing..." or "We recommend..." rather than demands.
- Remember: these are small practice owners, not security engineers. Be helpful and clear, not scary.

For each finding, provide:
- severity: "high", "medium", "low", or "pass" (pass = compliant item found)
- check: short label (e.g. "Google Analytics on Form Page")
- description: what was detected, using soft language (e.g. "We detected what looks like a GA4 script on the /contact page, which appears to contain a patient intake form")
- pageUrl: which page URL the finding relates to
- whyRisk: 1-2 sentence explanation of why this could be a HIPAA concern (use "may" and "could", not "violates" or "is a violation")
- recommendedFix: actionable fix suggestion

Check for these specific issues:
1. Contact/intake forms with no encryption notice or BAA disclosure (HIGH)
2. Forms using non-HIPAA-compliant providers: Gravity Forms on non-HIPAA host, Wufoo, Typeform, Google Forms (HIGH)
3. Google Analytics/GA4 on pages with contact/intake forms (HIGH)
4. Meta/Facebook Pixel on any page (HIGH)
5. SSL/TLS not enforced (HIGH)
6. Third-party chat widgets: Intercom, Drift, Tidio, HubSpot chat (HIGH)
7. Non-HIPAA schedulers: Calendly, Acuity (non-HIPAA plan), Google Calendar embeds (HIGH)
8. HIPAA-compliant tools detected: SimplePractice, TherapyNotes, Jane App — mark as PASS
9. No privacy policy found (MEDIUM)
10. Privacy policy without HIPAA/PHI mention (MEDIUM)
11. Session recording tools: Hotjar, FullStory, Microsoft Clarity (HIGH)

Return your response as a JSON object with this exact structure:
{
  "findings": [
    {
      "severity": "high|medium|low|pass",
      "check": "short label",
      "description": "what was detected",
      "pageUrl": "url",
      "whyRisk": "explanation",
      "recommendedFix": "fix"
    }
  ]
}

Return ONLY the JSON object, no other text.

--- WEBSITE DATA ---
${pagesContent}`,
      },
    ],
  });

  try {
    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';
    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response');
    }
    const parsed = JSON.parse(jsonMatch[0]) as { findings: HipaaFinding[] };
    const findings = parsed.findings || [];

    // Calculate risk level
    const riskLevel = calculateRiskLevel(findings);

    return { riskLevel, findings };
  } catch (err) {
    console.error('Failed to parse HIPAA analysis response:', err);
    return {
      riskLevel: 'High',
      findings: [
        {
          severity: 'high',
          check: 'Analysis Error',
          description: 'Failed to parse HIPAA analysis results',
          pageUrl: '',
          whyRisk: 'The automated analysis encountered an error. Manual review is recommended.',
          recommendedFix: 'Re-run the analysis or perform a manual HIPAA audit.',
        },
      ],
    };
  }
}

function calculateRiskLevel(
  findings: HipaaFinding[]
): 'Low' | 'Moderate' | 'High' {
  const highCount = findings.filter((f) => f.severity === 'high').length;
  const mediumCount = findings.filter((f) => f.severity === 'medium').length;

  if (highCount >= 1) return 'High';
  if (mediumCount >= 2) return 'Moderate';
  return 'Low';
}
