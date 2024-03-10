// ==UserScript==
// @name         Auto Read
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  自动刷linuxdo文章
// @author       liuweiqing
// @match        https://linux.do/*
// @grant        none
// ==/UserScript==

(function () {
  ("use strict");
  //1.进入网页 https://linux.do/t/topic/数字（1，2，3，4）
  //2.使滚轮均衡的往下移动模拟刷文章
  let scrolling = true; // 开始时就自动滚动
  const delay = 2000; // 滚动检查的间隔（毫秒）
  let scrollInterval = null;
  let checkScrollTimeout = null;

  function scrollToBottomSlowly(stopDistance = 9999999999) {
    const distancePerStep = 20;
    const delayPerStep = 20;
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
      } else {
        window.scrollBy(0, distancePerStep);
      }
    }, delayPerStep);
  }
  // 功能：跳转到下一个话题

  function navigateToNextTopic() {
    const nextTopicURL = `https://linux.do/top?period=all`;
    // 在跳转之前，标记即将跳转到下一个话题
    localStorage.setItem("navigatingToNextTopic", "true");
    // 尝试导航到下一个话题
    window.location.href = nextTopicURL;
  }

  // 检查是否已滚动到底部
  function checkScroll() {
    if (
      window.innerHeight + window.scrollY >=
      document.body.offsetHeight - 100
    ) {
      console.log("已滚动到底部");
      navigateToNextTopic();
    } else if (scrolling) {
      scrollToBottomSlowly();
      if (checkScrollTimeout !== null) {
        clearTimeout(checkScrollTimeout);
      }
      checkScrollTimeout = setTimeout(checkScroll, delay);
    }
  }
  // 入口函数
  // 检查是否正在导航到下一个话题
  window.addEventListener("load", () => {
    if (localStorage.getItem("navigatingToNextTopic") === "true") {
      console.log("正在导航到下一个话题");
      // 等待一段时间或直到页面完全加载
      // 页面加载完成后，移除标记
      localStorage.removeItem("navigatingToNextTopic");
      //先随机滚动一段距离然后再查找链接
      scrollToBottomSlowly(Math.random() * 2000);
      // 在新页面加载后执行检查
      // 使用CSS属性选择器寻找href属性符合特定格式的<a>标签
      const links = document.querySelectorAll('a[href^="/t/topic/"]');
      // 如果找到了这样的链接
      if (links.length > 0) {
        // 从所有匹配的链接中随机选择一个
        const randomIndex = Math.floor(Math.random() * links.length);
        const link = links[randomIndex];
        // 打印找到的链接（可选）
        console.log("Found link:", link.href);
        // // 模拟点击该链接
        // setTimeout(() => {
        //   link.click();
        // }, delay);
        // 导航到该链接
        window.location.href = link.href;
      } else {
        // 如果没有找到符合条件的链接，打印消息（可选）
        console.log("No link with the specified format was found.");
      }
    } else {
      console.log("执行正常的滚动和检查逻辑");
      // 执行正常的滚动和检查逻辑
      checkScroll();
    }
  });
  // 创建一个控制滚动的按钮

  const button = document.createElement("button");
  button.textContent = "停止阅读";
  button.style.position = "fixed";
  button.style.top = "10px";
  button.style.right = "10px";
  button.style.zIndex = 1000;
  document.body.appendChild(button);

  button.onclick = function () {
    scrolling = !scrolling;
    button.textContent = scrolling ? "停止阅读" : "开始阅读";
    if (!scrolling) {
      if (scrollInterval !== null) {
        clearInterval(scrollInterval);
        scrollInterval = null;
      }
      if (checkScrollTimeout !== null) {
        clearTimeout(checkScrollTimeout);
        checkScrollTimeout = null;
      }
    } else {
      checkScroll();
    }
  };
})();
