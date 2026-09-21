# Milestone 1 — 盘点与缺口：素材交付预检

日期：2026-09-11  
范围：只核对公开仓库与契约，不改 Host，不新造工作流 DSL，不发布、不安装到用户本机 Agent。  
结论先行：**第一类真实工作「素材交付预检」在公开链上没有现成 Procedure。** 可观察的单文件技术事实已经有公开 Provider（File Vitals / `file.inspect`）；按套检查命名、数量、必需版本对应，以及把观察变成「对照期望的 pass/fail」，仍要手写组合。目录里的 `org.openadam.brand-asset.prepare` 是**单张图的制作/写出**，不是预检。

---

## 0. 方法与检出

`grok clone` 在本环境不可用：Grove daemon / `grove` 二进制不存在，`[clone] enabled` 未开。本轮用 `git clone --depth 1` 拉到：

`/workspace/openadam-procedure-reuse/repos/`

| 仓库 | HEAD（short） | 日期 | 角色 |
| --- | --- | --- | --- |
| `procedure-contracts` | `ffac368` | 2026-09-10 | Procedure 标准与目录 |
| `capability-contracts` | `ef51ab8` | 2026-09-10 | Capability 标准与目录 |
| `agent-tool-development-kit` | `649cfd9` | 2026-09-10 | 制作/检查/打包/探测 CLI |
| `agent-host-suite` | `ab25a64` | 2026-09-10 | 安装、Direct Runtime、私有导入 |
| `file-vitals` | `53ed0ac` | 2026-09-05 | 公开 `file.inspect` Provider |
| `worldbend` | `86d2297` | 2026-09-11 | 公开 `projective.transform` Provider（品牌**制作**可选阶段，不是预检） |
| `BatchTicket` | `9f2a0d2` | 2026-09-05 | 公开 `structured-data.analyze`；预检组合的现成样板 |
| `agent-host-execution-architecture` | `a3adba1` | 2026-09-10 | 文档；不拥有可执行契约 |

`git ls-remote` 对以下名字返回 **Repository not found**（私有或未建仓，公开侧当不存在）：

`asset-prep`、`brand-asset-prep`、`perspective-tool`、`structured-data-preflight`、`data-transformer`、`universal-inspector`、`standards-pilots`、`raster-verify`、`brand-asset-preflight`

这些名字只出现在本地 sibling / 环境变量约定里，不能当成可克隆的公开实现。

---

## 1. 真实工作 vs 目录里已有的东西

PLAN_BRIEF 首条产品线：**素材交付：先预检，再按需求生成交付版本，再模板化差异。**  
里程碑一只要第一段：**预检**。对照维度（不宣称审美）：

| 维度 | 含义（本轮采用） |
| --- | --- |
| 命名 | 文件名 / 相对路径是否等于调用方给出的槽位名（或显式模式） |
| 尺寸 | 像素宽高是否等于该槽位声明 |
| 格式 | 字节身份（不是扩展名）是否等于声明 |
| 透明通道 | alpha 是否按声明 present / absent；不可判定则不得假装判定 |
| 数量 | 实际文件数 vs 声明槽位数；多余 / 缺失分开报 |
| 必需版本对应 | 一套交付必须同时具备的槽位（如 `icon-16`/`icon-32`/`icon-1024`，或 light/dark），缺一则整套未就绪 |

**不是**审美、品牌合规、自动选 logo、透视矫正、生成缺的尺寸。

### 1.1 目录里最容易误用的合同

`org.openadam.brand-asset.prepare@0.3.0`  
路径：`repos/procedure-contracts/catalog/procedures/brand-asset-prepare.v0.3.json`

它做的是：

1. `raster.prepare` `trim-transparent`
2. 可选 `projective.transform` `render`
3. `raster.prepare` `resize`（一张、一个宽高）
4. `raster.prepare` `apply-brand-mark`

语义：`stateAccess: destructive`，写出 PNG。输入是单 `source` + 单 `output`。  
**不能**当素材交付预检用。它对应产品线的第二段（生成交付版本），而且目前还是单张，不是一套槽位。

