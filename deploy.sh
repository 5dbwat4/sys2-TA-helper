#!/bin/bash
set -e
echo "Starting deployment of teach-assist (web-v2)..."

# Install pm2 globally if not installed
if ! command -v pm2 &> /dev/null; then
  echo "Installing pm2..."
  npm install -g pm2
fi

# Ensure web-v2 directory exists
cd /root/teach-assist/web-v2

# Copy production .env from legacy web if not yet present in web-v2
if [ ! -f .env ] && [ -f /root/teach-assist/web/.env ]; then
  echo "Copying .env from web to web-v2..."
  cp /root/teach-assist/web/.env .env
fi

# Ensure required passkey and server envs are present in .env
if [ -f .env ]; then
  grep -q "PASSKEY_RP_ID" .env || echo 'PASSKEY_RP_ID="ta.alabtnt.cn"' >> .env
  grep -q "PASSKEY_ORIGIN" .env || echo 'PASSKEY_ORIGIN="https://ta.alabtnt.cn"' >> .env
  grep -q "PASSKEY_RP_NAME" .env || echo 'PASSKEY_RP_NAME="CS-II TA Console"' >> .env
fi

echo "Installing dependencies in web-v2..."
npm install --legacy-peer-deps --no-audit --no-fund || echo "npm install warning, continuing..."

echo "Pushing DB schema to MySQL..."
npx prisma db push --accept-data-loss || npx prisma db push

echo "Generating Prisma Client..."
npx prisma generate

echo "Building Next.js (web-v2)..."
npm run build

echo "Starting PM2 service on port 3001..."
pm2 stop ta-web || true
pm2 delete ta-web || true
PORT=3001 pm2 start npm --name "ta-web" -- start

echo "Deployment finished! Serving web-v2 on port 3001 (https://ta.alabtnt.cn)."
