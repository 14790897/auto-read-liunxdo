// ==UserScript==
// @name         Auto Like Specific User
// @namespace    http://tampermonkey.net/
// @version      1.1.2
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
// @run-at       document-end
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
  const currentURL = window.location.href;
  let specificUser = localStorage.getItem("specificUser") || "14790897";
  let likeLimit = parseInt(localStorage.getItem("likeLimit") || 200, 10);
  let BASE_URL = possibleBaseURLs.find((url) => currentURL.startsWith(url));

  // 环境变量：阅读网址，如果没有找到匹配的URL，则默认为第一个
  if (!BASE_URL) {
    BASE_URL = possibleBaseURLs[0];
    console.log("当前BASE_URL设置为（默认）: " + BASE_URL);
  } else {
    console.log("当前BASE_URL是: " + BASE_URL);
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
  // 检查是否超过12小时（12小时 = 12 * 60 * 60 * 1000 毫秒）
  if (currentTime - storedTime > 12 * 60 * 60 * 1000) {
    // 超过24小时，清空点击计数器并更新时间戳
    clickCounter = 0;
    localStorage.setItem("clickCounter", "0");
    localStorage.setItem("clickCounterTimestamp", currentTime.toString());
  }

  console.log(`Initial clickCounter: ${clickCounter}`);
  // 入口函数
  window.addEventListener("load", () => {
    console.log("autoRead", localStorage.getItem("read"));
    checkFirstRun();
    if (localStorage.getItem("read") === "true") {
      console.log("点赞开始");
      setTimeout(() => {
        likeSpecificPost();
      }, 2000);
      setTimeout(() => {
        openSpecificUserPost();
      }, 4000);
    }
  });
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
    console.log("执行了初始数据更新操作");
  }

  function getLatestTopic() {
    let lastOffset = Number(localStorage.getItem("lastOffset")) || 0;
    let specificUserPostList = [];
    let isDataSufficient = false;

    while (!isDataSufficient) {
      //   lastOffset += 20;
      lastOffset += 1; //对于page来说
      // 举例：https://linux.do/user_actions.json?offset=0&username=14790897&filter=5
      //   const url = `${BASE_URL}/user_actions.json?offset=${lastOffset}&username=${specificUser}&filter=5`;
      //举例：https://linux.do/search?q=%4014790897%20in%3Aunseen
      const url = `${BASE_URL}/search?q=%40${specificUser}%20in%3Aunseen`; //&page=${lastOffset}
      $.ajax({
        url: url,
        async: false,
        headers: {
          Accept: "application/json",
        },
        success: function (result) {
          //   if (result && result.user_actions && result.user_actions.length > 0) {
          // result.user_actions.forEach((action) => {
          if (result && result.posts && result.posts.length > 0) {
            result.posts.forEach((action) => {
              const topicId = action.topic_id;
              //   const postId = action.post_id;
              const postNumber = action.post_number;
              specificUserPostList.push({
                topic_id: topicId,
                // post_id: postId,
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

      window.location.href = `${BASE_URL}/t/topic/${post.topic_id}/${post.post_number}`;
    } else {
      console.error("未能获取到新的帖子数据。");
    }
  }

  // 检查是否点赞
  // const postId = data.post_id;

  // const targetId = `discourse-reactions-counter-${postId}-right`;

  // const element = document.getElementById(targetId);
  function likeSpecificPost() {
    const urlParts = window.location.pathname.split("/");
    const lastPart = urlParts[urlParts.length - 1]; // 获取最后一部分
    let buttons, reactionButton;
    console.log("post number:", lastPart);
    if (lastPart < 10000) {
      buttons = document.querySelectorAll(
        "button[aria-label]" //[class*='reply']
      );

      let targetButton = null;
      buttons.forEach((button) => {
        const ariaLabel = button.getAttribute("aria-label");
        if (ariaLabel && ariaLabel.includes(`#${lastPart}`)) {
          targetButton = button;
          console.log("找到post number按钮:", targetButton);
          return;
        }
      });

      if (targetButton) {
        // 找到按钮后，获取其父级元素
        const parentElement = targetButton.parentElement;
        console.log("父级元素:", parentElement);
        reactionButton = parentElement.querySelector(
          ".discourse-reactions-reaction-button"
        );
      } else {
        console.log(`未找到包含 #${lastPart} 的按钮`);
      }
    } else {
      //大于10000说明是主题帖，选择第一个
      reactionButton = document.querySelectorAll(
        ".discourse-reactions-reaction-button"
      )[0];
    }
    if (
      reactionButton.title !== "点赞此帖子" &&
      reactionButton.title !== "Like this post"
    ) {
      console.log("已经点赞过");
      return "already liked";
    } else if (clickCounter >= likeLimit) {
      console.log("已经达到点赞上限");
      localStorage.setItem("read", false);
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
      localStorage.setItem("read", false);
    } else {
      console.log("clickCounter:", clickCounter);
    }
  }

  function triggerClick(button) {
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
    });
    button.dispatchEvent(event);
  }

  const button = document.createElement("button");
  button.textContent =
    localStorage.getItem("read") === "true" ? "停止阅读" : "开始阅读";
  button.style.position = "fixed";
  button.style.bottom = "20px";
  button.style.left = "20px";
  button.style.zIndex = 1000;
  button.style.backgroundColor = "#e0e0e0";
  button.style.color = "#333";
  button.style.border = "1px solid #aaa";
  button.style.padding = "8px 16px";
  button.style.borderRadius = "8px";
  document.body.appendChild(button);

  button.onclick = function () {
    const currentlyReading = localStorage.getItem("read") === "true";
    const newReadState = !currentlyReading;
    localStorage.setItem("read", newReadState.toString());
    button.textContent = newReadState ? "停止阅读" : "开始阅读";
    if (newReadState) {
      if (BASE_URL == "https://linux.do") {
        const maxPostNumber = 600;
        const randomPostNumber = Math.floor(Math.random() * maxPostNumber) + 1;
        const newUrl = `https://linux.do/t/topic/13716/${randomPostNumber}`;
        window.location.href = newUrl;
      } else {
        window.location.href = `${BASE_URL}/t/topic/1`;
      }
    }
  };

  const userInput = document.createElement("input");
  userInput.type = "text";
  userInput.placeholder = "输入要点赞的用户ID";
  userInput.style.position = "fixed";
  userInput.style.bottom = "90px";
  userInput.style.left = "20px";
  userInput.style.zIndex = "1000";
  userInput.style.padding = "6px";
  userInput.style.border = "1px solid #aaa";
  userInput.style.borderRadius = "8px";
  userInput.style.backgroundColor = "#e0e0e0";
  userInput.style.width = "100px";
  userInput.value = localStorage.getItem("specificUser") || "14790897";

  document.body.appendChild(userInput);

  const saveUserButton = document.createElement("button");
  saveUserButton.textContent = "保存用户ID";
  saveUserButton.style.position = "fixed";
  saveUserButton.style.bottom = "60px";
  saveUserButton.style.left = "20px";
  saveUserButton.style.zIndex = "1000";
  saveUserButton.style.backgroundColor = "#e0e0e0";
  saveUserButton.style.color = "#333";
  saveUserButton.style.border = "1px solid #aaa";
  saveUserButton.style.padding = "8px 16px";
  saveUserButton.style.borderRadius = "8px";
  document.body.appendChild(saveUserButton);

  saveUserButton.onclick = function () {
    const newSpecificUser = userInput.value.trim();
    if (newSpecificUser) {
      localStorage.setItem("specificUser", newSpecificUser);
      localStorage.removeItem("specificUserPostList");
      localStorage.removeItem("lastOffset");
      specificUser = newSpecificUser;
      console.log(
        `新的specificUser已保存: ${specificUser}，specificUserPostList已重置`
      );
    }
  };

  const likeLimitInput = document.createElement("input");
  likeLimitInput.type = "number";
  likeLimitInput.placeholder = "输入点赞数量";
  likeLimitInput.style.position = "fixed";
  likeLimitInput.style.bottom = "180px";
  likeLimitInput.style.left = "20px";
  likeLimitInput.style.zIndex = "1000";
  likeLimitInput.style.padding = "6px";
  likeLimitInput.style.border = "1px solid #aaa";
  likeLimitInput.style.borderRadius = "8px";
  likeLimitInput.style.backgroundColor = "#e0e0e0";
  likeLimitInput.style.width = "100px";
  likeLimitInput.value = localStorage.getItem("likeLimit") || 200;
  document.body.appendChild(likeLimitInput);

  const saveLikeLimitButton = document.createElement("button");
  saveLikeLimitButton.textContent = "保存点赞数量";
  saveLikeLimitButton.style.position = "fixed";
  saveLikeLimitButton.style.bottom = "140px";
  saveLikeLimitButton.style.left = "20px";
  saveLikeLimitButton.style.zIndex = "1000";
  saveLikeLimitButton.style.backgroundColor = "#e0e0e0";
  saveLikeLimitButton.style.color = "#333";
  saveLikeLimitButton.style.border = "1px solid #aaa";
  saveLikeLimitButton.style.padding = "8px 16px";
  saveLikeLimitButton.style.borderRadius = "8px";
  document.body.appendChild(saveLikeLimitButton);

  saveLikeLimitButton.onclick = function () {
    const newLikeLimit = parseInt(likeLimitInput.value.trim(), 10);
    if (newLikeLimit && newLikeLimit > 0) {
      localStorage.setItem("likeLimit", newLikeLimit);
      likeLimit = newLikeLimit;
      console.log(`新的likeLimit已保存: ${likeLimit}`);
    }
  };

  // 增加清除数据的按钮
  const clearDataButton = document.createElement("button");
  clearDataButton.textContent = "清除所有数据";
  clearDataButton.style.position = "fixed";
  clearDataButton.style.bottom = "20px";
  clearDataButton.style.left = "140px";
  clearDataButton.style.zIndex = "1000";
  clearDataButton.style.backgroundColor = "#ff6666"; // 红色背景，提示删除操作
  clearDataButton.style.color = "#fff"; // 白色文本
  clearDataButton.style.border = "1px solid #ff3333"; // 深红色边框
  clearDataButton.style.padding = "8px 16px";
  clearDataButton.style.borderRadius = "8px";
  document.body.appendChild(clearDataButton);

  clearDataButton.onclick = function () {
    localStorage.removeItem("lastOffset");
    localStorage.removeItem("clickCounter");
    localStorage.removeItem("clickCounterTimestamp");
    localStorage.removeItem("specificUserPostList");
    console.log("所有数据已清除，除了 specificUser 和 specificUserPostList");
  };
})();
