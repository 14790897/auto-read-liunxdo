#!/usr/bin/env node
/**
 * 代理测试工具
 * 用于测试代理服务器的连通性和配置正确性
 */

import dotenv from "dotenv";
import {
  getProxyConfig,
  testProxyConnection,
  getCurrentIP,
  parseProxyUrl,
} from "./src/proxy_config.js";

// 加载环境变量
dotenv.config();

async function main() {
  console.log("🔍 代理配置测试工具");
  console.log("==================");

  // 获取当前IP
  console.log("\n📍 当前网络状态:");
  const currentIP = await getCurrentIP();
  if (currentIP) {
    console.log(`✅ 当前IP地址: ${currentIP}`);
  } else {
    console.log("❌ 无法获取当前IP地址");
  }

  // 检查代理配置
  console.log("\n🔧 代理配置检查:");
  const proxyConfig = getProxyConfig();

  if (!proxyConfig) {
    console.log("❌ 未配置代理服务器");
    console.log("\n💡 配置方法:");
    console.log("1. 设置环境变量 PROXY_URL，例如:");
    console.log("   PROXY_URL=http://username:password@proxy.example.com:8080");
    console.log(
      "   PROXY_URL=socks5://username:password@proxy.example.com:1080"
    );
    console.log("\n2. 或者分别设置:");
    console.log("   PROXY_TYPE=http");
    console.log("   PROXY_HOST=proxy.example.com");
    console.log("   PROXY_PORT=8080");
    console.log("   PROXY_USERNAME=your_username");
    console.log("   PROXY_PASSWORD=your_password");
    return;
  }

  console.log(`✅ 代理类型: ${proxyConfig.type}`);
  console.log(`✅ 代理地址: ${proxyConfig.host}:${proxyConfig.port}`);
  if (proxyConfig.username) {
    console.log(`✅ 认证用户: ${proxyConfig.username}`);
    console.log(
      `✅ 密码设置: ${"*".repeat(proxyConfig.password?.length || 0)}`
    );
  } else {
    console.log("ℹ️  无需认证");
  }

  // 测试代理连接
  console.log("\n🚀 代理连接测试:");
  console.log("正在测试代理连接...");

  const startTime = Date.now();
  const isWorking = await testProxyConnection(proxyConfig);
  const endTime = Date.now();

  if (isWorking) {
    console.log(`✅ 代理连接成功! (耗时: ${endTime - startTime}ms)`);
    console.log("🎉 代理服务器工作正常，可以使用");
  } else {
    console.log(`❌ 代理连接失败! (耗时: ${endTime - startTime}ms)`);
    console.log("\n🔧 故障排查建议:");
    console.log("1. 检查代理服务器地址和端口是否正确");
    console.log("2. 检查用户名和密码是否正确");
    console.log("3. 检查代理服务器是否在线");
    console.log("4. 检查网络防火墙设置");
    console.log("5. 尝试其他代理服务器");
  }

  // 环境变量检查
  console.log("\n📋 环境变量检查:");
  const envVars = [
    "PROXY_URL",
    "PROXY_TYPE",
    "PROXY_HOST",
    "PROXY_PORT",
    "PROXY_USERNAME",
    "PROXY_PASSWORD",
  ];

  envVars.forEach((varName) => {
    const value = process.env[varName];
    if (value) {
      if (varName.includes("PASSWORD")) {
        console.log(`✅ ${varName}: ${"*".repeat(value.length)}`);
      } else {
        console.log(`✅ ${varName}: ${value}`);
      }
    } else {
      console.log(`❌ ${varName}: 未设置`);
    }
  });
}

// 如果是直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default main;