### 1.2 真正靠近预检的现成合同

| 身份 | 路径 | 能做什么 | 不能做什么 |
| --- | --- | --- | --- |
| `org.openadam.file.inspect@0.1.0` | `repos/capability-contracts/catalog/capabilities/file-inspect.v0.1.json` | 读一个已授权文件的信封：名字、扩展名证据、签名格式、宽高、`has_alpha`（能判定时） | 不对照期望；一次一个文件；没有套装/槽位 |
| `org.openadam.raster.verify@0.1.0` | `repos/capability-contracts/catalog/capabilities/raster-verify.v0.1.json` | 一张图对照 format/width/height/alpha；不匹配是成功的 `status: fail`，不是 provider error；明确不评判视觉质量 | 无公开 Provider；不查命名；不查数量；不查槽位对应；格式枚举无 SVG；conformance 用 XPM |
| `org.openadam.structured-data.preflight@0.3.0` | `repos/procedure-contracts/catalog/procedures/structured-data-preflight.v0.3.json` | **组合样板**：先 `file.inspect`，再领域 inspect，可选对照调用方约束 | 领域是结构化数据，不是栅格套装 |

File Vitals **产品**另有 `batch`（最多 16 条已知路径）和 `inventory`（最多 32 个文件），见 `repos/file-vitals/cmd/finspect/main.go` 与 MCP Skill。它们**不是** portable Capability 操作；`file.inspect` Profile 只有 `inspect`。

---

## 2. 可直接复用（给具体路径）

只列本轮能对着源码点名的东西。未公开的 sibling 实现不写进「可复用」。

### 2.1 契约与校验（不跑 Host）

**Capability**

- Profile / 输入输出：  
  `repos/capability-contracts/catalog/capabilities/file-inspect.v0.1.json`  
  `repos/capability-contracts/catalog/capabilities/schemas/file.inspect.v0.1.input.schema.json`  
  `repos/capability-contracts/catalog/capabilities/schemas/file.inspect.v0.1.output.schema.json`  
  输出已含 `file.name`、`identity.format` / `media_type` / `extension_match`、`image.width` / `height` / `has_alpha`
- 单文件技术对照（合同在，实现不公开）：  
  `repos/capability-contracts/catalog/capabilities/raster-verify.v0.1.json`  
  `repos/capability-contracts/catalog/capabilities/schemas/raster.verify.v0.1.{input,output}.schema.json`  
  `repos/capability-contracts/catalog/conformance/raster-verify.v0.1.json`
- 元模型：  
  `repos/capability-contracts/schemas/capability-profile.schema.v0.3.json`  
  `repos/capability-contracts/schemas/provider-manifest.schema.v0.3.json`  
  `repos/capability-contracts/schemas/capability-jsonl-envelope.schema.v0.1.json`
- 校验 / 符合性：  
  `repos/capability-contracts/src/validate.mjs`  
  `repos/capability-contracts/src/validate-catalog.mjs`  
  `repos/capability-contracts/src/validate-provider-catalog.mjs`  
  `repos/capability-contracts/src/run-conformance.mjs`  
  `repos/capability-contracts/src/run-transport-conformance.mjs`  
  `npm run check` / `npm run check:local-pilots`（后者缺 sibling 会 `not_run`，exit 2）

**Procedure**

- 预检组合样板：`repos/procedure-contracts/catalog/procedures/structured-data-preflight.v0.3.json`  
  输出 `readiness: ready | constraints-failed`：`repos/procedure-contracts/catalog/procedures/schemas/structured-data.preflight.v0.1.output.schema.json`
- 前向族（新 Procedure 只用这一族）：  
  `repos/procedure-contracts/schemas/procedure-profile.schema.v0.5.json`  
  `repos/procedure-contracts/schemas/procedure-implementation-manifest.schema.v0.5.json`  
  `repos/procedure-contracts/schemas/procedure-conformance-suite.schema.v0.4.json`  
  `repos/procedure-contracts/schemas/procedure-composition-suite.schema.v0.2.json`
