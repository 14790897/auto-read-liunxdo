const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // 定义包含文章列表的数组
  const urls = [
    "https://linux.do/latest",
    "https://linux.do/top",
    "https://linux.do/latest?ascending=false&order=posts",
    // "https://linux.do/unread",
  ];

  // 生成一个随机索引
  const randomIndex = Math.floor(Math.random() * urls.length);

  // 根据随机索引选择一个URL
  const initialURL = urls[randomIndex];

  await page.goto(initialURL);

  // 检查是否是第一次运行脚本
  async function checkFirstRun() {
    const isFirstRun = await page.evaluate(() => {
      if (localStorage.getItem("isFirstRun") === null) {
        localStorage.setItem("isFirstRun", "false");
        return true;
      }
      return false;
    });

    if (isFirstRun) {
      console.log("脚本第一次运行，执行初始化操作...");
      await updateInitialData();
    } else {
      console.log("脚本非第一次运行");
    }
  }

  // 更新初始数据的函数
  async function updateInitialData() {
    await page.evaluate(() => {
      localStorage.setItem("read", "false");
      localStorage.setItem("autoLikeEnabled", "false");
    });
    console.log("执行了初始数据更新操作");
  }

  const delay = 2000; // 滚动检查的间隔（毫秒）
  let scrollInterval = null;
  let checkScrollTimeout = null;

  async function scrollToBottomSlowly(
    stopDistance = 9999999999,
    callback = undefined,
    distancePerStep = 20,
    delayPerStep = 50
  ) {
    await page.evaluate(
      (stopDistance, distancePerStep, delayPerStep) => {
        if (scrollInterval !== null) {
          clearInterval(scrollInterval);
        }
        scrollInterval = setInterval(() => {
          if (
            window.innerHeight + window.scrollY >=
              document.body.offsetHeight - 100 ||
            window.innerHeight + window.scrollY >= stopDistance
          ) {
            clearInterval(scrollInterval);
            scrollInterval = null;
            if (typeof callback === "function") {
              callback();
            }
          } else {
            window.scrollBy(0, distancePerStep);
          }
        }, delayPerStep);
      },
      stopDistance,
      distancePerStep,
      delayPerStep
    );
  }

  // 功能：跳转到下一个话题
  async function navigateToNextTopic() {
    // 生成一个随机索引
    const randomIndex = Math.floor(Math.random() * urls.length);

    // 根据随机索引选择一个URL
    const nextTopicURL = urls[randomIndex];

    // 在跳转之前，标记即将跳转到下一个话题
    await page.evaluate(() => {
      localStorage.setItem("navigatingToNextTopic", "true");
    });

    // 尝试导航到下一个话题
    await page.goto(nextTopicURL);
  }

  // 检查是否已滚动到底部(不断重复执行)
  async function checkScroll() {
    const isRead = await page.evaluate(() => localStorage.getItem("read"));
    if (isRead) {
      const isBottom = await page.evaluate(
        () =>
          window.innerHeight + window.scrollY >=
          document.body.offsetHeight - 100
      );
      if (isBottom) {
        console.log("已滚动到底部");
        await navigateToNextTopic();
      } else {
        await scrollToBottomSlowly();
        if (checkScrollTimeout !== null) {
          clearTimeout(checkScrollTimeout);
        }
        checkScrollTimeout = setTimeout(checkScroll, delay);
      }
    }
  }

  // 入口函数
  await checkFirstRun();
  console.log("locals");
  const isRead = await page.evaluate(
    () => localStorage.getItem("read") === "true"
  );
  if (isRead) {
    // 检查是否正在导航到下一个话题
    const isNavigatingToNextTopic = await page.evaluate(
      () => localStorage.getItem("navigatingToNextTopic") === "true"
    );
    if (isNavigatingToNextTopic) {
      console.log("正在导航到下一个话题");
      // 等待一段时间或直到页面完全加载
      await page.waitForTimeout(2000);
      // 页面加载完成后，移除标记
      await page.evaluate(() => {
        localStorage.removeItem("navigatingToNextTopic");
      });
      // 先随机滚动一段距离然后再查找链接
      await scrollToBottomSlowly(
        Math.random() * 9999999999,
        searchLinkClick,
        20,
        20
      );
    } else {
      console.log("执行正常的滚动和检查逻辑");
      // 执行正常的滚动和检查逻辑
      await checkScroll();
      const isAutoLikeEnabled = await page.evaluate(
        () => localStorage.getItem("autoLikeEnabled") !== "false"
      );
      if (isAutoLikeEnabled) {
        await autoLike();
      }
    }
  }

  async function searchLinkClick() {
    const link = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href^="/t/topic/"]');
      const unreadLinks = Array.from(links).filter((link) => {
        let parent = link.parentElement;
        let times = 0;
        while (parent && times < 3) {
          if (parent.classList.contains("visited")) {
            return false;
          }
          parent = parent.parentElement;
          times++;
        }
        return true;
      });

      if (unreadLinks.length > 0) {
        const randomIndex = Math.floor(Math.random() * unreadLinks.length);
        return unreadLinks[randomIndex].href;
      }
      return null;
    });

    if (link) {
      console.log("Found link:", link);
      await page.goto(link);
    } else {
      console.log("No link with the specified format was found.");
      await scrollToBottomSlowly(Math.random() * 9999999999, searchLinkClick);
    }
  }

  async function autoLike() {
    await page.$$eval(".discourse-reactions-reaction-button", (buttons) => {
      buttons.forEach((button, index) => {
        if (button.title !== "点赞此帖子") {
          return;
        }
        setTimeout(() => {
          button.click();
          console.log(`Clicked button ${index + 1}`);
        }, index * 1000);
      });
    });
  }

  // 创建一个控制滚动的按钮
  await page.evaluate(() => {
    const button = document.createElement("button");
    button.textContent =
      localStorage.getItem("read") === "true" ? "停止阅读" : "开始阅读";
    button.style.position = "fixed";
    button.style.bottom = "10px";
    button.style.left = "10px";
    button.style.zIndex = 1000;
    button.style.backgroundColor = "#f0f0f0";
    button.style.color = "#000";
    button.style.border = "1px solid #ddd";
    button.style.padding = "5px 10px";
    button.style.borderRadius = "5px";
    document.body.appendChild(button);

    button.onclick = function () {
      const currentlyReading = localStorage.getItem("read") === "true";
      const newReadState = !currentlyReading;
      localStorage.setItem("read", newReadState.toString());
      button.textContent = newReadState ? "停止阅读" : "开始阅读";
      if (!newReadState) {
        if (scrollInterval !== null) {
          clearInterval(scrollInterval);
          scrollInterval = null;
        }
        if (checkScrollTimeout !== null) {
          clearTimeout(checkScrollTimeout);
          checkScrollTimeout = null;
        }
        localStorage.removeItem("navigatingToNextTopic");
      } else {
        window.location.href = "https://linux.do/t/topic/13716/100";
        checkScroll();
      }
    };
  });

  // 创建一个控制自动点赞的按钮
  await page.evaluate(() => {
    const toggleAutoLikeButton = document.createElement("button");
    toggleAutoLikeButton.textContent =
      localStorage.getItem("autoLikeEnabled") !== "false"
        ? "禁用自动点赞"
        : "启用自动点赞";
    toggleAutoLikeButton.style.position = "fixed";
    toggleAutoLikeButton.style.bottom = "50px";
    toggleAutoLikeButton.style.left = "10px";
    toggleAutoLikeButton.style.zIndex = "1000";
    toggleAutoLikeButton.style.backgroundColor = "#f0f0f0";
    toggleAutoLikeButton.style.color = "#000";
    toggleAutoLikeButton.style.border = "1px solid #ddd";
    toggleAutoLikeButton.style.padding = "5px 10px";
    toggleAutoLikeButton.style.borderRadius = "5px";
    document.body.appendChild(toggleAutoLikeButton);

    toggleAutoLikeButton.addEventListener("click", () => {
      const isEnabled = localStorage.getItem("autoLikeEnabled") === "false";
      localStorage.setItem("autoLikeEnabled", isEnabled ? "true" : "false");
      toggleAutoLikeButton.textContent = isEnabled
        ? "禁用自动点赞"
        : "启用自动点赞";
    });
  });

  // 保持浏览器打开
  await page.waitForTimeout(9999999999);
  await browser.close();
})();
