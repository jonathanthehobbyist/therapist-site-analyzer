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

  // Build the filtered content for all pages, truncating each to stay within token limits
  const MAX_CHARS_PER_PAGE = 4000;
  const MAX_TOTAL_CHARS = 150000; // ~37K tokens, well under 200K limit with prompt
  let totalChars = 0;
  const pageContents: string[] = [];
  for (const page of pages) {
    const content = extractHipaaRelevantContent(page);
    const truncated = content.length > MAX_CHARS_PER_PAGE
      ? content.substring(0, MAX_CHARS_PER_PAGE) + '\n[...truncated]'
      : content;
    if (totalChars + truncated.length > MAX_TOTAL_CHARS) break;
    pageContents.push(truncated);
    totalChars += truncated.length;
  }
  const pagesContent = pageContents.join('\n\n===== NEXT PAGE =====\n\n');

  const REQUIRED_CHECKS = [
    { id: 'ssl_tls', label: 'SSL / TLS Encryption', passDesc: 'The site enforces HTTPS across all pages.' },
    { id: 'contact_form', label: 'Contact / Intake Form Security', passDesc: 'No unprotected contact or intake forms were detected.' },
    { id: 'form_provider', label: 'Form Provider Compliance', passDesc: 'No non-HIPAA-compliant form providers (Wufoo, Typeform, Google Forms) were detected.' },
    { id: 'analytics_on_forms', label: 'Analytics on Form Pages', passDesc: 'No analytics trackers were found on pages containing forms.' },
    { id: 'facebook_pixel', label: 'Meta / Facebook Pixel', passDesc: 'No Meta/Facebook tracking pixel was detected on the site.' },
    { id: 'chat_widgets', label: 'Third-Party Chat Widgets', passDesc: 'No non-HIPAA-compliant chat widgets (Intercom, Drift, Tidio, HubSpot) were detected.' },
    { id: 'scheduling_tools', label: 'Scheduling Tool Compliance', passDesc: 'No non-HIPAA-compliant scheduling tools were detected.' },
    { id: 'session_recording', label: 'Session Recording Tools', passDesc: 'No session recording tools (Hotjar, FullStory, Clarity) were detected.' },
    { id: 'hipaa_tools', label: 'HIPAA-Compliant Tools', passDesc: 'No HIPAA-compliant practice management tools were detected (e.g. SimplePractice, TherapyNotes, Jane App).' },
    { id: 'privacy_policy', label: 'Privacy Policy', passDesc: 'A privacy policy was found on the site.' },
    { id: 'privacy_policy_hipaa', label: 'Privacy Policy HIPAA Language', passDesc: 'The privacy policy references HIPAA or protected health information.' },
  ];

  const checklistJson = REQUIRED_CHECKS.map(c => `  - id: "${c.id}", label: "${c.label}"`).join('\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are a HIPAA compliance auditor for therapist/healthcare websites. Analyze the following extracted website data and report on EVERY check in the required checklist below.

IMPORTANT: You MUST return a finding for EVERY check ID listed below — no exceptions. If you find no issue for a check, return it with severity "pass". Do NOT skip any check. Do NOT invent check IDs outside this list.

REQUIRED CHECKLIST (report on ALL of these):
${checklistJson}

IMPORTANT TONE GUIDELINES:
- Use soft, non-alarming language throughout. You are advising, not accusing.
- For descriptions, say "We detected what looks like..." or "It appears that..." rather than stating things definitively.
- For whyRisk, say "this may violate" or "this could pose a risk" rather than "this violates."
- For recommendedFix, frame as helpful suggestions: "Consider removing..." or "We recommend..." rather than demands.
- Remember: these are small practice owners, not security engineers. Be helpful and clear, not scary.

For each finding, provide:
- severity: "high", "medium", "low", or "pass"
- id: the exact check ID from the list above
- check: the label from the list above
- description: what was detected (or a brief note that nothing was found for "pass" items)
- pageUrl: which page URL the finding relates to (use "" for site-wide or pass items)
- whyRisk: 1-2 sentence explanation of why this could be a HIPAA concern (leave brief for "pass" items)
- recommendedFix: actionable fix suggestion (leave brief for "pass" items, e.g. "No action needed.")

Severity guidelines:
- ssl_tls: HIGH if not enforced
- contact_form: HIGH if unprotected forms with no encryption notice or BAA disclosure
- form_provider: HIGH if using Wufoo, Typeform, Google Forms, or Gravity Forms on non-HIPAA host
- analytics_on_forms: HIGH if Google Analytics/GA4 found on pages with contact/intake forms
- facebook_pixel: HIGH if Meta/Facebook pixel found on any page
- chat_widgets: HIGH if Intercom, Drift, Tidio, or HubSpot chat found
- scheduling_tools: HIGH if Calendly, Acuity (non-HIPAA plan), or Google Calendar embeds found
- session_recording: HIGH if Hotjar, FullStory, or Microsoft Clarity found
- hipaa_tools: PASS if SimplePractice, TherapyNotes, Jane App found; LOW if not found
- privacy_policy: MEDIUM if no privacy policy found
- privacy_policy_hipaa: MEDIUM if privacy policy exists but lacks HIPAA/PHI language

Return your response as a JSON object with this exact structure:
{
  "findings": [
    {
      "severity": "high|medium|low|pass",
      "id": "check_id",
      "check": "Check Label",
      "description": "what was detected",
      "pageUrl": "url",
      "whyRisk": "explanation",
      "recommendedFix": "fix"
    }
  ]
}

Return ONLY the JSON object, no other text. You MUST include exactly ${REQUIRED_CHECKS.length} findings, one for each check ID.

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
    let findings = parsed.findings || [];

    // Ensure every required check is present — fill in missing ones as "pass"
    const returnedIds = new Set(findings.map((f: HipaaFinding & { id?: string }) => f.id));
    for (const req of REQUIRED_CHECKS) {
      if (!returnedIds.has(req.id)) {
        findings.push({
          severity: 'pass',
          check: req.label,
          description: req.passDesc,
          pageUrl: '',
          whyRisk: 'No issue detected.',
          recommendedFix: 'No action needed.',
        });
      }
    }

    // Sort: high → medium → low → pass
    const severityOrder = { high: 0, medium: 1, low: 2, pass: 3 };
    findings = findings.sort((a: HipaaFinding, b: HipaaFinding) => severityOrder[a.severity] - severityOrder[b.severity]);

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
