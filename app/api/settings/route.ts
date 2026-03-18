import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const DEFAULTS: Record<string, string> = {
  seo_title: 'What is SEO?',
  hipaa_title: 'What is HIPAA Compliance?',
  keywords_title: 'Why Keywords Matter',
  seo_description:
    'Search Engine Optimization (SEO) is how potential clients find your practice online. When someone searches for a therapist in your area, strong SEO ensures your website appears near the top of results. This score measures technical factors like page titles, meta descriptions, heading structure, image optimization, and site speed — all signals that Google uses to rank your site. A higher score means better visibility and more clients finding you organically.',
  hipaa_description:
    'HIPAA compliance protects your clients\' sensitive health information. This audit checks your website for common privacy risks — like insecure contact forms, third-party trackers, and missing privacy policies. Even unintentional violations can result in significant fines and loss of client trust.',
  keywords_description:
    'Keywords are the words and phrases potential clients type into Google when looking for a therapist. This section shows the keywords your site currently emphasizes and the terms you\'re ranking for in search results. Understanding your keyword profile helps you attract the right clients.',
  opportunities_striking_title: 'Low-Hanging Fruit',
  opportunities_striking_subtitle: 'Keywords ranking positions 3–10 — close to the top of page 1. Small improvements here can drive significant traffic gains.',
  opportunities_toppages_title: 'Top Pages by Traffic',
  opportunities_toppages_subtitle: 'Your highest-traffic pages and the keywords driving visitors to them.',
  hipaa_findings_title: 'Findings',
  seo_score_label: 'SEO Hygiene',
  seo_score_subtext: 'How well your site follows on-page SEO best practices',
  seo_onpage_title: 'On-Page',
  seo_technical_title: 'Technical',
  seo_local_title: 'Local SEO',
  pagespeed_title: 'Why Page Speed Matters',
  pagespeed_description:
    'Page speed directly impacts both your search rankings and patient experience. Google uses Core Web Vitals — loading time, visual stability, and interactivity — as ranking factors. Sites that load in under 3 seconds see significantly lower bounce rates. For therapy practices, a slow site can mean a potential client leaves before ever reading about your services.',
  pagespeed_desktop_title: 'Desktop Performance',
  pagespeed_desktop_subtitle: 'How fast your site loads on a desktop computer with a broadband connection.',
  pagespeed_mobile_title: 'Mobile Performance',
  pagespeed_mobile_subtitle: 'How fast your site loads on a phone with a typical 4G connection. Most of your potential clients will visit on mobile.',
  pagespeed_desktop_score_title: 'Desktop Score',
  pagespeed_desktop_score_subtitle: 'Google Lighthouse performance score for desktop.',
  pagespeed_mobile_score_title: 'Mobile Score',
  pagespeed_mobile_score_subtitle: 'Google Lighthouse performance score for mobile.',
  pagespeed_filmstrip_title: 'Loading Timeline',
  pagespeed_filmstrip_subtitle: 'How your site loads over time on mobile — each frame shows what a visitor sees.',
  // Custom templates (pre-fill when switching to Custom mode)
  template_seo_title: '',
  template_seo_description: '',
  template_pagespeed_title: '',
  template_pagespeed_description: '',
  template_hipaa_title: '',
  template_hipaa_description: '',
  template_keywords_title: '',
  template_keywords_description: '',
  // Score thresholds
  threshold_score_good: '90',
  threshold_score_warn: '50',
  threshold_seo_warn: '60',
  threshold_dropoff_good: '5',
  threshold_dropoff_warn: '20',
  threshold_kw_difficulty_hard: '70',
  threshold_kw_difficulty_medium: '40',
  threshold_lcp_good: '2500',
  threshold_lcp_warn: '4000',
  threshold_cls_good: '0.1',
  threshold_cls_warn: '0.25',
  threshold_fcp_good: '1800',
  threshold_fcp_warn: '3000',
  threshold_tbt_good: '200',
  threshold_tbt_warn: '600',
  threshold_si_good: '3400',
  threshold_si_warn: '5800',
  threshold_fid_good: '200',
  threshold_fid_warn: '500',
  theme_text_primary: '#2A2A2A',
  theme_text_secondary: '#6B7280',
  theme_btn_primary_bg: '#4A4A4A',
  theme_btn_primary_text: '#FFFFFF',
  theme_btn_secondary_bg: '#F3F4F6',
  theme_btn_secondary_text: '#4A4A4A',
};

export async function GET() {
  const settings = await prisma.setting.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) {
    map[s.key] = s.value;
  }
  // Fill in defaults for any missing keys
  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (!map[key]) map[key] = value;
  }
  return NextResponse.json(map);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const updates: { key: string; value: string }[] = [];

  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string' && (key in DEFAULTS || key.startsWith('finding_') || key.startsWith('seo_') || key.startsWith('metric_') || key.startsWith('hipaa_') || key.startsWith('threshold_') || key.startsWith('template_') || key.startsWith('opportunities_'))) {
      updates.push({ key, value });
    }
  }

  for (const { key, value } of updates) {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  return NextResponse.json({ ok: true });
}
