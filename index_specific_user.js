// ==UserScript==
// @name         Auto Read
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  自动点赞特定用户，适用于discourse
// @author       liuweiqing
// @match        https://meta.discourse.org/*
// @match        https://linux.do/*
// @match        https://meta.appinn.net/*
// @match        https://community.openai.com/
// @grant        none
// @license      MIT
// @icon         https://www.google.com/s2/favicons?domain=linux.do
// @downloadURL https://update.greasyfork.org/scripts/489464/Auto%20Read.user.js
// @updateURL https://update.greasyfork.org/scripts/489464/Auto%20Read.meta.js
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
  const commentLimit = 1000;
  const specificUserPostListLimit = 100;
  const likeLimit = 50;
  const currentURL = window.location.href;
  let specificUser = localStorage.getItem("specificUser") || "14790897";
  let BASE_URL = possibleBaseURLs.find((url) => currentURL.startsWith(url));

  // 环境变量：阅读网址，如果没有找到匹配的URL，则默认为第一个
  if (!BASE_URL) {
    BASE_URL = possibleBaseURLs[0];
    console.log("默认BASE_URL设置为: " + BASE_URL);
  } else {
    console.log("当前BASE_URL是: " + BASE_URL);
  }

  console.log("脚本正在运行在: " + BASE_URL);

  function checkFirstRun() {
    if (localStorage.getItem("isFirstRun") === null) {
      console.log("脚本第一次运行，执行初始化操作...");
      updateInitialData();
      localStorage.setItem("isFirstRun", "false");
    } else {
      console.log("脚本非第一次运行");
    }
  }

  function updateInitialData() {
    localStorage.setItem("read", "false"); // 开始时自动滚动关闭
    localStorage.setItem("autoLikeEnabled", "false"); //默认关闭自动点赞
    console.log("执行了初始数据更新操作");
  }
  let scrollInterval = null;
  let checkScrollTimeout = null;

  function getLatestTopic() {
    let lastOffset = Number(localStorage.getItem("lastOffset")) || 0;
    let specificUserPostList = [];
    let isDataSufficient = false;

    while (!isDataSufficient) {
      lastOffset += 20;
      const url = `${BASE_URL}/user_actions.json?offset=${lastOffset}&username=${specificUser}&filter=5`;

      $.ajax({
        url: url,
        async: false,
        success: function (result) {
          if (result && result.user_actions && result.user_actions.length > 0) {
            result.user_actions.forEach((action) => {
              const topicId = action.topic_id;
              const postId = action.post_id;
              const postNumber = action.post_number;
              specificUserPostList.push({
                topic_id: topicId,
                post_id: postId,
                post_number: postNumber,
              });
            });

            // 检查是否已获得足够的 Posts
            if (specificUserPostList.length >= specificUserPostListLimit) {
              isDataSufficient = true;
            }
          } else {
            isDataSufficient = true; // 没有更多内容时停止请求
          }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
          console.error(XMLHttpRequest, textStatus, errorThrown);
          isDataSufficient = true; // 遇到错误时也停止请求
        },
      });
    }

    // 如果列表超出限制，则截断
    if (specificUserPostList.length > specificUserPostListLimit) {
      specificUserPostList = specificUserPostList.slice(
        0,
        specificUserPostListLimit
      );
    }

    // 存储 lastOffset 和 specificUserPostList 到 localStorage
    localStorage.setItem("lastOffset", lastOffset);
    localStorage.setItem(
      "specificUserPostList",
      JSON.stringify(specificUserPostList)
    );
  }

  function openSpecificUserPost() {
    let specificUserPostListStr = localStorage.getItem("specificUserPostList");
    let specificUserPostList = specificUserPostListStr
      ? JSON.parse(specificUserPostListStr)
      : [];

    // 如果列表为空，则获取最新文章
    if (specificUserPostList.length === 0) {
      getLatestTopic();
      specificUserPostListStr = localStorage.getItem("specificUserPostList");
      specificUserPostList = specificUserPostListStr
        ? JSON.parse(specificUserPostListStr)
        : [];
    }

    // 如果获取到新文章，打开第一个
    if (specificUserPostList.length > 0) {
      const post = specificUserPostList.shift(); // 获取列表中的第一个对象
      localStorage.setItem(
        "specificUserPostList",
        JSON.stringify(specificUserPostList)
      );

      // 使用 post_id 生成 URL 并导航
      window.location.href = `${BASE_URL}/t/topic/${post.topic_id}/${post.post_number}`;
    }
  }

  // 检查是否点赞
  // const postId = data.post_id;

  // const targetId = `discourse-reactions-counter-${postId}-right`;

  // const element = document.getElementById(targetId);
  function likeSpecificPost() {
    const urlParts = window.location.pathname.split("/");
    const lastPart = urlParts[urlParts.length - 1]; // 获取最后一部分

    const buttons = document.querySelectorAll("button[aria-label]");

    let targetButton = null;
    buttons.forEach((button) => {
      const ariaLabel = button.getAttribute("aria-label");
      if (ariaLabel && ariaLabel.includes(`#${lastPart}`)) {
        targetButton = button;
      }
    });

    if (targetButton) {
      // 找到按钮后，获取其父级元素
      const parentElement = targetButton.parentElement;
      console.log("父级元素:", parentElement);
      const reactionButton = parentElement.querySelector(
        ".discourse-reactions-reaction-button"
      );

      if (
        (reactionButton.title !== "点赞此帖子" &&
          reactionButton.title !== "Like this post") ||
        clickCounter >= likeLimit
      ) {
        return;
      }
      triggerClick(reactionButton);
      clickCounter++;
      console.log(
        `Clicked like button ${clickCounter},已点赞用户${specificUser}`
      );
      localStorage.setItem("clickCounter", clickCounter.toString());
      // 如果点击次数达到likeLimit次，则设置点赞变量为false
      if (clickCounter === likeLimit) {
        console.log(
          `Reached ${likeLimit} likes, setting the like variable to false.`
        );
        localStorage.setItem("autoLikeEnabled", "false");
      } else {
        console.log("clickCounter:", clickCounter);
      }
    } else {
      console.log(`未找到包含 #${lastPart} 的按钮`);
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
      console.log("点赞开始");
      openSpecificUserPost();
      likeSpecificPost();
    }
  });

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
      if (BASE_URL == "https://linux.do") {
        window.location.href = "https://linux.do/t/topic/13716/427";
      } else {
        window.location.href = `${BASE_URL}/t/topic/1`;
      }
    }
  };

  // 增加specificUser输入框和保存按钮
  const userInput = document.createElement("input");
  userInput.type = "text";
  userInput.placeholder = "输入要点赞的用户ID";
  userInput.style.position = "fixed";
  userInput.style.bottom = "90px";
  userInput.style.left = "10px";
  userInput.style.zIndex = "1000";
  userInput.style.padding = "5px";
  userInput.style.border = "1px solid #ddd";
  userInput.style.borderRadius = "5px";
  userInput.style.backgroundColor = "#f0f0f0";
  document.body.appendChild(userInput);

  const saveUserButton = document.createElement("button");
  saveUserButton.textContent = "保存用户ID";
  saveUserButton.style.position = "fixed";
  saveUserButton.style.bottom = "50px";
  saveUserButton.style.left = "150px";
  saveUserButton.style.zIndex = "1000";
  saveUserButton.style.backgroundColor = "#f0f0f0";
  saveUserButton.style.color = "#000";
  saveUserButton.style.border = "1px solid #ddd";
  saveUserButton.style.padding = "5px 10px";
  saveUserButton.style.borderRadius = "5px";
  document.body.appendChild(saveUserButton);

  saveUserButton.onclick = function () {
    const newSpecificUser = userInput.value.trim();
    if (newSpecificUser) {
      localStorage.setItem("specificUser", newSpecificUser);
      specificUser = newSpecificUser;
      console.log(`新的specificUser已保存: ${specificUser}`);
    }
  };
})();
