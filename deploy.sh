#!/usr/bin/env bash
set -e

echo "==========================================================="
echo "   🚀 FINSMART / LENQREDZO PRODUCTION CLOUD DEPLOYMENT     "
echo "==========================================================="

# Check Docker installation
if ! command -v docker &> /dev/null; then
    echo "📦 Docker not found. Installing official Docker Engine..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# Ensure docker compose plugin exists
if ! docker compose version &> /dev/null; then
    echo "📦 Installing Docker Compose plugin..."
    apt-get update && apt-get install -y docker-compose-plugin
fi

echo "📁 Ensuring directory structure for KYC uploads..."
mkdir -p apps/api/uploads/kyc

echo "🏗️ Building and starting production containers..."
docker compose down || true
docker compose up -d --build

echo "⏳ Waiting for PostgreSQL and API to initialize..."
sleep 10

echo "📊 Checking container status..."
docker compose ps

echo "==========================================================="
echo "   ✅ DEPLOYMENT SUCCESSFUL! APP IS LIVE ON PORT 80        "
echo "==========================================================="
