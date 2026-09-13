# 交接成本表

对象：`batch-delivery-preflight`（两层战役预检）。  
读者：没有参与 M1–M3 的人或 Agent。  
演练：`HANDOFF.md` 最短命令 + `handoff/run-drill.mjs`。  
不是真·第三方会话，也不是本机 Host 安装。本表按「照着入口文档跑」和「跳过文档会踩的坑」分开写。

## 总表

| 项 | 照着 `HANDOFF.md` | 跳过入口 / 只看 M3 夹具 |
| --- | --- | --- |
| 补问 | **0** | 约 3–5 问（见下） |
| 路径改动 | **0** | 1 处 cwd，或 1 层 `covers/` 嵌套 |
| 手工改文件 | 任务 B：**1** 张 JPEG（方法要抓的缺陷，不是交接缺陷） | 另加 README/规格误放进 kit 根则要删 |
| 隐藏依赖踩中 | 否（文档已写） | 很容易 |
| 只靠入口能否跑通 | **能**（系统 Node v20.19.2，已有 `bin/capability-adapter`） | 短路径从仓库根跑会 `ENOENT` |
| Host import | 未做 | 未做 |
| 真 Agent 选用 Skill | 未做、不能声称 | 未做 |

## 环境（实测 2026-09-12）

| 依赖 | 冷读者是否要自己解决 |
| --- | --- |
| Node | CLI 用系统 **v20.19.2** 即可。不必 `.tools/node`。Node 22 只给 Kit check / 契约工具。 |
| Go 1.26.6+ | **不必**。`bin/capability-adapter` 已在树里。 |
| 两个下层草稿 | **要在兄弟目录**。只拷贝本文件夹会 `combinator not found`。 |
| `repos/file-vitals` | 重建适配器才要。本次没重建。 |
| Agent Host | 不要。Linux preview 已失败；未授权 import。 |
| npm 依赖 | CLI 预检无。 |

## 两个新任务

| 任务 | 与作者夹具的差别 | 结果 | 修复 |
| --- | --- | --- | --- |
| A `kiosk-badge` | 新名 `badge-24/48/96`+`plate`+`poster-*`；新尺寸 24/48/96/200×80 与 80/192×108/108×192；扁平 kit 根；kit id 不是 icons/covers | **pass**，38 checks | 无 |
| B `docs-social` 第一次 | 新名 `favicon-*` / `card-*`；32/64 与 72/176×99/99×176；可选 4:5 缺席；宽图故意 176×100 | **fail** `failedKits=["social"]` `failedIds=["height","aspect"]`；favicon 套仍 pass；`expected` 99 / 16:9，`observed` 100 / 44:25 | 换 1 张 JPEG |
| B 修复后 | 仅 `card-wide.jpg` 176×99 | **pass**，28 checks | — |

17 个新像素文件相对作者 `fixtures/good` 的 sha256 **重叠 0**。不是 good 改名。

## 卡住点（演练里故意踩的）

| 卡住点 | 现象 | 入口文档是否已写 | 手工改多少 |
| --- | --- | --- | --- |
| 仓库根粘贴 HANDOFF 短路径 | `ENOENT` …/`handoff/tasks/...` 或 `Cannot find module …/src/cli.mjs` | 已写必须 `cd` 到本项目 | 0 文件；改 cwd |
| 仓库根 + 长相对路径 | 能 pass（适配器按 CLI 文件位置解析） | 已写可用绝对路径 | 0 |
| 把 M3 的 `covers/…` 前缀套到扁平海报 | `missing` + `extra`，`failedKits=["posters"]` | 已写槽位 path 相对 kit 根，不必抄 `covers/covers/` | 改规格 path 或加一层目录，1 处布局 |
| kit 根里放 README.md | `extra` on `badge` | 已写不要把 README/规格放进 kit 根 | 删 1 个文件 |
| 战役 JSON 加 `quality` | 退出码 2，`forbidden field` | 已写禁止审美字段 | 删字段 |
| 适配器缺失 | 本次未发生 | 已写 `scripts/build-file-vitals.sh` | 0（已有二进制） |
| `specPath` 相对 `--root` | 未在新任务上踩中（规格与战役 JSON 同树） | 已写相对战役 JSON 目录 | — |

## 补问清单（外人可能问；入口已答则不算欠债）

1. 系统 Node 20 能不能跑？（能，CLI 可以。）
2. 要不要装 Go / 编 File Vitals？（有 `bin/capability-adapter` 就不用。）
3. `specPath` 相对谁？（战役 JSON 所在目录。）
4. 为什么作者夹具是 `covers/covers/`？（旧封面规格带 `covers/` 前缀；新任务用扁平 path。）
5. 能不能 `component import`？（本环境默认不能、未授权。）

照着 `HANDOFF.md` 跑任务 A/B：**这 5 问都不必再问作者。**

## 还不能交接

- 真 Agent 会话里选中这条 Skill / MCP 工具
- 用户本机 Agent Host 安装
- 缺图或错图的自动生成（任务 B 的修复仍是人换文件）
