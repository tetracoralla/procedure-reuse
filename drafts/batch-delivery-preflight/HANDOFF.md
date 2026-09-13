# 交接入口：一批交付包预检

给**没有参与开发的人**和**没有装过这个方法的 Agent**。这不是架构说明书。
M4 记录的是实施侧交接演练，不是独立第三方交接完成。

Agent: default path is the CLI in「怎样第一次运行」. Do not assume MCP, Procedure JSONL, or Agent Host import. Read `handoff/AGENT.md` if you are an Agent.

工作根：本仓库的 clone（Linux x64 + Node；干净环境见仓库 `docs/CLEAN_ENV.md`）。  
不要照抄历史路径 `/workspace/openadam-procedure-reuse/`——那是另一棵树，不是本 clone。  
本项目：`drafts/batch-delivery-preflight/`

---

## 这能替我完成什么

你已经有一套（或几套）交付文件，也已经写好技术规格。这个方法只读对照，回答：

**整批能不能交货？如果不能，是哪一套、哪个槽位、哪一条检查没过。**

一次命令覆盖战役里列出的每一套。现在能调度的两类：

| 战役里的 `kind` | 实际检查的内容 |
| --- | --- |
| `asset-delivery` | 文件名、真实格式、宽、高、透明通道、缺槽、多余文件 |
| `channel-cover` | 命名正则、格式、宽、高、宽高比、是否允许透明、缺槽、多余文件 |

观察来自公开的 File Vitals（`file.inspect`）。对照是已经写好的组合代码。

## 这不做什么

- 不生成、不缩放、不补缺失素材
- 不评好看、品牌、文案
- 不是 `raster.verify`，也没有装进你本机的 Agent Host（本环境 Linux 上 Host preview 失败；默认不做 import）
- 不支持 ICO / ICNS 当已识别图标格式
- 不替你决定「fail 了是否仍可发布」——那是人的决定

---

## 我需要准备什么

三样东西。规格是 JSON，文件是真 PNG / JPEG 字节（扩展名撒谎也会被抓到）。

### 1. 战役目录（`--root`）

每个 kit 一个子目录。**不要把规格 JSON、README 放进 kit 目录**（未声明的文件算 `extra`）。

```text
my-delivery/
  badge/                 ← kit root
    badge-24.png
    …
  posters/               ← kit root
    poster-square.png
    poster-wide.jpg
    poster-tall.png
```

### 2. 战役规格（`--spec`）

字段只有技术项。`family` 必须是 `batch-delivery`。每个 kit：

| 字段 | 含义 |
| --- | --- |
| `id` | 失败时会出现在 `failedKits` 里的名字 |
| `kind` | `asset-delivery` 或 `channel-cover` |
| `required` | `true` 时目录不存在 → `kitMissing` |
| `root` | 相对 **战役目录** 的子目录 |
| `specPath` 或 `spec` | 二选一。`specPath` 相对 **战役 JSON 所在目录**，不是相对 `--root` |

槽位 `path` 相对 **kit 根目录**，不是相对战役根。

M3 自带夹具把封面写成 `covers/cover-1x1.png`，同时 kit `root` 也是 `covers`，所以磁盘上是 `covers/covers/…`。那是旧夹具的路径选择，**新任务不必照抄这一层嵌套**。你写 `path: "poster-square.png"`、`root: "posters"`，文件就放在 `posters/poster-square.png`。

### 3. 运行时依赖（隐藏项，一次性）

| 需要 | 为什么 | 没有时 |
| --- | --- | --- |
| 本目录 + 两个下层草稿（兄弟目录） | 上层用普通 `import()` 调下层 `runPreflight` | `combinator not found` |
| `bin/capability-adapter` | File Vitals JSONL `inspect` | `File Vitals JSONL adapter not found` |
| Node 18+（CLI） | 跑 `src/cli.mjs` | 换 Node。CLI 不要求 Node 22；Kit/契约工具才要。不要默认用作者 `.tools/node` |
| Go 1.26.6+ | **仅当**要重新编译适配器 | 已有本机刚编的 `bin/` 可跳过。干净环境按 `docs/CLEAN_ENV.md` 拉 pin 再编，不要默认用作者 `.tools/go` |

两个下层目录：

- `drafts/asset-delivery-preflight/`
- `drafts/channel-cover-preflight/`

只拷贝这一个文件夹不够。密封包 `dist/*.tar.gz` 里带了 `deps/`，但本环境不能走 Host 安装，默认仍用源码树。

---

## 怎样第一次运行

在本项目目录。系统 Node 20 即可跑 CLI；不必先 `openadam-dev check`。

```bash
cd drafts/batch-delivery-preflight

# 若 bin/capability-adapter 不存在或不可执行（干净环境见仓库 docs/CLEAN_ENV.md）：
scripts/build-file-vitals.sh

# 最短命令（作者自带的好夹具，用来确认工具能跑）
node src/cli.mjs --spec specs/good.json --root fixtures/good --compact

# 新任务 A：kiosk 徽标 + 海报（应 pass）
node src/cli.mjs \
  --spec handoff/tasks/kiosk-badge/campaign.json \
  --root handoff/tasks/kiosk-badge/delivery \
  --compact

# 新任务 B：文档站（第一次交货，宽图高度错，应 fail）
node src/cli.mjs \
  --spec handoff/tasks/docs-social/campaign.json \
  --root handoff/tasks/docs-social/delivery \
  --compact
```

