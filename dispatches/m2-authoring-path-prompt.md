# Milestone 2 — 制作路径：组合脚手架 + 第二个真实方法

你是实施 agent（Grok Build）。调度者 hostor。用户只把关战略，不审技术细节——你自行做合理工程选择并推进。

工作根：`/workspace/openadam-procedure-reuse/`  
先读：`PLAN_BRIEF.md`、`reports/m1-*.md`、已完成的 `drafts/asset-delivery-preflight/`、`repos/agent-tool-development-kit/`。

## 本里程碑目标（规划原话）
在第一条方法基础上，补 Developer Kit 的**组合项目模板/创作引导**；然后让真实 Agent 根据**另一份任务要求**完成方法制作。  
不能只把固定样例文件复制到新目录，便宣布「支持 Agent 创作」。要看到：哪些被复用、哪些有意义修改、修改是否真改变执行。

## 硬约束（继承）
- 不改 Host 源码/profile；不自动 import；不改公开 catalog（除非报告里明确「仅草稿区」）
- 不新造工作流 DSL；实现用普通代码 + 受控 Provider 调用
- 不发明不存在的 Capability；观察层继续优先复用已有公开 Provider
- 绑定决定：不把 File Vitals 说成 `raster.verify`；不无必要实现 `raster.verify`
- `--reasoning-effort` 已由调度命令设为 xhigh

## 交付 A — Developer Kit 组合型脚手架
在 `repos/agent-tool-development-kit` 上**不要直接改公开远端仓**。优先：
1. 在本工作区 `drafts/devkit-compose-scaffold/`（或对 Kit 的本地工作副本）实现/演示组合项目模板；或
2. 若必须改 Kit 源码：只在 `repos/agent-tool-development-kit` 本地 checkout 改，**不 push**；在报告说明 diff 范围，便于日后 PR。

模板应替作者完成机械工作：项目骨架、输入输出接口位置、依赖注入点、样例、检查入口、打包配置、薄 Skill（如需要）。  
作者/创作 Agent 负责：步骤安排、数据传递、失败处理、最终结果。  
生成后修改方法必须改变执行（禁止方法文件只是装饰）。

若 Kit `init` 目前只有 `node-mcp-provider`：新增一种组合/Procedure 取向模板（名称你定），或提供等效的 `init`/`scaffold` 脚本 + 文档，使创作路径可重复。

## 交付 B — 第二个真实方法（经制作路径，不是复制）
**另一份任务要求**（与「图标套装预检」不同，但仍在素材交付族附近，便于复用观察层）：

> 任务：检查一套「渠道封面」素材是否满足交付规格。  
> 规格示例维度：必需槽位（如 `cover-1x1`、`cover-16x9`、`cover-9x16`）、各自宽高与格式、命名规则、是否允许透明；缺槽/多余文件要报；不评判好看。  
> 明确不检查：品牌审美、文案内容、自动生成缺失尺寸。

要求：
1. 用制作路径（脚手架/引导 + Agent 或脚本化创作步骤）产出**新项目**，例如 `drafts/channel-cover-preflight/`（名字可调）。
2. 必须**有意义地不同于** `asset-delivery-preflight`（不同规格 schema/槽位、不同夹具；可复用共享库/观察调用，但对照规则与样例不是复制粘贴换目录名）。
3. 证明：改该新方法的规格或规则会改变执行；好/坏夹具行为正确。
4. 尽量走 Kit check（能 pack 更好；pack 失败则记录阻塞，不阻塞里程碑核心验收）。

## 交付 C — 报告
`reports/m2-authoring-path.md`：
- 脚手架怎么用（命令）
- 第二方法与第一方法的差异表
- 复用了什么 / 新写了什么
- 验收证据（命令与结果摘要）
- 中文用户摘要（战略层 8–12 行：解决了什么、还缺什么）
- 建议的里程碑三切入点（两层复用），但本轮做完 M2 即可停，除非时间充裕可开两层复用草稿

## 明确不做（本轮）
- 无限嵌套、公开市场、画布编辑器
- 生成交付版本全链路（resize/贴标等）——除非作为第二方法的极小只读旁路且不扩大范围
- Host 核心扩张
- push / 发布 / import

做完后确保报告与可运行路径齐全。