- 适配器协议：`openadam.procedure-jsonl.v0.2`（成功 `{id, ok:true, result}`，失败 `{id, ok:false, error}`）
- 校验 / 符合性：  
  `repos/procedure-contracts/src/validate-catalog.mjs`  
  `repos/procedure-contracts/src/validate-capability-refs.mjs`  
  `repos/procedure-contracts/src/validate-stage-bindings.mjs`  
  `repos/procedure-contracts/src/run-conformance.mjs`  
  `repos/procedure-contracts/src/lib/composition-harness.mjs`（注入 Capability 调用、核对顺序与数据流）  
  `repos/procedure-contracts/src/lib/stage-bindings.mjs`

**不要**复用 `brand-asset-prepare.v0.3.json` 当预检 Profile。0.1/0.2 是已关闭的旧语义身份，只保留给旧消费者。

### 2.2 领域 Provider：File Vitals（公开，预检观察层）

- 产品说明：`repos/file-vitals/README.md`（PNG/JPEG/GIF/WebP/SVG 的尺寸、色模型、能判定时的 alpha）
- CLI：`repos/file-vitals/cmd/finspect/`  
  - 单文件：`finspect [inspect] PATH --json`（`--quick` / 默认 standard / `--deep`，`--sha256`）  
  - 已知路径集合：`finspect batch`，schema `repos/file-vitals/schemas/file-inspect-batch-input.schema.json`（1–16）  
  - 未知路径总览：`finspect inventory`，schema `repos/file-vitals/schemas/workspace-inventory-result.schema.json`（最多 32 文件；**inventory 条目没有宽高/alpha**）
- 可移植 JSONL 适配器：`repos/file-vitals/cmd/capability-adapter/main.go`  
  操作仅 `inspect`；环境变量 `OPENADAM_CAPABILITY_WORKSPACE_ROOT`；并发 4、排队上限 16
- Provider Manifest：`repos/file-vitals/capabilities/provider.json`  
  `io.github.tetracoralla.file-vitals@0.3.3` → `org.openadam.file.inspect@0.1.0`  
  MCP 工具名 `file_inspect`；JSONL target `cmd/capability-adapter#inspect`
- 打包 / 检查（复用，不重建）：  
  `repos/file-vitals/scripts/check_all.sh`  
  `repos/file-vitals/scripts/build_plugin.sh`  
  `repos/file-vitals/scripts/create_release_archive.py`  
  `repos/file-vitals/scripts/validate_contract.py`
- Skill（告诉 Agent 用 batch/inventory，不要对 `file_inspect` 手写循环）：  
  `repos/file-vitals/skills/file-vitals/SKILL.md`
- 图像实现：`repos/file-vitals/internal/inspector/image.go`  
  PNG tRNS / color type；JPEG 恒为无 alpha；GIF 图形控制块；WebP VP8/VP8X；SVG 有尺寸，alpha 不一定有证据

**已核实的格式边界（不要发明）：** `identity.go` 的签名列表**没有** ICO / ICNS。这类交付物会被当成 unknown/binary，不能当「已支持图标容器」。

### 2.3 组合样板：Structured Data Preflight + BatchTicket

公开集成表：`repos/procedure-contracts/docs/INTEGRATIONS.md`

- File Vitals + BatchTicket 是**唯一**写明有独立公开源的 Procedure 实现链  
- 本地试点期望：  
  - 实现根：sibling `structured-data-preflight`（**不公开**）  
  - 环境变量：`OPENADAM_STRUCTURED_DATA_PREFLIGHT_SOURCE_ROOT`、`OPENADAM_FILE_VITALS_SOURCE_ROOT`、`OPENADAM_BATCHTICKET_SOURCE_ROOT`  
  - 清单：`procedure/implementation-manifest.json`  
  - 组合套件：`procedure/composition-conformance.json`  
  见 `repos/procedure-contracts/scripts/check-local-pilots.mjs`

