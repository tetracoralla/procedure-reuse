# Milestone 2 — 制作路径：组合脚手架 + 第二个真实方法

日期：2026-09-12  
工作根：`/workspace/openadam-procedure-reuse/`  
约束：不改 Host；不 `component import`；不实现 `raster.verify`；不改公开 catalog；不 push；不新造工作流 DSL。  
Node：工作区 `.tools/node` **v22.23.2**。Kit CLI：`repos/agent-tool-development-kit` `node src/cli.mjs`（未改 Kit 源码）。

结论先行：

1. **交付 A。** 工作区 `drafts/devkit-compose-scaffold/` 提供可重复的 `init compose-procedure-preflight`（Kit 目前仍只有 `node-mcp-provider`）。模板替作者完成机械骨架；`src/compare.mjs` 在生成时是 `CORE_NOT_IMPLEMENTED`。未完成示例会在 development 检查失败。
2. **交付 B。** 用该制作路径生成 `drafts/channel-cover-preflight/`，再写入渠道封面领域规则与夹具——不是把 M1 目录换名复制。规格/规则改了会改执行；好/坏夹具行为正确。
3. **Kit。** `openadam-dev check` PASS，`openadam-dev pack` 打出密封 `tar.gz`。没有 import Host，没有改公开仓。

---

## 1. 脚手架怎么用（交付 A）

**没有改、没有 push** `repos/agent-tool-development-kit`。等效 CLI 在草稿区，模板名 `compose-procedure-preflight`。

工作根，Node 22 在 PATH：

```bash
export PATH="$PWD/.tools/node/bin:$PATH"

node drafts/devkit-compose-scaffold/src/cli.mjs init compose-procedure-preflight \
  --destination drafts/channel-cover-preflight \
  --id org.openadam.channel-cover-preflight \
  --package-name @openadam/channel-cover-preflight \
  --plugin channel-cover-preflight \
  --operation channel_cover_preflight \
  --procedure-id org.openadam.channel-cover.preflight \
  --name "Channel cover preflight" \
  --summary "Read-only preflight for channel-cover slots using file.inspect observations and combinator comparison. Does not implement raster.verify." \
  --author "openAdam" \
  --license Apache-2.0 \
  --json
```

`--dry-run` 只打印计划文件列表。实测 dry-run / created 记录：

- `drafts/devkit-compose-scaffold/observations/init-channel-cover-dry-run.json`
- `drafts/devkit-compose-scaffold/observations/init-channel-cover.json`（`status: created`，约 44 个机械文件）

模板替作者完成的机械工作：

| 位置 | 作用 |
| --- | --- |
| `agent-tool.json` + `packaging/` | Kit 项目合同、MCP v0.2 集成、procedure-conformance lane |
| `lib/observe-file-inspect.mjs` | File Vitals JSONL `inspect` 客户端（分页 16，不静默截断） |
| `lib/spec-base.mjs` | 禁审美/生成字段、路径约束 |
| `src/preflight.mjs` + `src/cli.mjs` | 列文件、inspect 已存在槽、缺槽/多余、调用作者对照 |
| `procedure/adapter.mjs` | `openadam.procedure-jsonl.v0.2` |
| `src/mcp-server.mjs` | 薄 MCP，工具名来自 `--operation` |
| `scripts/check` / pack / digest / `build-file-vitals.sh` | 检查入口与打包配置 |
| 薄 Skill 身份文件 | 路由占位，不含算法 |

作者必须写的：`src/spec.mjs` 领域字段、`src/compare.mjs` 对照规则、夹具、Procedure 用例、Skill/法律文件，然后删除 `.openadam-scaffold`。说明见生成项目里的 `docs/AUTHORING.md`。

生成后、作者对照写完之前，**规格文件已经驱动执行**：空目录 + `specs/example.json` 报 `missing` 路径 `slot-a.png`；只改规格路径为 `other.png`，同一空目录报 `other.png`。未完成项目 `drafts/devkit-compose-scaffold/examples/unfinished-compose-preflight/` 保留这个状态：`compareSlot` 仍抛 `CORE_NOT_IMPLEMENTED`，`scripts/kit-development-check.mjs` 以 `SCAFFOLD_INCOMPLETE` 失败。

脚手架自测：`node --test drafts/devkit-compose-scaffold/test/init.test.mjs`（5/5）。

日后若要把模板送进 Kit：把 `templates/compose-procedure-preflight/` 与 `init` 的模板名加进 Kit 本地 checkout 再开 PR。本轮 **diff 范围为 0**（`git -C repos/agent-tool-development-kit status --porcelain` 空）。

---

## 2. 第二方法与第一方法的差异

