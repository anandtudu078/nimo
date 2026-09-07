# syntax=docker/dockerfile:1

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# VITE_API_URL is baked in at build time (Vite inlines env vars into the bundle).
# Set it to the public API origin in production, e.g.:
#   docker build --build-arg VITE_API_URL=https://api.example.com .
# Leave empty for same-origin setups (nginx proxies /api and /socket.io/).
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

# Copy lockfile + manifest for reproducible installs
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code (excluding node_modules, dist via .dockerignore)
COPY . .

# Build the app
RUN npm run build

# Production stage - serve with nginx
FROM nginx:alpine AS production

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]