BatchTicket 公开源：`repos/BatchTicket/capabilities/provider.json`  
`data_inspect` / `data_validate`，JSONL：`python -m data_transformer.capability_adapter`  
用途：抄「inspect → 可选对照调用方约束」的形状，**不要**拿它查图片。

### 2.4 制作路径（后置；有脚手架，但没有 Procedure 模板）

Agent Tool Development Kit：`repos/agent-tool-development-kit/`

CLI（`node src/cli.mjs` / `openadam-dev`）：

| 命令 | 源 | 作用 |
| --- | --- | --- |
| `doctor` / `inspect` | `src/doctor.mjs` `src/inspect.mjs` | 环境与仓库只读盘点 |
| `init node-mcp-provider` | `src/init.mjs` | **唯一**模板：`templates/node-mcp-provider/` |
| `check` | `src/check.mjs` | 跑项目声明的检查 |
| `pack` | `src/pack.mjs` | 密封 `tar.gz`，不发布、不安装 |
| `probe` | `src/probe.mjs` | 需 Agent Host CLI 在 PATH；独立准入 |
| `measure` | `src/measure.mjs` | 打包运行时基线 |
| `materials` / `opportunity` | `src/materials.mjs` `src/opportunity.mjs` | 授权材料与提案结构检查 |

项目声明可挂 Capability / Procedure manifest，并**必须**配独立 `capability-conformance` / `procedure-conformance` lane：`repos/agent-tool-development-kit/docs/PROJECT_CONTRACT.md`。  
Skill：`repos/agent-tool-development-kit/skills/build-openadam-agent-tools/SKILL.md`。  
明确：**不要发明不存在的 Capability 或 Procedure。**

### 2.5 Host / Direct Runtime（安装与已选中执行；本轮默认不动 Host）

- CLI：`repos/agent-host-suite/src/cli.mjs`  
  `setup` / `doctor` / `component preview` / `component import` / `tools set` …
- 私有密封组件导入：`repos/agent-host-suite/docs/TOOL_INTEGRATION.md`  
  `agent-host component preview --artifact` → `import --binding`
- Direct Runtime（已选中的 Capability JSONL / Procedure JSONL / MCP）：  
  `repos/agent-host-suite/packages/direct-execution-runtime/`  
  CLI：`openadam-direct-exec`
- File Vitals **不**在 `standard` profile。`repos/agent-host-suite/catalog/profiles/standard.json` 只有 `direct-execution-runtime`、`math-anchor`、`migratory-time`。  
  File Vitals 在 `local-dogfood`：`repos/agent-host-suite/catalog/profiles/local-dogfood.json`
- 构建 File Vitals 组件：`repos/agent-host-suite/scripts/provider-source-build.mjs`（`FILE_VITALS_COMPATIBILITY_VERSION = 0.3.3`）  
  源根默认 sibling 名是 `universal-inspector`，可用 `AGENT_HOST_FILE_VITALS_SOURCE_ROOT` 指到公开仓 `file-vitals`

### 2.6 品牌「准备」相关的公开 Provider（仅制作链，预检用不上）

`procedure-contracts` 写明 `brand-asset.prepare` 的实现是 **development-only providers**。公开能对上的只有透视这一段：

- Worldbend：`repos/worldbend/capabilities/provider.json`  
  `org.openadam.projective.transform@0.2.0` 的 `inspect` / `render`  
  检查：`pnpm capability:check`（`repos/worldbend/capabilities/README.md`）
- Canvas Set（`repos/worldbend/docs/CANVAS_CONTRACT.md`）是**按声明生成**最多 16 个变体、文件名 `${id}.png`。这是后续「生成交付版本」，不是预检。

`capability-contracts` 本地试点把 `raster.prepare` **和** `raster.verify` 都绑在 sibling `asset-prep`（`OPENADAM_ASSET_PREP_SOURCE_ROOT`）。该仓公开不可得。  
Procedure 试点把实现绑在 sibling `brand-asset-prep`（`src/brand_asset_prep/adapter.py`），同样不可得。

