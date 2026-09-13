# Milestone 4 — 脱离作者的交接

日期：2026-09-12  
工作根：`/workspace/openadam-procedure-reuse/`  
交接主对象：`drafts/batch-delivery-preflight/`（两层）  
下层依赖：`drafts/asset-delivery-preflight/`、`drafts/channel-cover-preflight/`  
约束：不 Host import；不 push；不改公开 catalog；不把调用次数当价值；不生成缺失素材；不扩大 Host 核心。

结论先行：

1. **有外人能跟的入口。** `drafts/batch-delivery-preflight/HANDOFF.md` 写的是「能做什么 / 准备什么 / 最短命令 / 怎么读结果 / 出事怎么办」，不是架构说明书。
2. **两套新任务不是 good 改名。** kiosk-badge 整批 pass；docs-social 第一次因宽图 176×100 失败并定位到 kit/slot/check，换一张 JPEG 后 pass。17 个新像素相对作者 good 夹具 sha256 重叠为 0。
3. **照着入口文档能跑通 CLI。** 系统 Node v20.19.2，不必 Node 22，不必重编 Go 适配器。跳过 `cd` 或照抄 M3 的 `covers/` 嵌套会卡住——入口已经写明。
4. **还不能交接的仍然诚实：** 真 Agent 会话选用、本机 Host 安装。Skill 禁止用「你必须调用 Procedure」冒充采用。
5. **未** import Host、未 push、未改公开仓。`openadam-dev check` 仍 ok（13 测 + 5 例 result-boundary）。

本轮冷读者是实施侧按 `HANDOFF.md` 跑的脚本，不是第三方真人、也不是装进 Host 的 Agent。

---

## 1. 入口材料

| 给谁 | 路径 |
| --- | --- |
| 人（主入口） | `drafts/batch-delivery-preflight/HANDOFF.md` |
| Agent | 同文件顶部说明 + `handoff/AGENT.md` + 已改的 Skill |
| 成本 | `handoff/COST.md` |
| 演练 | `handoff/run-drill.mjs` → `handoff/observations/drill.md` |
| 下层 | 各自 README 顶部指向上层 HANDOFF；不另写第三份架构 |

HANDOFF 覆盖的五件事：

- 能替你做：只读对照战役 kit 清单，报 `status` / `failedKits` / `failedIds`
- 不做：生成、审美、`raster.verify`、ICO/ICNS、Host 安装
- 准备：战役目录 + 战役 JSON + kit 规格；槽位 path 相对 kit 根；`specPath` 相对战役 JSON 目录
- 最短命令：`cd drafts/batch-delivery-preflight` 然后 `node src/cli.mjs --spec … --root … --compact`
- 出事：适配器、兄弟草稿、family 字段、差一层目录、审美字段、不要 import

Skill 改动要点：默认走 CLI；仅当会话里**已经有** `batch_delivery_preflight` 才调用 MCP；写明「不要告诉用户必须调用本 Procedure」。密封 `dist/*.tar.gz` **未重打**，Host 仍不安装。

---

## 2. 新夹具（与作者开发夹具不同）

作者 M3 夹具：`fixtures/good`（icon-16/32/64/128 + wordmark + og-cover；`covers/covers/cover-*`）。

| 任务 | 规格 / 文件 | 意图 |
| --- | --- | --- |
| A kiosk-badge | `handoff/tasks/kiosk-badge/` | 店内 kiosk：24/48/96 徽标 + 200×80 铭牌 + 80 / 192×108 / 108×192 海报。扁平 kit 根。应 pass。 |
| B docs-social | `handoff/tasks/docs-social/` | 文档站：32/64 favicon + 72 / 176×99 / 99×176 社交卡；可选 4:5 缺席。第一次宽图 176×100。 |

不是 `cp fixtures/good` 改名。生成脚本：`handoff/generate-tasks.py`（只为写像素；跑预检不需要它）。

---

## 3. 冷读者演练

工作目录：`drafts/batch-delivery-preflight/`  
Node：`/usr/bin/node` **v20.19.2**  
适配器：开始时已有 `bin/capability-adapter`  
Host import：否

```bash
node src/cli.mjs --spec specs/good.json --root fixtures/good --compact
# status=pass  failedKits=[]

node src/cli.mjs --spec handoff/tasks/kiosk-badge/campaign.json --root handoff/tasks/kiosk-badge/delivery --compact
# status=pass  kits=2  checks=38  failedKits=[]  failedIds=[]
# badge → asset-delivery；posters → channel-cover
# inspect grant = …/delivery/badge 与 …/delivery/posters（不是战役根）

node src/cli.mjs --spec handoff/tasks/docs-social/campaign.json --root handoff/tasks/docs-social/delivery --compact
# status=fail  failedKits=["social"]  failedIds=["height","aspect"]
# card-wide  expected height=99 observed=100；aspect 16:9 vs 44:25
# favicons 仍 pass

node src/cli.mjs --spec handoff/tasks/docs-social/campaign.json --root handoff/tasks/docs-social/delivery-fixed --compact
# status=pass  failedKits=[]   ← 只换 JPEG，规格未改
```

