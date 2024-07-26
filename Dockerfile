# 使用官方 Node.js 作为父镜像
FROM buildkite/puppeteer

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json 文件，可能利用缓存，避免重复构建
COPY package*.json ./

#时区为中国
ENV TZ=Asia/Shanghai

# 安装 Node.js 依赖
RUN npm install

# 将根目录复制到容器中
COPY . .

# 设置容器启动时运行的命令
CMD ["node", "/app/bypasscf.js"]
