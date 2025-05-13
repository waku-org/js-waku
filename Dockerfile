FROM node:20-slim

# Install Chrome dependencies
RUN apt-get update && apt-get install -y \
    procps \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/browser-tests/package.json ./packages/browser-tests/
COPY packages/headless-tests/package.json ./packages/headless-tests/

# Install dependencies and serve
RUN npm install && npm install -g serve

# Copy source files
COPY tsconfig.json ./
COPY packages/ ./packages/

# Build packages
RUN npm run build -w packages/headless-tests && \
    npm run build:server -w packages/browser-tests && \
    npx playwright install chromium

EXPOSE 3000

CMD ["npm", "run", "start:server", "-w", "packages/browser-tests"]
