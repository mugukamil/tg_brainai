# syntax=docker/dockerfile:1

# === Stage 1: Dependencies ===
FROM node:22-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# === Stage 2: Prisma Generate ===
FROM deps AS prisma
# Copy Prisma schema
COPY prisma ./prisma
# Install Prisma CLI and generate client
RUN npx prisma generate

# === Stage 3: Build ===
FROM deps AS build
# Copy generated Prisma Client and node_modules from prisma stage
COPY --from=prisma /app/node_modules ./node_modules
COPY tsconfig.json ./
COPY src ./src
# Now build — types are available
RUN npm run build

# === Stage 4: Production Runner ===
FROM node:22-slim AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
RUN npm prune --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]