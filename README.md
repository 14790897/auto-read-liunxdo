## 使用方法一：油猴脚本

油猴脚本代码在 index_passage_list 中
油猴：https://greasyfork.org/en/scripts/489464-auto-read

## 使用方法二：puppeteer 无头运行

### 1.设置环境变量

.env 里面设置用户名 密码

### 2.运行

#### Windows

```sh
npm install
node .\pteer.js
```

#### Linux 额外安装以下包，运行命令相同

```sh
sudo apt-get update
sudo apt install nodejs npm  -y
sudo apt-get install -y wget unzip fontconfig locales gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget

```

## 使用方法三：GitHub Action 每天 0 点阅读

(可自行修改启动时间和持续时间，代码.github\workflows\cron_read.yaml)

### 1. fork 仓库

### 2.设置环境变量

在 GitHub action 的 secrets 设置用户名密码（变量名参考.env 中给出的）（.env 里面设置用户名密码在这里无效）

### 3.启动 workflow

教程：https://github.com/ChatGPTNextWeb/ChatGPT-Next-Web?tab=readme-ov-file#enable-automatic-updates

## 使用方法四：docker 定时运行

### 1.立刻执行

克隆仓库，在`docker-compose.yml`里面设置环境变量，然后运行

```sh
 docker-compose up -d
```

查看日志

```sh
docker-compose logs -f
```

### 2.定时运行(目前存在问题)

```sh
docker-compose -f cron-docker-compose.yml up -d

```
