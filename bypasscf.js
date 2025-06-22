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
import { processAndSaveTopicData } from "./src/topic_data.js";
import {
  getProxyConfig,
  getPuppeteerProxyArgs,
  testProxyConnection,
  getCurrentIP,
} from "./src/proxy_config.js";

dotenv.config();

// 截图保存的文件夹
// const screenshotDir = "screenshots";
// if (!fs.existsSync(screenshotDir)) {
//   fs.mkdirSync(screenshotDir);
// }
puppeteer.use(StealthPlugin());

// Load the default .env file
if (fs.existsSync(".env.local")) {
  console.log("Using .env.local file to supply config environment variables");
  const envConfig = dotenv.parse(fs.readFileSync(".env.local"));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
} else {
  console.log(
    "Using .env file to supply config environment variables, you can create a .env.local file to overwrite defaults, it doesn't upload to git"
  );
}

// 读取以分钟为单位的运行时间限制
const runTimeLimitMinutes = process.env.RUN_TIME_LIMIT_MINUTES || 20;

// 将分钟转换为毫秒
const runTimeLimitMillis = runTimeLimitMinutes * 60 * 1000;

console.log(
  `运行时间限制为：${runTimeLimitMinutes} 分钟 (${runTimeLimitMillis} 毫秒)`
);

// 设置一个定时器，在运行时间到达时终止进程
const shutdownTimer = setTimeout(() => {
  console.log("时间到,Reached time limit, shutting down the process...");
  process.exit(0); // 退出进程
}, runTimeLimitMillis);

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const groupId = process.env.TELEGRAM_GROUP_ID;
const specificUser = process.env.SPECIFIC_USER || "14790897";
const maxConcurrentAccounts = parseInt(process.env.MAX_CONCURRENT_ACCOUNTS) || 3; // 每批最多同时运行的账号数
const usernames = process.env.USERNAMES.split(",");
const passwords = process.env.PASSWORDS.split(",");
const loginUrl = process.env.WEBSITE || "https://linux.do"; //在GitHub action环境里它不能读取默认环境变量,只能在这里设置默认值
const delayBetweenInstances = 10000;
const totalAccounts = usernames.length; // 总的账号数
const delayBetweenBatches =
  runTimeLimitMillis / Math.ceil(totalAccounts / maxConcurrentAccounts);
const isLikeSpecificUser = process.env.LIKE_SPECIFIC_USER || "false";
const isAutoLike = process.env.AUTO_LIKE || "true";
const enableRssFetch = process.env.ENABLE_RSS_FETCH === "true"; // 是否开启抓取RSS，只有显式设置为 "true" 才开启
const enableTopicDataFetch = process.env.ENABLE_TOPIC_DATA_FETCH === "true"; // 是否开启抓取话题数据，只有显式设置为 "true" 才开启

console.log(
  `RSS抓取功能状态: ${enableRssFetch ? "开启" : "关闭"} (ENABLE_RSS_FETCH=${
    process.env.ENABLE_RSS_FETCH
  })`
);
console.log(
  `话题数据抓取功能状态: ${
    enableTopicDataFetch ? "开启" : "关闭"
  } (ENABLE_TOPIC_DATA_FETCH=${process.env.ENABLE_TOPIC_DATA_FETCH})`
);

