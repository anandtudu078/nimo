# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json ./

# Install all dependencies (use npm install instead of npm ci to avoid Windows lock file issues)
RUN npm install

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
