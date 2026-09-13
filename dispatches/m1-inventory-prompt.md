# Milestone 1 — 盘点与缺口（素材交付预检）

你是实施 agent（Grok Build）。调度者是 hostor。用户是 openAdam / tetracoralla。

阅读 `/workspace/openadam-procedure-reuse/PLAN_BRIEF.md`。本轮只做里程碑一的**核对与缺口清单**，不要开始大改 Host，不要新造工作流 DSL。

## 任务
1. 用 `grok clone`（若目录尚不存在）拉取并阅读这些公开仓库（工作目录建议 `/workspace/openadam-procedure-reuse/repos`）：
   - https://github.com/tetracoralla/agent-tool-development-kit
   - https://github.com/tetracoralla/procedure-contracts
   - https://github.com/tetracoralla/capability-contracts
   - https://github.com/tetracoralla/agent-host-suite
   - https://github.com/tetracoralla/file-vitals
   - 以及 procedure-contracts 里「品牌素材准备」相关引用的任何公开 Provider

2. 对照「素材交付预检」真实工作（命名/尺寸/格式/透明通道/数量/必需版本对应；不宣称审美），列出：
   - **可直接复用**：现有 CLI/契约/脚手架/检查/打包/安装路径（给具体路径）
   - **必需缺口**：完成真实预检仍缺什么（区分：领域 Provider 能力 / 组合实现 / 制作路径 / Host）
   - **明确不做**：本轮不应碰的东西

3. 给出里程碑一的**最小实施顺序**（3–7 步），每步可独立验收。优先「先手写组合做出有用预检」，制作脚手架放后面。

## 输出
把完整报告写到：
`/workspace/openadam-procedure-reuse/reports/m1-inventory.md`

报告末尾用简短「给用户的中文摘要」（10 行内）：现状、最大缺口、建议下一步动手点。

## 约束
- 不得发明不存在的仓库能力或 API
- 不自动 push、不发布、不安装到用户本机 Agent
- 需要写代码时只写在 `/workspace/openadam-procedure-reuse/` 下的草稿区；本轮默认只盘点
- 检查/报告服务于交付，不以堆测试数量代替结论
