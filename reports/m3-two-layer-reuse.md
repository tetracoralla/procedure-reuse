# Milestone 3 — 两层复用：小方法成为上层依赖

日期：2026-09-12  
工作根：`/workspace/openadam-procedure-reuse/`  
约束：不改 Host；不 `component import`；不实现 `raster.verify`；不改公开 catalog；不 push；不新造工作流 DSL；不嵌套 Direct Runtime。  
Node：工作区 `.tools/node` **v22.23.2**。Kit CLI：`repos/agent-tool-development-kit` `node src/cli.mjs`（未改 Kit 源码）。

结论先行：

1. **真实两层。** 上层草稿 `drafts/batch-delivery-preflight/` 是战役级 kit 清单。每个 kit 通过普通函数 import 调用已有 `runPreflight`（`asset-delivery-preflight` 或 `channel-cover-preflight`）。没有第三层、没有虚构流程。
2. **没有复制下层规则。** 上层没有 `compare.mjs`，不实现宽高/格式/透明/宽高比/命名模式。失败从下层 checks 抬上来，带上 kit / slot / check。
3. **边界没有因组合失真。** 观察仍是 `org.openadam.file.inspect@0.1.0`；每套 inspect grant 是 **kit 根目录**，不是战役根；下层 identity 仍是 `@0.1.0`；只读；JSONL 16 条上限仍按套生效。
4. **Kit。** `openadam-dev check` PASS，`openadam-dev pack` 打出密封 `tar.gz`。没有 import Host，没有改公开仓。

---

## 1. 选型（诚实）

M2 建议「图标套装 + 渠道封面」组合器；调度文也允许「一批交付包」并对验收点名 **缺一套 / 一套内尺寸错 / 上层清单改动**。

本轮两层同时满足这两条，仍然只有两层：

| 层 | 身份 | 做什么 |
| --- | --- | --- |
| 下层（已有） | `org.openadam.asset-delivery.preflight@0.1.0` | 单套图标槽位对照 |
| 下层（已有） | `org.openadam.channel-cover.preflight@0.1.0` | 单套渠道封面对照 |
| 上层（新建） | `org.openadam.batch-delivery.preflight@0.1.0` | 读 kit 清单，按 kind 调度下层，聚合整批 ready/not-ready |

没有为证明架构再包一层「战役的战役」。没有把两个预检硬塞进 Procedure DAG 当 portable stage（目录里没有预检 Capability）。阶段仍只引用已存在的 `file.inspect`；适配器内部调度两个已有 combinator。

**优先普通函数组合，不调 Direct Runtime。** `src/lower.mjs` 用 ESM `import()` 加载下层模块。未启动 `openadam-direct-exec`，因此没有嵌套 JSONL 适配器、没有假重入、没有死锁面。

---

## 2. 复用边界

| 位置 | 作用 |
| --- | --- |
| `src/spec.mjs` | 只解析战役字段：`family: batch-delivery`、kit id/kind/root/required、`spec` 或 `specPath` |
| `src/lower.mjs` | 按 kind 解析到 sibling 或 packed `deps/` 的下层 `runPreflight` / `parseSpec` |
| `src/preflight.mjs` | 缺套记 `kitMissing`；在场套把 inspect grant 设成 kit 根后调用下层；抬 checks |
| 下层 `preflight.mjs` + `compare.mjs` | 槽位规则原样执行 |

夹具像素来自下层真实夹具（`scripts/stage-fixtures.mjs` 复制，不重新发明 PNG/JPEG）。kit 规格是下层 parser 吃的输入 JSON，不是把对照代码粘进上层。

自动化测试会读上层源码：不得出现 `compareSlot` / `has_alpha` / `alphaPolicy` / `transparencyAllowed` / `namePattern` / `reducedRatio`；必须出现 `loadLower` 与 `lower.runPreflight`。

---

## 3. 验收证据

工作目录：`drafts/batch-delivery-preflight/`

```bash
node src/cli.mjs --spec specs/good.json --root fixtures/good --compact
# status=pass  kits=2  failedKits=[]  failedIds=[]
# icons → org.openadam.asset-delivery.preflight@0.1.0
# covers → org.openadam.channel-cover.preflight@0.1.0
# workspaceRoot(icons)=…/fixtures/good/icons
# workspaceRoot(covers)=…/fixtures/good/covers   ← 不是战役根

node src/cli.mjs --spec specs/good.json --root fixtures/missing-covers --compact
# status=fail  failedKits=["covers"]  failedIds=["kitMissing"]
# covers.present=false；下层未调用（lower=null）
# icons 仍 pass

node src/cli.mjs --spec specs/good.json --root fixtures/icons-wrong-size --compact
# status=fail  failedKits=["icons"]  failedIds=["width","height"]
# width/height  kit=icons  slot=icon-64  expected=64  observed=48
# covers 仍 pass

node src/cli.mjs --spec specs/covers-only.json --root fixtures/icons-wrong-size --compact
# status=pass  kits=1  failedKits=[]
# 同一套错尺寸文件，只改上层清单（去掉 icons）→ 整批翻成 pass

node src/cli.mjs --spec specs/icons-wrong-height.json --root fixtures/good --compact
# status=fail  failedKits=["icons"]  failedIds=["height"]
# height  kit=icons  slot=og-cover  expected=361  observed=360
# 同一套好文件，只改下层图标规格 → 整批翻成 fail
```

