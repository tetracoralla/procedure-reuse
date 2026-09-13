# 素材交付预检（草稿）

一批交付（图标套 + 封面套一起预检）的外人入口在
[`../batch-delivery-preflight/HANDOFF.md`](../batch-delivery-preflight/HANDOFF.md)。
本目录是下层单套图标方法（只读对照）。按规格从一张源 PNG 生成图标尺寸再预检，在
[`../asset-delivery-generate/`](../asset-delivery-generate/)。

期望规格驱动的套装预检：对照槽位的**文件名、格式、宽、高、透明通道**，以及**缺槽 / 多余文件**。  
观察层只用公开 Capability **`org.openadam.file.inspect@0.1.0`**（File Vitals JSONL `inspect`）。对照是普通代码，**不是** `raster.verify`，也不是新 DSL / 新 Capability。inspect 路径相对真正的交付 root：`workspaceRoot` 是父目录时不会读到授权根下的同名文件。`result.status` / `integrity` / error diagnostics 计入可交付结论；`corrupt` 与 `unsupported` 不能静默当 pass；`partial` 有齐字段可以通过，缺宽高则仍失败。

人不用跑代码，也可以对照下面的目录说出谁该过、谁该失败。

## 规格里有什么（只有技术项）

槽位字段：`id`、`path`、`name`、`format`、`width`、`height`、`alpha`、`required`。

`alpha` 策略（写在规格的 `alphaPolicy` 里，预检按此执行）：

| 取值 | 何时通过 | 未知时 |
| --- | --- | --- |
| `present` | File Vitals 报告 `image.has_alpha === true` | **不**当成 present，检查失败 |
| `absent` | `image.has_alpha === false` | **不**当成 absent，检查失败 |
| `any` | 不因 alpha 失败 | 包括省略 `has_alpha` |
| `unknown` | 只有省略 `has_alpha` 才通过 | 不得把 unknown 写成 present/absent |

禁止审美字段（`quality` / `brand` / `aesthetic` 等会被拒绝）。

冻结规格：

- `spec.example.json`（与 `specs/good.json` 相同）
- `specs/good-wrong-height.json`：同一套文件，只改 `og-cover.height` 360→361
- `specs/name-mismatch.json`：同一套文件，只改 `icon-16.name`
- `specs/wrong-name.json`：对着磁盘上的错名文件做 `name` 对照

## 夹具：谁该过、谁该失败

交付形态：6 个槽位的小套 PNG（app icon 16/32/64/128 + 不透明 wordmark + 不透明 og-cover）。

| 目录 | 对照规格 | 不用跑代码也能看出的结果 |
| --- | --- | --- |
| `fixtures/good/` | `specs/good.json` | 六个文件名、尺寸、PNG、alpha 都对。**整套 pass** |
| `fixtures/good-alt/` | `specs/good.json` | 像素颜色不同，技术项相同。**仍 pass**（换输入、同一方法） |
| `fixtures/bad/wrong-size/` | `specs/good.json` | `icon-64.png` 是 48×48，不是 64×64。**`width` / `height` 失败** |
| `fixtures/bad/wrong-format/` | `specs/good.json` | `wordmark.png` 实际是 JPEG 字节。**`format` 失败**（签名胜过扩展名） |
| `fixtures/bad/wrong-alpha/` | `specs/good.json` | `wordmark.png` 带 alpha，规格要求 `absent`。**`alpha` 失败** |
| `fixtures/bad/missing-slot/` | `specs/good.json` | 没有 `icon-128.png`。**`missing` 失败** |
| `fixtures/bad/extra-file/` | `specs/good.json` | 多了 `scratch-icon.png`。**`extra` 失败** |
| `fixtures/bad/wrong-name/` | `specs/good.json` | 16px 图标叫 `icon16.png` 而不是 `icon-16.png`。**`missing` + `extra`** |
| `fixtures/bad/wrong-name/` | `specs/wrong-name.json` | 规格去找 `icon16.png`，但仍要求文件名 `icon-16.png`。**`name` 失败** |
| `fixtures/good/` | `specs/good-wrong-height.json` | 文件没变，期望高 361。**`height` 失败**（改规格就改结果） |
| `fixtures/good/` | `specs/name-mismatch.json` | 文件没变，期望名 `app-icon-16.png`。**`name` 失败** |

观察用样本（不是交付套装）：

- `observations/samples/vp8l-unknown-alpha.webp`：VP8L WebP，尺寸可判定，`has_alpha` 必须省略
- `observations/samples/icon.ico`：ICO 容器。File Vitals **没有** ICO/ICNS 签名，不能当已支持图标格式

## 依赖

- Node.js 18+ for `node preflight.mjs`; Node 22 for procedure-contracts / Kit pack
- File Vitals: official clone at the commit in `deps/pins.json`, Go **1.26.6+** from https://go.dev/dl/. See [`docs/CLEAN_ENV.md`](../../docs/CLEAN_ENV.md). Do not assume author `repos/file-vitals` or `.tools/go`.
- 重新生成夹具：Python 3 + `ffmpeg`（JPEG 坏例）。已生成的 PNG/JPEG 可直接用

不安装 npm 依赖。不改 Host。

## 构建观察层

From the repository root:

