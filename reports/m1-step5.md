# Milestone 1 — 步 5：草稿 Procedure（不改公开目录）

日期：2026-09-11  
工作根：`/workspace/openadam-procedure-reuse/`  
约束：不改 Host；不 `component import`；不 pack；不实现 `raster.verify`；不改 `brand-asset.prepare`；不 init Kit；不 push / 不改公开 catalog。

结论先行：**草稿 Procedure `org.openadam.asset-delivery.preflight@0.1.0` 已在 `drafts/asset-delivery-preflight/procedure/` 落地，被 procedure-contracts 校验器接受，并通过 `result-boundary` 符合性（好套 pass、缺槽 fail、错尺寸 fail；改规格改结果）。** 观察仍只绑 `file.inspect@0.1.0` / File Vitals；套装对照仍是步 3 组合代码。

---

## 1. 身份

采用建议名，未微调。

| 字段 | 值 |
| --- | --- |
| id | `org.openadam.asset-delivery.preflight` |
| version | `0.1.0` |
| lifecycle | `experimental` |
| 前向族 | Profile v0.5 / Manifest v0.5 / Suite v0.4 |
| 适配器协议 | `openadam.procedure-jsonl.v0.2` |
| 符合性声明 | **仅** `result-boundary`（composition-suite 后置） |
| 实现 provider | `org.openadam.asset-delivery-preflight@0.1.0` |

未改 `org.openadam.brand-asset.prepare`。未宣称 `org.openadam.raster.verify`。

---

## 2. 路径（全部在草稿区）

| 文件 | 作用 |
| --- | --- |
| `drafts/asset-delivery-preflight/procedure/asset-delivery-preflight.v0.1.json` | Procedure Profile |
| `drafts/asset-delivery-preflight/procedure/schemas/asset-delivery.preflight.v0.1.input.schema.json` | 输入：`root` + `spec` 或 `specPath` |
| `drafts/asset-delivery-preflight/procedure/schemas/asset-delivery.preflight.v0.1.output.schema.json` | 输出：有序 `checks` + 整套 `status` |
| `drafts/asset-delivery-preflight/procedure/implementation-manifest.json` | 绑定草稿适配器 + File Vitals JSONL `inspect` |
| `drafts/asset-delivery-preflight/procedure/adapter.mjs` | JSONL v0.2；调用 `preflight.mjs` 的 `runPreflight` |
| `drafts/asset-delivery-preflight/procedure/conformance.v0.1.json` | 最小 result-boundary 套件（4 例） |
| `drafts/asset-delivery-preflight/procedure/check.mjs` | 对草稿文件做契约校验（不扫公开 catalog） |
| `drafts/asset-delivery-preflight/scripts/ensure-node.sh` | 工作区 Node 22 工具链 |
| `drafts/asset-delivery-preflight/scripts/run-procedure-conformance.sh` | 校验 + 符合性一键跑 |

公开仓 `repos/procedure-contracts/catalog/`、`repos/capability-contracts/catalog/`、File Vitals 源码 **未改**（`git status --short` 为空）。为跑校验器，在 **clone** 里执行了 `npm ci`（`ajv`），未改 catalog 文件。

---

## 3. Profile 怎么诚实描述「对 N 个槽位 inspect」

阶段 DAG 不能 map-over-files，也没有 portable `batch` Capability。因此 Profile **只有一个** required stage：

`inspect-files` → `org.openadam.file.inspect@0.1.0` / `inspect`

purpose 写明：适配器对每个**已存在**的声明路径调度一次 `inspect`（JSONL 会话最多 16 条，与步 3 相同）；缺的必需槽位不调用 inspect，记 `missing`；多余文件不 inspect，记 `extra`。name / format / width / height / alpha / missing / extra 的对照是适配器普通代码。

这与盘点结论和步 4 决定一致：对外一个 Procedure 结果；不伪造 `raster.verify` stage。

语义：`stateAccess: read`，`resultVariability: deterministic`，`openWorld: false`，`idempotency: idempotent`，`contextSources: [referenced-resource]`。

输入：期望规格（内联 `spec` 或相对 `specPath`）+ 相对 `root`（工作区根 / 交付目录）。  
输出：与 `preflight.mjs` 对齐的 `status`、`checks`、`summary`、`observer`（`observer.capability` 在输出 schema 里是常量 `org.openadam.file.inspect@0.1.0`）。

---

## 4. 如何跑

工作根：`/workspace/openadam-procedure-reuse/`

系统 Node 是 `v20.19.2`，契约仓 `engines.node` 为 `>=22`。已把 **Node v22.23.2** 装到 `.tools/node`（与 `.tools/go` 同类工作区工具链，不是 Host）。File Vitals 适配器仍用步 3 的 `drafts/asset-delivery-preflight/bin/capability-adapter`。

```bash
# 若尚未构建观察层
drafts/asset-delivery-preflight/scripts/build-file-vitals.sh

# 校验草稿 Profile / Manifest / Suite + result-boundary 符合性
export PATH="$PWD/.tools/node/bin:$PATH"
drafts/asset-delivery-preflight/scripts/run-procedure-conformance.sh
```

等价拆开：

