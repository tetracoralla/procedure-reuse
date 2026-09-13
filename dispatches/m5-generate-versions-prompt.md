# Milestone 5 — 有边界：按规格生成交付版本 + 再预检

你是实施 agent（Grok Build）。调度者 hostor。用户只把关战略。

工作根：`/workspace/openadam-procedure-reuse/`  
先读既有 `PLAN_BRIEF.md`、`reports/m1`–`m4`、三个预检草稿 + batch 上层。

## 目标（规划第二段，收窄）
> 检查输入 → **生成所需版本** → 检查输出 → 交付。

本轮只做**有边界**的生成：
- 输入：一份「主图/源图」+ 目标套装规格（槽位宽高/格式/命名）
- 行为：在**新输出目录**写出各槽位文件（默认不改原文件）
- 然后调用已有预检（下层或上层）验收产物
- 明确不宣称：品牌贴标、透视、审美、`brand-asset.prepare`、`raster.prepare` 公开实现

实现可用本机图像库（如 sharp / magick / pillow 等），普通代码；**不要**假装绑定未公开的 `asset-prep` / `raster.prepare`。

## 建议落点
`drafts/asset-delivery-generate/`（或并入现有草稿的 `generate.mjs` 子命令）。  
优先服务 **icon 套装** 或 **channel-cover** 之一（选夹具成本低的），从一张源 PNG 生成多尺寸，再跑对应 `runPreflight`。

## 硬约束
- 不改 Host；不 push；不改公开 catalog
- 不 import
- 输出写入选定新目录；保留源
- 生成失败与预检失败要可区分
- 改规格（目标宽高）必须改变生成结果与后续预检
- 只读预检逻辑继续复用，不复制对照

## 验收
1. CLI：生成 + 预检一条龙；好源图 → 预检 pass
2. 故意要一个源图无法满足的要求（如源比目标还小且禁止放大——若你选择允许放大则换另一种故意失败）能失败并说明
3. 测试自动化
4. `reports/m5-generate-versions.md` + 中文战略摘要：这补了交付链哪一环、与未公开制作合同的关系、下一步是否值得做局部重做/Host 真安装

## 明确不做
- 完整 brand-asset.prepare 四阶段
- 公开市场、n8n 翻译
- Host 核心改动

做完停在 M5。
