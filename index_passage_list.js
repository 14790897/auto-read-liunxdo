// ==UserScript==
// @name         Auto Read
// @namespace    http://tampermonkey.net/
// @version      0.4
// @description  自动刷linuxdo文章
// @author       liuweiqing
// @match        https://linux.do/*
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
  ("use strict");
  //1.进入网页 https://linux.do/t/topic/数字（1，2，3，4）
  //2.使滚轮均衡的往下移动模拟刷文章
  localStorage.setItem("read", "true"); // 开始时就自动滚动
  const delay = 2000; // 滚动检查的间隔（毫秒）
  let scrollInterval = null;
  let checkScrollTimeout = null;

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
    // 定义包含三个文章列表的数组
    const urls = [
      "https://linux.do/latest",
      "https://linux.do/top?period=all",
      "https://linux.do/unread",
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
    if (localStorage.getItem("read") === "true") {
      // 检查是否正在导航到下一个话题
      if (localStorage.getItem("navigatingToNextTopic") === "true") {
        console.log("正在导航到下一个话题");
        // 等待一段时间或直到页面完全加载
        // 页面加载完成后，移除标记
        localStorage.removeItem("navigatingToNextTopic");
        //先随机滚动一段距离然后再查找链接
        scrollToBottomSlowly(
          Math.random() * document.body.offsetHeight * 3,
          searchLinkClick,
          20,
          20
        );
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
    const links = document.querySelectorAll('a[href^="/t/topic/"]');
    const alreadyReadLinks = JSON.parse(
      localStorage.getItem("alreadyReadLinks") || "[]"
    ); // 获取已阅读链接列表

    // 筛选出未阅读的链接
    const unreadLinks = Array.from(links).filter(
      (link) => !alreadyReadLinks.includes(link.href)
    );

    // 如果找到了这样的链接
    if (unreadLinks.length > 0) {
      // 从所有匹配的链接中随机选择一个
      const randomIndex = Math.floor(Math.random() * unreadLinks.length);
      const link = unreadLinks[randomIndex];
      // 打印找到的链接（可选）
      console.log("Found link:", link.href);
      // // 模拟点击该链接
      // setTimeout(() => {
      //   link.click();
      // }, delay);
      // 将链接添加到已阅读列表并更新localStorage
      alreadyReadLinks.push(link.href);
      localStorage.setItem(
        "alreadyReadLinks",
        JSON.stringify(alreadyReadLinks)
      );

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
  function autoLike() {
    // 寻找所有的discourse-reactions-reaction-button
    const buttons = document.querySelectorAll(
      ".discourse-reactions-reaction-button"
    );

    // 逐个点击找到的按钮
    buttons.forEach((button, index) => {
      // 使用setTimeout来错开每次点击的时间，避免同时触发点击
      setTimeout(() => {
        // 模拟点击
        button.click();
        console.log(`Clicked button ${index + 1}`);
      }, index * 1000); // 这里的1000毫秒是两次点击之间的间隔，可以根据需要调整
    });
  }
  const button = document.createElement("button");
  button.textContent = "停止阅读";
  button.style.position = "fixed";
  button.style.top = "10px";
  button.style.right = "10px";
  button.style.zIndex = 1000;
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
      window.location.href = "https://linux.do/t/topic/13716/40";
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
  toggleAutoLikeButton.style.top = "50px"; // 与停止阅读按钮错开位置
  toggleAutoLikeButton.style.right = "10px";
  toggleAutoLikeButton.style.zIndex = "1000";
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

  // 在页面加载时检查是否启用自动点赞，并执行相应的操作
  window.addEventListener("load", () => {
    if (localStorage.getItem("read") === "true") {
      // 根据设置决定是否执行自动点赞
      if (isAutoLikeEnabled()) {
        autoLike();
      }

      // 其余的加载逻辑...
    }
  });
})();
