import { savePosts, isGuidExists } from "./db.js";

async function runDbTest() {
  const testGuid = "test-guid-" + Date.now();
  const testPost = {
    title: "GitHub Action 测试标题" + Date.now(),
    creator: "测试作者",
    description: "测试内容",
    link: "https://example.com",
    pubDate: new Date().toISOString(),
    guid: testGuid,
    guidIsPermaLink: "false",
    source: "test-source",
    sourceUrl: "https://source.com"
  };

  // 1. 保存帖子
  await savePosts([testPost]);
  console.log("savePosts 测试通过");

  // 2. 检查 guid 是否存在
  const exists = await isGuidExists(testGuid);
  if (exists) {
    console.log("isGuidExists 测试通过");
    process.exit(0);
  } else {
    console.error("isGuidExists 测试失败");
    process.exit(1);
  }
}

runDbTest().catch((e) => { console.error(e); process.exit(1); });
