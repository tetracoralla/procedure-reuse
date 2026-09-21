# Milestone 1 — 步 1–3：夹具 + File Vitals + 手写预检

日期：2026-09-11  
工作根：`/workspace/openadam-procedure-reuse/`  
草稿：`drafts/asset-delivery-preflight/`  
约束：不改 Host，不新造 DSL，不改公开仓目录（`repos/` 只读），不把 File Vitals 说成 `raster.verify`。

结论先行：**有用的素材交付预检已经能在本工作区草稿里跑。** 好套整套 pass；坏套按 check id 失败；改规格中的期望宽高，同一套文件从 pass 变 fail；换一套符合同一规格的文件仍走同一方法。

---

## 步 1 — 冻结夹具与期望规格

交付形态：6 个槽位的小套 PNG（icon 16/32/64/128 + 不透明 wordmark + 不透明 og-cover）。文件是程序写出的合法 PNG/JPEG，不是假扩展名空文件。

| 路径 | 作用 |
| --- | --- |
| `drafts/asset-delivery-preflight/spec.example.json` | 与 `specs/good.json` 相同的冻结规格 |
| `specs/good.json` | 槽位 id / path / name / format / width / height / alpha / required |
| `specs/good-wrong-height.json` | 只把 `og-cover.height` 改成 361 |
| `specs/name-mismatch.json` | 只把 `icon-16.name` 改成 `app-icon-16.png` |
| `specs/wrong-name.json` | 去磁盘上的 `icon16.png` 仍要求文件名 `icon-16.png` |
| `fixtures/good/` | 全部符合规格 |
| `fixtures/good-alt/` | 像素颜色不同，技术项相同 |
| `fixtures/bad/*` | 错尺寸 / 错格式 / 错 alpha / 缺槽 / 多余 / 错文件名 |

规格只有技术项。`alphaPolicy` 写明 present / absent / any / unknown：File Vitals 省略 `has_alpha` 时观察为 `unknown`，**不得**写成 present/absent。审美字段会被入口拒绝。

人对照目录即可判断好坏，见草稿 `README.md` 表格。重新生成：`python3 scripts/generate-fixtures.py`（JPEG 坏例需要 ffmpeg）。

---

## 步 2 — File Vitals 观察层

公开仓 `repos/file-vitals`（只读）。`go.mod` 要求 **Go 1.26.6+**。环境里系统 Go 是 1.24.4，本工作区安装了本地工具链 `.tools/go`（go1.26.6），**没有改 Host**。

```bash
drafts/asset-delivery-preflight/scripts/build-file-vitals.sh
# 写出 drafts/asset-delivery-preflight/bin/{finspect,capability-adapter}
```

样例输出在 `drafts/asset-delivery-preflight/observations/`。

`finspect --json` 摘要（`observations/finspect-summary.json`）：

| 样本 | name | 签名 format | 宽×高 | has_alpha |
| --- | --- | --- | --- | --- |
| 好套 `icon-16.png` | `icon-16.png` | PNG | 16×16 | `true` |
| 好套 `wordmark.png` | `wordmark.png` | PNG | 320×64 | `false` |
| 坏套 48px 冒充 64 | `icon-64.png` | PNG | **48×48** | `true` |
| JPEG 字节、名为 `.png` | `wordmark.png` | **JPEG**，`extension_match: false` | 320×64 | `false` |
| VP8L WebP | `vp8l-unknown-alpha.webp` | WebP | 1×1 | **字段省略**（unknown，未脑补） |
| ICO 容器 | `icon.ico` | Unknown / `unsupported` | 无 image | — |

JSONL 适配器（预检真正调用的路径）：

```text
OPENADAM_CAPABILITY_WORKSPACE_ROOT=.../fixtures/good bin/capability-adapter
{"id":"obs-icon-16","operationId":"inspect","input":{"path":"icon-16.png","mode":"standard","hash":"none"}}
```

响应见 `observations/jsonl-inspect-icon-16.jsonl`：`ok: true`，`file.name`、`identity.format=PNG`、`image.width/height/has_alpha` 齐全。  
产品 CLI `finspect batch`（6 个文件，低于上限 16）落在 `observations/finspect-batch-good.json`。batch **不是** portable Capability 操作。

---

## 步 3 — 手写组合器

入口：`drafts/asset-delivery-preflight/preflight.mjs`（Node，无 npm 依赖）。

```bash
cd drafts/asset-delivery-preflight
node preflight.mjs --spec specs/good.json --root fixtures/good
```

行为：读规格 → 对每个已存在槽位路径调用 File Vitals JSONL `inspect`（`OPENADAM_CAPABILITY_WORKSPACE_ROOT` = `--root` 的绝对路径；超过 16 个 inspect 显式切会话，不静默截断）→ 对照 name / format / width / height / alpha，并报 missing / extra → 有序 `checks` + 整套 `status: pass|fail`。

