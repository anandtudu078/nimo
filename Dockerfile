# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy server package files first for better layer caching
COPY server/package.json server/package-lock.json ./server/

# Install all dependencies (including dev for build)
WORKDIR /app/server
RUN npm ci

# Copy source code
COPY server/tsconfig.json ./
COPY server/src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY server/package.json server/package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built files from builder stage
COPY --from=builder /app/server/dist ./dist

# Note: Railway sets PORT dynamically via env var, do NOT hardcode it
EXPOSE 5000

# Start the server
CMD ["node", "dist/index.js"]
