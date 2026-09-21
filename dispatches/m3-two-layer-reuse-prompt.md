# Milestone 3 — 两层复用：小方法成为上层依赖

你是实施 agent（Grok Build）。调度者 hostor。用户只把关战略——自行做工程选择。

工作根：`/workspace/openadam-procedure-reuse/`  
先读：`PLAN_BRIEF.md`、`reports/m1-*.md`、`reports/m2-authoring-path.md`、  
`drafts/asset-delivery-preflight/`、`drafts/channel-cover-preflight/`、`drafts/devkit-compose-scaffold/`。

## 目标（规划）
把一个已有小方法作为上层方法依赖。验证：
1. 上层没有重复实现底层规则
2. 底层失败能被定位
3. 版本、预算/权限边界没有因为组合而失真
4. 不为证明架构而虚构三四层没有使用者的流程——**只要真实两层**

## 建议的两层形状（可微调，须诚实）
**下层（已有）：** `asset-delivery-preflight` 或 `channel-cover-preflight` 之一（单套对照）。  
**上层（新建草稿）：** 例如「一批交付包 / 多套渠道封面」预检：对每个子目录或清单项调用下层预检，再聚合整批 ready/not-ready、缺失套件、部分失败定位。

或：上层「素材交付包预检」= 图标套装预检 + 封面套装预检（两个下层），仍算两层组合（上层编排，下层执行）。

优先选**有真实夹具、能演示失败定位**的方案。写在 `drafts/` 下新目录（如 `drafts/batch-delivery-preflight/`）。

## 硬约束
- 不改 Host；不 push；不改公开 catalog 作为已发布真相
- 不新造工作流 DSL；普通代码组合
- 下层对照逻辑不复制粘贴进上层——通过函数/适配器/包调用复用
- 失败可定位到哪一套 / 哪一槽 / 哪条 check
- 不因封装宣称 `raster.verify` 或扩大权限；仍只读
- 嵌套若调 Direct Runtime：必须实际验证无死锁/假重入；**优先普通函数组合**（盘点已建议）
- 改下层规格或上层清单必须能改变整批结果

## 验收
1. 可运行上层 CLI/入口；好整批 pass；故意坏其中一套 → 整批 fail 且指出哪套、何因
2. 上层源码中看不到对下层规则的重复实现（或报告说明共享模块边界）
3. 自动化测试覆盖至少：全好、缺一套、一套内尺寸错、上层清单改动导致结果变化
4. 报告 `reports/m3-two-layer-reuse.md` + 中文战略摘要（8–12 行）
5. 若时间够：Kit check 对上层项目；pack 可选

## 明确不做
- 无限嵌套、公开市场、Host import、生成缺失素材
- 把外部 n8n/Dify 翻译器当本轮范围

做完即可停在 M3；不要擅自开 M4，除非 M3 自然多出交接材料且成本很低。
