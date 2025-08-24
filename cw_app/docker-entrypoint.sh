#!/bin/sh

# Docker entrypoint script to handle Prisma binary issues
echo "🚀 Starting HubSpot Bridge Application..."

# Regenerate Prisma client with correct binary targets
echo "📦 Regenerating Prisma Client for Alpine Linux..."
npx prisma generate

# Check if Prisma client generation was successful
if [ $? -eq 0 ]; then
    echo "✅ Prisma Client generated successfully"
else
    echo "❌ Failed to generate Prisma Client"
    exit 1
fi

# Start the application
echo "🚀 Starting Node.js application..."
exec "$@"