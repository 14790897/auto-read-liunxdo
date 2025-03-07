FROM node:22-slim

WORKDIR /app

COPY package*.json ./

RUN apt update && apt install -y \
    cron \
    wget \
    gnupg2 \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    xvfb \
    findutils && \
    rm -rf /var/lib/apt/lists/*

RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-linux-signing-key.gpg && \
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-linux-signing-key.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list && \
    apt update && apt install -y google-chrome-stable && \
    rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

ENV TZ=Asia/Shanghai

RUN npm install

COPY . .

RUN chmod -R 777 /app

# 创建清理脚本
RUN echo '#!/bin/bash\nfind /tmp -type f -atime +1 -delete' > /usr/local/bin/clean_tmp.sh && \
    chmod +x /usr/local/bin/clean_tmp.sh

# 设置 cron 任务 (每天凌晨 3:00 执行)
RUN (crontab -l ; echo "0 3 * * * /usr/local/bin/clean_tmp.sh") | crontab -

# 启动 cron 并运行主程序 (使用 CMD 作为入口点)
CMD ["sh", "-c", "service cron start && node /app/bypasscf.js"]