```bash
sh scripts/fetch-deps.sh --file-vitals
sh scripts/build-file-vitals.sh --all-drafts
# or: FILE_VITALS_SRC=/path/to/pinned-file-vitals sh drafts/asset-delivery-preflight/scripts/build-file-vitals.sh
```

写出：

- `drafts/asset-delivery-preflight/bin/finspect`
- `drafts/asset-delivery-preflight/bin/capability-adapter`

单文件 / batch 观察（样例已落在 `observations/`）：

```bash
bin/finspect fixtures/good/icon-16.png --json
bin/finspect batch fixtures/good/icon-16.png fixtures/good/wordmark.png --json
OPENADAM_CAPABILITY_WORKSPACE_ROOT=$PWD/fixtures/good \
  bin/capability-adapter <<'EOF'
{"id":"s0","operationId":"inspect","input":{"path":"icon-16.png","mode":"standard"}}
EOF
```

## 跑预检

工作目录：`drafts/asset-delivery-preflight/`

```bash
node preflight.mjs --spec specs/good.json --root fixtures/good
node preflight.mjs --spec specs/good.json --root fixtures/bad/wrong-size
node preflight.mjs --spec specs/good-wrong-height.json --root fixtures/good
```

环境变量 `OPENADAM_CAPABILITY_WORKSPACE_ROOT` 由入口设成 `--root` 的绝对路径（可用 `--workspace-root` 覆盖）。适配器默认 `bin/capability-adapter`，也可用 `--adapter` 或 `FILE_VITALS_ADAPTER`。

退出码：`0` 整套 pass，`1` 整套 fail，`2` 用法/规格/适配器错误。

验收脚本：

```bash
node --test preflight.test.mjs
node scripts/run-acceptance.mjs
```

重新生成夹具（会覆盖 `fixtures/` 与 `observations/samples/`）：

```bash
python3 scripts/generate-fixtures.py
```

## 明确不是什么

- 不是 `org.openadam.raster.verify`（目录有合同、无公开 Provider；本草稿不去实现它，也不拿 File Vitals 冒充）
- 不是 `brand-asset.prepare`（那是制作/写出，不是预检）
- 不评判好看、品牌、选标
- 不支持 ICO/ICNS 作为已识别格式
- File Vitals 产品 `batch` 上限 16、`inventory` 上限 32、JSONL 同时准入 16；本组合器对 inspect 按 16 切会话，超限不会静默截断

## Binding decision (M1 step 4)

See `/workspace/openadam-procedure-reuse/reports/m1-step4-binding-decision.md`.

M1 binds **`org.openadam.file.inspect@0.1.0`** (File Vitals) for observation; suite checks stay in ordinary composition code. **Do not** claim or implement `org.openadam.raster.verify@0.1.0` for this preflight.

## Draft Procedure (M1 step 5)

Portable wrapper lives only under `procedure/`. Identity:
`org.openadam.asset-delivery.preflight@0.1.0` (experimental). It does not
change `brand-asset.prepare` or the public catalog.

The JSONL adapter (`procedure/adapter.mjs`, protocol
`openadam.procedure-jsonl.v0.2`) calls `runPreflight` from this file. One
Profile stage (`inspect-files`) names `file.inspect` / `inspect`; the adapter
schedules that call once per present slot path.

Requires Node 22+ for procedure-contracts tools (workspace toolchain:
`.tools/node`). File Vitals adapter is still `bin/capability-adapter`.

```bash
# from the workspace root
drafts/asset-delivery-preflight/scripts/run-procedure-conformance.sh
```

Details: `procedure/README.md` and `reports/m1-step5.md`.

## Kit check / pack (M1 step 6)

Hand-written `agent-tool.json` (Kit does not infer architecture). The MCP
carrier is a thin stdio wrapper around `runPreflight`; it is not a generated
scaffold and does not return `CORE_NOT_IMPLEMENTED`. Pack stages the File
Vitals JSONL adapter plus the combinator. The package command writes only to
`OPENADAM_COMPONENT_STAGE`; Kit seals `component.json` and the archive.

From the workspace root, with Node 22 on PATH (see `docs/CLEAN_ENV.md`; not `.tools/node`):

```bash
sh scripts/fetch-deps.sh --kit --file-vitals
sh scripts/build-file-vitals.sh --all-drafts
node .deps/agent-tool-development-kit/src/cli.mjs check \
  --root drafts/asset-delivery-preflight --json
node .deps/agent-tool-development-kit/src/cli.mjs pack \
  --root drafts/asset-delivery-preflight --json
```

Sealed artifact: `drafts/asset-delivery-preflight/dist/asset-delivery-preflight-0.1.0.tar.gz`.

Optional Host preview (do **not** import):

```bash
node repos/agent-host-suite/src/cli.mjs component preview \
  --artifact "$PWD/drafts/asset-delivery-preflight/dist/asset-delivery-preflight-0.1.0.tar.gz" \
  --license-spdx Apache-2.0 \
  --standalone \
  --workspace-root "$PWD/drafts/asset-delivery-preflight" \
  --json
```

Host CLI requires `--license-spdx`. This integration declares a workspace
grant, so preview also needs `--workspace-root`. `--standalone` avoids
installed Agent Host state. Details: `reports/m1-step6.md`.
