#!/bin/bash
set -e

echo "=== Therapist Analyzer EC2 Setup ==="

# Update system
sudo dnf update -y

# Install Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo dnf install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Install Git
sudo dnf install -y git

# Install Playwright system dependencies
npx playwright install-deps chromium
npx playwright install chromium

# Copy Nginx config
sudo cp /home/ec2-user/app/infra/nginx.conf /etc/nginx/conf.d/therapist-analyzer.conf
# Remove default config if it conflicts
sudo rm -f /etc/nginx/conf.d/default.conf
sudo nginx -t && sudo systemctl reload nginx

# Configure PM2 to start on boot
pm2 startup systemd -u ec2-user --hp /home/ec2-user
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ec2-user --hp /home/ec2-user

# Set up S3 backup cron (runs at 2am daily)
chmod +x /home/ec2-user/app/infra/backup.sh
(crontab -l 2>/dev/null; echo "0 2 * * * /home/ec2-user/app/infra/backup.sh") | crontab -

echo "=== Setup complete! ==="
echo "Next steps:"
echo "1. Clone your repo to /home/ec2-user/app"
echo "2. Copy .env.production to /home/ec2-user/app/.env.local"
echo "3. Run /home/ec2-user/app/infra/deploy.sh"
