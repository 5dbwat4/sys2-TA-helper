#!/bin/bash
set -e
echo "Starting deployment..."

# Install pm2 globally if not installed
if ! command -v pm2 &> /dev/null; then
  echo "Installing pm2..."
  npm install -g pm2
fi

cd /root/teach-assist/web

# Ensure legacy peer deps since npm sometimes fails on postinstalls with ENOSPC
echo "Installing dependencies..."
npm install --legacy-peer-deps --no-audit --no-fund || echo "npm install failed, continuing..."

echo "Pushing DB schema..."
npx prisma db push
echo "Generating Prisma Client..."
npx prisma generate
echo "Seeding Database..."
node prisma/seed.js || echo "Seed failed or already seeded"

echo "Building Next.js..."
npm run build

echo "Starting PM2 on port 3001..."
pm2 stop ta-web || true
pm2 delete ta-web || true
PORT=3001 pm2 start npm --name "ta-web" -- start

echo "Deployment finished! Serving on port 3001."
