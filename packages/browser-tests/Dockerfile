FROM node:18-slim

# Install dependencies for Playwright and Chrome
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
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
    libfontconfig1 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package.json files
COPY package.json ./
COPY tsconfig.json ./
COPY headless/package.json ./headless/
COPY types/ ./types/

# Install dependencies
RUN npm install
RUN cd headless && npm install

# Make sure serve is installed globally to avoid import issues
RUN npm install -g serve

# Copy project files
COPY . .

# Build headless package
RUN cd headless && npm run build

# Install Playwright browsers
RUN npx playwright install chromium

# Build TypeScript server
RUN npm run build:server

# Expose port for the API server
EXPOSE 3000

# Start the API server
CMD ["npm", "run", "start:server"]