`node handoff/run-drill.mjs`：三项期望全部命中；新像素与作者 good **sha256 重叠 0**。  
既有 `node --test src/preflight.test.mjs src/mcp-server.test.mjs`：**13/13**。  
`openadam-dev check --root drafts/batch-delivery-preflight`：`status: ok`。

### 只靠入口？卡住点？手工改了多少？

| | 记录 |
| --- | --- |
| 只靠 HANDOFF | **能跑通**任务 A；任务 B 的 fail 是输入缺陷，读报告即可定位，不必问作者 |
| 卡住（跳过 cd） | 仓库根粘贴短路径 → `ENOENT` 打到 `/workspace/.../handoff/tasks/...` |
| 卡住（照抄 M3 嵌套） | 扁平文件 + `posters/poster-*.png` path → `missing`+`extra` |
| 手工改 | 任务 B **1** 个文件（JPEG）。0 处改 CLI / 下层代码 / 规格字段。0 次重建适配器 |

详情：`handoff/COST.md`、`handoff/observations/drill.md`、`handoff/observations/traps.json`。

---

## 4. 验收三问（落到 M4）

1. **是否承接了重复劳动？** 外人不必再手跑两套下层 CLI 再自己对表。入口给出最短命令和结果读法。真会话里的「Agent 自己选用」还没发生。
2. **改方法 / 换输入是否仍按同一方法？** 新规格 + 新文件走同一 `runPreflight` 调度。任务 B 只换一张图，失败变通过。观察仍是 `file.inspect`，grant 仍是 kit 根。
3. **复用是否值得？** 相对再写脚本：增量是可跟的入口、失败定位、以及不复制下层规则。不值得的做法（Host 强装、伪造 Skill 采用、公开市场）没做。

---

## 5. 明确没做 / 限制

- 不 `component import`、不改 Host、不改公开 catalog、不 push
- 不生成缺失/错误素材
- 不宣称领域生产成熟
- 不把 CLI 调用次数当价值证明
- 密封包未重打（源码 Skill 已更新；包内 Skill 仍是 M3 文本）
- 冷读者不是独立第三方

公开仓 `file-vitals` / `procedure-contracts` / `capability-contracts` / `agent-tool-development-kit` / `agent-host-suite`：源文件 git 干净。

---

## 6. M5 是否值得开（建议，不开工）

剩下的真实阻碍：

1. **本机 Host 安装** — Linux 上 preview 仍会被 GNU tar 列表格式和 `linux-x64` 发行挡住。值得开的条件：下一个使用者在 macOS 或 Windows 上，并且明确授权 `component preview`（仍不要为 Linux 去改 Host 核心）。
2. **真 Agent 会话选用** — Skill 现在可给外人读，但没有会话证据。值得开的条件：有一个已安装工具的 Agent Host 会话，看它会不会在「预检这批交付」时走到 CLI/MCP，而不是靠作者点名。
3. **生成缺失素材** — 任务 B 已经表明 fail 之后人还要自己换图。这是产品线第二段，公开 `raster.prepare` / `asset-prep` 仍缺。只有当使用者的重复劳动已经从「对照」变成「补图」时才值得开；不要从本 Linux 工作区擅自开大范围生成链。

不值得借 M5 做的：公开市场、自动价值评分、工作流 DSL、Direct Runtime 嵌套、扩大 Host。

本轮停在 M4。

---

## 7. 中文战略摘要

这一轮做的是「让没写过这些方法的人，能用已经封装好的预检去处理新的文件」，不是再证明组合器能跑。

给使用者的入口在 `drafts/batch-delivery-preflight/HANDOFF.md`：它能替你做整批技术对照，不生成、不评好看、也不装进你电脑上的 Agent。准备战役目录和 JSON，在项目目录里跑一条 `node src/cli.mjs`。看 `status`、`failedKits`、`failedIds`；`fail` 就是答案，不要同一条命令重试。

两套新任务都不是把原来的 good 夹具改个名。店内 kiosk 的徽标和海报会通过。文档站那一套第一次宽图高度差 1 像素，报告会指到 social / card-wide / height 和 aspect；只换那张 JPEG，整批就通过。系统自带的 Node 20 就够跑，不必先装 Node 22，也不必重编 Go。

照着入口文档，冷读者不用再问作者。如果从仓库根目录粘贴短路径，或者把旧夹具的 `covers/covers` 嵌套抄到新任务上，会卡住——这些已经写进入口和成本表。

还不能交接的是：真的 Agent 会话自己选用这条方法，以及装进用户本机的 Agent Host。Skill 写明了没有安装时就走 CLI，禁止用「必须调用我们的 Procedure」来假装已经被采用。缺的图仍然要人自己准备。公开市场和改 Host 都不在范围内。