---

## 3. 必需缺口（按层）

### 3.1 领域 Provider 能力

| 缺口 | 证据 | 影响 |
| --- | --- | --- |
| 无公开 `raster.verify` 实现 | INTEGRATIONS：development pilot / not published；`asset-prep` 远程 404 | 不能把「对照期望的 format/width/height/alpha」当成现成 Capability 调 |
| `raster.verify` 覆盖面小于交付预检 | 输入只有 `source` + `expected.{format,width,height,alpha}`；格式枚举 `png\|jpeg\|gif\|webp\|xpm`；conformance fixture 是 XPM | 即使实现公开，仍不覆盖命名、数量、槽位、SVG |
| File Vitals **不能**冒充 `raster.verify` | File Vitals 不宣称 XPM；Capability 只有 `inspect`，没有 verify | 不要写一个「file-vitals 实现 raster.verify」的假绑定 |
| 无「套装 / 槽位 / 必需版本对应」Capability | 全目录无此类 Profile | 数量与对应只能放在组合代码或将来新 Capability |
| 产品 batch/inventory 不是 portable 操作 | MCP/CLI 有；`file.inspect` 没有 | Procedure 阶段 DAG 不能直接声明 `batch`/`inventory` |
| ICO/ICNS 无身份 | `file-vitals/internal/inspector/identity.go` 无这些签名 | macOS/Windows 图标容器不能当已支持格式 |
| `has_alpha` 可缺省 | `ImageInfo.HasAlpha *bool`；WebP VP8L / 部分 SVG 可能无证据 | 「透明通道」必须允许 unknown，禁止脑补 |
| 套装规模上限 | batch 16、inventory 32、JSONL 排队 16 | 真实 App Icon 套可能超过；M1 应用小套夹具，把上限写成显式失败而不是静默截断 |

**不缺：** 单张 PNG/JPEG/GIF/WebP（及部分 SVG）的名字、格式、宽高、多数 PNG/GIF/JPEG 的 alpha 观察——File Vitals 已经能做。

### 3.2 组合实现

| 缺口 | 说明 |
| --- | --- |
| 没有「素材交付预检」Procedure | 目录只有 `brand-asset.prepare`（制作）和 `structured-data.preflight`（数据） |
| 没有公开 Procedure 适配器 | `brand-asset-prep`、`structured-data-preflight` 都不是公开仓 |
| 阶段模型是固定 DAG，不是 map-over-files | 对 N 个槽位循环调用 `inspect` 属于适配器内部调度（标准允许，只要对外结果语义不变），不能假装已有 batch Capability |
| 对照逻辑没有家 | `raster.verify` 是单张对照；套装聚合（缺失槽、多余文件、整套 ready/not-ready）目前只能是普通代码 |
| 调用方「期望规格」没有标准 schema | 需要一份本工作区草稿：槽位 id、相对路径/文件名、format、width、height、alpha、是否必需。这不是新 DSL，是输入 JSON |

最小有用组合（普通代码 + 受控 Provider 调用）：

```text
期望槽位规格
  ->（可选）inventory 只用于发现，产品 CLI，非 Capability
  -> 对每个必需路径：file.inspect JSONL
  -> 普通代码对照 name/format/width/height/alpha
  -> 聚合：缺失槽 / 多余文件 / 单槽 fail / 整套 status
```

改规格必须改结果；换一套符合同一规格的输入必须仍走同一方法。这才能回答验收三问里的「改方法是否真正改变执行」。

### 3.3 制作路径

| 缺口 | 说明 |
| --- | --- |
| Kit 没有 Procedure 组合模板 | `init` 只支持 `node-mcp-provider` |
| Kit 不代写领域核心 | 生成物带 `.openadam-scaffold`，核心返回 `CORE_NOT_IMPLEMENTED` |
| 公开制作链样板是 MCP Provider，不是 Procedure 适配器 | Procedure 适配器用 `openadam.procedure-jsonl.v0.2` |
| 未声明 conformance lane 不能挂 Procedure manifest | PROJECT_CONTRACT 硬性要求 |

