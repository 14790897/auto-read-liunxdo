#!/bin/bash
#设置为中文
export LANG=zh_CN.UTF-8
export LC_ALL=zh_CN.UTF-8
# 获取当前工作目录
WORKDIR=$(dirname $(readlink -f $0))

# 进入工作目录
cd $WORKDIR

# 停止 Docker Compose
/usr/local/bin/docker-compose down --remove-orphans --volumes

# 重新启动 Docker Compose
/usr/local/bin/docker-compose up -d >> ./cron.log 2>&1

# 等待20分钟
sleep 20m
/usr/local/bin/docker-compose logs >> ./cron.log 2>&1

# 停止 Docker Compose
/usr/local/bin/docker-compose down --remove-orphans --volumes >> ./cron.log 2>&1
