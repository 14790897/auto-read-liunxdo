import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import TelegramBot from "node-telegram-bot-api";
import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";
import { parseRss } from "./src/parse_rss.js";

// 导入新的系统模块
import { createLogger } from "./src/logger.js";  
import configManager from "./src/config.js";
import alertManager from "./src/alert-manager.js";
import HealthCheckManager from "./src/health-check.js";
import PerformanceMonitor from "./src/performance.js";
import RetryManager, { RetryConfig } from "./src/retry.js";

// 初始化系统组件
const logger = createLogger('MAIN');
const healthCheck = new HealthCheckManager();
const performanceMonitor = new PerformanceMonitor();

// 启动系统
logger.info('=== 自动阅读系统启动 ===');
configManager.printSummary();

// 执行初始健康检查
healthCheck.runAllChecks().then(status => {
  logger.info('初始健康检查完成', { status: status.overall });
  if (status.overall === 'unhealthy') {
    alertManager.sendAlert(
      alertManager.createAlert('system_error', '系统健康检查失败', {
        details: healthCheck.getHealthSummary()
      })
    );
  }
});

dotenv.config();

// 截图保存的文件夹
// const screenshotDir = "screenshots";
// if (!fs.existsSync(screenshotDir)) {
//   fs.mkdirSync(screenshotDir);
// }
puppeteer.use(StealthPlugin());

// 使用配置管理器获取配置
const runTimeLimitMinutes = configManager.get('runtime.runTimeLimitMinutes');
const runTimeLimitMillis = configManager.getRunTimeLimitMs();

logger.info(`运行时间限制为：${runTimeLimitMinutes} 分钟 (${runTimeLimitMillis} 毫秒)`);

// 设置一个定时器，在运行时间到达时终止进程
const shutdownTimer = setTimeout(() => {
  logger.info("达到时间限制，正在关闭进程...");
  performanceMonitor.generateFinalReport().then(report => {
    logger.info('性能监控最终报告', { report });
    alertManager.sendInfo('系统正常关闭', {
      runTime: `${runTimeLimitMinutes} 分钟`,
      reason: '达到运行时间限制'
    });
    process.exit(0);
  });
}, runTimeLimitMillis);

// 获取配置
const maxConcurrentAccounts = configManager.get('runtime.maxConcurrentAccounts');
const usernames = configManager.get('accounts.usernames');
const passwords = configManager.get('accounts.passwords');
const loginUrl = configManager.get('website.loginUrl');
const delayBetweenInstances = configManager.get('runtime.delayBetweenInstances');
const totalAccounts = usernames.length;
const delayBetweenBatches = configManager.getDelayBetweenBatches(totalAccounts);
const isLikeSpecificUser = configManager.get('website.isLikeSpecificUser');
const isAutoLike = configManager.get('website.isAutoLike');
const enableRssFetch = configManager.get('rss.enabled');
const specificUser = configManager.get('website.specificUser');

logger.info(`RSS抓取功能状态: ${enableRssFetch ? "开启" : "关闭"}`);
logger.info(`账号配置: ${totalAccounts} 个账号, 最大并发: ${maxConcurrentAccounts}`);

// Telegram 配置（使用新的告警管理器）
const token = configManager.get('telegram.botToken');
const chatId = configManager.get('telegram.chatId');
const groupId = configManager.get('telegram.groupId');

// 使用新的告警管理器替代原有的 Telegram 函数
let bot;
if (token && (chatId || groupId)) {
  bot = new TelegramBot(token);
}

function sendToTelegram(message) {
  alertManager.sendToChat(message);
}

function sendToTelegramGroup(message) {
  alertManager.sendRssContent('RSS 内容更新', { content: message });
}

