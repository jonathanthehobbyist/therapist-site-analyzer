import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const analysis = await prisma.analysis.findUnique({
    where: { id },
    include: { site: true },
  });

  if (!analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
  }

  // Parse JSON string fields back into objects for the client
  return NextResponse.json({
    ...analysis,
    seoComparisonData: analysis.seoComparisonData
      ? JSON.parse(analysis.seoComparisonData)
      : null,
    seoHygieneData: analysis.seoHygieneData
      ? JSON.parse(analysis.seoHygieneData)
      : null,
    hipaaData: analysis.hipaaData ? JSON.parse(analysis.hipaaData) : null,
    pagesScraped: analysis.pagesScraped
      ? JSON.parse(analysis.pagesScraped)
      : null,
    keywordData: analysis.keywordData
      ? JSON.parse(analysis.keywordData)
      : null,
    pageSpeedData: analysis.pageSpeedData
      ? JSON.parse(analysis.pageSpeedData)
      : null,
    localSearchData: analysis.localSearchData
      ? JSON.parse(analysis.localSearchData)
      : null,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const data: Record<string, string | null> = {};
  if ('loomUrl' in body) {
    const url = typeof body.loomUrl === 'string' ? body.loomUrl.trim() : '';
    data.loomUrl = url || null;
  }
  if ('seoSummary' in body) {
    data.seoSummary = typeof body.seoSummary === 'string' ? body.seoSummary : null;
  }
  if ('overviewTitle' in body) {
    data.overviewTitle = typeof body.overviewTitle === 'string' ? body.overviewTitle : null;
  }
  if ('overviewSubtitle' in body) {
    data.overviewSubtitle = typeof body.overviewSubtitle === 'string' ? body.overviewSubtitle : null;
  }
  const customFields = [
    'customSeoTitle', 'customSeoDesc',
    'customPagespeedTitle', 'customPagespeedDesc',
    'customHipaaTitle', 'customHipaaDesc',
    'customKeywordsTitle', 'customKeywordsDesc',
    'customLocalSearchTitle', 'customLocalSearchDesc',
  ];
  for (const field of customFields) {
    if (field in body) {
      data[field] = typeof body[field] === 'string' ? body[field] : null;
    }
  }
  if ('localSearchData' in body) {
    data.localSearchData = typeof body.localSearchData === 'string'
      ? body.localSearchData
      : JSON.stringify(body.localSearchData);
  }

  try {
    const analysis = await prisma.analysis.update({
      where: { id },
      data,
    });
    return NextResponse.json({ id: analysis.id, loomUrl: analysis.loomUrl });
  } catch (err) {
    console.error('Analysis PATCH error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
