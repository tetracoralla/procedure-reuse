# Procedure Reuse PR #1：修正与验收任务

审查对象：`tetracoralla/procedure-reuse`，PR #1。
固定提交：`0ea5124b3787cea4f7aa6349aea9a0e95da60bc5`。
结论：方向保留，当前版本建议 Request Changes；不以其证明整套制作与复用方案已完成。

## 证据边界

通过 GitHub connector 阅读了固定提交的核心源码、PR 状态、交接说明和里程碑报告。
容器无法解析 GitHub 域名，未取得完整 checkout，未运行仓库原有全套测试。
`targeted_reproductions.mjs` 是源码关键片段的定向复现，不是未经修改的完整模块。
文件系统部分使用哨兵字节代替已经生成的 PNG，只检查路径准入和写入行为；不测试编码器。
`targeted_results.json` 保存本环境 Node v22.16.0 / Linux 的结果。
所有复现仅在程序创建并删除的临时目录内运行。

## A. 先修复，再增加功能

### A1. 输出目录边界、源文件保护、部分写入

位置：`drafts/asset-delivery-generate/src/generate.mjs`，`src/pipeline.mjs`。

发现：仅以 resolve 后字符串判断源文件同一性与目录包含；access 检查后普通 writeFile；逐文件写入且普通 I/O 错误未携带完整部分效果。
摘录复现：目录别名配合 overwrite 可改写源文件；悬空符号链接可在默认模式引导范围外写入；后续路径故障会留下先前输出。

验收必须回到真实模块/CLI：
- 源文件路径、符号链接别名、硬链接别名均不能被输出修改。
- 输出根和中间路径的符号链接不会扩大写入范围。
- 默认不覆盖是执行时的保护，不是单次事前 access 的推断。
- 人为制造第二个文件写入失败，返回准确的部分效果或兑现受限的全有全无语义。
- 取消、现有目录、并发改动按明确支持范围处理；不宣称普通路径校验是 OS 沙箱。

### A2. 上层授权不能在子方法调用时扩大

位置：`drafts/batch-delivery-preflight/src/preflight.mjs`，`src/mcp-server.mjs`。

发现：外层 MCP 校验 campaign root 后，下层 kit 路径仅检查词法包含，再 realpath 并直接作为新 workspace grant。kit 符号链接可能指向原授权范围外。
摘录复现确认：下层接收的 grant 可以位于原授权范围之外；未运行完整 MCP 和真实 File Vitals。

验收：真实 MCP 调用使用临时目录中指向授权范围外的 kit 链接，应拒绝且不能扩大下层授权。对 kit 的 specPath 及中间路径同样验证；静态包含检查不宣称解决所有并发路径替换问题。

### A3. 图像正确性与资源边界

位置：`drafts/asset-delivery-generate/src/png.mjs`。

发现与摘录复现：
- RGBA 独立平均：不透明红 + 全透明蓝，输出 [128,0,128,128]，透明 RGB 污染可见颜色。对应预乘 alpha 的 box-filter 期望是 [255,0,0,128]。
- 三像素黑白黑缩至两像素，当前输出黑/灰；真正按覆盖面积加权的 box-filter 应对称。
- inflateSync 未给 maxOutputLength，解压后的长度检查不是解压分配上限。

优先评估成熟图像实现，不默认继续维护手写通用 PNG 解码/缩放引擎。明确所选滤波与色彩语义，增加像素级独立期望、非整数缩放、透明边缘、超限/畸形输入测试。限制输入字节、解压输出和任务总预算，而不只限制宽高。

### A4. 文件事实、检查状态与输入路径不能错配

位置：`drafts/asset-delivery-preflight/preflight.mjs`。

静态发现：
- 文件枚举相对 root，inspect 请求仍直接使用同一相对路径，却以 workspaceRoot 为授权根。root 是 workspaceRoot 的子目录时，会读取错误位置的同名文件。
- compareSlot 只检查 envelope error 与字段相等，没有把 result.status / integrity / diagnostics 带入整体可交付结论。

验收：授权根与交付根各放同名但不同尺寸的文件，应只检查交付根对应文件；针对 corrupt/partial/unsupported 建立业务规则，绝不能把已知损坏或未覆盖条件静默转换为整体“可交付”。部分观察不应一律失败，也不应一律通过。

### A5. 绑定失败不能静默更换实现

位置：`drafts/batch-delivery-preflight/src/lower.mjs`。

静态发现：已打包 deps 导入失败后，importFirst 捕获任意异常再尝试开发目录；报告里的实现身份仍来自硬编码常量。

验收：已选生产依赖损坏时应失败，不应回退到相邻 checkout；开发模式回退显式启用，并暴露真实解析来源。发布包明确绑定实际依赖版本/字节；不要为此另造全局路由系统。

## B. 把公开可读变成可复现

- 修正 `drafts/devkit-compose-scaffold/src/init.mjs` 对 `../../../repos/agent-tool-development-kit/src/contracts.mjs` 的内部源码直接依赖。
- 修正 build-file-vitals.sh 对作者目录 `repos/file-vitals` 的假设。使用显式来源与固定版本，或完整清楚的首次引导；不暗中下载/执行未授权来源。
- 干净环境从指定提交开始，运行最小检查；不借作者已有 bin、.tools、dist 或历史会话。
- 新增必要 CI，结果绑定提交。查到该 SHA 的 GitHub Actions run count 为 0；历史工作区测试报告不是该提交的 CI。
- 若更新 Skill 或源码，重建后再验证包；不把旧密封包的结果继承给新源代码。

## C. 重新标记完成度，补真正用户侧工作

- M1：领域预检原型，不等于真实任务长期采用。
- M2：可执行领域脚手架及第二个实现；尚非普适制作工具，也未集成到正式 Kit。
- M3：真实函数复用，不等于完成高层 Capability Provider 的注册、可替换与组合符合性。
- M4：实施侧交接演练；报告明示没有独立第三方或新 Agent 会话，不应判为独立交接完成。
- M5：窄 PNG 生成与复检切片；先修图像与写入问题，不扩大格式范围。

接下来选择一份有真实来源且已授权的交付任务，先确定验收规则。
让未参与开发的新 Agent，仅靠正式入口、样例和公开依赖进行制作/使用。不能以强制指定某工具来证明自然选择，但正常的定向交接本身仍有价值。
记录额外解释、修改文件、返工、完成质量，以及与朴素脚本/成熟工具的实际差异。
不把安装 Agent Host 设成开展此实验的前置条件；已有 CLI/Skill 足以开始。

## 代码与发布归属

建议：实验继续有单一私有孵化源；公开示例只保留可复现且明确边界的切片。
经过真实复用的通用脚手架以小 PR 回到 Developer Kit；领域检查/生成留在领域实现；契约新增仍以真实共享需求为依据。
不把整个草稿树合并进 Host；不新增工作流 DSL、市场、默认组件或自动递归 Agent。
公开研究不是错误，也不必等生产成熟才开源。但公开仓库的未合并 PR 仍是公开材料；Draft 不是隐私机制。
本次审查不授权改可见性、删库、改历史、合并、发布或安装。
