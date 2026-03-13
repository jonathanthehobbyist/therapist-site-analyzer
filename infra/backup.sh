#!/bin/bash
DATE=$(date +%Y-%m-%d)
aws s3 cp /home/ec2-user/app/prisma/data/app.db \
  s3://YOUR-BUCKET-NAME/backups/app-$DATE.db
