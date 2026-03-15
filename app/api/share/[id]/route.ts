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

  if (!analysis || !analysis.isPublic) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // If passcode is set, check for verification cookie
  if (analysis.sharePasscode) {
    const cookie = req.cookies.get(`share-${id}`)?.value;
    if (cookie !== 'verified') {
      return NextResponse.json({ requiresPasscode: true }, { status: 403 });
    }
  }

  return NextResponse.json({
    ...analysis,
    sharePasscode: undefined, // never expose passcode to client
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
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = { isPublic: Boolean(body.isPublic) };
  if ('sharePasscode' in body) {
    data.sharePasscode = body.sharePasscode || null;
  }

  const analysis = await prisma.analysis.update({
    where: { id },
    data,
  });

  return NextResponse.json({ id: analysis.id, isPublic: analysis.isPublic });
}
