#!/bin/bash
set -e

cd /home/ec2-user/app
git pull origin main

# Load env vars for Prisma
set -a
source .env.local
set +a

npm ci
npx prisma migrate deploy
npx prisma generate
npm run build
pm2 restart therapist-analyzer || pm2 start infra/ecosystem.config.js
pm2 save
echo "Deploy complete!"
