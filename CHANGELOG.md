# Changelog

## [1.7.0](https://www.github.com/14790897/auto-read-liunxdo/compare/v1.6.0...v1.7.0) (2024-11-29)


### Features

* 健康探针 ([0768f30](https://www.github.com/14790897/auto-read-liunxdo/commit/0768f303e6c4a4074f3528970f5329c53d55ae07))
* 加上首页 ([b561fde](https://www.github.com/14790897/auto-read-liunxdo/commit/b561fde351ad031f4e0e1396aa4683ea0572ab1a))


### Bug Fixes

* 尝试改进dockerfile ([533a5c9](https://www.github.com/14790897/auto-read-liunxdo/commit/533a5c9d21c35c1b3c8d2d3d2c46a0dedd070493))
* 暴露端口问题 ([78a1aca](https://www.github.com/14790897/auto-read-liunxdo/commit/78a1aca637909f65909eadd85b45a36704646020))

## [1.6.0](https://www.github.com/14790897/auto-read-liunxdo/compare/v1.5.0...v1.6.0) (2024-10-10)


### Features

* last_read_post_number完善自动阅读跳转 ([f872df4](https://www.github.com/14790897/auto-read-liunxdo/commit/f872df46d04c5726c023a6f1a3d464bf21607cc1))
* 先点赞再阅读 ([a9f016b](https://www.github.com/14790897/auto-read-liunxdo/commit/a9f016be196074d75f549ed408892ed0809e6095))
* 增加登录成功通知 ([7d4c96d](https://www.github.com/14790897/auto-read-liunxdo/commit/7d4c96dd78f7d5332a8d9d36729f46d0746c83ef))
* 自动点赞的docker ([d4b7195](https://www.github.com/14790897/auto-read-liunxdo/commit/d4b7195047ca12f4991583d93bd1a514d56a960a))


### Bug Fixes

* action不能指定点赞用户 ([4fb63a3](https://www.github.com/14790897/auto-read-liunxdo/commit/4fb63a3b035f01f05316c3b37b4cc1c305e1b933))
* docker读取.env.local变量 ([c5a61bf](https://www.github.com/14790897/auto-read-liunxdo/commit/c5a61bf5ac38cd05fbde5204976d52541f3c6dfb))
* 启动间隔时间修复 ([3d32bba](https://www.github.com/14790897/auto-read-liunxdo/commit/3d32bba8c471750b7e0e9b508eaca9e49f258c52))

## [1.5.0](https://www.github.com/14790897/auto-read-liunxdo/compare/v1.4.0...v1.5.0) (2024-09-12)


### Features

* bypasscf使用更好的脚本 ([0fd5340](https://www.github.com/14790897/auto-read-liunxdo/commit/0fd534051629d85f9a7f31d106abf42ca4743576))
* 优化dockercompose 使得它可以直接读取env文件 ([08a9a4f](https://www.github.com/14790897/auto-read-liunxdo/commit/08a9a4fb044350d72b939531b9398fc6467cdcff))
* 使用api获得文章列表 ([ccca920](https://www.github.com/14790897/auto-read-liunxdo/commit/ccca9208b28f155af58c2513e2a0040b26b77905))
* 使用search获得不重复的post ([046e1e6](https://www.github.com/14790897/auto-read-liunxdo/commit/046e1e6026a6484ccfab4fea134f7893782c1dd5))
* 可以设置结束时间，避免action报错，默认15分钟 ([8f19e92](https://www.github.com/14790897/auto-read-liunxdo/commit/8f19e92adb2ce422787be6a4bf0abece9c385b4d))
* 多账号分批处理 ([26e516f](https://www.github.com/14790897/auto-read-liunxdo/commit/26e516fbb451769383a31804739a80786ff5c563))
* 多账号分批处理 ([a5002fb](https://www.github.com/14790897/auto-read-liunxdo/commit/a5002fb9bb104013dd5094f0a32ae37d67107e03))
* 多账号分批处理 ([500c34e](https://www.github.com/14790897/auto-read-liunxdo/commit/500c34e840c3781f6ce3236e22b5d7a2649639de))
* 点赞特定用户cron ([214b3b9](https://www.github.com/14790897/auto-read-liunxdo/commit/214b3b9507d74df9a30da8df3db0fe1459d3853f))
* 电报机器人消息推送 ([43f1f42](https://www.github.com/14790897/auto-read-liunxdo/commit/43f1f425a94589267bc716e144549088359c0ff4))
* 自动点赞特定用户 ([e2340d4](https://www.github.com/14790897/auto-read-liunxdo/commit/e2340d4433fdd8b4a05af782e89dcd6285f9b9ef))


### Bug Fixes

* cron中变量的默认值 ([10499e2](https://www.github.com/14790897/auto-read-liunxdo/commit/10499e2aa7fb02075ee7925cbeb2125a59a2d922))
* cron中变量的默认值 ([9d0302a](https://www.github.com/14790897/auto-read-liunxdo/commit/9d0302a9098267ea587456a7f607e547cd004d86))
* cron中变量的默认值 ([09fd9bd](https://www.github.com/14790897/auto-read-liunxdo/commit/09fd9bd7a0f0e2b047d3c02bd7f4d93df22503dd))
* cron中变量的默认值 ([c1c07ca](https://www.github.com/14790897/auto-read-liunxdo/commit/c1c07cae1bd109f8785907b35ebc63b28dce6e93))
* cron中变量的默认值 ([6bc8bce](https://www.github.com/14790897/auto-read-liunxdo/commit/6bc8bce2a42bbb414450454f9bd36c5a07da8fc5))
* cron中变量的默认值 ([b2227b6](https://www.github.com/14790897/auto-read-liunxdo/commit/b2227b60a0fd3af4e5abe0dbe19b85bc42ba855c))
* cron中变量的默认值 ([b9b72fc](https://www.github.com/14790897/auto-read-liunxdo/commit/b9b72fce05be1046b7f917d9820ba3d9260ab476))
* cron中变量的默认值 ([4cc640a](https://www.github.com/14790897/auto-read-liunxdo/commit/4cc640a7c15f30c0f6455a2e6343fd4681960a67))
* cron中变量的默认值 ([3b044c1](https://www.github.com/14790897/auto-read-liunxdo/commit/3b044c1cbc57cb043e53a0de15287cbd35f0fce1))
* cron中变量的默认值 ([72af582](https://www.github.com/14790897/auto-read-liunxdo/commit/72af5821a782b3eb6174372d89dbff5a78656ecf))
* cron中变量的默认值 ([8fedb7b](https://www.github.com/14790897/auto-read-liunxdo/commit/8fedb7be3930f02fa2b89a49a35484e0f8cfd273))
* env.local后才能读取环境变量，page.evaluate变量必须从外部显示的传入, 因为在浏览器上下文它是读取不了的 ([f57d512](https://www.github.com/14790897/auto-read-liunxdo/commit/f57d5128dae5e3cffc9928589cf9c427e84d648c))
* env写错了 ([19d3b64](https://www.github.com/14790897/auto-read-liunxdo/commit/19d3b644445bdd26bb4a3e5a5ebc480ed085cbee))
* run-at  document-end可以修复有时候脚本不运行的问题 ([a0c35f2](https://www.github.com/14790897/auto-read-liunxdo/commit/a0c35f26a2fb187950d4a220ed096fd419e59c88))
* throw error导致无法运行 ([67811e3](https://www.github.com/14790897/auto-read-liunxdo/commit/67811e35394bf02ef1af6850dffd6b888c4091ae))
* 保存用户的时候需要清除      localStorage.removeItem("lastOffset"); ([edb72ac](https://www.github.com/14790897/auto-read-liunxdo/commit/edb72ac66ac6bcd864781d2c85d7795bc15881d9))
* 其实不需要 !topic.unseen ([d2a0ab3](https://www.github.com/14790897/auto-read-liunxdo/commit/d2a0ab3342fcd26498fab9c0e6ebac815b4c353c))
* 只有一个账号会立刻停止的问题 ([672ebee](https://www.github.com/14790897/auto-read-liunxdo/commit/672ebee00c954cd41661751a35a08868eb3d239d))
* 密码转义 ([e5802ab](https://www.github.com/14790897/auto-read-liunxdo/commit/e5802abbf770c5a65cfaee3515529d75558b8068))
* 直接使用油猴脚本 ([d429ca9](https://www.github.com/14790897/auto-read-liunxdo/commit/d429ca931cf8bddfbd14788a451e0c6d2cf05313))
* 返回 ([9f5d398](https://www.github.com/14790897/auto-read-liunxdo/commit/9f5d39814940c88628bdd648b7766143734f0201))
* 通过在主进程直接设置localstorage变量，避免单独设置 ([99b6725](https://www.github.com/14790897/auto-read-liunxdo/commit/99b67252ba7536a75708b6eb19956ace04a71122))
* 重置用户的时候需要清空post列表 ([5980c9a](https://www.github.com/14790897/auto-read-liunxdo/commit/5980c9a3b205af32fbceedc157400330eb77f3b0))

## [1.4.0](https://www.github.com/14790897/auto-read-liunxdo/compare/v1.3.0...v1.4.0) (2024-08-08)


### Features

* action中如果secrets未定义则使用env文件 ([cc2812f](https://www.github.com/14790897/auto-read-liunxdo/commit/cc2812f6a1bdf43bc03c676a963b00ce8271f732))
* 增加了对小众软件论坛的支持（https://linux.do/t/topic/169209/166） ([598913c](https://www.github.com/14790897/auto-read-liunxdo/commit/598913c09b9bc9b880fe9f974c3da490acb6ca55))


### Bug Fixes

* action 中secret读取特殊字符处理 ([5457abc](https://www.github.com/14790897/auto-read-liunxdo/commit/5457abce09c0b26a54ef6b67b0563b49ca567e97))
* docker-compose.yml命令错误 ([ec3cedc](https://www.github.com/14790897/auto-read-liunxdo/commit/ec3cedc83895cbf8dc759770c1203fa718b52dfd))
* docker-compose.yml命令错误 ([2b4d73d](https://www.github.com/14790897/auto-read-liunxdo/commit/2b4d73de2becd56f8a1c4d7ecc8aff71de619225))
* docker-compose.yml命令错误 ([2d8a099](https://www.github.com/14790897/auto-read-liunxdo/commit/2d8a099990d986741189129dfb67ec8e8869325e))
* docker-compose.yml命令错误（https://linux.do/t/topic/169209/158） ([b83b09c](https://www.github.com/14790897/auto-read-liunxdo/commit/b83b09cbc0b96b846d78d8aa1ef242e4429bac9b))
* docker命令执行的代码 ([aa36a2b](https://www.github.com/14790897/auto-read-liunxdo/commit/aa36a2b754e2591c65dfdd9314e8676aeba60b2b))
* loginbutton作用域问题 ([1f626aa](https://www.github.com/14790897/auto-read-liunxdo/commit/1f626aa8cd8299086f91a4019779500cbd9abbfb))
* Windows需要等待cf的完成 ([bdcbeaf](https://www.github.com/14790897/auto-read-liunxdo/commit/bdcbeaff2403123b74a0e031c28560b16265798b))
* 似乎不需要特殊处理 ([dc96005](https://www.github.com/14790897/auto-read-liunxdo/commit/dc960051002d88f27e5fd5ccde5a22d6be511250))
* 增加navigation超时时长 ([7c92ff0](https://www.github.com/14790897/auto-read-liunxdo/commit/7c92ff0b3d58753571674f133eaf3bd88d9c75de))
* 增加点赞间隔 ([dc472be](https://www.github.com/14790897/auto-read-liunxdo/commit/dc472be03be350e2a69d7adc25ae628f1193f241))
* 增加点赞间隔，避免频繁429 ([706198d](https://www.github.com/14790897/auto-read-liunxdo/commit/706198d1359157da83bb839827278a6f0b61c01c))
* 还是要找button ([ba801c9](https://www.github.com/14790897/auto-read-liunxdo/commit/ba801c9cc82b6ba5825fc79111c5d8d319c50cf3))

## [1.3.0](https://www.github.com/14790897/auto-read-liunxdo/compare/v1.2.1...v1.3.0) (2024-08-04)


### Features

* bypasscf可以绕过cf了 ([197e04f](https://www.github.com/14790897/auto-read-liunxdo/commit/197e04f1b67164ccabdb8e8347039c2ceb51d8e7))
* 截图记录功能 ([2e98654](https://www.github.com/14790897/auto-read-liunxdo/commit/2e986540f9170ef345b8d2a3e8df7b4b7a8a00c2))
* 新的cron ([5e005eb](https://www.github.com/14790897/auto-read-liunxdo/commit/5e005eb4591f193c3b45ba4029e4363c7356f62e))


### Bug Fixes

* action大小写问题 ([aeeb918](https://www.github.com/14790897/auto-read-liunxdo/commit/aeeb918fe199003b66279aa1e182496ed4b4d683))
* auto加双引号 ([b38c22e](https://www.github.com/14790897/auto-read-liunxdo/commit/b38c22ee52165cecdae63c296434f564af7f95f0))
* docker compose环境变量配置 ([b67d946](https://www.github.com/14790897/auto-read-liunxdo/commit/b67d94633920a9c8f2c5eaf6a8a08590d443cf7c))
* docker compose环境变量配置 ([a7f19bb](https://www.github.com/14790897/auto-read-liunxdo/commit/a7f19bbd3d139e5ede1402127fed13ce5bfea9f1))
* es6 dirname不存在 ([b5f02b4](https://www.github.com/14790897/auto-read-liunxdo/commit/b5f02b44c4b2c1d02d1ac83d1bcfe8d2f2e55096))
* Windows有头，Linux无头 ([5a39ded](https://www.github.com/14790897/auto-read-liunxdo/commit/5a39ded0ca6afc3790d891d70928cc7a863c5e01))
* 使用{ waitUntil: "domcontentloaded" }避免超时错误 ([8c3e38a](https://www.github.com/14790897/auto-read-liunxdo/commit/8c3e38a73efbc51c02191f0bb71350ff4486d9f5))

### [1.2.1](https://www.github.com/14790897/auto-read-liunxdo/compare/v1.2.0...v1.2.1) (2024-05-20)


### Bug Fixes

* env注释 ([22b118f](https://www.github.com/14790897/auto-read-liunxdo/commit/22b118f5c18f24471feb48890bcbc32f905037a0))
* 使用domcontentloaded等待页面跳转 ([611290c](https://www.github.com/14790897/auto-read-liunxdo/commit/611290c4c64aa7d75736156dae61674284d67499))
* 点赞每日重置，修复只能启动一次自动点赞 ([15529df](https://www.github.com/14790897/auto-read-liunxdo/commit/15529df487d307cd421008cb9477e369cda6075a))
* 错误处理 ([c1ad79f](https://www.github.com/14790897/auto-read-liunxdo/commit/c1ad79ff26d3a806b0e9ae450b4d36a4f8e134c1))

## [1.2.0](https://www.github.com/14790897/auto-read-liunxdo/compare/v1.1.0...v1.2.0) (2024-05-07)


### Features

* 增加local变量的读取方便调试 ([08c5631](https://www.github.com/14790897/auto-read-liunxdo/commit/08c563143d7fd1ae868e90a950cbd51ea46fe279))


### Bug Fixes

* headless改为true ([77bee42](https://www.github.com/14790897/auto-read-liunxdo/commit/77bee42accad682cc9ed4e680b1d529d7274d015))

## [1.1.0](https://www.github.com/14790897/auto-read-liunxdo/compare/v1.0.0...v1.1.0) (2024-04-30)


### Features

* cron的docker ([3f96acc](https://www.github.com/14790897/auto-read-liunxdo/commit/3f96accce19c263263ad953f3c55f422a0c16c37))
* docker 定时运行 ([963a2ed](https://www.github.com/14790897/auto-read-liunxdo/commit/963a2edf466cf113908493e1144f23c1ea9c95c6))
* docker输出日志 ([a0a13e6](https://www.github.com/14790897/auto-read-liunxdo/commit/a0a13e6f09d6226f3811cb82425852f4283f48f5))
* 环境变量可以配置阅读网站 ([fc1e52b](https://www.github.com/14790897/auto-read-liunxdo/commit/fc1e52b20fe8ad17a3c5215a3732da5d91a49d12))
* 适用于meta.discourse ([ada117a](https://www.github.com/14790897/auto-read-liunxdo/commit/ada117af31053029fcec28292844175db6b5d6a6))


### Bug Fixes

* cron ([13e2181](https://www.github.com/14790897/auto-read-liunxdo/commit/13e21815c8b4f081cef4c76d113781451e738030))
* cron ([3986f1d](https://www.github.com/14790897/auto-read-liunxdo/commit/3986f1d22c2c6be1ff0e373fad5862dcf2f3b4e5))
* cron ([d428a63](https://www.github.com/14790897/auto-read-liunxdo/commit/d428a6357f2c705c6b288188909fa5f62f35ab5a))
* cron ([82376ca](https://www.github.com/14790897/auto-read-liunxdo/commit/82376ca52bbd374ce8596b4583bc3e09e30d741c))
* cron ([b3f17c7](https://www.github.com/14790897/auto-read-liunxdo/commit/b3f17c75fbc83b2f4be005e6de8d683a4d93ad70))
* cron ([feec05e](https://www.github.com/14790897/auto-read-liunxdo/commit/feec05e10149f7314894b3d6284285f2aaa564d5))
* cron ([1ba6a4d](https://www.github.com/14790897/auto-read-liunxdo/commit/1ba6a4d7862f6d9c46b464be107b8ac7aaed66b3))
* cron ([bdd3db0](https://www.github.com/14790897/auto-read-liunxdo/commit/bdd3db0d9e0bf3109fbe2af3fee3731c9fd8478f))
* cron ([51d9566](https://www.github.com/14790897/auto-read-liunxdo/commit/51d95663b21121328ddd257e87c529fd807b7155))
* cron ([51326fe](https://www.github.com/14790897/auto-read-liunxdo/commit/51326fec312ada029e29fb8fe7b46996ae17d3a6))
* cron ([69b1801](https://www.github.com/14790897/auto-read-liunxdo/commit/69b1801b11af87685761927488937ac18592b42c))
* cron bug ([e749db7](https://www.github.com/14790897/auto-read-liunxdo/commit/e749db7d50586082e8efae2e3e3cd8b8a1f3dd56))
* cron docker ([a572a72](https://www.github.com/14790897/auto-read-liunxdo/commit/a572a720be95a8d1496699fd2203cace0cc53041))
* cron添加执行权限 ([c57da15](https://www.github.com/14790897/auto-read-liunxdo/commit/c57da15f3bd2e5f119a8f145adfb9c97d1a624e1))
* docker ([effbaa1](https://www.github.com/14790897/auto-read-liunxdo/commit/effbaa1b6982b0dd90494c0ddc9726481a824e73))
* docker 环境变量配置 ([b651584](https://www.github.com/14790897/auto-read-liunxdo/commit/b651584caa5fed554f9b95707d87e0465e3ed698))
* remove button in pteer ([edc8ef0](https://www.github.com/14790897/auto-read-liunxdo/commit/edc8ef04eb4a9034d46194722864d00f32aaadf1))
* workdir ([6083de8](https://www.github.com/14790897/auto-read-liunxdo/commit/6083de8418e1f2f8f34937f73716d30a40b673bd))
* 权限 ([4c33ce9](https://www.github.com/14790897/auto-read-liunxdo/commit/4c33ce93f29013f88611ed29d4177d2ed935fe98))

## 1.0.0 (2024-04-05)


### Features

* puppeteer ([8952911](https://www.github.com/14790897/auto-read-liunxdo/commit/895291148807dc669c10a9e0481cb9a024c57577))
* 再加一个链接 ([60cc6b0](https://www.github.com/14790897/auto-read-liunxdo/commit/60cc6b03fe884ca700b8645f646801f8d7ef088e))
* 增加脚本图标 ([61e2d35](https://www.github.com/14790897/auto-read-liunxdo/commit/61e2d354ce5b8e7c54f65233ffb2f0d89e7534fe))
* 多浏览器间隔启动 ([0647c0b](https://www.github.com/14790897/auto-read-liunxdo/commit/0647c0b721972db19451ba73a53dbe4a6831e52a))
* 多账户功能 ([c922667](https://www.github.com/14790897/auto-read-liunxdo/commit/c9226675ca22c826e09959989154cd91309d027a))
* 完善登录等待逻辑 ([6134567](https://www.github.com/14790897/auto-read-liunxdo/commit/6134567566ef695cb33244e52c08d4a0e0b1f8a7))
* 找按钮逻辑优化 ([4e392a1](https://www.github.com/14790897/auto-read-liunxdo/commit/4e392a125b6ecc7e994fa91ff67dd64cc3e01eeb))
* 收集报错 ([3b12c3b](https://www.github.com/14790897/auto-read-liunxdo/commit/3b12c3bcef358df0e7b12ccd5263ace8c9fc4eb7))
* 更好的寻找未读过的文章，但可能有问题 ([5e1e9ce](https://www.github.com/14790897/auto-read-liunxdo/commit/5e1e9ce390e886259f7e92a19a7b02201e1e1f74))
* 检查avatarImg判断登录状况 ([19efb2f](https://www.github.com/14790897/auto-read-liunxdo/commit/19efb2f74918e1e4dc8b72992f2e06a4d1d217eb))
* **点赞:** 防止已赞过的被取消 ([fcc2b40](https://www.github.com/14790897/auto-read-liunxdo/commit/fcc2b40c70c8475f83be4af2b4a7c5be601373bb))
* 自动点赞 ([a9dd8d7](https://www.github.com/14790897/auto-read-liunxdo/commit/a9dd8d74d5bcbcd9836ff0fd5df3c5014188c5a8))
* 自动点赞按钮 ([843f61f](https://www.github.com/14790897/auto-read-liunxdo/commit/843f61fe5178d7a6c4ae968a5aef2457efbda238))
* 设置正常的请求头 ([3eb58de](https://www.github.com/14790897/auto-read-liunxdo/commit/3eb58dec6e069182a852408c2900dff1b5f7fe83))
* 设置点赞上限 ([15a6ba9](https://www.github.com/14790897/auto-read-liunxdo/commit/15a6ba9cf5bccbea6ff33a5c0655e58b30e44854))


### Bug Fixes

* headless ([184461e](https://www.github.com/14790897/auto-read-liunxdo/commit/184461e27b62d0e57e0da4679b56b75e3f3a6535))
* localstorage无法访问 ([f2c1e9f](https://www.github.com/14790897/auto-read-liunxdo/commit/f2c1e9ff9ca27bd6d48296d3a3a0931b6184fba0))
* 不要刷新就启动 ([670992a](https://www.github.com/14790897/auto-read-liunxdo/commit/670992a91c031387c555682b0327cc782d309dbf))
* 修复略过已点赞按钮的逻辑错误 ([8e3089c](https://www.github.com/14790897/auto-read-liunxdo/commit/8e3089c7339fde603c26b67b0fcbb5fdc0138b3d))
* 修改等待元素 ([57ad719](https://www.github.com/14790897/auto-read-liunxdo/commit/57ad7190b0221181d746e88f1d83838b46a58dca))
* 去掉link限制，延迟2秒执行 ([98b0c93](https://www.github.com/14790897/auto-read-liunxdo/commit/98b0c936a359040ea5f5f68ed26dc02b72784c25))
* 去掉new ([f4d8c27](https://www.github.com/14790897/auto-read-liunxdo/commit/f4d8c270c20536bb60877183e9757e8069778dcb))
* 去除unread，因为可能没有文章 ([531d5b0](https://www.github.com/14790897/auto-read-liunxdo/commit/531d5b0923f4c676ff31fc1e6d5cdf43bc907443))
* 去除监听request ([32d4637](https://www.github.com/14790897/auto-read-liunxdo/commit/32d4637e79f78169f8f11f5970490a9052168b4d))
* 增加元素等待时间 ([e574e50](https://www.github.com/14790897/auto-read-liunxdo/commit/e574e509bfb676b43a5cb35bf34225ed6f7b5747))
* 增加等待时间 ([e439eee](https://www.github.com/14790897/auto-read-liunxdo/commit/e439eee13a631856fe8d524d1e7ab79eb2d618cd))
* 按钮位置移到到左下角 ([afd3394](https://www.github.com/14790897/auto-read-liunxdo/commit/afd33947af7bc86422857ad1452cb692a83707ca))
* 改变帖子位置 ([37c52ee](https://www.github.com/14790897/auto-read-liunxdo/commit/37c52eeee9296197334e0d929fd2249b8ef9adee))
* 改变帖子位置 ([0bd3aed](https://www.github.com/14790897/auto-read-liunxdo/commit/0bd3aede6a937c623d687e2edf59089511efa7e0))
* 暗色模式下看不清的问题 ([1616eb3](https://www.github.com/14790897/auto-read-liunxdo/commit/1616eb33b9432ee1636ee124acfd1860d4940669))
* 更新名字 ([3024a4c](https://www.github.com/14790897/auto-read-liunxdo/commit/3024a4c0b9ef9a691ef96b24c0e0943956e4b90d))
* 点赞429 ([a0d809c](https://www.github.com/14790897/auto-read-liunxdo/commit/a0d809ce4faeeb98c49f611eb78d384dc195b1e4))
* 点赞跳过加上英文title判断 ([36e05fb](https://www.github.com/14790897/auto-read-liunxdo/commit/36e05fb33ad9d507faae042e05a6a7821937c432))
* 环境变量名字错误 ([a3f8f1e](https://www.github.com/14790897/auto-read-liunxdo/commit/a3f8f1e1c123ff813c5443acb5a0f512493dc58f))
* 调整了浏览的速度 ([e85425f](https://www.github.com/14790897/auto-read-liunxdo/commit/e85425f3138c94a603793a1111dfabeb1c22e3c5))
* 阅读位置 ([2a3d1a3](https://www.github.com/14790897/auto-read-liunxdo/commit/2a3d1a3a25537cf9bacea3e21b2df646650fb67f))
* 页面刷新之后保持之前的状态 ([d1817b8](https://www.github.com/14790897/auto-read-liunxdo/commit/d1817b81fb9085bad392675422c1e56f5e01ce90))
* 默认不启动自动点赞 ([be0ca10](https://www.github.com/14790897/auto-read-liunxdo/commit/be0ca10aecb6ec1bcfb61af19e97b2536bfa1ad8))
