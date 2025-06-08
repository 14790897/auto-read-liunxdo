// 多数据库功能测试脚本 (PostgreSQL + MongoDB + MySQL)
import {
  testAllConnections,
  getAllDatabaseStats,
  savePosts,
  isGuidExists,
  closeAllConnections,
} from "./src/db.js";

async function testMultiDatabase() {
  console.log("🚀 开始多数据库功能测试 (PostgreSQL + MongoDB + MySQL)...\n");

  try {
    // 1. 测试所有数据库连接
    console.log("=== 1. 测试数据库连接 ===");
    await testAllConnections();
    console.log("");

    // 2. 获取当前统计信息
    console.log("=== 2. 获取当前统计信息 ===");
    const statsBefore = await getAllDatabaseStats();
    console.log("");

    // 3. 测试保存数据
    console.log("=== 3. 测试保存数据 ===");
    const testPosts = [
      {
        title: "测试帖子标题 - 多数据库测试 (含MongoDB+MySQL)",
        creator: "test_user",
        description:
          "这是一个多数据库功能测试帖子，包括 PostgreSQL、MongoDB 和 MySQL",
        link: "https://linux.do/t/topic/test-mysql-123",
        pubDate: new Date().toISOString(),
        guid: `test-multi-db-mysql-${Date.now()}`,
        guidIsPermaLink: "false",
        source: "Linux.do",
        sourceUrl: "https://linux.do",
      },
    ];

    await savePosts(testPosts);
    console.log("");

    // 4. 测试GUID存在性检查
    console.log("=== 4. 测试GUID存在性检查 ===");
    const testGuid = testPosts[0].guid;
    const exists = await isGuidExists(testGuid);
    console.log(`GUID ${testGuid} 存在性: ${exists ? "✅ 存在" : "❌ 不存在"}`);
    console.log("");

    // 5. 获取更新后的统计信息
    console.log("=== 5. 获取更新后的统计信息 ===");
    const statsAfter = await getAllDatabaseStats();
    console.log("");

    // 6. 比较统计信息
    console.log("=== 6. 统计信息对比 ===");
    statsBefore.forEach((beforeStat, index) => {
      const afterStat = statsAfter[index];
      if (beforeStat.status === "healthy" && afterStat.status === "healthy") {
        const increase = afterStat.totalPosts - beforeStat.totalPosts;
        console.log(
          `${beforeStat.name}: ${beforeStat.totalPosts} → ${afterStat.totalPosts} (+${increase})`
        );
      }
    });
    console.log("\n✅ 多数据库功能测试完成 (PostgreSQL + MongoDB + MySQL)");
  } catch (error) {
    console.error("❌ 测试过程中发生错误:", error);
  } finally {
    // 关闭所有连接
    console.log("\n=== 关闭数据库连接 ===");
    await closeAllConnections();
  }
}

// 运行测试
testMultiDatabase().catch(console.error);
