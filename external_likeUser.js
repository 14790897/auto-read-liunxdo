// ==UserScript==
// @name         Auto Like Specific User
// @namespace    http://tampermonkey.net/
// @version      1.1
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
    localStorage.setItem("read", "true"); // 开始时自动滚动关闭
    console.log("执行了初始数据更新操作");
  }

  function getLatestTopic() {
    let lastOffset = Number(localStorage.getItem("lastOffset")) || 0;
    let specificUserPostList = [];
    let isDataSufficient = false;

    while (!isDataSufficient) {
      //   lastOffset += 20; //对于user_actions
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
})();
