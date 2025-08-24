#!/bin/bash

# Database setup script for HubSpot-Stripe-QuickBooks Bridge
set -e

echo "🚀 Setting up database for hs_bridge..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the correct directory
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}❌ Error: Please run this script from the project root directory${NC}"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

# Start database services
echo -e "${YELLOW}📦 Starting database services...${NC}"
docker-compose up -d cw_postgres cw_redis

# Wait for PostgreSQL to be ready
echo -e "${YELLOW}⏳ Waiting for PostgreSQL to be ready...${NC}"
timeout=30
counter=0
while ! docker-compose exec -T cw_postgres pg_isready -U hs_bridge_user -d hs_bridge > /dev/null 2>&1; do
    sleep 1
    counter=$((counter + 1))
    if [ $counter -gt $timeout ]; then
        echo -e "${RED}❌ Error: PostgreSQL failed to start within ${timeout} seconds${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✅ PostgreSQL is ready!${NC}"

# Wait for Redis to be ready
echo -e "${YELLOW}⏳ Waiting for Redis to be ready...${NC}"
timeout=10
counter=0
while ! docker-compose exec -T cw_redis redis-cli ping > /dev/null 2>&1; do
    sleep 1
    counter=$((counter + 1))
    if [ $counter -gt $timeout ]; then
        echo -e "${RED}❌ Error: Redis failed to start within ${timeout} seconds${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✅ Redis is ready!${NC}"

# Install dependencies and generate Prisma client
echo -e "${YELLOW}📦 Installing dependencies in cw_app container...${NC}"
docker-compose exec cw_app npm install

# Generate Prisma client
echo -e "${YELLOW}🔧 Generating Prisma client...${NC}"
docker-compose exec cw_app npm run db:generate

# Push database schema
echo -e "${YELLOW}📊 Pushing database schema...${NC}"
docker-compose exec cw_app npm run db:push

# Seed database with sample data
echo -e "${YELLOW}🌱 Seeding database with sample data...${NC}"
docker-compose exec cw_app npm run db:seed

echo -e "${GREEN}✅ Database setup complete!${NC}"
echo ""
echo "🎉 Your database is ready! You can now:"
echo "   • Start the full application: docker-compose up -d"
echo "   • View database: docker-compose exec cw_app npm run db:studio"
echo "   • Check logs: docker-compose logs cw_app"
echo "   • Access API: http://localhost:3000/api"
echo "   • Access Dashboard: http://localhost:3001"