| 维度 | M1 `asset-delivery-preflight` | M2 `channel-cover-preflight` |
| --- | --- | --- |
| 任务 | 图标套装（icon 16/32/64/128 + wordmark + og-cover） | 渠道封面（`cover-1x1` / `cover-16x9` / `cover-9x16`） |
| 目录 | 扁平文件名 | 嵌套 `covers/` |
| 格式 | 全 PNG | 1x1/9x16 PNG，16x9 **JPEG** |
| 命名 | 每槽精确 `name` | 套装级 `naming.pattern` 正则（check id `namePattern`） |
| 透明 | 每槽 `alpha: present\|absent\|any\|unknown` | 套装级 `transparencyAllowed`（check id `transparency`） |
| 宽高比 | 无 | 每槽 `aspect`（观察宽高约分后对照，check id `aspect`） |
| 可选槽 | 全部 required | `cover-4x5` required=false，好套可以没有 |
| 规格 schema | 无 `family` | `family: channel-cover` 强制 |
| Procedure | `org.openadam.asset-delivery.preflight@0.1.0` | `org.openadam.channel-cover.preflight@0.1.0` |
| 夹具尺寸 | 16–128 与 320×64 / 640×360 | 64×64、160×90、90×160（小文件，比例仍是 1:1 / 16:9 / 9:16） |
| 明确不查 | 审美 | 审美、文案、**不生成缺失尺寸** |

对照规则在 `drafts/channel-cover-preflight/src/compare.mjs`，不是 M1 `preflight.mjs` 换目录。

---

## 3. 复用了什么 / 新写了什么

作者相对脚手架快照（`observations/channel-cover-authoring-diff.json`）：生成 44 文件 → 作者后 76 文件；**未改 18**、**改 23**、**新增 35**、**删除 3**（脚手架标记与示例规格）。

**复用（未改或共享）：**

- File Vitals `org.openadam.file.inspect@0.1.0` JSONL `inspect`（二进制从 M1 `drafts/asset-delivery-preflight/bin/` 复用，脚本 `build-file-vitals.sh`）
- `lib/observe-file-inspect.mjs`、`lib/spec-base.mjs`、`lib/list-delivery-files.mjs`、`lib/check-record.mjs`
- 机械编排 `src/cli.mjs`、Procedure/MCP 载体形状、Kit check/pack 脚本
- procedure-contracts 校验器与 result-boundary 跑法（草稿文件，不写公开 catalog）

**新写（作者步骤，改变执行）：**

- `src/spec.mjs`：`family` / `naming.pattern` / `transparencyAllowed` / `aspect`
- `src/compare.mjs`：`namePattern` `aspect` `transparency` `format` `width` `height`
- `specs/good.json` 与变异规格（宽、宽高比、命名模式、允许透明）
- `scripts/generate-fixtures.py` + `scripts/write-jpeg.go`（真 PNG/JPEG 字节）
- 好/坏夹具（缺槽、多余、错尺寸、错格式、透明、错名、错宽高比）
- Procedure Profile / IO schema / 4 例 result-boundary
- Skill、Apache-2.0 法律文件

删除 `.openadam-scaffold` 是完成作者步骤的显式动作，不是「复制样例就算创作」。

---

## 4. 验收证据

### 4.1 制作路径不是复制 M1

1. `init` 写出带 `.openadam-scaffold` 与 `CORE_NOT_IMPLEMENTED` 的项目。  
2. 未完成示例 development 检查：`SCAFFOLD_INCOMPLETE`（exit 1）。  
3. 同一空目录改规格路径：`slot-a.png` → `other.png`（missing 检查跟着变）。  
4. 作者快照相对脚手架：领域文件是新增/改写，不是 `cp -R drafts/asset-delivery-preflight`。

### 4.2 好/坏夹具与「改方法改执行」

```bash
cd drafts/channel-cover-preflight
node src/cli.mjs --spec specs/good.json --root fixtures/good --compact
# status=pass  slots=4 files=3 checks=18 passed=18 failedIds=[]
# （3 个必需文件 + 缺席的可选 4x5）

node src/cli.mjs --spec specs/good-wrong-aspect.json --root fixtures/good --compact
# status=fail  failedIds=["aspect"]
# cover-16x9 expected 4:3 observed 16:9（宽高仍是 160×90）

node src/cli.mjs --spec specs/good.json --root fixtures/bad/transparent --compact
# fail ["transparency"]

node src/cli.mjs --spec specs/transparency-allowed.json --root fixtures/bad/transparent --compact
# pass []   ← 只改 transparencyAllowed 就翻转结果

node src/cli.mjs --spec specs/good.json --root fixtures/bad/missing-slot --compact
# fail ["missing"]  （缺 cover-9x16；可选 4x5 仍不算 missing）
```

