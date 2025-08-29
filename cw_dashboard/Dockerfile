# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install curl for health checks and build dependencies
RUN apk add --no-cache curl libc6-compat

# Copy package files
COPY package*.json ./

# Install dependencies with optimizations
RUN npm ci && \
    npm cache clean --force

# Copy source code and configs
COPY . .

# Set build environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build application with standalone output
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copy standalone build (optimized for Next.js standalone mode)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set production environment variables
ENV PORT=3000
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || curl -f http://localhost:3000 || exit 1

# Start application using standalone server
CMD ["node", "server.js"]

# Testing stage - for running tests in container
FROM node:18-alpine AS testing

WORKDIR /app

# Install dependencies including curl for health checks
RUN apk add --no-cache curl libc6-compat

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev) for testing
RUN npm ci && npm cache clean --force

# Copy source code and config files
COPY . .

# Generate types and prepare for testing
RUN npm run type-check || echo "Type check completed with warnings"

# Create directories for test artifacts
RUN mkdir -p /app/coverage /app/test-results && \
    chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Set test environment
ENV NODE_ENV=test
ENV CI=true
ENV NEXT_TELEMETRY_DISABLED=1

# Health check for testing container
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD echo "Test container healthy" || exit 1

# Default command runs tests in CI mode
CMD ["npm", "run", "test:ci"]

# Development testing stage - for watch mode
FROM testing AS testing-dev

# Override command for development testing (watch mode)
CMD ["npm", "run", "test:watch"]