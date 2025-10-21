# syntax=docker/dockerfile:1

# === Stage 1: Base image with Bun ===
FROM oven/bun:1.3-slim AS base
WORKDIR /app

# === Stage 2: Dependencies ===
FROM base AS deps
# Copy package files
COPY package.json bun.lock ./
# Install dependencies with frozen lockfile
RUN bun install --frozen-lockfile --ignore-scripts

# === Stage 3: Development dependencies (for build tools) ===
FROM base AS dev-deps
# Copy package files
COPY package.json bun.lock ./
# Install all dependencies including dev dependencies
RUN bun install --frozen-lockfile --ignore-scripts

# === Stage 4: Prisma Client Generation ===
FROM dev-deps AS prisma
# Copy Prisma schema
COPY prisma ./prisma
# Generate Prisma client
RUN bunx prisma generate

# === Stage 5: TypeScript Build ===
FROM prisma AS build
# Copy TypeScript configuration
COPY tsconfig.json ./
# Copy source code
COPY src ./src
# Build the application
RUN bun run build

# === Stage 6: Production Image ===
FROM base AS runner

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
	adduser --system --uid 1001 bunuser

# Copy package files and install production dependencies only
COPY package.json bun.lock ./
RUN bun install --production --ignore-scripts && \
	bun pm cache rm

# Copy built application and generated Prisma client
COPY --from=build --chown=bunuser:nodejs /app/dist ./dist
COPY --from=prisma --chown=bunuser:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Switch to non-root user
USER bunuser

# Expose port
EXPOSE 3000

# Health check (using wget which is more commonly available in slim images)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
	CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application
CMD ["bun", "dist/index.js"]