`node --test src/preflight.test.mjs src/mcp-server.test.mjs`：**13/13**。覆盖：全好、缺一套、一套内尺寸错、上层清单改动、下层规格改动、每套 inspect grant、源码不复制槽位规则、MCP 只读工具。

观察声明仍是 `observer.capability = org.openadam.file.inspect@0.1.0`，note 写明不是 `raster.verify`，且 grant 按套而不是按战役放大。

---

## 4. Kit check / pack

```bash
export PATH="$PWD/.tools/node/bin:$PATH"
node repos/agent-tool-development-kit/src/cli.mjs check --root drafts/batch-delivery-preflight --json
node repos/agent-tool-development-kit/src/cli.mjs pack --root drafts/batch-delivery-preflight --json
```

| 项 | 结果 |
| --- | --- |
| check | `status: ok` |
| development-regression | ok ~1.3 s（13 tests + syntax） |
| procedure-conformance | ok ~1.3 s；5 例 PASS：good / missing-kit / wrong-size / list-change / lower-spec-height |
| pack | `status: ok`，`hostAdmission: not-performed` |
| 产物 | `drafts/batch-delivery-preflight/dist/batch-delivery-preflight-0.1.0.tar.gz` 与工作区 `dist/` 副本 |
| 大小 / sha256 | 2 307 676 bytes · `sha256:bc46389bbb32ef61f391b0c5e8e9266e15962318ead678782885a6273ea13892` |
| 组件 | `batch-delivery-preflight` `0.1.0`，payload 25 files，SPDX Apache-2.0 |

打包时把两个下层 combinator 放进 `deps/`，运行时仍走 `runPreflight` import，而不是把槽位规则重写成战役代码。

Procedure 符合性原文：

```text
PASS good-campaign-pass
PASS missing-cover-kit-fail
PASS icons-wrong-size-fail
PASS campaign-list-change-pass
PASS lower-spec-height-change-fail
PASS result-conformance implementation=org.openadam.batch-delivery-preflight@0.1.0
  procedure=org.openadam.batch-delivery.preflight@0.1.0 cases=5
```

未 `component import`。公开仓 `file-vitals` / `procedure-contracts` / `capability-contracts` / `agent-tool-development-kit` / Host：**源文件 git 干净**。

---

## 5. 验收三问（落到 M3）

1. **是否承接了重复劳动？** 人不再手跑两次预检再自己对表。一次战役入口给出整批 pass/fail，并指出哪一套、哪一槽、哪条 check。
2. **改方法是否真正改变执行？** 改下层 `og-cover.height` 360→361，同一套文件从 pass 变 fail；改上层清单去掉失败的 icons kit，同一套错尺寸文件从 fail 变 pass。换输入仍走同一套调度。
3. **复用是否值得？** 相对再写一个脚本：增量是可交接的 Procedure/Kit 包装、失败定位、以及 **不复制** 已经写过的两套对照。不值得的做法（新 DSL、Direct Runtime 嵌套、宣称 `raster.verify`）本轮没做。

---

## 6. 中文用户摘要

做完了一次真实的两层复用：上层是「一批交付包」预检，下层仍是已经存在的图标套装预检和渠道封面预检。  
上层只负责读 kit 清单、按类型调用下层、把结果聚合成整批通过或失败；槽位该怎么对照，仍然由下层自己执行。  
没有为了证明架构再叠第三层，也没有新造工作流语言，调用方式就是普通函数，没有套 Direct Runtime。  
好的两套一起跑会通过；故意拿掉封面那一套，整批失败，并且明确写的是封面套缺失。  
故意让图标里的 64 像素槽变成 48 像素，整批失败，并能指出是图标套、icon-64、宽和高不对；封面套仍然通过。  
同一批错尺寸文件，只要上层清单里去掉图标套，整批又会通过——改清单会改结果。  
同一批好文件，只把下层图标规格里 og-cover 的期望高度改成 361，整批失败——改下层规格也会改结果。  
观察层还是公开的 File Vitals，每套的读取权限停在自己的目录，没有因为组合成战役就扩大成整棵树，更没有把观察说成 `raster.verify`。  
Developer Kit 的 check 和 pack 都过了，密封包在草稿 `dist/`，没有改 Host、没有发布、没有装进用户 Agent。  
还缺：脱离作者的交接（装进 Agent、Skill 在真会话里被选中），以及生成缺失素材（明确不做）。公开市场和外部 n8n/Dify 翻译器仍不在范围内。
