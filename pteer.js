const fs = require("fs");

const path = require("path");
const puppeteer = require("puppeteer");
require("dotenv").config();

(async () => {
  //随机等待时间
  function delayClick(time) {
    return new Promise(function (resolve) {
      setTimeout(resolve, time);
    });
  }
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  page.on("pageerror", (error) => {
    console.error(`Page error: ${error.message}`);
  });
  page.on("error", (error) => {
    console.error(`Error: ${error.message}`);
  });
  //登录操作
  await page.goto("https://linux.do", { timeout: 60000 });
  // 使用XPath查询找到包含"登录"或"login"文本的按钮
  await page.evaluate(() => {
    const loginButton = Array.from(document.querySelectorAll("button")).find(
      (button) =>
        button.textContent.includes("登录") ||
        button.textContent.includes("login")
    );

    if (loginButton) {
      loginButton.click();
    } else {
      console.log("Login button not found.");
    }
  });

  // 等待用户名输入框加载
  await page.waitForSelector("#login-account-name", { timeout: 60000 });
  // 模拟人类在找到输入框后的短暂停顿
  await delayClick(500); // 延迟500毫秒
  // 清空输入框并输入用户名
  await page.click("#login-account-name", { clickCount: 3 });
  await page.type("#login-account-name", process.env.USERNAMELINUXDO, {
    delay: 100,
  }); // 输入时在每个按键之间添加额外的延迟

  // 等待密码输入框加载
  await page.waitForSelector("#login-account-password", { timeout: 60000 });
  // 模拟人类在输入用户名后的短暂停顿
  await delayClick(500);
  // 清空输入框并输入密码
  await page.click("#login-account-password", { clickCount: 3 });
  await page.type("#login-account-password", process.env.PASSWORDLINUXDO, {
    delay: 100,
  });

  // 模拟人类在输入完成后思考的短暂停顿
  await delayClick(1000);

  // 假设登录按钮的ID是'login-button'，点击登录按钮
  await page.waitForSelector("#login-button");
  await delayClick(500); // 模拟在点击登录按钮前的短暂停顿
  await Promise.all([
    page.waitForNavigation(), // 等待页面跳转
    page.click("#login-button"), // 点击登录按钮触发跳转
  ]);
  await delayClick(1000);

  //真正执行阅读脚本
  // 读取外部脚本文件的内容
  const externalScriptPath = path.join(__dirname, "external.js");
  const externalScript = fs.readFileSync(externalScriptPath, "utf8");

  // 在每个新的文档加载时执行外部脚本
  await page.evaluateOnNewDocument((...args) => {
    const [scriptToEval] = args;
    eval(scriptToEval);
  }, externalScript);

  // 添加一个监听器来监听每次页面加载完成的事件
  // page.on("load", async () => {
  //   await page.evaluate(externalScript);
  // });
  await page.goto("https://linux.do/t/topic/13716/100");
})();
