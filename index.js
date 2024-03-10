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

  function scrollToBottomSlowly() {
    const distancePerStep = 10;
    const delayPerStep = 20;
    if (scrollInterval !== null) {
      clearInterval(scrollInterval);
    }
    scrollInterval = setInterval(() => {
      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 100
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
    const currentURL = window.location.href;
    const topicNumber = parseInt(currentURL.match(/\/t\/topic\/(\d+)/)[1]);
    const nextTopicNumber = topicNumber + 1;
    const nextTopicURL = `https://linux.do/t/topic/${nextTopicNumber}`;
    // 尝试导航到下一个话题
    window.location.href = nextTopicURL;
    // 在新页面加载后执行检查
    window.addEventListener("load", () => {
      // 假设页面上有一个元素（比如一个具有特定ID或类的元素），只有在帖子不存在时才会出现
      // 或者检查页面上显示帖子不存在的特定文本
      const postNotExists = document.querySelector(".not-found-topic") !== null;
      const postNotFoundMessage = document.body.textContent.includes(
        "That page is private"
      );

      if (postNotExists || postNotFoundMessage) {
        console.log("帖子不存在，停止导航");
        // 这里可以添加逻辑来处理不存在的帖子，比如回退到上一个存在的帖子或停止自动导航
        // 寻找类名为 'not-found-topic' 的元素
        // 获取页面上所有类名为 'not-found-topic' 的元素
        const topics = document.querySelectorAll(".not-found-topic");

        // 检查是否找到了这样的元素
        if (topics.length > 0) {
          // 选择最后一个 'not-found-topic' 元素
          const lastTopic = topics[topics.length - 1];

          // 在最后一个元素内部，寻找 <a> 标签
          const link = lastTopic.querySelector("a");

          if (link && link.href) {
            // 如果找到了链接，并且这个链接有 href 属性，则打开这个链接
            // 在当前窗口打开链接
            window.location.href = link.href;

            // 如果你想在新标签页中打开链接，请使用下面的代码（注意，这可能会被浏览器的弹窗拦截器阻止）
            // window.open(link.href, '_blank');
          }
        }
      }
    });
  }

  // 检查是否已滚动到底部
  function checkScroll() {
    if (
      window.innerHeight + window.scrollY >=
      document.body.offsetHeight - 100
    ) {
      navigateToNextTopic();
    } else if (scrolling) {
      scrollToBottomSlowly();
      if (checkScrollTimeout !== null) {
        clearTimeout(checkScrollTimeout);
      }
      checkScrollTimeout = setTimeout(checkScroll, delay);
    }
  }
  // 初始化滚动检查

  setTimeout(checkScroll, delay);
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