//随机等待时间
function delayClick(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

(async () => {
  const startTime = Date.now();
  
  try {
    // 启动前性能监控
    performanceMonitor.startMonitoring();
    
    // 账号配置验证
    if (usernames.length !== passwords.length) {
      const error = new Error("用户名和密码的数量不匹配！");
      logger.error("配置错误", { 
        usernames: usernames.length, 
        passwords: passwords.length 
      });
      alertManager.sendSystemError("配置错误", error, {
        usernames: usernames.length,
        passwords: passwords.length
      });
      throw error;
    }

    logger.info("开始批量账号处理", {
      totalAccounts,
      maxConcurrentAccounts,
      delayBetweenBatches: Math.round(delayBetweenBatches / 1000) + 's'
    });

    // 记录账号处理开始
    performanceMonitor.startAccountProcessing(totalAccounts);

    // 并发启动浏览器实例进行登录
    const loginTasks = usernames.map((username, index) => {
      const password = passwords[index];
      const delay = (index % maxConcurrentAccounts) * delayBetweenInstances; // 使得每一组内的浏览器可以分开启动
      return () => {
        // 确保这里返回的是函数
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            launchBrowserForUser(username, password)
              .then(resolve)
              .catch(reject);
          }, delay);
        });
      };
    });
    
    // 依次执行每个批次的任务
    for (let i = 0; i < totalAccounts; i += maxConcurrentAccounts) {
      const batchNumber = Math.floor(i / maxConcurrentAccounts) + 1;
      const batchSize = Math.min(maxConcurrentAccounts, totalAccounts - i);
      
      logger.info(`开始处理批次 ${batchNumber}`, {
        accounts: `${i + 1} - ${i + batchSize}`,
        batchSize
      });
      
      // 执行每批次最多 4 个账号
      const batch = loginTasks
        .slice(i, i + maxConcurrentAccounts)
        .map(async (task) => {
          const { browser } = await task(); // 运行任务并获取浏览器实例
          return browser;
        }); 
        
      // 等待当前批次的任务完成
      const browsers = await Promise.all(batch);

      // 如果还有下一个批次，等待指定的时间,同时，如果总共只有一个账号，也需要继续运行
      if (i + maxConcurrentAccounts < totalAccounts || i === 0) {
        const waitTime = Math.round(delayBetweenBatches / 1000);
        logger.info(`等待 ${waitTime} 秒后处理下一批次`);
        await new Promise((resolve) =>
          setTimeout(resolve, delayBetweenBatches)
        );
      } else {
        logger.info("没有下一个批次，即将结束");
      }
      
      logger.info(`批次 ${batchNumber} 完成，关闭浏览器实例`, { browsers: browsers.length });
      
      // 关闭所有浏览器实例
      for (const browser of browsers) {
        try {
          await browser.close();
        } catch (error) {
          logger.warn('关闭浏览器失败', { error: error.message });
        }
      }
    }    const totalDuration = Date.now() - startTime;
    logger.info("所有账号登录操作已完成", { 
      totalAccounts, 
      duration: Math.round(totalDuration / 1000) + 's' 
    });
    
    // 记录完成情况 (使用通用完成记录)
    performanceMonitor.incrementCounter('system.batch_completed');
    
    // 发送成功通知
    alertManager.sendSuccess("批量账号处理完成", {
      账号数量: totalAccounts,
      处理时间: Math.round(totalDuration / 1000) + '秒',
      平均时间: Math.round(totalDuration / totalAccounts / 1000) + '秒/账号'
    });

  } catch (error) {
    // 增强的错误处理逻辑
    const totalDuration = Date.now() - startTime;
    logger.error("系统发生错误", { 
      error: error.message, 
      stack: error.stack,
      duration: Math.round(totalDuration / 1000) + 's'
    });
    
    performanceMonitor.incrementCounter('system.errors');
    
    // 发送错误告警
    alertManager.sendSystemError("系统执行错误", error, {
      执行时间: Math.round(totalDuration / 1000) + '秒',
      已处理账号: performanceMonitor.getMetrics().accounts?.completed || 0,
      总账号数: totalAccounts
    });
  }
})();
async function launchBrowserForUser(username, password) {
  let browser = null; // 在 try 之外声明 browser 变量
  const startTime = Date.now();
  
  try {
    logger.info(`启动用户浏览器实例`, { username, timestamp: new Date().toISOString() });
    performanceMonitor.incrementCounter('browser.launches');
    
    const browserOptions = {
      headless: "auto",
      args: ["--no-sandbox", "--disable-setuid-sandbox"], // Linux 需要的安全设置
    };

    // 如果环境变量不是 'dev'，则添加代理配置
    // if (process.env.ENVIRONMENT !== "dev") {
    // browserOptions["proxy"] = {
    //   host: "38.154.227.167",
    //   port: "5868",
    //   username: "pqxujuyl",
    //   password: "y1nmb5kjbz9t",
    // };
    // }    // 使用重试机制连接浏览器
    const connectToWrowser = () => import("puppeteer-real-browser").then(({ connect }) => connect(browserOptions));
    const { page, browser: newBrowser } = await RetryManager.withRetry(
      connectToWrowser,
      RetryConfig.BROWSER,
      `浏览器连接 ${username}`
    );
    
    browser = newBrowser; // 将 browser 初始化
    logger.info(`浏览器连接成功`, { username, duration: Date.now() - startTime });
    performanceMonitor.incrementCounter('browser.connections.success');    
    // 启动截图功能
    // takeScreenshots(page);
    
    // 导航到登录页面并进行 Cloudflare 检查
    logger.info(`开始导航到登录页面`, { username, url: loginUrl });
    await navigatePage(loginUrl, page, browser);
    await delayClick(8000);
    
    // 设置额外的 headers
    await page.setExtraHTTPHeaders({
      "accept-language": "en-US,en;q=0.9",
    });
    
    // 增强的错误处理
    page.on("pageerror", (error) => {
      logger.error(`页面错误`, { username, error: error.message, stack: error.stack });
      performanceMonitor.incrementCounter('browser.page_errors');
    });
    
    page.on("error", async (error) => {
      logger.error(`浏览器错误`, { username, error: error.message });
      performanceMonitor.incrementCounter('browser.errors');
      
      // 检查是否是 localStorage 的访问权限错误
      if (
        error.message.includes(
          "Failed to read the 'localStorage' property from 'Window'"
        )
      ) {
        logger.warn(`尝试刷新页面解决 localStorage 错误`, { username });
        await page.reload(); // 刷新页面
        // 重新尝试你的操作...
      }
    });
    
    page.on("console", async (msg) => {
      const logLevel = msg.type() === 'error' ? 'error' : 'debug';
      logger[logLevel](`浏览器控制台`, { 
        username, 
        type: msg.type(), 
        message: msg.text() 
      });
      
      // 使用一个标志变量来检测是否已经刷新过页面
      if (
        !page._isReloaded &&
        msg.text().includes("the server responded with a status of 429")
      ) {
        // 设置标志变量为 true，表示即将刷新页面
        page._isReloaded = true;
        logger.warn(`检测到 429 错误，准备重试`, { username });
        performanceMonitor.incrementCounter('browser.rate_limits');
        
        //由于油候脚本它这个时候可能会导航到新的网页,会导致直接执行代码报错,所以使用这个来在每个新网页加载之前来执行
        await page.evaluateOnNewDocument(() => {
          localStorage.setItem("autoLikeEnabled", "false");
        });
        // 等待一段时间，比如 3 秒
        await new Promise((resolve) => setTimeout(resolve, 3000));
        logger.info(`429 错误处理后重试`, { username });
        // 尝试刷新页面
        // await page.reload();
      }
    });    
    // 执行登录操作
    logger.info(`开始执行登录`, { username });
    const loginStartTime = Date.now();
    await login(page, username, password);
    
    // 验证登录是否成功
    const avatarImg = await page.$("img.avatar");
    const loginDuration = Date.now() - loginStartTime;

    if (avatarImg) {
      logger.info(`登录成功`, { username, duration: loginDuration });
      performanceMonitor.incrementCounter('browser.logins.success');
      performanceMonitor.recordTiming('browser.login_duration', loginDuration);
    } else {
      const error = new Error("登录失败");
      logger.error(`登录失败 - 未找到头像元素`, { username, duration: loginDuration });
      performanceMonitor.incrementCounter('browser.logins.failed');
      throw error;
    }

    // 加载并注入外部脚本
    let externalScriptPath;
    if (isLikeSpecificUser === "true") {
      const randomChoice = Math.random() < 0.5; // 生成一个随机数，50% 概率为 true
      if (randomChoice) {
        externalScriptPath = path.join(
          dirname(fileURLToPath(import.meta.url)),
          "index_likeUser_activity.js"
        );
        logger.info(`使用特定用户活动脚本`, { username, script: "index_likeUser_activity.js" });
      } else {
        externalScriptPath = path.join(
          dirname(fileURLToPath(import.meta.url)),
          "index_likeUser.js"
        );
        logger.info(`使用特定用户脚本`, { username, script: "index_likeUser.js" });
      }
    } else {
      externalScriptPath = path.join(
        dirname(fileURLToPath(import.meta.url)),
        "index.js"
      );
      logger.info(`使用通用阅读脚本`, { username, script: "index.js" });
    }
    
    const externalScript = fs.readFileSync(externalScriptPath, "utf8");
    logger.info(`脚本文件读取成功`, { username, scriptPath: externalScriptPath });

    // 在每个新的文档加载时执行外部脚本
    await page.evaluateOnNewDocument(
      (...args) => {
        const [specificUser, scriptToEval, isAutoLike] = args;
        localStorage.setItem("read", true);
        localStorage.setItem("specificUser", specificUser);
        localStorage.setItem("isFirstRun", "false");
        localStorage.setItem("autoLikeEnabled", isAutoLike);
        console.log("当前点赞用户：", specificUser);
        eval(scriptToEval);
      },
      specificUser,
      externalScript,
      isAutoLike
    ); //变量必须从外部显示的传入, 因为在浏览器上下文它是读取不了的
    
    logger.info(`外部脚本注入成功`, { username, specificUser, isAutoLike });
    
    // 添加一个监听器来监听每次页面加载完成的事件
    page.on("load", async () => {
      logger.debug(`页面加载完成`, { username, url: page.url() });
      // await page.evaluate(externalScript); //因为这个是在页面加载好之后执行的,而脚本是在页面加载好时刻来判断是否要执行，由于已经加载好了，脚本就不会起作用
    });    
    // 导航到目标页面
    logger.info(`导航到目标页面`, { username, loginUrl });
    if (loginUrl == "https://linux.do") {
      await page.goto("https://linux.do/t/topic/13716/790", {
        waitUntil: "domcontentloaded",
      });
      logger.info(`已导航到 Linux.do 目标页面`, { username });
    } else if (loginUrl == "https://meta.appinn.net") {
      await page.goto("https://meta.appinn.net/t/topic/52006", {
        waitUntil: "domcontentloaded",
      });
      logger.info(`已导航到 AppInn 目标页面`, { username });
    } else {
      await page.goto(`${loginUrl}/t/topic/1`, {
        waitUntil: "domcontentloaded",
      });
      logger.info(`已导航到默认目标页面`, { username, url: `${loginUrl}/t/topic/1` });
    }
    
    // 发送登录成功通知
    if (token && chatId) {
      alertManager.sendAccountUpdate(`${username} 登录成功`, { status: 'success' });
    }
    
    // 设置 RSS 抓取监听器（如果启用）
    if (enableRssFetch) {
      logger.info(`启用 RSS 抓取功能`, { username });
      performanceMonitor.incrementCounter('browser.rss_fetch_enabled');
      
      // 记录已推送过的 topicId，防止重复推送
      const pushedTopicIds = new Set();
      page.on("framenavigated", async (frame) => {
        if (frame.parentFrame() !== null) return;
        const url = frame.url();
        const match = url.match(/https:\/\/linux\.do\/t\/topic\/(\d+)/);
        if (match) {
          const topicId = match[1];
          if (pushedTopicIds.has(topicId)) {
            return; // 已推送过则跳过
          }
          pushedTopicIds.add(topicId);
          const rssUrl = `https://linux.do/t/topic/${topicId}.rss`;
          
          logger.info(`检测到话题跳转，开始抓取 RSS`, { username, topicId, rssUrl });
          performanceMonitor.incrementCounter('browser.rss_topics_detected');
          
          try {
            // 停顿1.5秒再抓取
            await new Promise((r) => setTimeout(r, 1500));
            const rssPage = await browser.newPage();
            await rssPage.goto(rssUrl, {
              waitUntil: "domcontentloaded",
              timeout: 20000,
            });
            // 停顿0.5秒再获取内容，确保页面渲染完成
            await new Promise((r) => setTimeout(r, 1000));
            const xml = await rssPage.evaluate(() => document.body.innerText);
            await rssPage.close();
            const parsedData = await parseRss(xml);
            sendToTelegramGroup(parsedData);
            
            logger.info(`RSS 抓取并发送成功`, { username, topicId });
            performanceMonitor.incrementCounter('browser.rss_successful');
          } catch (e) {
            logger.error(`RSS 抓取失败`, { 
              username, 
              topicId, 
              error: e.message,
              note: "可能是非公开话题" 
            });
            performanceMonitor.incrementCounter('browser.rss_failed');
          }
        }
        // 停顿0.5秒后允许下次抓取
        await new Promise((r) => setTimeout(r, 500));
      });
    }
    
    const totalDuration = Date.now() - startTime;
    logger.info(`浏览器实例启动完成`, { 
      username, 
      totalDuration,
      success: true 
    });
    performanceMonitor.recordTiming('browser.launch_total_duration', totalDuration);
    performanceMonitor.incrementCounter('browser.launches.success');
    
    return { browser };
  } catch (err) {
    const totalDuration = Date.now() - startTime;
    logger.error(`浏览器实例启动失败`, { 
      username, 
      error: err.message, 
      stack: err.stack,
      totalDuration 
    });
    
    performanceMonitor.incrementCounter('browser.launches.failed');
    performanceMonitor.recordTiming('browser.launch_failed_duration', totalDuration);
    
    // 发送错误告警
    alertManager.sendAccountError(`${username} 浏览器启动失败`, err, {
      duration: Math.round(totalDuration / 1000) + 's'
    });
    
    if (token && chatId) {
      alertManager.sendAccountUpdate(`${username} 处理失败: ${err.message}`, { 
        status: 'error',
        duration: totalDuration 
      });
    }
    return { browser }; // 错误时仍然返回 browser
  }
}
async function login(page, username, password, retryCount = 3) {
  const startTime = Date.now();
  
  try {
    logger.info(`开始登录流程`, { username, retryCount });
    
    // 使用XPath查询找到包含"登录"或"login"文本的按钮
    let loginButtonFound = await page.evaluate(() => {
      let loginButton = Array.from(document.querySelectorAll("button")).find(
        (button) =>
          button.textContent.includes("登录") ||
          button.textContent.includes("login")
      ); // 注意loginButton 变量在外部作用域中是无法被 page.evaluate 内部的代码直接修改的。page.evaluate 的代码是在浏览器环境中执行的，这意味着它们无法直接影响 Node.js 环境中的变量
      // 如果没有找到，尝试根据类名查找
      if (!loginButton) {
        loginButton = document.querySelector(".login-button");
      }
      if (loginButton) {
        loginButton.click();
        console.log("Login button clicked.");
        return true; // 返回true表示找到了按钮并点击了
      } else {
        console.log("Login button not found.");
        return false; // 返回false表示没有找到按钮
      }
    });
    
    if (!loginButtonFound) {
      logger.warn(`未找到登录按钮，尝试通过点赞按钮触发登录`, { username });
      if (loginUrl == "https://meta.appinn.net") {
        await page.goto("https://meta.appinn.net/t/topic/52006", {
          waitUntil: "domcontentloaded",
        });
        await page.click(".discourse-reactions-reaction-button");
      } else {
        await page.goto(`${loginUrl}/t/topic/1`, {
          waitUntil: "domcontentloaded",
        });
        await page.click(".discourse-reactions-reaction-button");
      }
    }
    
    // 等待用户名输入框加载
    logger.debug(`等待用户名输入框`, { username });
    await page.waitForSelector("#login-account-name");
    // 模拟人类在找到输入框后的短暂停顿
    await delayClick(1000); // 延迟500毫秒
    
    // 清空输入框并输入用户名
    logger.debug(`输入用户名`, { username });
    await page.click("#login-account-name", { clickCount: 3 });
    await page.type("#login-account-name", username, {
      delay: 100,
    }); // 输入时在每个按键之间添加额外的延迟
    await delayClick(1000);
    
    // 等待密码输入框加载
    // await page.waitForSelector("#login-account-password");
    // 模拟人类在输入用户名后的短暂停顿
    // delayClick; // 清空输入框并输入密码
    logger.debug(`输入密码`, { username });
    await page.click("#login-account-password", { clickCount: 3 });
    await page.type("#login-account-password", password, {
      delay: 100,
    });

    // 模拟人类在输入完成后思考的短暂停顿
    await delayClick(1000);

    // 假设登录按钮的ID是'login-button'，点击登录按钮
    await page.waitForSelector("#login-button");
    await delayClick(1000); // 模拟在点击登录按钮前的短暂停顿
    
    logger.info(`点击登录按钮`, { username });
    await page.click("#login-button");
    
    try {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded" }), // 等待 页面跳转 DOMContentLoaded 事件
        // 去掉上面一行会报错：Error: Execution context was destroyed, most likely because of a navigation. 可能是因为之后没等页面加载完成就执行了脚本
        page.click("#login-button", { force: true }), // 点击登录按钮触发跳转
      ]); //注意如果登录失败，这里会一直等待跳转，导致脚本执行失败 这点四个月之前你就发现了结果今天又遇到（有个用户遇到了https://linux.do/t/topic/169209/82），但是你没有在这个报错你提示我8.5
      
      const loginDuration = Date.now() - startTime;
      logger.info(`登录导航成功`, { username, duration: loginDuration });
      
    } catch (error) {
      logger.warn(`登录导航可能失败，检查错误信息`, { username, error: error.message });
      
      const alertError = await page.$(".alert.alert-error");
      if (alertError) {
        const alertText = await page.evaluate((el) => el.innerText, alertError); // 使用 evaluate 获取 innerText
        logger.error(`登录出现错误提示`, { username, alertText });
        
        if (
          alertText.includes("incorrect") ||
          alertText.includes("Incorrect ") ||
          alertText.includes("不正确")
        ) {
          const credentialsError = new Error(
            `用户名密码不正确，失败用户 ${username}, 错误信息：${alertText}`
          );
          logger.error(`凭据错误`, { username, alertText });
          performanceMonitor.incrementCounter('browser.login_credential_errors');
          throw credentialsError;
        } else {
          const ipError = new Error(
            `IP相关错误，可能需使用中国美国香港台湾IP，失败用户 ${username}，错误信息：${alertText}`
          );
          logger.error(`IP相关错误`, { username, alertText });
          performanceMonitor.incrementCounter('browser.login_ip_errors');
          throw ipError;
        }
      } else {
        if (retryCount > 0) {
          logger.warn(`登录超时，准备重试`, { username, retryCount: retryCount - 1 });
          performanceMonitor.incrementCounter('browser.login_retries');
          
          await page.reload({ waitUntil: "domcontentloaded" });
          await delayClick(2000); // 增加重试前的延迟
          return await login(page, username, password, retryCount - 1);
        } else {
          const timeoutError = new Error(
            `登录导航超时，可能是IP质量问题，失败用户 ${username}, ${error.message}`
          ); //{password}
          logger.error(`登录最终失败`, { 
            username, 
            error: error.message,
            totalDuration: Date.now() - startTime 
          });
          performanceMonitor.incrementCounter('browser.login_timeout_errors');
          throw timeoutError;
        }
      }
    }
    await delayClick(1000);
    
    const totalDuration = Date.now() - startTime;
    logger.info(`登录流程完成`, { username, totalDuration });
    performanceMonitor.recordTiming('browser.login_success_duration', totalDuration);
    
  } catch (err) {
    const totalDuration = Date.now() - startTime;
    logger.error(`登录流程异常`, { 
      username, 
      error: err.message, 
      totalDuration,
      retryCount 
    });
    performanceMonitor.recordTiming('browser.login_error_duration', totalDuration);
    throw err;
  }
}