// 代理配置
const proxyConfig = getProxyConfig();
if (proxyConfig) {
  console.log(
    `代理配置: ${proxyConfig.type}://${proxyConfig.host}:${proxyConfig.port}`
  );

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

let bot;
if (token && (chatId || groupId)) {
  bot = new TelegramBot(token);
}
function sendToTelegram(message) {
  if (!bot || !chatId) return;

  bot
    .sendMessage(chatId, message)
    .then(() => {
      console.log("Telegram message sent successfully");
    })
    .catch((error) => {
      console.error(
        "Error sending Telegram message:",
        error && error.code ? error.code : "",
        error && error.message
          ? error.message.slice(0, 100)
          : String(error).slice(0, 100)
      );
    });
}
function sendToTelegramGroup(message) {
  if (!bot || !groupId) {
    console.error("sendToTelegramGroup: bot 或 groupId 不存在");
    return;
  }
  // 过滤空内容，避免 Telegram 400 错误
  if (!message || !String(message).trim()) {
    console.warn("Telegram 群组推送内容为空，跳过发送");
    return;
  }
  // 分割长消息，Telegram单条最大4096字符
  const MAX_LEN = 4000;
  if (typeof message === "string" && message.length > MAX_LEN) {
    let start = 0;
    let part = 1;
    while (start < message.length) {
      const chunk = message.slice(start, start + MAX_LEN);
      bot
        .sendMessage(groupId, chunk)
        .then(() => {
          console.log(`Telegram group message part ${part} sent successfully`);
        })
        .catch((error) => {
          console.error(
            `Error sending Telegram group message part ${part}:`,
            error
          );
        });
      start += MAX_LEN;
      part++;
    }
  } else {
    bot
      .sendMessage(groupId, message)
      .then(() => {
        console.log("Telegram group message sent successfully");
      })
      .catch((error) => {
        console.error("Error sending Telegram group message:", error);
      });
  }
}

//随机等待时间
function delayClick(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

(async () => {
  try {
    if (usernames.length !== passwords.length) {
      console.log(usernames.length, passwords.length);
      throw new Error("用户名和密码的数量不匹配！");
    }

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
      console.log(`当前批次：${i + 1} - ${i + maxConcurrentAccounts}`);
      // 执行每批次最多 4 个账号
      const batch = loginTasks
        .slice(i, i + maxConcurrentAccounts)
        .map(async (task) => {
          const { browser } = await task(); // 运行任务并获取浏览器实例
          return browser;
        }); // 等待当前批次的任务完成
      const browsers = await Promise.all(batch); // Task里面的任务本身是没有进行await的, 所以会继续执行下面的代码

      // 如果还有下一个批次，等待指定的时间,同时，如果总共只有一个账号，也需要继续运行
      if (i + maxConcurrentAccounts < totalAccounts || i === 0) {
        console.log(`等待 ${delayBetweenBatches / 1000} 秒`);
        await new Promise((resolve) =>
          setTimeout(resolve, delayBetweenBatches)
        );
      } else {
        console.log("没有下一个批次，即将结束");
      }
      console.log(
        `批次 ${
          Math.floor(i / maxConcurrentAccounts) + 1
        } 完成，关闭浏览器...,浏览器对象：${browsers}`
      );
      // 关闭所有浏览器实例
      for (const browser of browsers) {
        await browser.close();
      }
    }

    console.log("所有账号登录操作已完成");
    // 等待所有登录操作完成
    // await Promise.all(loginTasks);
  } catch (error) {
    // 错误处理逻辑
    console.error("发生错误：", error);
    if (token && chatId) {
      sendToTelegram(`${error.message}`);
    }
  }
})();
async function launchBrowserForUser(username, password) {
  let browser = null; // 在 try 之外声明 browser 变量
  try {
    console.log("当前用户:", username);
    const browserOptions = {
      headless: "auto",
      args: ["--no-sandbox", "--disable-setuid-sandbox"], // Linux 需要的安全设置
    };

    // 添加代理配置到浏览器选项
    const proxyConfig = getProxyConfig();
    if (proxyConfig) {
      const proxyArgs = getPuppeteerProxyArgs(proxyConfig);
      browserOptions.args.push(...proxyArgs);
      console.log(
        `为用户 ${username} 启用代理: ${proxyConfig.type}://${proxyConfig.host}:${proxyConfig.port}`
      );

      // 如果有用户名密码，puppeteer-real-browser会自动处理
      if (proxyConfig.username && proxyConfig.password) {
        browserOptions.proxy = {
          host: proxyConfig.host,
          port: proxyConfig.port,
          username: proxyConfig.username,
          password: proxyConfig.password,
        };
      }
    }

    var { connect } = await import("puppeteer-real-browser");
    const { page, browser: newBrowser } = await connect(browserOptions);
    browser = newBrowser; // 将 browser 初始化
    // 启动截图功能
    // takeScreenshots(page);
    //登录操作
    await navigatePage(loginUrl, page, browser);
    await delayClick(8000);
    // 设置额外的 headers
    await page.setExtraHTTPHeaders({
      "accept-language": "en-US,en;q=0.9",
    });
    // 验证 `navigator.webdriver` 属性是否为 undefined
    // const isWebDriverUndefined = await page.evaluate(() => {
    //   return `${navigator.webdriver}`;
    // });

    // console.log("navigator.webdriver is :", isWebDriverUndefined); // 输出应为 false
    page.on("pageerror", (error) => {
      console.error(`Page error: ${error.message}`);
    });
    page.on("error", async (error) => {
      // console.error(`Error: ${error.message}`);
      // 检查是否是 localStorage 的访问权限错误
      if (
        error.message.includes(
          "Failed to read the 'localStorage' property from 'Window'"
        )
      ) {
        console.log("Trying to refresh the page to resolve the issue...");
        await page.reload(); // 刷新页面
        // 重新尝试你的操作...
      }
    });
    page.on("console", async (msg) => {
      // console.log("PAGE LOG:", msg.text());
      // 使用一个标志变量来检测是否已经刷新过页面
      if (
        !page._isReloaded &&
        msg.text().includes("the server responded with a status of 429")
      ) {
        // 设置标志变量为 true，表示即将刷新页面
        page._isReloaded = true;
        //由于油候脚本它这个时候可能会导航到新的网页,会导致直接执行代码报错,所以使用这个来在每个新网页加载之前来执行
        await page.evaluateOnNewDocument(() => {
          localStorage.setItem("autoLikeEnabled", "false");
        });
        // 等待一段时间，比如 3 秒
        await new Promise((resolve) => setTimeout(resolve, 3000));
        console.log("Retrying now...");
        // 尝试刷新页面
        // await page.reload();
      }
    });
    // //登录操作
    console.log("登录操作");
    await login(page, username, password);
    // 查找具有类名 "avatar" 的 img 元素验证登录是否成功
    const avatarImg = await page.$("img.avatar");

    if (avatarImg) {
      console.log("找到avatarImg，登录成功");
    } else {
      console.log("未找到avatarImg，登录失败");
      throw new Error("登录失败");
    }

    //真正执行阅读脚本
    let externalScriptPath;
    if (isLikeSpecificUser === "true") {
      const randomChoice = Math.random() < 0.5; // 生成一个随机数，50% 概率为 true
      if (randomChoice) {
        externalScriptPath = path.join(
          dirname(fileURLToPath(import.meta.url)),
          "index_likeUser_activity.js"
        );
        console.log("使用index_likeUser_activity");
      } else {
        externalScriptPath = path.join(
          dirname(fileURLToPath(import.meta.url)),
          "index_likeUser.js"
        );
        console.log("使用index_likeUser");
      }
    } else {
      externalScriptPath = path.join(
        dirname(fileURLToPath(import.meta.url)),
        "index.js"
      );
    }
    const externalScript = fs.readFileSync(externalScriptPath, "utf8");

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
    // 添加一个监听器来监听每次页面加载完成的事件
    page.on("load", async () => {
      // await page.evaluate(externalScript); //因为这个是在页面加载好之后执行的,而脚本是在页面加载好时刻来判断是否要执行，由于已经加载好了，脚本就不会起作用
    });
    // 如果是Linuxdo，就导航到我的帖子，但我感觉这里写没什么用，因为外部脚本已经定义好了，不对，这里不会点击按钮，所以不会跳转，需要手动跳转
    if (loginUrl == "https://linux.do") {
      await page.goto("https://linux.do/t/topic/13716/790", {
        waitUntil: "domcontentloaded",
      });
    } else if (loginUrl == "https://meta.appinn.net") {
      await page.goto("https://meta.appinn.net/t/topic/52006", {
        waitUntil: "domcontentloaded",
      });
    } else {
      await page.goto(`${loginUrl}/t/topic/1`, {
        waitUntil: "domcontentloaded",
      });
    }
    if (token && chatId) {
      sendToTelegram(`${username} 登录成功`);
    } // 监听页面跳转到新话题，自动推送RSS example：https://linux.do/t/topic/525305.rss
    // 记录已推送过的 topicId，防止重复推送
    if (enableRssFetch || enableTopicDataFetch) {
      const pushedTopicIds = new Set();
      const processedTopicIds = new Set(); // 用于话题数据处理的记录
      page.on("framenavigated", async (frame) => {
        if (frame.parentFrame() !== null) return;
        const url = frame.url();
        const match = url.match(/https:\/\/linux\.do\/t\/topic\/(\d+)/);
        if (match) {
          const topicId = match[1];

          // RSS抓取处理
          if (enableRssFetch && !pushedTopicIds.has(topicId)) {
            pushedTopicIds.add(topicId);
            const rssUrl = `https://linux.do/t/topic/${topicId}.rss`;
            console.log("检测到话题跳转，抓取RSS：", rssUrl);
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
            } catch (e) {
              console.error("抓取或发送RSS失败：", e, "可能是非公开话题");
            }
          }

          // 话题数据抓取处理
          if (enableTopicDataFetch && !processedTopicIds.has(topicId)) {
            processedTopicIds.add(topicId);
            console.log("检测到话题跳转，抓取话题数据：", url);
            try {
              // 停顿1秒再处理话题数据
              await new Promise((r) => setTimeout(r, 1000));
              await processAndSaveTopicData(page, url);
            } catch (e) {
              console.error("抓取或保存话题数据失败：", e);
            }
          }
        }
        // 停顿0.5秒后允许下次抓取
        await new Promise((r) => setTimeout(r, 500));
      });
    }
    return { browser };
  } catch (err) {
    // throw new Error(err);
    console.log("Error in launchBrowserForUser:", err);
    if (token && chatId) {
      sendToTelegram(`${err.message}`);
    }
    return { browser }; // 错误时仍然返回 browser
  }
}
async function login(page, username, password, retryCount = 3) {
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
    if (loginUrl == "https://meta.appinn.net") {
      await page.goto("https://meta.appinn.net/t/topic/52006", {
        waitUntil: "domcontentloaded",
      });
      await page.click(".discourse-reactions-reaction-button");
    } else {
      await page.goto(`${loginUrl}/t/topic/1`, {
        waitUntil: "domcontentloaded",
      });
      try {
        await page.click(".discourse-reactions-reaction-button");
      } catch (error) {
        console.log("没有找到点赞按钮，可能是页面没有加载完成或按钮不存在");
      }
    }
  }
  // 等待用户名输入框加载
  await page.waitForSelector("#login-account-name");
  // 模拟人类在找到输入框后的短暂停顿
  await delayClick(1000); // 延迟500毫秒
  // 清空输入框并输入用户名
  await page.click("#login-account-name", { clickCount: 3 });
  await page.type("#login-account-name", username, {
    delay: 100,
  }); // 输入时在每个按键之间添加额外的延迟
  await delayClick(1000);
  // 等待密码输入框加载
  // await page.waitForSelector("#login-account-password");
  // 模拟人类在输入用户名后的短暂停顿
  // delayClick; // 清空输入框并输入密码
  await page.click("#login-account-password", { clickCount: 3 });
  await page.type("#login-account-password", password, {
    delay: 100,
  });

  // 模拟人类在输入完成后思考的短暂停顿
  await delayClick(1000);

  // 假设登录按钮的ID是'login-button'，点击登录按钮
  await page.waitForSelector("#login-button");
  await delayClick(1000); // 模拟在点击登录按钮前的短暂停顿
  await page.click("#login-button");
  try {
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded" }), // 等待 页面跳转 DOMContentLoaded 事件
      // 去掉上面一行会报错：Error: Execution context was destroyed, most likely because of a navigation. 可能是因为之后没等页面加载完成就执行了脚本
      page.click("#login-button", { force: true }), // 点击登录按钮触发跳转
    ]); //注意如果登录失败，这里会一直等待跳转，导致脚本执行失败 这点四个月之前你就发现了结果今天又遇到（有个用户遇到了https://linux.do/t/topic/169209/82），但是你没有在这个报错你提示我8.5
  } catch (error) {
    const alertError = await page.$(".alert.alert-error");
    if (alertError) {
      const alertText = await page.evaluate((el) => el.innerText, alertError); // 使用 evaluate 获取 innerText
      if (
        alertText.includes("incorrect") ||
        alertText.includes("Incorrect ") ||
        alertText.includes("不正确")
      ) {
        throw new Error(
          `非超时错误，请检查用户名密码是否正确，失败用户 ${username}, 错误信息：${alertText}`
        );
      } else {
        throw new Error(
          `非超时错误，也不是密码错误，可能是IP导致，需使用中国美国香港台湾IP，失败用户 ${username}，错误信息：${alertText}`
        );
      }
    } else {
      if (retryCount > 0) {
        console.log("Retrying login...");
        await page.reload({ waitUntil: "domcontentloaded" });
        await delayClick(2000); // 增加重试前的延迟
        return await login(page, username, password, retryCount - 1);
      } else {
        throw new Error(
          `Navigation timed out in login.超时了,可能是IP质量问题,失败用户 ${username}, 
      ${error}`
        ); //{password}
      }
    }
  }
  await delayClick(1000);
}

