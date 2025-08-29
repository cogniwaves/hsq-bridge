# Multi-stage build for production optimization
FROM node:18-slim AS base

WORKDIR /app

# Install OpenSSL, curl and other dependencies
RUN apt-get update && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1001 nodejs && useradd -r -u 1001 -g nodejs nodejs

# Dependencies stage
FROM base AS deps

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install ALL dependencies (including dev) for building
RUN npm ci && npm cache clean --force

# Build stage
FROM deps AS builder

# Copy source code and prisma
COPY src ./src
COPY prisma ./prisma

# Build application
RUN npm run build

# Generate Prisma client with correct binary target
RUN npx prisma generate

# Production stage
FROM base AS production

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

# Copy production node_modules
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Create logs directory and change ownership to nodejs user
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start application in production mode
CMD ["node", "dist/index.js"]

# Development stage
FROM deps AS development

# Copy source code and prisma
COPY --chown=nodejs:nodejs src ./src
COPY --chown=nodejs:nodejs prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

# Create logs directory and change ownership to nodejs user
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Start application with ts-node for development
CMD ["npx", "ts-node-dev", "--respawn", "--transpile-only", "src/index.ts"]

# Testing stage
FROM deps AS testing

# Copy source code, tests, and prisma
COPY --chown=nodejs:nodejs src ./src
COPY --chown=nodejs:nodejs tests ./tests
COPY --chown=nodejs:nodejs prisma ./prisma

# Install additional testing dependencies (if any)
RUN npm install --save-dev jest-junit @types/supertest

# Generate Prisma client
RUN npx prisma generate

# Create directories for test artifacts
RUN mkdir -p /app/logs /app/coverage /app/test-results && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Set test environment
ENV NODE_ENV=test
ENV CI=true

# Health check for testing
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "console.log('Test container healthy')" || exit 1

# Default command runs tests in CI mode
CMD ["npm", "run", "test:ci"]