```bash
export PATH="$PWD/.tools/node/bin:$PATH"

node drafts/asset-delivery-preflight/procedure/check.mjs

node repos/procedure-contracts/src/run-conformance.mjs \
  --profile drafts/asset-delivery-preflight/procedure/asset-delivery-preflight.v0.1.json \
  --suite drafts/asset-delivery-preflight/procedure/conformance.v0.1.json \
  --manifest drafts/asset-delivery-preflight/procedure/implementation-manifest.json \
  --implementation-root drafts/asset-delivery-preflight

node repos/procedure-contracts/src/validate-stage-bindings.mjs \
  --profile drafts/asset-delivery-preflight/procedure/asset-delivery-preflight.v0.1.json \
  --suite drafts/asset-delivery-preflight/procedure/conformance.v0.1.json \
  --manifest drafts/asset-delivery-preflight/procedure/implementation-manifest.json \
  --capability-manifest repos/file-vitals/capabilities/provider.json
```

`--implementation-root` 指向草稿根，因此套件里的 `fixtures/…` 与 `specs/…` 落在 grant 内。未把草稿文件拷进公开 catalog。

---

## 5. 校验 / 符合性结果摘要

实测（Node v22.23.2，`PATH=.tools/node/bin`）：

```text
PASS capability-refs procedures=1 stages=1 capabilities=1
PASS contract-set org.openadam.asset-delivery.preflight@0.1.0 claim=result-boundary cases=4
PASS stage-provider-bindings stages=1 providers=1
PASS draft procedure org.openadam.asset-delivery.preflight@0.1.0

PASS good-delivery-pass
PASS missing-required-slot-fail
PASS wrong-size-fail
PASS spec-height-change-fail
PASS result-conformance implementation=org.openadam.asset-delivery-preflight@0.1.0
  procedure=org.openadam.asset-delivery.preflight@0.1.0 cases=4

PASS stage-provider-bindings stages=1 providers=1
```

| 用例 | 输入 | 期望 | 结果 |
| --- | --- | --- | --- |
| `good-delivery-pass` | `fixtures/good` + `specs/good.json` | success，`status=pass`，`failedIds=[]` | PASS |
| `missing-required-slot-fail` | `fixtures/bad/missing-slot` + 同一规格 | success，`status=fail`，`failedIds=["missing"]`（缺槽是检查失败，不是 JSONL error） | PASS |
| `wrong-size-fail` | `fixtures/bad/wrong-size` + 同一规格 | success，`status=fail`，`failedIds=["width","height"]` | PASS |
| `spec-height-change-fail` | `fixtures/good` + `specs/good-wrong-height.json` | success，`status=fail`，`failedIds=["height"]`（改规格改执行） | PASS |

缺文件 / 错尺寸与 `preflight.mjs` 一样走 **成功信封 + `status: fail`**，不是 `{ok:false}`。这与步 3 语义一致。

适配器 vs CLI（同一 4 组输入）`status` 与 `failedIds` 完全一致。步 3 `node --test preflight.test.mjs` 仍 11/11 通过。

stage 绑定：`inspect-files` → File Vitals `io.github.tetracoralla.file-vitals@0.3.3`，transport `capability-jsonl`，target `cmd/capability-adapter#inspect`（与步 3 使用的 JSONL 适配器同一操作）。

---

## 6. 与步 4 决定的一致性

| 步 4 决定 | 本步落实 |
| --- | --- |
| 只绑已存在的 `file.inspect@0.1.0` | Profile stage 与 Manifest stage 都只引用该 Capability / `inspect` |
| 不实现、不宣称 `raster.verify` | 无该 stage；输出 `observer.note` 与 schema 常量仍写明观察来自 file.inspect |
| 套装对照留在组合实现 | `adapter.mjs` 只调度并返回 `runPreflight`；未复制对照逻辑 |
| 不改 Host / 不改公开目录 | 全部写在 `drafts/`；catalog git 干净 |
| 新 Procedure id，不改 `brand-asset.prepare` | 新身份 `org.openadam.asset-delivery.preflight@0.1.0` |

---

## 7. 明确没做

- 无 composition-suite（后置）
- 无 Kit `init` / `check` / `pack`
- 无 Host `component import`
- 无 `raster.verify` Provider
- 无生成链 / `brand-asset.prepare`

---

## 8. 中文用户摘要

本草稿把步 3 的套装预检包成了可校验的 Procedure：`org.openadam.asset-delivery.preflight@0.1.0`（实验性），文件只在 `drafts/asset-delivery-preflight/procedure/`，公开目录没动。  
阶段只引用已有的 `file.inspect`；N 个槽位由适配器内部多次 inspect，对外仍是一次 Procedure 结果。命名、尺寸、格式、透明、缺文件、多余文件的对照还是原来的 `preflight.mjs`，不是 `raster.verify`。  
好套 pass、缺 `icon-128` fail、`icon-64` 尺寸不对 fail；同一套好文件只改期望高度也会从 pass 变 fail。  
契约校验和 result-boundary 符合性都过了。系统 Node 20 跑不了契约工具，已在工作区 `.tools/node` 安装 Node 22。  
没有改 Host、没有打包、没有发布。
