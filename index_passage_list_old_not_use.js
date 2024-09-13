// ==UserScript==
// @name         Auto Read
// @namespace    http://tampermonkey.net/
// @version      1.3.2
// @description  自动刷linuxdo文章
// @author       liuweiqing
// @match        https://meta.discourse.org/*
// @match        https://linux.do/*
// @match        https://meta.appinn.net/*
// @match        https://community.openai.com/
// @grant        none
// @license      MIT
// @icon         https://www.google.com/s2/favicons?domain=linux.do
// ==/UserScript==

(function () {
  ("use strict");
  // 定义可能的基本URL
  const possibleBaseURLs = [
    "https://meta.discourse.org",
    "https://linux.do",
    "https://meta.appinn.net",
    "https://community.openai.com",
  ];

  // 获取当前页面的URL
  const currentURL = window.location.href;

  // 确定当前页面对应的BASE_URL
  let BASE_URL = possibleBaseURLs.find((url) => currentURL.startsWith(url));

  // 环境变量：阅读网址，如果没有找到匹配的URL，则默认为第一个
  if (!BASE_URL) {
    BASE_URL = possibleBaseURLs[0];
    console.log("默认BASE_URL设置为: " + BASE_URL);
  } else {
    console.log("当前BASE_URL是: " + BASE_URL);
  }

  // 以下是脚本的其余部分
  console.log("脚本正在运行在: " + BASE_URL);
  //1.进入网页 https://linux.do/t/topic/数字（1，2，3，4）
  //2.使滚轮均衡的往下移动模拟刷文章
  // 检查是否是第一次运行脚本
  function checkFirstRun() {
    if (localStorage.getItem("isFirstRun") === null) {
      // 是第一次运行，执行初始化操作
      console.log("脚本第一次运行，执行初始化操作...");
      updateInitialData();

      // 设置 isFirstRun 标记为 false
      localStorage.setItem("isFirstRun", "false");
    } else {
      // 非第一次运行
      console.log("脚本非第一次运行");
    }
  }

  // 更新初始数据的函数
  function updateInitialData() {
    localStorage.setItem("read", "false"); // 开始时自动滚动关闭
    localStorage.setItem("autoLikeEnabled", "false"); //默认关闭自动点赞
    console.log("执行了初始数据更新操作");
  }
  const delay = 2000; // 滚动检查的间隔（毫秒）
  let scrollInterval = null;
  let checkScrollTimeout = null;
  let autoLikeInterval = null;
//在主页去寻找可以进入的话题，同时可以在文章页进行浏览
  function scrollToBottomSlowly(
    stopDistance = 9999999999,
    callback = undefined,
    distancePerStep = 20,
    delayPerStep = 50
  ) {
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
          callback(); // 当滚动结束时调用回调函数
        }
      } else {
        window.scrollBy(0, distancePerStep);
      }
    }, delayPerStep);
  }
  // 功能：跳转到下一个话题

  function navigateToNextTopic() {
    // 定义包含文章列表的数组
    const urls = [
      `${BASE_URL}/latest`,
      `${BASE_URL}/top`,
      `${BASE_URL}/latest?ascending=false&order=posts`,
      // `${BASE_URL}/unread`, // 示例：如果你想将这个URL启用，只需去掉前面的注释
    ];

    // 生成一个随机索引
    const randomIndex = Math.floor(Math.random() * urls.length);

    // 根据随机索引选择一个URL
    const nextTopicURL = urls[randomIndex]; // 在跳转之前，标记即将跳转到下一个话题
    localStorage.setItem("navigatingToNextTopic", "true");
    // 尝试导航到下一个话题
    window.location.href = nextTopicURL;
  }

  // 检查是否已滚动到底部(不断重复执行)
  function checkScroll() {
    if (localStorage.getItem("read")) {
      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 100
      ) {
        console.log("已滚动到底部");
        navigateToNextTopic();
      } else {
        scrollToBottomSlowly();
        if (checkScrollTimeout !== null) {
          clearTimeout(checkScrollTimeout);
        }
        checkScrollTimeout = setTimeout(checkScroll, delay);
      }
    }
  }

  // 入口函数
  window.addEventListener("load", () => {
    checkFirstRun();
    console.log(
      "autoRead",
      localStorage.getItem("read"),
      "autoLikeEnabled",
      localStorage.getItem("autoLikeEnabled")
    );
    if (localStorage.getItem("read") === "true") {
      // 检查是否正在导航到下一个话题
      if (localStorage.getItem("navigatingToNextTopic") === "true") {
        console.log("正在导航到下一个话题");
        // 等待一段时间或直到页面完全加载
        // 页面加载完成后，移除标记
        localStorage.removeItem("navigatingToNextTopic");
        // 使用setTimeout延迟执行
        setTimeout(() => {
          // 先随机滚动一段距离然后再查找链接
          scrollToBottomSlowly(
            Math.random() * document.body.offsetHeight * 3,
            searchLinkClick,
            20,
            20
          );
        }, 2000); // 延迟2000毫秒（即2秒）
      } else {
        console.log("执行正常的滚动和检查逻辑");
        // 执行正常的滚动和检查逻辑
        checkScroll();
        if (isAutoLikeEnabled()) {
          //自动点赞
          autoLike();
        }
      }
    }
  });
  // 创建一个控制滚动的按钮
  function searchLinkClick() {
    // 在新页面加载后执行检查
    // 使用CSS属性选择器寻找href属性符合特定格式的<a>标签
    const links = document.querySelectorAll('a[href^="/t/"]');

    // 筛选出未阅读的链接
    const unreadLinks = Array.from(links).filter((link) => {
      // 向上遍历DOM树，查找包含'visited'类的父级元素，最多查找三次
      let parent = link.parentElement;
      let times = 0; // 查找次数计数器
      while (parent && times < 3) {
        if (parent.classList.contains("visited")) {
          // 如果找到包含'visited'类的父级元素，中断循环
          return false; // 父级元素包含'visited'类，排除这个链接
        }
        parent = parent.parentElement; // 继续向上查找
        times++; // 增加查找次数
      }

      // 如果链接未被读过，且在向上查找三次内，其父级元素中没有包含'visited'类，则保留这个链接
      return true;
    });

    // 如果找到了这样的链接
    if (unreadLinks.length > 0) {
      // 从所有匹配的链接中随机选择一个
      const randomIndex = Math.floor(Math.random() * unreadLinks.length);
      const link = unreadLinks[randomIndex];
      // 打印找到的链接（可选）
      console.log("Found link:", link.href);
      // 导航到该链接
      window.location.href = link.href;
    } else {
      // 如果没有找到符合条件的链接，打印消息（可选）
      console.log("No link with the specified format was found.");
      scrollToBottomSlowly(
        Math.random() * document.body.offsetHeight * 3,
        searchLinkClick
      );
    }
  }
  // 获取当前时间戳
  const currentTime = Date.now();
  // 获取存储的时间戳
  const defaultTimestamp = new Date("1999-01-01T00:00:00Z").getTime(); //默认值为1999年
  const storedTime = parseInt(
    localStorage.getItem("clickCounterTimestamp") ||
      defaultTimestamp.toString(),
    10
  );

  // 获取当前的点击计数，如果不存在则初始化为0
  let clickCounter = parseInt(localStorage.getItem("clickCounter") || "0", 10);
  // 检查是否超过24小时（24小时 = 24 * 60 * 60 * 1000 毫秒）
  if (currentTime - storedTime > 24 * 60 * 60 * 1000) {
    // 超过24小时，清空点击计数器并更新时间戳
    clickCounter = 0;
    localStorage.setItem("clickCounter", "0");
    localStorage.setItem("clickCounterTimestamp", currentTime.toString());
  }

  console.log(`Initial clickCounter: ${clickCounter}`);
  function triggerClick(button) {
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
    });
    button.dispatchEvent(event);
  }

  function autoLike() {
    console.log(`Initial clickCounter: ${clickCounter}`);
    // 寻找所有的discourse-reactions-reaction-button
    const buttons = document.querySelectorAll(
      ".discourse-reactions-reaction-button"
    );
    if (buttons.length === 0) {
      console.error(
        "No buttons found with the selector '.discourse-reactions-reaction-button'"
      );
      return;
    }
    console.log(`Found ${buttons.length} buttons.`); // 调试信息

    // 逐个点击找到的按钮
    buttons.forEach((button, index) => {
      if (
        (button.title !== "点赞此帖子" && button.title !== "Like this post") ||
        clickCounter >= 50
      ) {
        return;
      }

      // 使用setTimeout来错开每次点击的时间，避免同时触发点击
      autoLikeInterval = setTimeout(() => {
        // 模拟点击
        triggerClick(button); // 使用自定义的触发点击方法
        console.log(`Clicked like button ${index + 1}`);
        clickCounter++; // 更新点击计数器
        // 将新的点击计数存储到localStorage
        localStorage.setItem("clickCounter", clickCounter.toString());
        // 如果点击次数达到50次，则设置点赞变量为false
        if (clickCounter === 50) {
          console.log("Reached 50 likes, setting the like variable to false.");
          localStorage.setItem("autoLikeEnabled", "false"); // 使用localStorage存储点赞变量状态
        } else {
          console.log("clickCounter:", clickCounter);
        }
      }, index * 3000); // 这里的3000毫秒是两次点击之间的间隔，可以根据需要调整
    });
  }
  const button = document.createElement("button");
  // 初始化按钮文本基于当前的阅读状态
  button.textContent =
    localStorage.getItem("read") === "true" ? "停止阅读" : "开始阅读";
  button.style.position = "fixed";
  button.style.bottom = "10px"; // 之前是 top
  button.style.left = "10px"; // 之前是 right
  button.style.zIndex = 1000;
  button.style.backgroundColor = "#f0f0f0"; // 浅灰色背景
  button.style.color = "#000"; // 黑色文本
  button.style.border = "1px solid #ddd"; // 浅灰色边框
  button.style.padding = "5px 10px"; // 内边距
  button.style.borderRadius = "5px"; // 圆角
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
      // 如果是Linuxdo，就导航到我的帖子
      if (BASE_URL == "https://linux.do") {
        window.location.href = "https://linux.do/t/topic/13716/340";
      } else if (BASE_URL == "https://meta.appinn.net") {
        window.location.href = "https://meta.appinn.net/t/topic/52006";
      } else {
        window.location.href = `${BASE_URL}/t/topic/1`;
      }
      checkScroll();
    }
  };

  //自动点赞按钮
  // 在页面上添加一个控制自动点赞的按钮
  const toggleAutoLikeButton = document.createElement("button");
  toggleAutoLikeButton.textContent = isAutoLikeEnabled()
    ? "禁用自动点赞"
    : "启用自动点赞";
  toggleAutoLikeButton.style.position = "fixed";
  toggleAutoLikeButton.style.bottom = "50px"; // 之前是 top，且与另一个按钮错开位置
  toggleAutoLikeButton.style.left = "10px"; // 之前是 right
  toggleAutoLikeButton.style.zIndex = "1000";
  toggleAutoLikeButton.style.backgroundColor = "#f0f0f0"; // 浅灰色背景
  toggleAutoLikeButton.style.color = "#000"; // 黑色文本
  toggleAutoLikeButton.style.border = "1px solid #ddd"; // 浅灰色边框
  toggleAutoLikeButton.style.padding = "5px 10px"; // 内边距
  toggleAutoLikeButton.style.borderRadius = "5px"; // 圆角
  document.body.appendChild(toggleAutoLikeButton);

  // 为按钮添加点击事件处理函数
  toggleAutoLikeButton.addEventListener("click", () => {
    const isEnabled = !isAutoLikeEnabled();
    setAutoLikeEnabled(isEnabled);
    toggleAutoLikeButton.textContent = isEnabled
      ? "禁用自动点赞"
      : "启用自动点赞";
  });
  // 判断是否启用自动点赞
  function isAutoLikeEnabled() {
    // 从localStorage获取autoLikeEnabled的值，如果未设置，默认为"true"
    return localStorage.getItem("autoLikeEnabled") !== "false";
  }

  // 设置自动点赞的启用状态
  function setAutoLikeEnabled(enabled) {
    localStorage.setItem("autoLikeEnabled", enabled ? "true" : "false");
  }
})();