async function navigatePage(url, page, browser) {
  const startTime = Date.now();
  
  try {
    logger.info(`开始导航到页面`, { url });
    
    await page.goto(url, { waitUntil: "domcontentloaded" }); //如果使用默认的load,linux下页面会一直加载导致无法继续执行
    
    let pageTitle = await page.title(); // 获取当前页面标题
    logger.debug(`页面标题获取`, { url, title: pageTitle });

    while (pageTitle.includes("Just a moment")) {
      logger.warn(`页面受到 Cloudflare 保护，等待中...`, { url, title: pageTitle });
      performanceMonitor.incrementCounter('browser.cloudflare_challenges');

      await delayClick(2000); // 每次检查间隔2秒

      // 重新获取页面标题
      pageTitle = await page.title();

      // 检查是否超过35秒
      if (Date.now() - startTime > 35000) {
        const error = new Error(`Cloudflare 挑战超时 (35秒)`);
        logger.error(`Cloudflare 挑战超时`, { 
          url, 
          duration: Date.now() - startTime,
          title: pageTitle 
        });
        performanceMonitor.incrementCounter('browser.cloudflare_timeouts');
        await browser.close();
        throw error;
      }
    }
    
    const navigationDuration = Date.now() - startTime;
    logger.info(`页面导航成功`, { 
      url, 
      title: pageTitle, 
      duration: navigationDuration 
    });
    performanceMonitor.recordTiming('browser.navigation_duration', navigationDuration);
    performanceMonitor.incrementCounter('browser.navigations.success');
    
  } catch (err) {
    const navigationDuration = Date.now() - startTime;
    logger.error(`页面导航失败`, { 
      url, 
      error: err.message, 
      duration: navigationDuration 
    });
    performanceMonitor.incrementCounter('browser.navigations.failed');
    throw err;
  }
}

