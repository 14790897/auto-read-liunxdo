# 🚀 自动阅读 Linux.do 代理配置指南

## 📖 概述

本项目支持多种代理协议，帮助您绕过网络限制，提高访问稳定性。

## 🛠️ 支持的代理类型

- **HTTP 代理**: 最常见的代理类型
- **HTTPS 代理**: 安全的HTTP代理
- **SOCKS4 代理**: 更底层的代理协议
- **SOCKS5 代理**: 功能最强大的代理协议(推荐)

## ⚙️ 配置方法

### 方法 1: 使用代理URL (推荐)

在 `.env` 或 `.env.local` 文件中设置：

```bash
# HTTP代理 (带认证)
PROXY_URL=http://username:password@proxy.example.com:8080

# SOCKS5代理 (带认证)  
PROXY_URL=socks5://username:password@proxy.example.com:1080

# 免费代理 (无认证)
PROXY_URL=http://free-proxy.example.com:8080
```

### 方法 2: 分别配置参数

```bash
PROXY_TYPE=socks5
PROXY_HOST=proxy.example.com
PROXY_PORT=1080
PROXY_USERNAME=your_username
PROXY_PASSWORD=your_password
```

## 🔍 代理测试

运行测试命令检查代理配置：

```bash
node test_proxy.js
```

测试工具会：
- ✅ 检查代理配置是否正确
- 🌐 测试代理连接性能
- 📍 显示当前IP地址
- 💡 提供故障排查建议

## 🌟 推荐的代理服务

### 免费代理
- [FreeProxyList](https://www.freeproxy.world/)
- [ProxyScrape](https://proxyscrape.com/free-proxy-list)
- [HideMy.name](https://hidemy.name/en/proxy-list/)

### 付费代理(稳定性更好)
- [Bright Data](https://brightdata.com/)
- [Smartproxy](https://smartproxy.com/)
- [Oxylabs](https://oxylabs.io/)
- [ProxyMesh](https://proxymesh.com/)

## 🚨 故障排查

### 常见错误及解决方案

#### 1. 超时错误 (Timeout)
```
ProtocolError: Network.enable timed out
```

**解决方案:**
- 检查代理服务器响应速度
- 尝试其他代理服务器
- 增加超时时间设置
- 检查网络连接稳定性

#### 2. 连接被拒绝 (Connection Refused)
```
Error: connect ECONNREFUSED
```

**解决方案:**
- 验证代理地址和端口
- 检查代理服务器状态
- 确认防火墙设置
- 检查IP是否被封禁

#### 3. 认证失败 (Authentication Failed)
```
Error: Proxy authentication required
```

**解决方案:**
- 检查用户名和密码
- 确认账户状态
- 验证IP白名单设置

#### 4. DNS解析失败
```
Error: getaddrinfo ENOTFOUND
```

**解决方案:**
- 检查代理域名是否正确
- 尝试使用IP地址替代域名
- 检查DNS服务器设置

## 🎯 最佳实践

### 1. 代理选择建议
- **速度优先**: 选择地理位置近的代理
- **稳定性优先**: 选择付费代理服务
- **隐私优先**: 选择SOCKS5代理

### 2. 配置优化
- 使用 `.env.local` 文件避免提交敏感信息
- 定期测试代理连接性
- 准备备用代理服务器

### 3. 安全注意事项
- 不要在公共场所使用免费代理
- 定期更换代理密码
- 避免通过代理传输敏感信息

## 📝 配置示例

### 完整的 .env.local 示例

```bash
# 基本配置
USERNAMES=your_username1,your_username2
PASSWORDS=your_password1,your_password2
WEBSITE=https://linux.do

# 代理配置 (选择其中一种方式)
# 方式1: 使用代理URL
PROXY_URL=socks5://username:password@proxy.example.com:1080

# 方式2: 分别配置
# PROXY_TYPE=socks5
# PROXY_HOST=proxy.example.com
# PROXY_PORT=1080
# PROXY_USERNAME=username
# PROXY_PASSWORD=password

# Telegram配置 (可选)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# 其他配置
RUN_TIME_LIMIT_MINUTES=30
AUTO_LIKE=true
```

## 🔧 高级配置

### 自定义超时设置

如果遇到频繁超时，可以在代码中调整：

```javascript
// 在 browserOptions 中设置
browserOptions.protocolTimeout = 300000; // 5分钟
browserOptions.timeout = 120000; // 2分钟
```

### 代理轮换

实现多代理轮换使用：

```bash
# 设置多个代理URL，用逗号分隔
PROXY_URLS=socks5://user1:pass1@proxy1.com:1080,http://user2:pass2@proxy2.com:8080
```

## 💬 技术支持

如果遇到问题，请：

1. 运行 `node test_proxy.js` 获取详细错误信息
2. 检查代理服务商的文档
3. 在项目 Issues 中报告问题
4. 提供完整的错误日志(隐藏敏感信息)

## 🎉 快速开始

1. 复制 `.env.example` 为 `.env.local`
2. 填入你的代理配置
3. 运行 `node test_proxy.js` 测试连接
4. 运行 `node bypasscf.js` 开始使用

祝你使用愉快! 🚀
