import xml2js from "xml2js";
import { savePosts, isGuidExists } from "./db.js";

// 生成适合Telegram的文本内容，去掉“阅读完整话题”和“Read full topic”内容
function cleanDescription(desc) {
  if (!desc) return "无内容";
  // 去掉HTML标签
  let text = desc.replace(/<[^>]+>/g, "");
  // 去掉特定内容
  text = text.replace(/阅读完整话题/g, "");
  text = text.replace(/Read full topic/gi, "");
  // 去掉多余的空白字符
  text = text.replace(/\s+/g, " ");
  return text.trim() || "无内容";
}

/**
 * 解析RSS XML并返回适合Telegram的文本内容
 * @param {string} xmlData - RSS XML字符串
 * @returns {Promise<string>} 适合Telegram的文本内容
 */
export async function parseRss(xmlData) {
  const parser = new xml2js.Parser({ explicitArray: false, trim: true });
  const result = await parser.parseStringPromise(xmlData);
  const channel = result.rss.channel;
  const items = channel.item;
  const extractedItems = [];
  if (items && Array.isArray(items)) {
    for (const item of items) {
      extractedItems.push({
        title: item.title,
        creator: item["dc:creator"],
        description: item.description,
        link: item.link,
        pubDate: item.pubDate,
        guid: item.guid?._,
        guidIsPermaLink: item.guid?.$?.isPermaLink,
        source: item.source?._,
        sourceUrl: item.source?.$?.url,
      });
    }
  } else if (items) {
    extractedItems.push({
      title: items.title,
      creator: items["dc:creator"],
      description: items.description,
      link: items.link,
      pubDate: items.pubDate,
      guid: items.guid?._,
      guidIsPermaLink: items.guid?.$?.isPermaLink,
      source: items.source?._,
      sourceUrl: items.source?.$?.url,
    });
  }
  // items反转，最新的内容排在最前面
  const reversedItems = extractedItems.reverse();

  // 用于存储要推送的内容
  let textContentArr = [];
  for (let idx = 0; idx < reversedItems.length; idx++) {
    const item = reversedItems[idx];
    if (item.guid) {
      const exists = await isGuidExists(item.guid);
      if (exists) {
        console.warn(`GUID ${item.guid} 已存在，跳过保存。`);
        continue;
      }
    }
    const isFirst = idx === 0;
    const isLast = idx === reversedItems.length - 1;
    const msg = [
      isFirst ? `标题: ${item.title}` : "",
      `作者: ${item.creator}`,
      isFirst
        ? `内容: ${cleanDescription(item.description)}`
        : `回复: ${cleanDescription(item.description)}`,
      `时间: ${item.pubDate}`,
      isLast ? `链接: ${item.link}` : "",
      "",
    ]
      .filter(Boolean)
      .join("\n")
      .trim();
    if (msg) {
      textContentArr.push(msg);
    }
  }
  // 存入数据库
  try {
    await savePosts(reversedItems);
  } catch (e) {
    console.error("保存帖子到数据库失败:", e);
  }

  const textContent = textContentArr.filter(Boolean).join("\n");
  return textContent;
}
