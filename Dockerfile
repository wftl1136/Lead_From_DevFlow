FROM node:20-slim

# Установка Chromium и системных зависимостей
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-freefont-ttf \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libnss3 \
    libpango-1.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# Копируем зависимости
COPY package*.json tsconfig.json ./

# Устанавливаем все зависимости, включая компилятор
RUN npm install --include=dev

# Копируем исходный код
COPY . .

# Компилируем TypeScript
RUN npm run build

# Создаем папку для базы
RUN mkdir -p data

# Запуск
CMD ["node", "dist/src/index.js"]
