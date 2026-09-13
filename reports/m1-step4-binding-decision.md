# Milestone 1 — 步 4：绑定决定（书面）

日期：2026-09-11  
决策方：用户确认；hostor 落盘  
依据：`reports/m1-inventory.md`、`reports/m1-steps1-3.md`、公开契约 `org.openadam.raster.verify@0.1.0` 与 `org.openadam.file.inspect@0.1.0`、草稿实现 `drafts/asset-delivery-preflight/`

## 决定（生效）

**M1 素材交付预检继续采用：**

| 层级 | 绑定 | 不绑定 |
| --- | --- | --- |
| 已存在、公开可调用的 Capability | **`org.openadam.file.inspect@0.1.0`**（Provider：File Vitals JSONL `inspect`） | — |
| 单槽技术对照（format / width / height / alpha） | **适配器内普通代码**（读 inspect 观察 + 对照规格） | **不实现、不宣称** `org.openadam.raster.verify@0.1.0` |
| 套装聚合（name / missing / extra / 整套 pass\|fail） | **适配器内普通代码** | 无现成 Capability；不新造公共 Capability（除非日后有第二消费者） |
| Host / 公开目录 | 不动 | 不改 Host；不把草稿写进公开 `capability-contracts` / `procedure-contracts` 目录 |

一句话：**观察走公开 `file.inspect`；对照与套装语义留在组合实现里；不把 File Vitals 说成 `raster.verify`，也不为过 XPM conformance 去实现该 Profile。**

## 并排对照：为什么不绑 `raster.verify`

| 维度 | `file.inspect@0.1.0` + 组合（当前） | `raster.verify@0.1.0` |
| --- | --- | --- |
| 公开实现 | 有（File Vitals） | 无（试点绑私有 `asset-prep`） |
| 输入 | 路径 → 观察事实 | 路径 + `expected.{format,width,height,alpha}` |
| 输出 | 信封观察；对照由调用方做 | 有序客观 checks；不匹配是成功的 `fail`，不是 provider error |
| 覆盖 | 名字、签名格式、宽高、可判定时的 alpha；套装由组合补 | **仅单张**；无命名、无数量、无槽位 |
| 格式枚举 | File Vitals 产品侧含 PNG/JPEG/GIF/WebP/SVG 等 | 合同枚举含 `png\|jpeg\|gif\|webp\|xpm`；conformance 用 XPM |
| 与 M1 目标 | 已用真实夹具验收（好套 pass、坏套分 id、改规格改结果） | 即使实现公开，仍不够套装预检；为实现它还要扛 XPM 等与当前 PNG 交付无关的负担 |

因此：为 M1「PNG 套装交付预检」去实现 `raster.verify`，**既补不上套装缺口，又引入无公开实现与错误 conformance 焦点**。正确做法是保持现状边界。

## 明确禁止的说法与做法

1. **禁止**宣称本草稿「实现了 / 符合」`org.openadam.raster.verify@0.1.0`（未跑、未过其 conformance suite）。  
2. **禁止**把 File Vitals Provider Manifest 绑到 `raster.verify`。  
3. **禁止**为了填 Capability 矩阵而发明第二个 verify Provider。  
4. **允许**在文档与输出 `observer` 字段写明：观察来自 `file.inspect@0.1.0` / File Vitals；对照是组合代码。  
5. **允许**将来在有公开/授权的 `asset-prep`（或独立 verify 产品）且确有单张 verify 消费者时，再单独跑 `run-conformance.mjs` 对该 Profile——那是另一条产品线，不是 M1 阻塞项。

## 与后续里程碑的接口

- **步 5（可选草稿 Procedure）：** 阶段只引用已存在 Capability（预期重复的 `file.inspect`）；套装聚合仍在适配器；新 Procedure id，**不**改 `brand-asset.prepare`。  
- **生成交付版本：** 仍依赖未公开的 `raster.prepare` 等；与本决定无关。  
- **两层复用：** 先有稳定预检适配器（步 3 已有；步 5 可选包一层），再谈封装为高层 Provider。

## 验收（本步）

- [x] 书面决定已落盘本文件  
- [x] 用户确认方向：继续 `file.inspect` + 组合对照，不实现 `raster.verify`  
- [x] 与步 3 实现一致：`preflight.mjs` 的 `observer` 指向 `file.inspect`，对照为普通代码  

签名栏：用户选型确认于 2026-09-11；hostor 记录。