退出码：`0` = 整批 pass；`1` = 整批 fail（这是检查结果，不是程序崩了）；`2` = 用法/规格/适配器错误。

不要从仓库根目录裸跑 `node src/cli.mjs`（相对路径对不上）。可以把 `--spec` / `--root` 写成绝对路径，但仍建议 `cd` 到本项目，这样能找到 `bin/capability-adapter` 和下层草稿。

`--compact` 只是少空格；结果字段一样。

---

## 结果怎么读

看 JSON 顶层这几项就够：

| 字段 | 含义 |
| --- | --- |
| `status` | `pass` 或 `fail`。`fail` 仍是一次成功的预检报告 |
| `summary.failedKits` | 哪几套没过，例如 `["social"]` |
| `summary.failedIds` | 去重后的检查 id，例如 `["height","aspect"]` |
| `summary.missing` | 必需套的目录根本不在 |
| `checks[]` | 有序明细。失败行带 `kit` / `slot` / `id` / `expected` / `observed` |

常见 `id`：

| id | 通常原因 |
| --- | --- |
| `kitMissing` | 战役写了这套，磁盘上没有这个 kit 目录 |
| `missing` | 槽位文件不在（path 相对 kit 根） |
| `extra` | kit 根下有未声明文件 |
| `name` / `namePattern` | 文件名或命名正则 |
| `format` | 字节格式（不是扩展名） |
| `width` / `height` / `aspect` | 像素 |
| `alpha` / `transparency` | 透明通道政策 |

**不要**因为 `status: fail` 再跑同一条命令。报告已经是答案。人决定改文件、改规格，还是接受这次 fail。

本方法**不会**帮你把缺的图生出来。

---

## 出问题怎么办

| 你看到的 | 先查 | 怎么修 |
| --- | --- | --- |
| `both --spec and --root are required` | 参数 | 两条都给 |
| `File Vitals JSONL adapter not found` | `bin/capability-adapter` | 仓库根 `sh scripts/fetch-deps.sh --file-vitals` 然后 `sh scripts/build-file-vitals.sh --all-drafts`（Go 1.26.6+，见 `docs/CLEAN_ENV.md`） |
| `combinator not found` | 兄弟草稿是否还在 | 不要只拷贝这一个目录 |
| `family must be batch-delivery` | 战役 JSON | 下层封面规格才是 `family: channel-cover`；图标规格没有 `family` |
| `unsupported field` / `forbidden field` | 规格里出现审美/生成字段 | 删掉 `quality` / `brand` / `generate` 等 |
| `kitMissing` | `kit.root` 对战役根 | 目录名要一致 |
| 同时 `missing` 和 `extra` | 槽位 `path` 和磁盘相对路径 | 差一层 `covers/` 是最常见的 |
| `specPath … not found` / 读到错误 JSON | `specPath` 相对战役 JSON 目录 | 不要相对 `--root` |
| Kit `check` 报 Node 版本 | 契约工具要 Node ≥22 | CLI 预检本身不需要 Node 22 |
| 想 `agent-host component import` | 本环境不做 | Linux 上 preview 已失败（GNU tar + 无 linux-x64 发行）。未授权不要 import |

卡住仍无法判断时，把完整 JSON（或 `--compact` 那一行 `status` / `failedKits` / `failedIds`）交给人，不要改规格里没有的字段。

---

## 两个新任务（跟练，不是作者开发夹具）

作者开发时用的是 `fixtures/good`、`missing-covers`、`icons-wrong-size`。下面两套是新文件 + 新规格。

| 任务 | 目录 | 期望 |
| --- | --- | --- |
| A kiosk-badge | `handoff/tasks/kiosk-badge/` | 整批 **pass** |
| B docs-social 第一次 | `…/docs-social/delivery` | **fail**，`failedKits=["social"]`，`height`+`aspect`（宽图 176×100，规格 176×99） |
| B 修复后 | `…/docs-social/delivery-fixed` | 只换了那张 JPEG → **pass** |

冷读者演练：`node handoff/run-drill.mjs`（仍在本项目目录）。记录写在 `handoff/observations/`。交接成本表：`handoff/COST.md`。

---

## 下层方法（被依赖，不是本轮主入口）

只预检一套图标：`drafts/asset-delivery-preflight/`（`node preflight.mjs --spec … --root …`）。  
只预检一套封面：`drafts/channel-cover-preflight/`（`node src/cli.mjs --spec … --root …`）。

上层不复制它们的槽位规则。你不必先读完那两份架构说明才能跑战役。

---

## 还不能交接的

- 真 Agent 会话里自动选用这条 Skill / MCP 工具（本环境没有把组件 import 进 Host）
- 用户本机 Agent Host 安装
- 缺图自动生成
- 公开目录 / 市场发布
- 独立第三方真人交接（M4 是演练；Batch C 是新会话 CLI 使用一份 `synthetic-authorized-substitute` 任务，仍不是第三方授权素材包）
