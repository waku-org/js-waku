# syntax=docker/dockerfile:1

FROM node:20-bullseye

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

COPY package.json package-lock.json* .npmrc* ./
RUN npm install --no-audit --no-fund

# Copy sources
COPY . .

# Build server (tsc)
RUN npm run build

# Install Playwright browsers (Chromium only) at runtime layer
RUN npx playwright install --with-deps chromium

ENV PORT=8080 \
    NODE_ENV=production \
    CHROMIUM_NO_SANDBOX=1

EXPOSE 8080

CMD ["npm", "run", "start:server"]