// 增强的截图功能 - 支持监控和错误处理
async function takeScreenshots(page, username = 'unknown') {
  let screenshotIndex = 0;
  const screenshotInterval = setInterval(async () => {
    const startTime = Date.now();
    screenshotIndex++;
    const screenshotPath = path.join(
      screenshotDir,
      `screenshot-${username}-${screenshotIndex}.png`
    );
    
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
      const duration = Date.now() - startTime;
      
      logger.debug(`截图保存成功`, { 
        username, 
        path: screenshotPath, 
        index: screenshotIndex,
        duration 
      });
      
      performanceMonitor.incrementCounter('browser.screenshots.success');
      performanceMonitor.recordTiming('browser.screenshot_duration', duration);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`截图保存失败`, { 
        username, 
        path: screenshotPath, 
        index: screenshotIndex,
        error: error.message,
        duration 
      });
      performanceMonitor.incrementCounter('browser.screenshots.failed');
    }
  }, 1000);

  // 注册退出时清理
  const cleanupHandler = () => {
    try {
      clearInterval(screenshotInterval);
      if (fs.existsSync(screenshotDir)) {
        fs.rmSync(screenshotDir, { recursive: true, force: true });
        logger.info(`截图文件夹已清理`, { path: screenshotDir });
      }
    } catch (error) {
      logger.error(`清理截图文件夹失败`, { 
        path: screenshotDir, 
        error: error.message 
      });
    }
  };

  process.on("exit", cleanupHandler);
  process.on("SIGINT", cleanupHandler);
  process.on("SIGTERM", cleanupHandler);
  
  return screenshotInterval;
}
import express from "express";

