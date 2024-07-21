// ==UserScript==
// @name         自动上传邀请码
// @namespace    https://linux.do
// @version      0.0.8
// @description  直接上传邀请码！
// @author       codecow
// @match        https://linux.do/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=linux.do
// @require      https://cdn.bootcdn.net/ajax/libs/jquery/1.9.1/jquery.min.js
// @grant        none
// @license      MIT
// @run-at       document-end
// ==/UserScript==

(function () {
  "use strict";

  const BASE_URL = "https://linux.do";
  const UPLOAD_URL = "https://linuxdo-invites.speedcow.top/upload";
  let username = "";
  let csrfToken = document
    .querySelector('meta[name="csrf-token"]')
    .getAttribute("content");
  const CHECK_INTERVAL_MS = 1000; // 检查间隔

  let headers = {
    accept: "*/*",
    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
    "cache-control": "no-cache",
    "discourse-logged-in": "true",
    "discourse-present": "true",
    pragma: "no-cache",
    "x-csrf-token": csrfToken,
    "x-requested-with": "XMLHttpRequest",
    "sec-ch-ua":
      '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
    "Discourse-Logged-In": "true",
    "sec-ch-ua-arch": '"x86"',
    "sec-ch-ua-platform-version": '"10.0.0"',
    "X-Requested-With": "XMLHttpRequest",
    "sec-ch-ua-full-version-list":
      '"Google Chrome";v="123.0.6312.60", "Not:A-Brand";v="8.0.0.0", "Chromium";v="123.0.6312.60"',
    "sec-ch-ua-bitness": '"64"',
    "sec-ch-ua-model": "",
    "sec-ch-ua-platform": '"Windows"',
    "Discourse-Present": "true",
    "sec-ch-ua-mobile": "?0",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "sec-ch-ua-full-version": '"123.0.6312.60"',
    Referer: `${BASE_URL}/u/${username}/invited/pending`,
  };
  let upload_headers = {
    "Content-Type": "application/json",
  };
  // 循环flag
  let flag = true;
  // 邀请链接
  let inviteLinks = [];

  // 获取过期时间
  async function getExpiresAt() {
    let date = new Date();
    date.setDate(date.getDate() + 1);
    // 格式化日期和时间
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0"); // 月份是从0开始的
    const day = date.getDate().toString().padStart(2, "0");
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");

    // 时区处理，这里简化处理为+08:00，具体时区可能需要动态获取或计算
    const timezone = "+08:00";

    // 构建expires_at参数值
    return `${year}-${month}-${day} ${hours}:${minutes}${timezone}`;
  }

  // 获取新的邀请链接
  async function fetchInvite() {
    try {
      let response = await fetch(`${BASE_URL}/invites`, {
        headers: headers,
        method: "POST",
        mode: "cors",
        credentials: "include",
        body: `max_redemptions_allowed=2&expires_at=${encodeURIComponent(
          await getExpiresAt()
        )}`,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      let data = await response.json();
      if (data.error_type === "rate_limit") {
        console.log("Rate limit reached, stopping.");
        flag = false;
      } else {
        inviteLinks.push(data.link);
        await uploadInvites(inviteLinks);
      }
    } catch (error) {
      console.log("Error:", error);
      flag = false;
    }
  }

  // 获取已有的邀请链接列表
  async function fetchInvites() {
    try {
      let response = await fetch(`${BASE_URL}/u/${username}/invited/pending`, {
        headers: headers,
        method: "GET",
        mode: "cors",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      let data = await response.json();
      for (let invite of data.invites) {
        inviteLinks.push(invite.link);
      }
      await uploadInvites(inviteLinks);
      while (flag) {
        await fetchInvite();
        if (!flag) {
          break;
        }
      }
    } catch (error) {
      console.log("Error:", error);
      flag = false;
    }
  }

  // 上传邀请链接
  async function uploadInvites(inviteLinks) {
    try {
      const inviteLinksObject = inviteLinks.reduce((obj, link) => {
        obj[link] = link;
        return obj;
      }, {});
      await fetch(`${UPLOAD_URL}?username=${username}`, {
        headers: upload_headers,
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify(inviteLinksObject),
      });
    } catch (error) {
      console.log("Error:", error);
      flag = false;
    }
  }

  // 获取用户名称
  const checkInterval = setInterval(function () {
    // 查找id为current-user的li元素
    const currentUserLi = document.querySelector("#current-user");
    // 如果找到了元素
    if (currentUserLi) {
      // 查找该元素下的button
      const button = currentUserLi.querySelector("button");

      // 如果找到了button元素
      if (button) {
        // 获取button的href属性值
        const href = button.getAttribute("href");
        username = href.replace("/u/", "");
        // username = document.getElementsByClassName("header-dropdown-toggle current-user")[0].querySelector("button").getAttribute("href").replace("/u/", "");
        clearInterval(checkInterval); // 停止检查
      }
    }
    if (username !== "") {
      fetchInvites().then((r) => {
        console.log("done");
      });
    }
  }, CHECK_INTERVAL_MS); // 每隔1秒检查一次
})();
