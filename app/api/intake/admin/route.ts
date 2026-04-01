import { prisma } from '@/lib/db';
import { runAnalysis } from '@/lib/analyzer';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const submissions = await prisma.intakeSubmission.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(submissions);
}

export async function PATCH(req: NextRequest) {
  const { id, action } = await req.json();

  if (!id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (action === 'reject') {
    await prisma.intakeSubmission.update({
      where: { id },
      data: { status: 'rejected' },
    });
    return NextResponse.json({ ok: true });
  }

  // Approve — kick off an analysis
  const submission = await prisma.intakeSubmission.findUnique({ where: { id } });
  if (!submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  const analysis = await prisma.analysis.create({
    data: {
      siteUrl: submission.siteUrl,
      status: 'pending',
    },
  });

  await prisma.intakeSubmission.update({
    where: { id },
    data: { status: 'approved', analysisId: analysis.id },
  });

  runAnalysis(analysis.id).catch((err) => {
    console.error('Background analysis error:', err);
  });

  return NextResponse.json({ ok: true, analysisId: analysis.id });
}
