# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 5000

# Start the server
CMD ["node", "dist/index.js"]