观察声明写在输出的 `observer` 里：`org.openadam.file.inspect@0.1.0` / File Vitals。对照是普通代码，**不是** `raster.verify`。

### 硬验收（实测）

`node --test preflight.test.mjs`：11/11 通过。  
`node scripts/run-acceptance.mjs`：11/11 与预期一致。完整 JSON：`drafts/asset-delivery-preflight/observations/acceptance.json`。

| 命令要点 | 结果 |
| --- | --- |
| `--spec specs/good.json --root fixtures/good` | `status=pass`，30 checks 全过 |
| 同一规格 × `fixtures/good-alt` | `status=pass`（换输入、同一方法） |
| `fixtures/bad/wrong-size` | fail ids `width`,`height`（icon-64 期望 64 观察 48） |
| `fixtures/bad/wrong-format` | fail id `format`（期望 png 观察 jpeg） |
| `fixtures/bad/wrong-alpha` | fail id `alpha`（wordmark 期望 absent 观察 present） |
| `fixtures/bad/missing-slot` | fail id `missing`（icon-128） |
| `fixtures/bad/extra-file` | fail id `extra`（scratch-icon.png） |
| `fixtures/bad/wrong-name` × 好规格 | fail ids `missing`,`extra` |
| 同上 × `specs/wrong-name.json` | fail id `name`（期望 icon-16.png 观察 icon16.png） |
| 好文件 × `specs/good-wrong-height.json` | fail id `height`（期望 361 观察 360） |
| 好文件 × `specs/name-mismatch.json` | fail id `name` |

实际命令输出摘要：

```text
$ node preflight.mjs --spec specs/good.json --root fixtures/good --compact
status=pass
summary: { slots:6, files:6, checks:30, passed:30, failed:0, failedIds:[] }
observer.capability=org.openadam.file.inspect@0.1.0
observer.note="Observation only. Comparison is ordinary combinator code, not raster.verify."

$ node preflight.mjs --spec specs/good.json --root fixtures/bad/wrong-format --compact
status=fail  failedIds=["format"]
{ id:"format", slot:"wordmark", expected:"png", observed:"jpeg", passed:false }

$ node preflight.mjs --spec specs/good-wrong-height.json --root fixtures/good --compact
status=fail
{ id:"height", slot:"og-cover", expected:361, observed:360, passed:false }
```

公开仓 `git diff`：`file-vitals` / `agent-host-suite` 无改动。

---

## 已知限制

- **ICO / ICNS**：File Vitals 签名表没有这些容器。样例 `icon.ico` 的 identity 是 `Unknown` / `unsupported`，不能当已支持图标格式。
- **batch / inventory 上限**：产品 CLI batch 最多 16 条已知路径；inventory 最多 32 个文件且条目无宽高/alpha。JSONL 适配器同时准入 16。本组合器对 inspect 按 16 切会话；M1 夹具 6 个文件。更大套装要显式失败或分页，禁止静默截断。
- **alpha unknown**：PNG/JPEG/GIF 在本夹具里可判定。VP8L WebP 有宽高、省略 `has_alpha`。规格 `present`/`absent` 遇到 unknown 会失败，不会把 unknown 写成 present/absent。
- **name 与路径**：File Vitals `file.name` 是 inspect 路径的 basename。磁盘上改名、规格仍写旧路径时，表现为 `missing`+`extra`；要单独打出 `name`，规格的 `path` 与 `name` 必须能对上已存在文件。
- **执行环境**：系统 Node 20.19.2 够跑本草稿；契约仓要求 Node ≥22 与本步无关。Go 必须 1.26.6+ 才能构建 File Vitals。
- **未做（按计划）**：`brand-asset.prepare` 生成链、Kit 脚手架、公开目录改契约、push/发布/安装到用户 Agent、改 Host、实现 `raster.verify`。

步 4 的书面倾向（尚未实施）：M1 继续绑定已存在的 `file.inspect`，套装对照留在适配器；不要为了 XPM conformance 去实现 `raster.verify`。

---

## 给用户的摘要

本工作区草稿已经能对一套 6 文件 PNG 交付做技术预检：对照文件名、真实格式、宽高、透明通道，以及缺槽/多余文件。  
在 `drafts/asset-delivery-preflight/` 先跑 `scripts/build-file-vitals.sh`（需 Go 1.26.6+；本环境已放在 `.tools/go`），再 `node preflight.mjs --spec specs/good.json --root fixtures/good`。  
好套和另一套同规格文件都会 pass；改规格里的期望高度，同一套文件会变成 fail。  
坏套按 `name` / `format` / `width` / `height` / `alpha` / `missing` / `extra` 报出来，不评判好看。  
观察来自 File Vitals 的 `file.inspect` JSONL，不是 `raster.verify`，也没有改 Host。  
ICO/ICNS 仍不能当已支持格式；alpha 看不清时不会假装看清。  
建议下一步：书面确认继续用 `file.inspect`+组合对照（步 4），需要交接再考虑草稿 Procedure，而不是先做制作链或装进 Agent。