async function navigatePage(url, page, browser) {
  await page.goto(url, { waitUntil: "domcontentloaded" }); //如果使用默认的load,linux下页面会一直加载导致无法继续执行

  const startTime = Date.now(); // 记录开始时间
  let pageTitle = await page.title(); // 获取当前页面标题

  while (pageTitle.includes("Just a moment") || pageTitle.includes("请稍候")) {
    console.log("The page is under Cloudflare protection. Waiting...");

    await delayClick(2000); // 每次检查间隔2秒

    // 重新获取页面标题
    pageTitle = await page.title();

    // 检查是否超过15秒
    if (Date.now() - startTime > 35000) {
      console.log("Timeout exceeded, aborting actions.");
      sendToTelegram(`超时了,无法通过Cloudflare验证`);
      await browser.close();
      return; // 超时则退出函数
    }
  }
  console.log("页面标题：", pageTitle);
}

// 每秒截图功能
async function takeScreenshots(page) {
  let screenshotIndex = 0;
  setInterval(async () => {
    screenshotIndex++;
    const screenshotPath = path.join(
      screenshotDir,
      `screenshot-${screenshotIndex}.png`
    );
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Screenshot saved: ${screenshotPath}`);
    } catch (error) {
      console.error("Error taking screenshot:", error);
    }
  }, 1000);
  // 注册退出时删除文件夹的回调函数
  process.on("exit", () => {
    try {
      fs.rmdirSync(screenshotDir, { recursive: true });
      console.log(`Deleted folder: ${screenshotDir}`);
    } catch (error) {
      console.error(`Error deleting folder ${screenshotDir}:`, error);
    }
  });
}
import express from "express";

const healthApp = express();
const HEALTH_PORT = process.env.HEALTH_PORT || 7860;

// 健康探针路由
healthApp.get("/health", (req, res) => {
  const memoryUsage = process.memoryUsage();

  // 将字节转换为MB
  const memoryUsageMB = {
    rss: `${(memoryUsage.rss / (1024 * 1024)).toFixed(2)} MB`, // 转换为MB并保留两位小数
    heapTotal: `${(memoryUsage.heapTotal / (1024 * 1024)).toFixed(2)} MB`,
    heapUsed: `${(memoryUsage.heapUsed / (1024 * 1024)).toFixed(2)} MB`,
    external: `${(memoryUsage.external / (1024 * 1024)).toFixed(2)} MB`,
    arrayBuffers: `${(memoryUsage.arrayBuffers / (1024 * 1024)).toFixed(2)} MB`,
  };

  const healthData = {
    status: "OK",
    timestamp: new Date().toISOString(),
    memoryUsage: memoryUsageMB,
    uptime: process.uptime().toFixed(2), // 保留两位小数
  };

  res.status(200).json(healthData);
});
healthApp.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Auto Read</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            color: #333;
            margin: 0;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
          }
          .container {
            background-color: #fff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 15px rgba(0, 0, 0, 0.1);
            max-width: 600px;
            text-align: center;
          }
          h1 {
            color: #007bff;
          }
          p {
            font-size: 18px;
            margin: 15px 0;
          }
          a {
            color: #007bff;
            text-decoration: none;
            font-weight: bold;
          }
          a:hover {
            text-decoration: underline;
          }
          footer {
            margin-top: 20px;
            font-size: 14px;
            color: #555;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Welcome to the Auto Read App</h1>
          <p>You can check the server's health at <a href="/health">/health</a>.</p>
          <p>GitHub: <a href="https://github.com/14790897/auto-read-liunxdo" target="_blank">https://github.com/14790897/auto-read-liunxdo</a></p>
          <footer>&copy; 2024 Auto Read App</footer>
        </div>
      </body>
    </html>
  `);
});
healthApp.listen(HEALTH_PORT, () => {
  console.log(
    `Health check endpoint is running at http://localhost:${HEALTH_PORT}/health`
  );
});
