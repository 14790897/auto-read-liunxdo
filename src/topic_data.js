// 话题数据获取和保存模块
import { saveTopicData } from './db.js';

// 从话题页面提取话题ID
export function extractTopicIdFromUrl(url) {
  const match = url.match(/\/t\/topic\/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

// 获取话题JSON数据
export async function fetchTopicJson(page, topicId) {
  try {
    const jsonUrl = `https://linux.do/t/${topicId}.json`;
    console.log(`正在获取话题JSON数据: ${jsonUrl}`);
    
    // 在新页面中获取JSON数据
    const jsonPage = await page.browser().newPage();
    await jsonPage.goto(jsonUrl, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    
    // 等待页面加载完成
    await new Promise((r) => setTimeout(r, 1000));
    
    // 获取JSON内容
    const jsonText = await jsonPage.evaluate(() => {
      // 尝试从pre标签获取内容（某些浏览器显示JSON的方式）
      const pre = document.querySelector('pre');
      if (pre) {
        return pre.textContent;
      }
      // 否则获取body的文本内容
      return document.body.textContent;
    });
    
    await jsonPage.close();
    
    if (!jsonText) {
      console.warn(`无法获取话题 ${topicId} 的JSON数据`);
      return null;
    }
    
    // 解析JSON
    const topicData = JSON.parse(jsonText);
    console.log(`✅ 成功获取话题 ${topicId} 的JSON数据: ${topicData.title}`);
    
    return topicData;
  } catch (error) {
    console.error(`获取话题 ${topicId} JSON数据失败:`, error.message);
    return null;
  }
}

// 处理话题数据并保存到数据库
export async function processAndSaveTopicData(page, url) {
  try {
    const topicId = extractTopicIdFromUrl(url);
    if (!topicId) {
      console.warn(`无法从URL提取话题ID: ${url}`);
      return;
    }
    
    // 获取JSON数据
    const topicData = await fetchTopicJson(page, topicId);
    if (!topicData) {
      return;
    }
    
    // 保存到数据库
    await saveTopicData(topicData);
    console.log(`✅ 话题 ${topicId} 数据处理完成`);
    
  } catch (error) {
    console.error(`处理话题数据失败:`, error.message);
  }
}
