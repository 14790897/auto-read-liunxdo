# 使用官方 Node.js 作为父镜像
FROM node:18-slim

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json (如果存在)
COPY package*.json ./

# 安装 Puppeteer 依赖
RUN apt-get update && apt-get install -y \
    cron\
    wget \
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
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 安装 Node.js 依赖
RUN npm install

# 将你的 Puppeteer 脚本复制到容器中
COPY . .

# 创建一个新的 crontab 文件
RUN echo "0 3 * * * node /app/pteer.js" > /etc/cron.d/puppeteer-cron

# 给 crontab 文件适当的权限
RUN chmod 0644 /etc/cron.d/puppeteer-cron

# 将 cron 设置为在前台运行
CMD ["cron", "-f"]
