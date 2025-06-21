/*
  Auto Read App (Playwright 版本)
  ---------------------------------
  将原 Puppeteer + puppeteer-extra + puppeteer-real-browser 的脚本整体迁移到 Playwright。
  主要差异：
  1. 使用 playwright‑extra + stealth 插件来隐藏自动化特征。
  2. Puppeteer 的 page.evaluateOnNewDocument → Playwright 的 page.addInitScript。
  3. Puppeteer 的 type/click 改为 Playwright 的 fill/click/locator 组合。
  4. Browser 实例 → Context → Page 三层模型。
  5. 其余业务逻辑、并发调度、Telegram、Express 健康探针保持不变。

  依赖安装：
  ----------------
  npm i playwright-extra playwright-extra-plugin-stealth playwright @playwright/test node-telegram-bot-api dotenv express
  # 若需要下载浏览器：
  npx playwright install chromium

  运行：
  node auto-read-playwright.mjs
*/

import fs from "fs";
import path, { dirname, join } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";
import express from "express";

// --- Playwright & Stealth ----------------------------------------------
import { chromium } from "playwright-extra";
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
const stealth = StealthPlugin();
chromium.use(stealth);

// 代理配置
import { 
  getProxyConfig, 
  getPlaywrightProxyConfig, 
  testProxyConnection, 
  getCurrentIP 
} from "./src/proxy_config.js";
// -----------------------------------------------------------------------
// 环境变量加载
// -----------------------------------------------------------------------
if (fs.existsSync(".env.local")) {
  console.log("Using .env.local file to supply config environment variables");
  const envConfig = dotenv.parse(fs.readFileSync(".env.local"));
  for (const k in envConfig) process.env[k] = envConfig[k];
} else {
  dotenv.config();
  console.log("Using .env file to supply config environment variables…");
}

// 运行时间限制
const runTimeLimitMinutes = Number(process.env.RUN_TIME_LIMIT_MINUTES || 20);
const runTimeLimitMillis = runTimeLimitMinutes * 60 * 1000;
console.log(`运行时间限制：${runTimeLimitMinutes} 分钟 (${runTimeLimitMillis} ms)`);
setTimeout(() => {
  console.log("Reached time limit, shutting down…");
  process.exit(0);
}, runTimeLimitMillis);

// Telegram --------------------------------------------------------------
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
let bot = null;
if (token && chatId) bot = new TelegramBot(token);
const sendToTelegram = (msg) => bot?.sendMessage(chatId, msg).catch(console.error);

// 全局配置 --------------------------------------------------------------
const maxConcurrentAccounts = 4;
const usernames = (process.env.USERNAMES || "").split(",").filter(Boolean);
const passwords = (process.env.PASSWORDS || "").split(",").filter(Boolean);
if (usernames.length !== passwords.length) throw new Error("USERNAMES 与 PASSWORDS 数量不一致");
const loginUrl = process.env.WEBSITE || "https://linux.do";
const totalAccounts = usernames.length;
const delayBetweenInstances = 10_000; // 每批账号实例间隔
const delayBetweenBatches = runTimeLimitMillis / Math.ceil(totalAccounts / maxConcurrentAccounts);

const specificUser = process.env.SPECIFIC_USER || "14790897";
const isLikeSpecificUser = process.env.LIKE_SPECIFIC_USER === "true";
const isAutoLike = process.env.AUTO_LIKE !== "false"; // 默认自动

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// -----------------------------------------------------------------------
// 主流程
// -----------------------------------------------------------------------
(async () => {
  try {
    // 代理配置检查
    const proxyConfig = getProxyConfig();
    if (proxyConfig) {
      console.log(`代理配置: ${proxyConfig.type}://${proxyConfig.host}:${proxyConfig.port}`);
      
      // 测试代理连接
      console.log("正在测试代理连接...");
      const proxyWorking = await testProxyConnection(proxyConfig);
      if (proxyWorking) {
        console.log("✅ 代理连接测试成功");
      } else {
        console.log("❌ 代理连接测试失败，将使用直连");
      }
    } else {
      console.log("未配置代理，使用直连");
      const currentIP = await getCurrentIP();
      if (currentIP) {
        console.log(`当前IP地址: ${currentIP}`);
      }
    }

    const batches = [];
    for (let i = 0; i < totalAccounts; i += maxConcurrentAccounts) {
      batches.push(usernames.slice(i, i + maxConcurrentAccounts).map((u, idx) => ({
        username: u,
        password: passwords[i + idx],
        delay: idx * delayBetweenInstances,
      })));
    }

    // 按批次顺序执行
    for (let b = 0; b < batches.length; b++) {
      console.log(`开始第 ${b + 1}/${batches.length} 批`);
      const browsers = await Promise.all(
        batches[b].map(({ username, password, delay: d }) =>
          launchBrowserForUser(username, password, d)
        )
      );

      // 若有下批次则等待
      if (b <= batches.length - 1) {
        console.log(`等待 ${delayBetweenBatches / 1000}s 进入下一批…`);
        await delay(delayBetweenBatches);
      }

      // 关闭浏览器
      for (const br of browsers) await br?.close();
    }
    console.log("所有账号处理完成 ✨");
  } catch (err) {
    console.error(err);
    sendToTelegram?.(`脚本异常: ${err.message}`);
  }
})();

