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