# syntax=docker/dockerfile:1

# Build stage - install all dependencies and build
FROM node:22-bullseye AS builder

WORKDIR /app

# Copy package.json and temporarily remove workspace dependencies that can't be resolved
COPY package.json package.json.orig
RUN sed '/"@waku\/tests": "\*",/d' package.json.orig > package.json
RUN npm install --no-audit --no-fund

COPY src ./src
COPY types ./types
COPY tsconfig.json ./
COPY web ./web

RUN npm run build

# Production stage - only runtime dependencies
FROM node:22-bullseye

# Install required system deps for Playwright Chromium
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install only production dependencies
COPY package.json package.json.orig
RUN sed '/"@waku\/tests": "\*",/d' package.json.orig > package.json  
RUN npm install --only=production --no-audit --no-fund

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Install Playwright browsers (Chromium only) at runtime layer
RUN npx playwright install --with-deps chromium

ENV PORT=8080 \
    NODE_ENV=production

EXPOSE 8080

# Use a script to handle CLI arguments and environment variables
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "run", "start:server"]


