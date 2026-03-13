#!/bin/bash
set -e

cd /home/ec2-user/app
git pull origin main
npm ci
npx prisma migrate deploy
npm run build
pm2 restart therapist-analyzer || pm2 start infra/ecosystem.config.js
pm2 save
echo "Deploy complete!"