// -----------------------------------------------------------------------
// 核心：为单个账号启动 Playwright、完成登录与业务逻辑
// -----------------------------------------------------------------------
async function launchBrowserForUser(username, password, instanceDelay) {
  await delay(instanceDelay); // 分散启动时序

  const launchOpts = {
    headless: false, // 改为 false，显示浏览器窗口
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  };

  // 添加代理配置
  const proxyConfig = getProxyConfig();
  const playwrightProxy = getPlaywrightProxyConfig(proxyConfig);
  
  const browser = await chromium.launch(launchOpts);
  
  const contextOptions = {
    locale: "en-US",
    userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36`,
    viewport: {
      width: 1280 + Math.floor(Math.random() * 100),
      height: 720 + Math.floor(Math.random() * 100),
    },
  };
  
  // 如果有代理配置，添加到context选项
  if (playwrightProxy) {
    contextOptions.proxy = playwrightProxy;
    console.log(`为用户 ${username} 启用代理: ${playwrightProxy.server}`);
  }
  
  const context = await browser.newContext(contextOptions);
  await context.setExtraHTTPHeaders({ "accept-language": "en-US,en;q=0.9" });

  const page = await context.newPage();
  page.on("pageerror", (err) => console.error("Page error:", err.message));
  page.on("console", (msg) => console.log("[console]", msg.text()));

  // Cloudflare challenge 处理
  await navigatePage(loginUrl, page);

  // 登录
  await login(page, username, password);
  await page.waitForTimeout(5000); // 登录后等待2秒

  // 跳到目标帖子
  const target =
    loginUrl === "https://linux.do"
      ? "https://linux.do/t/topic/13716/700"
      : loginUrl === "https://meta.appinn.net"
      ? "https://meta.appinn.net/t/topic/52006"
      : `${loginUrl}/t/topic/1`;
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000); // 跳转后等待2秒

  // 登录成功后注入业务脚本
  const scriptPath = resolveBusinessScript();
  const externalScript = fs.readFileSync(scriptPath, "utf8");
  await page.addInitScript(
    ([u, script, autoLike]) => {
      localStorage.setItem("read", true);
      localStorage.setItem("specificUser", u);
      localStorage.setItem("isFirstRun", "false");
      localStorage.setItem("autoLikeEnabled", autoLike);
      console.log("当前点赞用户：", u);
      eval(script);
    },
    [specificUser, externalScript, isAutoLike]
  );

  sendToTelegram?.(`${username} 登录成功`);
  return browser;
}

function resolveBusinessScript() {
  const base = dirname(fileURLToPath(import.meta.url));
  if (isLikeSpecificUser) {
    return join(base, Math.random() < 0.5 ? "index_likeUser_activity.js" : "index_likeUser.js");
  }
  return join(base, "index.js");
}

// -----------------------------------------------------------------------
// Cloudflare challenge 简易检测：页面标题含 Just a moment
// -----------------------------------------------------------------------
async function navigatePage(url, page) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const start = Date.now();
  while ((await page.title()).includes("Just a moment")) {
    console.log("Cloudflare challenge… 等待中");
    await delay(2000);
    if (Date.now() - start > 35_000) throw new Error("Cloudflare 验证超时");
  }
  console.log("已通过 Cloudflare, 页面标题:", await page.title());
}

// -----------------------------------------------------------------------
// 登录逻辑：根据页面实际结构适当调整选择器
// -----------------------------------------------------------------------
async function login(page, username, password, retry = 3) {
  // 点击登录按钮（中文/英文）或者类 .login-button
  const loginBtn = page.locator("button:text-is('登录'), button:text-is('login'), .login-button");
  if (await loginBtn.count()) await loginBtn.first().click();

  await page.locator("#login-account-name").waitFor();
  await page.fill("#login-account-name", username);
  await delay(1000); // 填写用户名后等待1秒
  await page.fill("#login-account-password", password);
  await delay(1000); // 填写密码后等待1秒
  await delay(800);

  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    page.click("#login-button"),
  ]).catch(async (err) => {
    if (retry > 0) {
      console.log("登录失败，重试…", err.message);
      await page.reload({ waitUntil: "domcontentloaded" });
      await delay(2000);
      return login(page, username, password, retry - 1);
    }
    throw new Error(`登录失败(${username}): ${err.message}`);
  });

  // 检查头像
  if (!(await page.locator("img.avatar").count())) throw new Error("登录后未找到头像, 疑似失败");
}

// -----------------------------------------------------------------------
// Express 健康监测
// -----------------------------------------------------------------------
const HEALTH_PORT = process.env.HEALTH_PORT || 7860;
const app = express();
app.get("/health", (_req, res) => {
  const m = process.memoryUsage();
  const fmt = (b) => `${(b / 1024 / 1024).toFixed(2)} MB`;
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime().toFixed(2),
    memory: Object.fromEntries(Object.entries(m).map(([k, v]) => [k, fmt(v)])),
  });
});
app.get("/", (_req, res) => res.send(`<h1>Auto Read (Playwright)</h1><p>Health: <a href="/health">/health</a></p>`));
app.listen(HEALTH_PORT, () => console.log(`Health endpoint: http://localhost:${HEALTH_PORT}/health`));
