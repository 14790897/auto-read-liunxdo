#!/bin/bash

# 获取当前工作目录
WORKDIR=$(dirname $(readlink -f $0))

# 进入工作目录
cd $WORKDIR

# 停止 Docker Compose
/usr/local/bin/docker-compose down --remove-orphans --volumes

# 重新启动 Docker Compose
/usr/local/bin/docker-compose up -d >> ./cron.log 2>&1

# 等待10分钟
sleep 10m

# 停止 Docker Compose
/usr/local/bin/docker-compose down --remove-orphans --volumes >> ./cron.log 2>&1