制作脚手架放在手写预检**之后**。先有可跑的对照，再考虑 `openadam-dev init/check/pack`。

### 3.4 Host

| 缺口 | 说明 |
| --- | --- |
| 预检不依赖改 Host | 源码调 File Vitals JSONL 即可 |
| File Vitals 不在 default `standard` 安装集 | 以后要给 Agent 用，走 `local-dogfood` 或 `component import`，不是改 Host 代码 |
| Direct Runtime 能跑已绑定的 Procedure JSONL | 那是封装之后的事，不是 M1 阻塞 |
| 当前 checkout 的 Node/Go 低于仓库要求 | 本机 `node 20.19.2` vs 契约 `>=22`；`go 1.24.4` vs File Vitals `1.26.6`。这是执行环境缺口，不是产品合同缺口 |

**没有**定位到「必须改 Host 才能做预检」的失败。按硬约束：Host 默认不动。

---

## 4. 明确不做（本里程碑 / 本轮）

- 不改 Agent Host 源码、profile 语义、安装策略  
- 不新造工作流 DSL、画布编辑器、审批/receipt、市场、跨平台翻译器  
- 不把 `brand-asset.prepare` 改成预检，也不原地改已发布的 `id@version`  
- 不实现 trim / resize / 贴标 / 透视 / CanvasSet 生成（那是「生成交付版本」）  
- 不宣称审美、品牌合规、自动选标  
- 不发明不存在的 Provider API；不把 File Vitals 说成 `raster.verify`  
- 不把 Worldbend / BatchTicket / Armorial 塞进预检主路径（透视、数据、选 SVG 图标是别的任务）  
- 不 3D / Scene Lab / `scene.create`（procedure-contracts 已冻结）  
- 不自动 push、发布、安装到用户 Agent  
- 不重建 check / pack / probe / doctor  
- 不以堆测试数量代替「对照真实夹具能报出命名/尺寸/格式/alpha/数量/槽位」

---

## 5. 里程碑一最小实施顺序（6 步，每步可独立验收）

优先手写组合；Kit 脚手架在能报出真实缺口之后。

### 步 1 — 冻结一份真实夹具和期望规格

在本工作区草稿区（例如 `drafts/asset-delivery-preflight/`）放：

- 一套小交付（建议 4–8 个 PNG，含至少一种必需槽、一张错尺寸、一张错格式或错 alpha、一个缺文件、一个多余文件）
- 一份 JSON 期望：槽位 id、相对路径、format、width、height、alpha、required

**验收：** 规格字段只有上述技术项；无审美字段；人不用跑代码也能对照目录说出「谁该过、谁该失败」。

### 步 2 — 用 File Vitals 证明观察层

从 `repos/file-vitals` 构建 `finspect` 与 `capability-adapter`（需满足其 Go 版本），对夹具跑单文件 inspect（及可选 batch）。

**验收：** JSON 里能读到 name、签名 format、width、height、以及能判定时的 `has_alpha`；扩展名与签名冲突仍可见；不把 unknown alpha 写成 present/absent。

### 步 3 — 手写组合器（有用的预检）

普通代码（建议 Node 或 Python，只写在 `/workspace/openadam-procedure-reuse/` 草稿区）：

- 读步 1 规格  
- 对每个必需路径调 File Vitals JSONL `inspect`（显式 workspace grant）  
- 对照五个单槽维度 + 缺失/多余  
- 写出有序 checks 和整套 `pass|fail`  
- 规格驱动：改一个期望宽高，同一套文件必须从 pass 变 fail

**验收：**  
1. 好夹具整套 pass；坏夹具按 check id 失败（`name` / `format` / `width` / `height` / `alpha` / `missing` / `extra`）。  
2. 改规格改变执行；换另一套符合同一规格的输入仍走同一方法。  
3. 没有审美字段，没有 Host，没有新 DSL。

