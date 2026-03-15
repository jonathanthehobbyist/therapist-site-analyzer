import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=yourpassword npx tsx prisma/seed.ts');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { password: hash },
    create: { email, password: hash },
  });

  console.log(`Admin user seeded: ${email}`);
}

main().finally(() => prisma.$disconnect());
