import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
// 截图保存的文件夹
const screenshotDir = "screenshots";
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir);
}
puppeteer.use(StealthPlugin());

// Load the default .env file
dotenv.config();
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
    // await Promise.all(loginPromises);
  } catch (error) {
    // 错误处理逻辑
    console.error("发生错误：", error);
  }
})();
async function launchBrowserForUser(username, password) {
  try {
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
    // }

    var { connect } = await import("puppeteer-real-browser");
    const { page, browser } = await connect(browserOptions);
    // 设置导航超时时间为60秒
    page.setDefaultNavigationTimeout(60000);
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
    }

    //真正执行阅读脚本
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
    // 如果是Linuxdo，就导航到我的帖子，但我感觉这里写没什么用，因为外部脚本已经定义好了
    if (loginUrl == "https://linux.do") {
      await page.goto("https://linux.do/t/topic/13716/340", {
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
  } catch (err) {
    console.log(err);
  }
}
async function login(page, username, password) {
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
      await page.click(".discourse-reactions-reaction-button");
    }
  }
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
  delayClick; // 清空输入框并输入密码
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
      // 去掉上面一行会报错：Error: Execution context was destroyed, most likely because of a navigation. 可能是因为之后没等页面加载完成就执行了脚本
      page.click("#login-button"), // 点击登录按钮触发跳转
    ]); //注意如果登录失败，这里会一直等待跳转，导致脚本执行失败 这点四个月之前你就发现了结果今天又遇到（有个用户遇到了https://linux.do/t/topic/169209/82），但是你没有在这个报错你提示我8.5
  } catch (error) {
    console.error(
      "Navigation timed out in login.请检查用户名密码是否正确(注意密码中是否有特殊字符,需要外面加上双引号指明这是字符串，如果密码里面有双引号则需要转义), 此外GitHub action不需要加上引号:",
      error
    );
    throw new Error("Navigation timed out in login.");
  }
  await delayClick(1000);
}

async function navigatePage(url, page, browser) {
  await page.goto(url, { waitUntil: "domcontentloaded" }); //如果使用默认的load,linux下页面会一直加载导致无法继续执行

  const startTime = Date.now(); // 记录开始时间
  let pageTitle = await page.title(); // 获取当前页面标题

  while (pageTitle.includes("Just a moment")) {
    console.log("The page is under Cloudflare protection. Waiting...");

    await delayClick(2000); // 每次检查间隔2秒

    // 重新获取页面标题
    pageTitle = await page.title();

    // 检查是否超过15秒
    if (Date.now() - startTime > 35000) {
      console.log("Timeout exceeded, aborting actions.");
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
