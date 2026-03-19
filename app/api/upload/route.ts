import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const analysisId = formData.get('analysisId') as string | null;

  if (!file || !analysisId) {
    return NextResponse.json({ error: 'Missing file or analysisId' }, { status: 400 });
  }

  // Validate file type
  const allowed = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Only PNG, JPG, and WebP files are allowed' }, { status: 400 });
  }

  // Validate file size (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File must be under 5MB' }, { status: 400 });
  }

  const ext = file.name.split('.').pop() || 'png';
  const filename = `${Date.now()}.${ext}`;
  const dir = path.join(process.cwd(), 'public', 'uploads', analysisId);
  await mkdir(dir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = path.join(dir, filename);
  await writeFile(filePath, buffer);

  const url = `/api/uploads?path=${encodeURIComponent(`${analysisId}/${filename}`)}`;
  return NextResponse.json({ url });
}
