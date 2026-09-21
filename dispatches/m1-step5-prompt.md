# Milestone 1 — 步 5：草稿 Procedure（不改公开目录）

你是实施 agent（Grok Build）。调度者 hostor。工作根：`/workspace/openadam-procedure-reuse/`。

先读：
- `PLAN_BRIEF.md`
- `reports/m1-inventory.md`（步 5 段落）
- `reports/m1-step4-binding-decision.md`（绑定决定：只用 `file.inspect`，不实现 `raster.verify`）
- `drafts/asset-delivery-preflight/`（已有可跑预检）
- 样板：`repos/procedure-contracts/catalog/procedures/structured-data-preflight.v0.3.json` 与前向族 schemas
- 适配器协议：`openadam.procedure-jsonl.v0.2`

## 目标
在**草稿区**把步 3 预检包成可校验的 Procedure Profile + implementation manifest + procedure-jsonl 适配器 + 最小 result-boundary 符合性套件。  
**禁止**修改 `repos/procedure-contracts/catalog/` 或任何公开仓内容；全部写在 `drafts/asset-delivery-preflight/procedure/`（或同等草稿路径）。

## 必须交付

1. **新 Procedure 身份**（不要改 `brand-asset.prepare`）  
   建议 id：`org.openadam.asset-delivery.preflight`（版本 `0.1.0`，lifecycle experimental）  
   若命名需微调，在报告里说明理由。

2. **Profile（前向族 v0.5）**  
   - `stateAccess: read`，deterministic，closed-world  
   - stages **只引用已存在 Capability**：`org.openadam.file.inspect@0.1.0` / `inspect`  
   - 套装对照（name/format/width/height/alpha/missing/extra）在适配器内完成，**不要**伪造不存在的 Capability stage  
   - 如何表达「对 N 个槽位 inspect」：优先采用「适配器内部调度多次 file.inspect，对外一个 Procedure 结果」——与盘点结论一致；在 Profile 的 stages 里诚实描述（可参考 structured-data 的阶段风格，但不要抄数据领域操作）  
   - 输入：期望规格 + 工作区根（或相对 root）；输出：有序 checks + 整套 status（与现有 `preflight.mjs` 语义对齐）  
   - 自带 input/output JSON Schema（草稿内）

3. **implementation manifest**（前向族）  
   绑定草稿适配器；声明 Capability 绑定到 File Vitals（路径/命令与步 3 一致）。

4. **适配器** `openadam.procedure-jsonl.v0.2`  
   - 成功 `{id, ok:true, result}`，失败 `{id, ok:false, error}`  
   - 内部调用现有预检逻辑（复用 `preflight.mjs` 模块，避免两套对照逻辑漂移）  
   - 改规格必须仍改变执行结果

5. **最小 result-boundary 套件**  
   至少：好路径 pass；缺文件 fail；尺寸不匹配 fail。  
   用 `repos/procedure-contracts/src/run-conformance.mjs`（或 validate + run）在**指向草稿文件**的方式跑；声明仅 `result-boundary`。composition-suite 可后置。  
   若 Node 版本 < 22 阻塞契约工具：安装 Node 22+ 到工作区工具链（类似 `.tools`），或记录阻塞并尽量用 validate 能跑的部分；不要改 Host。

6. **报告** `reports/m1-step5.md`  
   路径、如何跑、校验/符合性命令与结果摘要、与步 4 决定的一致性、中文用户摘要（10 行内）。

## 明确不做
- 不改 Host；不 `component import`；不 pack 到用户 Agent  
- 不实现 `raster.verify`；不宣称符合该 Capability  
- 不做 brand-asset.prepare / 生成链  
- 不 init Kit 脚手架（步 6）  
- 不 push / 发布 / 改公开 catalog

## 验收
- Profile / Manifest / Suite 被 procedure-contracts 校验器接受（或报告精确失败并修复到接受）  
- 适配器对好夹具 / 坏夹具行为与 `preflight.mjs` 一致  
- 符合性至少 result-boundary 三类用例  
- 观察声明仍指向 `file.inspect` / File Vitals
