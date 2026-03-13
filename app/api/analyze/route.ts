import { prisma } from '@/lib/db';
import { runAnalysis } from '@/lib/analyzer';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { siteUrl, competitorUrl, keyword } = body;

  if (!siteUrl || typeof siteUrl !== 'string') {
    return NextResponse.json({ error: 'siteUrl is required' }, { status: 400 });
  }

  // Validate URL format
  try {
    new URL(siteUrl);
    if (competitorUrl) new URL(competitorUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  // Create the analysis record
  const analysis = await prisma.analysis.create({
    data: {
      siteUrl,
      competitorUrl: competitorUrl || null,
      keyword: keyword || null,
      status: 'pending',
    },
  });

  // Kick off analysis in the background (non-blocking)
  runAnalysis(analysis.id).catch((err) => {
    console.error('Background analysis error:', err);
  });

  return NextResponse.json({ id: analysis.id, status: 'pending' }, { status: 201 });
}