`node --test src/preflight.test.mjs src/mcp-server.test.mjs`：**19/19**。含 good-alt 换输入仍同一方法、错 JPEG 槽位的 PNG 字节、命名模式变异、宽变异。

观察声明仍是 `observer.capability = org.openadam.file.inspect@0.1.0`，note 写明不是 `raster.verify`。

### 4.3 Kit check / pack

```bash
export PATH="$PWD/.tools/node/bin:$PATH"
node repos/agent-tool-development-kit/src/cli.mjs check --root drafts/channel-cover-preflight --json
node repos/agent-tool-development-kit/src/cli.mjs pack --root drafts/channel-cover-preflight --json
```

| 项 | 结果 |
| --- | --- |
| check | `status: ok` |
| development-regression | ok ~1.6 s（19 tests + syntax） |
| procedure-conformance | ok ~1.1 s；4 例 PASS：good / missing / spec-aspect-change / transparent |
| pack | `status: ok`，`hostAdmission: not-performed` |
| 产物 | `drafts/channel-cover-preflight/dist/channel-cover-preflight-0.1.0.tar.gz` 与工作区 `dist/` 副本 |
| 大小 / sha256 | 2 301 884 bytes · `sha256:58680c52642dfdc08cfab8e9bf0c198f7ba28a609b2f248525b01243d9c00b94` |
| 组件 | `channel-cover-preflight` `0.1.0`，payload 19 files，SPDX Apache-2.0 |

Procedure 符合性原文：

```text
PASS good-delivery-pass
PASS missing-required-slot-fail
PASS spec-aspect-change-fail
PASS transparent-not-allowed-fail
PASS result-conformance implementation=org.openadam.channel-cover-preflight@0.1.0
  procedure=org.openadam.channel-cover.preflight@0.1.0 cases=4
```

未 `component import`。Linux / GNU tar / 无 linux-x64 Host 发行仍会挡住官方 preview（与 M1 相同环境限制）；pack 不要求 preview。

公开仓 `file-vitals` / `procedure-contracts` / `agent-tool-development-kit` / Host：**源文件 git 干净**。

---

## 5. 中文用户摘要

做完了第二条真实方法和一条可重复的制作路径，不再靠「把第一份草稿换个文件夹」冒充创作。  
脚手架会生成项目骨架、File Vitals 观察调用、检查/打包入口和薄 Skill；作者要自己写规格字段、对照规则和夹具，没写完检查会失败。  
第二条方法查的是渠道封面：方图、横图、竖图是否齐全，宽高比、真实格式、命名模式、是否允许透明，缺槽和多余文件会报。  
它和第一份图标套装预检不是同一套规则：封面用嵌套目录、PNG+JPEG、套装级命名正则和透明政策，还有一个可以缺席的可选尺寸。  
改规格里的宽高比或「是否允许透明」，同一套文件会从通过变成失败，或反过来——方法文件是真的在跑，不是装饰。  
观察层继续用已经公开的 File Vitals，没有把 File Vitals 说成 `raster.verify`，也没有改 Host、没有发布、没有装进用户 Agent。  
Developer Kit 的 `check` 和 `pack` 都过了，密封包在草稿 `dist/`。  
还缺：两层复用（用这两个预检去组一个更高层的「交付战役」检查）、脱离作者的交接（装进 Agent、Skill 在真会话里被选中）、以及生成缺失封面尺寸（明确不做）。  
公开市场和画布编辑器仍然不在范围内。

---

## 6. 建议的里程碑三切入点（两层复用）

本轮停在 M2。M3 不要新造 Capability，也不要把两个预检硬塞进 Procedure DAG 当 portable stage（目录里没有「预检 Capability」）。

建议最小两层：

1. **普通代码组合器**（草稿 `drafts/delivery-campaign-preflight/` 一类名字）：输入两套 root+spec（图标套装 + 渠道封面），分别调用两个 `runPreflight`，聚合为战役级 `pass|fail` 与分方法 `failedIds`。改其中一份方法规格必须改战役结果。  
2. **可选草稿 Procedure**：一个新 id，阶段仍只引用已存在的 `file.inspect`（或诚实写成适配器内部调度两个已有 combinator）；符合性只声明 result-boundary。  
3. **不要做**：把 File Vitals 说成 verify、实现 `raster.verify`、生成缺失尺寸、改 Host profile、公开 catalog。

验收三问落到 M3：人不再手跑两次预检；改下层方法仍改上层结果；相对「再写一个脚本」的增量是可交接的 Procedure/Kit 包装，而不是新 DSL。
