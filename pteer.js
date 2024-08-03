import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

puppeteer.use(StealthPlugin());

// Load the default .env file
dotenv.config();
if (fs.existsSync(".env.local")) {
  console.log("Using .env.local file to supply config environment variables");
  const envConfig = dotenv.parse(fs.readFileSync(".env.local"));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}
// 从环境变量解析用户名和密码
const usernames = process.env.USERNAMES.split(",");
const passwords = process.env.PASSWORDS.split(",");
const loginUrl = process.env.WEBSITE;
// 每个浏览器实例之间的延迟时间(毫秒)
const delayBetweenInstances = 10000;
//随机等待时间
function delayClick(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

(async () => {
  try {
    if (usernames.length !== passwords.length) {
      console.log(usernames.length, usernames, passwords.length, passwords);
      console.log("用户名和密码的数量不匹配！");
      return;
    }

    // 并发启动浏览器实例进行登录
    const loginPromises = usernames.map((username, index) => {
      const password = passwords[index];
      const delay = index * delayBetweenInstances;
      return new Promise((resolve, reject) => {
        //其实直接使用await就可以了
        setTimeout(() => {
          launchBrowserForUser(username, password).then(resolve).catch(reject);
        }, delay);
      });
    });

    // 等待所有登录操作完成
    await Promise.all(loginPromises);
  } catch (error) {
    // 错误处理逻辑
    console.error("发生错误：", error);
  }
})();
async function launchBrowserForUser(username, password) {
  try {
    const browser = await puppeteer.launch({
      headless: process.env.ENVIRONMENT !== "dev", // 当ENVIRONMENT不是'dev'时启用无头模式
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-infobars",
        "--window-position=0,0",
        "--ignore-certifcate-errors",
        "--ignore-certifcate-errors-spki-list",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
        "--allow-running-insecure-content",
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--mute-audio",
        "--no-zygote",
        "--no-xshm",
        "--window-size=1920,1080",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--enable-webgl",
        "--ignore-certificate-errors",
        "--lang=en-US,en;q=0.9",
        "--password-store=basic",
        "--disable-gpu-sandbox",
        "--disable-software-rasterizer",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--disable-infobars",
        "--disable-breakpad",
        "--disable-canvas-aa",
        "--disable-2d-canvas-clip-aa",
        "--disable-gl-drawing-for-tests",
        "--enable-low-end-device-mode",
      ], //linux需要
      defaultViewport: {
        width: 1280,
        height: 800,
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36",
      },
    });
    const page = await browser.newPage();
    // 设置额外的 headers
    await page.setExtraHTTPHeaders({
      "accept-language": "en-US,en;q=0.9",
    });

    // 调用封装的反检测函数
    await bypassDetection(page);
    // 验证 `navigator.webdriver` 属性是否为 undefined
    const isWebDriverUndefined = await page.evaluate(() => {
      return `${navigator.webdriver}`;
    });

    console.log("navigator.webdriver is :", isWebDriverUndefined); // 输出应为 true
    page.on("pageerror", (error) => {
      console.error(`Page error: ${error.message}`);
    });
    page.on("error", async (error) => {
      console.error(`Error: ${error.message}`);
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
      console.log("PAGE LOG:", msg.text());
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
        await page.reload();
      }
    });

    //登录操作
    await page.goto(loginUrl, { waitUntil: "networkidle0" });
    console.log("登录操作");
    // 使用XPath查询找到包含"登录"或"login"文本的按钮
    await page.evaluate(() => {
      let loginButton = Array.from(document.querySelectorAll("button")).find(
        (button) =>
          button.textContent.includes("登录") ||
          button.textContent.includes("login")
      );
      // 如果没有找到，尝试根据类名查找
      if (!loginButton) {
        loginButton = document.querySelector(
          ".widget-button.btn.btn-primary.btn-small.login-button.btn-icon-text"
        );
      }
      console.log(loginButton);
      if (loginButton) {
        loginButton.click();
        console.log("Login button clicked.");
      } else {
        console.log("Login button not found.");
      }
    });

    await login(page, username, password);
    // 查找具有类名 "avatar" 的 img 元素验证登录是否成功
    const avatarImg = await page.$("img.avatar");

    if (avatarImg) {
      console.log("找到avatarImg，登录成功");
      // 可以继续对 avatarImg 进行操作，比如获取其属性等
    } else {
      console.log("未找到avatarImg，登录失败");
    }

    //真正执行阅读脚本
    // 读取外部脚本文件的内容
    const externalScriptPath = path.join(
      dirname(fileURLToPath(import.meta.url)),
      "external.js"
    );
    const externalScript = fs.readFileSync(externalScriptPath, "utf8");

    // 在每个新的文档加载时执行外部脚本
    await page.evaluateOnNewDocument((...args) => {
      const [scriptToEval] = args;
      eval(scriptToEval);
    }, externalScript);
    // 添加一个监听器来监听每次页面加载完成的事件
    page.on("load", async () => {
      // await page.evaluate(externalScript); //因为这个是在页面加载好之后执行的,而脚本是在页面加载好时刻来判断是否要执行，由于已经加载好了，脚本就不会起作用
    });
    await page.goto("https://linux.do/t/topic/13716/190");
  } catch (err) {
    console.log(err);
  }
}
async function login(page, username, password) {
  // 等待用户名输入框加载
  await page.waitForSelector("#login-account-name");
  // 模拟人类在找到输入框后的短暂停顿
  await delayClick(500); // 延迟500毫秒
  // 清空输入框并输入用户名
  await page.click("#login-account-name", { clickCount: 3 });
  await page.type("#login-account-name", username, {
    delay: 100,
  }); // 输入时在每个按键之间添加额外的延迟

  // 等待密码输入框加载
  await page.waitForSelector("#login-account-password");
  // 模拟人类在输入用户名后的短暂停顿
  await delayClick(500);
  // 清空输入框并输入密码
  await page.click("#login-account-password", { clickCount: 3 });
  await page.type("#login-account-password", password, {
    delay: 100,
  });

  // 模拟人类在输入完成后思考的短暂停顿
  await delayClick(1000);

  // 假设登录按钮的ID是'login-button'，点击登录按钮
  await page.waitForSelector("#login-button");
  await delayClick(500); // 模拟在点击登录按钮前的短暂停顿
  try {
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded" }), // 等待 页面跳转 DOMContentLoaded 事件
      page.click("#login-button"), // 点击登录按钮触发跳转
    ]); //注意如果登录失败，这里会一直等待跳转，导致脚本执行失败
  } catch (error) {
    console.error("Navigation timed out in login.:", error);
    throw new Error("Navigation timed out in login.");
  }
  await delayClick(1000);
}

async function bypassDetection(page) {
  // 在页面上下文中执行脚本，修改 `navigator.webdriver` 以及其他反检测属性
  await page.evaluateOnNewDocument(() => {
    // Overwrite the `navigator.webdriver` property to return `undefined`.
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });

    // Pass the Chrome Test.
    window.chrome = {
      runtime: {},
      // Add more if needed
    };

    // Pass the Permissions Test.
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
      parameters.name === "notifications"
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters);

    // Pass the Plugins Length Test.
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5], // Make plugins array non-empty
    });

    // Pass the Languages Test.
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });
  });
}