这是 M1 的**有用交付**。后面步骤是把它接回标准，不是先决条件。

### 步 4 — 对照 `raster.verify` 合同，决定是否绑定

把步 3 的单槽对照与 `raster.verify@0.1.0` 并排看：

- 若只做 PNG 交付预检：**不要**为了过 XPM conformance 去实现 `raster.verify`。保持「`file.inspect` + 组合对照」。  
- 只有在拿到公开/授权的 `asset-prep`，或 owner 明确要该 Capability 的独立产品时，才跑  
  `capability-contracts/src/run-conformance.mjs` 对该 Profile。

**验收：** 书面决定（仍放本报告或草稿 README）：M1 绑定哪些已存在 Capability，哪些对照留在适配器。禁止未过 suite 就宣称实现了 `raster.verify`。

### 步 5 — （可选）草稿 Procedure，不改公开目录除非 owner 要求

若步 3 稳定，用前向族在草稿区写新 Profile（新 id，例如交付预检，**不是**改 `brand-asset.prepare`）：

- 阶段只引用已存在 Capability（预期就是重复的 `file.inspect`；套装聚合在适配器）  
- `procedure-jsonl.v0.2` 适配器包一步 3  
- 用 `procedure-contracts/src/run-conformance.mjs` 跑最小 result-boundary 套件（好路径 + 缺文件 + 尺寸不匹配）

**验收：** 校验器接受 Profile/Manifest/Suite；符合性只声明 `result-boundary`。组合观察（`composition-suite`）可后置。  
**不**在本步 `init` 脚手架，不 pack，不 import Host。

### 步 6 — 制作路径后置：Kit check/pack，Host 仍默认不碰

仅当需要把步 3/5 交给别人的 Agent 时：

- 手写 `agent-tool.json`（Kit 不推断架构）  
- `openadam-dev check` / `pack`  
- 需要装进 Host 时用现成 `component preview/import`，不改 Host

**验收：** 密封包可预览；不自动 import。M1 可以在步 3 或步 5 停，只要预检对真实夹具有用。

---

## 6. 与后续里程碑的边界

| 里程碑 | 与本盘点的关系 |
| --- | --- |
| M1 预检 | `file.inspect` + 手写套装对照 |
| 生成交付版本 | `brand-asset.prepare` 和/或 Worldbend CanvasSet；依赖未公开的 `raster.prepare` / `asset-prep` |
| 制作路径产生另一方法 | Developer Kit；当前无 Procedure 模板 |
| 两层复用 | 预检 Procedure 被更高层调用；先要有步 5 的真实适配器，且改方法会改执行 |
| 脱离作者交接 | pack + Host import + Skill；M1 不做 |

公开链上「品牌素材准备」完整制作试点（`asset-prep` + `brand-asset-prep` + 可选 `perspective-tool`）**现在走不通**。Worldbend 只覆盖可选透视阶段。这阻塞的是生成，不是预检。

---

## 7. 给用户的中文摘要

现状：公开仓里，素材**观察**已有 File Vitals（名字、真实格式、宽高、多数情况下的透明通道）；素材**制作**合同 `brand-asset.prepare` 也在，但实现和 `raster.prepare` / `raster.verify` 的 Provider 都不公开。目录里没有「一套交付对照期望规格」的预检 Procedure。  
最大缺口：套装级对照——命名、数量、必需槽位是否齐全——没有任何 Capability；单张 `raster.verify` 也没有公开实现。预检不能靠现成制作流程，更不能改 Host 或新造工作流语言。  
建议下一步：在本工作区草稿里放一小套真文件和一份期望 JSON，用 File Vitals JSONL 逐张 inspect，再用普通代码对照并报出缺失/多余/尺寸/格式/alpha。先做出能改规格就改结果的预检；制作脚手架和 `brand-asset.prepare` 生成链放到后面。
