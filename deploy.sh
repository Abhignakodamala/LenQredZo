#!/bin/bash
set -e

echo "=========================================================="
echo "🚀 Deploying LenQredzo to DigitalOcean (Bangalore BLR1)"
echo "=========================================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker Engine..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
fi

# Build and start services
echo "📦 Building and starting LenQredzo microservices..."
docker compose down || true
docker compose build
docker compose up -d

# Wait for database and sync Prisma schema
echo "⏳ Syncing database schema with PostgreSQL..."
sleep 5
docker compose exec -T api npx prisma db push

IP_ADDRESS=$(curl -s ifconfig.me || echo "your-droplet-ip")

echo "=========================================================="
echo "✅ DEPLOYMENT COMPLETE!"
echo "LenQredzo is now live at: http://${IP_ADDRESS}"
echo "=========================================================="