const healthApp = express();
const HEALTH_PORT = process.env.HEALTH_PORT || 7860;

// 健康探针路由 - 使用增强的健康检查系统
healthApp.get("/health", async (req, res) => {
  try {
    const healthStatus = await healthCheck.runAllChecks();
    const performanceMetrics = performanceMonitor.getMetrics();
    const configInfo = configManager.getHealthInfo();
    
    // 基础内存信息
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = {
      rss: `${(memoryUsage.rss / (1024 * 1024)).toFixed(2)} MB`,
      heapTotal: `${(memoryUsage.heapTotal / (1024 * 1024)).toFixed(2)} MB`,
      heapUsed: `${(memoryUsage.heapUsed / (1024 * 1024)).toFixed(2)} MB`,
      external: `${(memoryUsage.external / (1024 * 1024)).toFixed(2)} MB`,
      arrayBuffers: `${(memoryUsage.arrayBuffers / (1024 * 1024)).toFixed(2)} MB`,
    };

    const responseData = {
      status: healthStatus.overall === 'healthy' ? "OK" : "DEGRADED",
      overall: healthStatus.overall,
      timestamp: new Date().toISOString(),
      uptime: `${process.uptime().toFixed(2)}s`,
      memoryUsage: memoryUsageMB,
      healthChecks: healthStatus.checks,
      performance: {
        counters: performanceMetrics.counters || {},
        timings: performanceMetrics.timings || {},
        accounts: performanceMetrics.accounts || {},
        database: performanceMetrics.database || {}
      },
      configuration: {
        environment: configInfo.environment,
        totalAccounts: configInfo.totalAccounts,
        runtime: configInfo.runtime,
        features: configInfo.features
      }
    };

    // 根据健康状态设置 HTTP 状态码
    const statusCode = healthStatus.overall === 'healthy' ? 200 : 
                      healthStatus.overall === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(responseData);
    
    logger.debug('健康检查请求完成', { 
      status: healthStatus.overall,
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    
  } catch (error) {
    logger.error('健康检查端点错误', { error: error.message, stack: error.stack });
    
    // 降级响应
    const fallbackData = {
      status: "ERROR",
      overall: "unhealthy",
      timestamp: new Date().toISOString(),
      uptime: `${process.uptime().toFixed(2)}s`,
      error: error.message,
      memoryUsage: Object.fromEntries(
        Object.entries(process.memoryUsage()).map(([k, v]) => 
          [k, `${(v / (1024 * 1024)).toFixed(2)} MB`]
        )
      )
    };
    
    res.status(500).json(fallbackData);
  }
});
healthApp.get("/", async (req, res) => {
  try {
    const healthStatus = await healthCheck.runAllChecks();
    const performanceMetrics = performanceMonitor.getMetrics();
    const configInfo = configManager.getHealthInfo();
    
    // 生成状态颜色
    const getStatusColor = (status) => {
      switch (status) {
        case 'healthy': return '#28a745';
        case 'degraded': return '#ffc107';
        case 'unhealthy': return '#dc3545';
        default: return '#6c757d';
      }
    };
    
    const statusColor = getStatusColor(healthStatus.overall);
    
    res.send(`
    <html>
      <head>
        <title>Auto Read System</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            margin: 0;
            padding: 20px;
            min-height: 100vh;
          }
          .container {
            max-width: 1200px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
            color: white;
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 2.5rem;
            font-weight: 300;
          }
          .header .subtitle {
            margin: 10px 0 0 0;
            opacity: 0.9;
            font-size: 1.1rem;
          }
          .content {
            padding: 30px;
          }
          .status-card {
            background: white;
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 25px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            border-left: 4px solid ${statusColor};
          }
          .status-header {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
          }
          .status-indicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background-color: ${statusColor};
            margin-right: 12px;
          }
          .status-text {
            font-size: 1.3rem;
            font-weight: 600;
            color: ${statusColor};
            text-transform: uppercase;
          }
          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 25px;
          }
          .metric-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            border: 1px solid #e9ecef;
          }
          .metric-title {
            font-size: 0.9rem;
            color: #6c757d;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .metric-value {
            font-size: 1.8rem;
            font-weight: 700;
            color: #007bff;
          }
          .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
          }
          .info-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            border: 1px solid #e9ecef;
          }
          .info-title {
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 15px;
            color: #495057;
            border-bottom: 2px solid #007bff;
            padding-bottom: 8px;
          }
          .info-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #f8f9fa;
          }
          .info-item:last-child {
            border-bottom: none;
          }
          .info-label {
            color: #6c757d;
            font-weight: 500;
          }
          .info-value {
            color: #495057;
            font-weight: 600;
          }
          .links {
            text-align: center;
            margin-top: 30px;
            padding-top: 25px;
            border-top: 1px solid #e9ecef;
          }
          .btn {
            display: inline-block;
            padding: 12px 24px;
            margin: 0 10px;
            background: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 500;
            transition: all 0.3s ease;
          }
          .btn:hover {
            background: #0056b3;
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0, 123, 255, 0.3);
          }
          .btn-outline {
            background: transparent;
            border: 2px solid #007bff;
            color: #007bff;
          }
          .btn-outline:hover {
            background: #007bff;
            color: white;
          }
          .footer {
            text-align: center;
            padding: 20px;
            color: #6c757d;
            background: #f8f9fa;
            margin-top: 30px;
          }
          @media (max-width: 768px) {
            .content { padding: 20px; }
            .header { padding: 20px; }
            .header h1 { font-size: 2rem; }
            .metrics-grid { grid-template-columns: 1fr; }
            .info-grid { grid-template-columns: 1fr; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🤖 Auto Read System</h1>
            <p class="subtitle">多账号自动阅读与监控系统</p>
          </div>
          
          <div class="content">
            <div class="status-card">
              <div class="status-header">
                <div class="status-indicator"></div>
                <div class="status-text">${healthStatus.overall}</div>
              </div>
              <p>系统运行时间: ${Math.floor(process.uptime() / 3600)}小时 ${Math.floor((process.uptime() % 3600) / 60)}分钟</p>
            </div>

            <div class="metrics-grid">
              <div class="metric-card">
                <div class="metric-title">总账号数</div>
                <div class="metric-value">${configInfo.totalAccounts || 0}</div>
              </div>
              <div class="metric-card">
                <div class="metric-title">成功登录</div>
                <div class="metric-value">${performanceMetrics.counters?.['browser.logins.success'] || 0}</div>
              </div>
              <div class="metric-card">
                <div class="metric-title">数据库操作</div>
                <div class="metric-value">${performanceMetrics.counters?.['database.saves'] || 0}</div>
              </div>
              <div class="metric-card">
                <div class="metric-title">系统错误</div>
                <div class="metric-value">${performanceMetrics.counters?.['system.errors'] || 0}</div>
              </div>
            </div>

            <div class="info-grid">
              <div class="info-card">
                <div class="info-title">🖥️ 系统信息</div>
                <div class="info-item">
                  <span class="info-label">内存使用</span>
                  <span class="info-value">${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB</span>
                </div>
                <div class="info-item">
                  <span class="info-label">运行环境</span>
                  <span class="info-value">${configInfo.environment || 'unknown'}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Node版本</span>
                  <span class="info-value">${process.version}</span>
                </div>
              </div>

              <div class="info-card">
                <div class="info-title">⚙️ 配置信息</div>
                <div class="info-item">
                  <span class="info-label">运行时限</span>
                  <span class="info-value">${configInfo.runtime?.limit || 'N/A'}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">并发数</span>
                  <span class="info-value">${configInfo.runtime?.concurrent || 'N/A'}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">功能特性</span>
                  <span class="info-value">${Object.keys(configInfo.features || {}).join(', ') || 'None'}</span>
                </div>
              </div>
            </div>

            <div class="links">
              <a href="/health" class="btn">📊 详细健康报告</a>
              <a href="https://github.com/14790897/auto-read-liunxdo" target="_blank" class="btn btn-outline">📚 GitHub 仓库</a>
            </div>
          </div>

          <div class="footer">
            <p>&copy; 2024 Auto Read System | 最后更新: ${new Date().toLocaleString('zh-CN')}</p>
          </div>
        </div>
        
        <script>
          // 自动刷新页面状态 (每30秒)
          setTimeout(() => {
            window.location.reload();
          }, 30000);
        </script>
      </body>
    </html>
  `);
  } catch (error) {
    logger.error('主页渲染错误', { error: error.message });
    res.status(500).send(`
      <html>
        <head><title>Error</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>🚨 系统错误</h1>
          <p>无法加载系统状态，请稍后重试。</p>
          <a href="/health">查看基础健康状态</a>
        </body>
      </html>
    `);
  }
});
healthApp.listen(HEALTH_PORT, () => {
  console.log(
    `Health check endpoint is running at http://localhost:${HEALTH_PORT}/health`
  );
});
