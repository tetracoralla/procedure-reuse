# Milestone 5 — 有边界：按规格生成交付版本 + 再预检

日期：2026-09-12  
工作根：`/workspace/openadam-procedure-reuse/`  
落点：`drafts/asset-delivery-generate/`  
预检复用：`drafts/asset-delivery-preflight/` 的 `runPreflight` / `parseSpec`  
约束：不改 Host；不 `component import`；不 push；不改公开 catalog；不宣称 `raster.prepare` / `brand-asset.prepare` / `asset-prep`。

结论先行：

1. **交付链第二段补上了「按槽位写出」**，范围收在图标 PNG 套装：一张源图 + 目标宽高/格式/命名 → 新目录写出 16/32/64/128，再跑已有预检。
2. **好源图一条龙 pass。** `master-256.png` + `specs/icons.json` → 四张 PNG → File Vitals 观察后对照 pass，exit 0。源文件 sha256 不变。
3. **源图不够大是生成失败，不是预检失败。** 32×32 源对着 64/128 槽：`stage=generate`，`sourceTooSmall`，不写槽位文件。改规格 `icon-64` 64→48，生成结果变成 48×48；拿原规格再预检则 `width`/`height` 失败。
4. **制作合同仍然未公开实现。** 本轮是普通 PNG cover-crop + 禁止放大，不是 `raster.prepare`，不是四阶段 `brand-asset.prepare`，没有绑定 `asset-prep`。
5. **未** import Host、未 push、未改公开仓。未做 Kit pack / MCP（本轮不需要）。

---

## 1. 选型（夹具成本）

| 选项 | 为何选 / 不选 |
| --- | --- |
| **图标套装（本轮）** | 四张正方形 PNG、同一 alpha 政策、扁平文件名；源 256×256 即可。规格可直接喂给 M1 `parseSpec`。 |
| 渠道封面 | 要 JPEG、嵌套 `covers/`、三种宽高比、禁止透明；夹具和编码器都更贵。 |
| 完整 6 槽 `good.json` | wordmark 320×64、og-cover 640×360 不是「多尺寸」，还像在发明封面。256 源会在生成阶段因禁止放大失败（已实测）。 |

生成器身份是草稿实现 `org.openadam.asset-delivery-generate@0.1.0`，**不进**公开 catalog。

---

## 2. 行为边界

| 项 | 本轮 |
| --- | --- |
| 输入 | 一张 8-bit RGB/RGBA PNG + asset-delivery 槽位 JSON |
| 写出 | `--out` 新目录；默认不覆盖已有槽位；**永不写源文件** |
| 几何 | 居中 cover-crop，面积平均缩小；**禁止放大** |
| 格式 | 只写 PNG。JPEG 槽 → `slotFormatUnsupported`（生成失败） |
| 透明 | `alpha=present` 要求源有 alpha；`absent` 则压到不透明白底 |
| 失败区分 | JSON `stage`: `generate` \| `preflight`。exit 0 全过；1 领域失败；2 用法/规格/适配器 |
| 预检 | `import` 兄弟草稿的 `runPreflight`。对照代码不复制 |

明确不宣称：品牌贴标、透视、审美、透明边裁切、`org.openadam.raster.prepare`、`org.openadam.brand-asset.prepare`、`asset-prep`。

---

## 3. 验收证据

工作目录：`drafts/asset-delivery-generate/`  
Node：系统 `/usr/bin/node` **v20.19.2**（不必 Node 22）  
适配器：已有 `drafts/asset-delivery-preflight/bin/capability-adapter`

```bash
node src/cli.mjs --source fixtures/source/master-256.png --spec specs/icons.json --out /tmp/icon-pack --compact
# status=pass  stage=preflight  failedIds=[]
# observer.capability=org.openadam.file.inspect@0.1.0
# 写出 icon-16/32/64/128.png（64×64 File Vitals: PNG nrgba has_alpha=true）

node src/cli.mjs --source fixtures/source/too-small-32.png --spec specs/icons.json --out /tmp/icon-pack-small --compact
# status=fail  stage=generate  failedIds=["sourceTooSmall"]
# slots icon-64 与 icon-128；目录里没有槽位文件

node src/cli.mjs --source fixtures/source/master-256.png --spec specs/icons-64-as-48.json --out /tmp/icon-pack-48 --compact
# status=pass  stage=preflight；icon-64.png 实际 48×48

node ../asset-delivery-preflight/preflight.mjs --spec specs/icons.json --root /tmp/icon-pack-48 --compact
# status=fail  failedIds=["width","height"]
# icon-64 expected=64 observed=48
```

`node --test src/generate.test.mjs`：**9/9**。覆盖：好源一条龙、源太小、改规格改像素并改后续预检、生成成功但预检 name 失败、JPEG 槽生成失败、拒绝覆盖、源码不复制对照、无 alpha 源。

源码检查：`generate.mjs` / `pipeline.mjs` / `lower.mjs` 必须出现 `loadLower` 与 `runPreflight`，不得出现 `compareSlot` / `alphaPassed`。

观察记录：`drafts/asset-delivery-generate/observations/acceptance.json`。

公开仓 `file-vitals` / `procedure-contracts` / `capability-contracts` / `agent-tool-development-kit` / `agent-host-suite`：源文件 git 干净。

---

## 4. 验收三问（落到 M5）

1. **是否承接了重复劳动？** 人不必再按规格手导出 16/32/64/128，也不必生成后再另开一条预检命令。缺的仍是：贴标、透视、非 PNG、以及从一张方图变出 wordmark/og-cover。
2. **改方法 / 换输入是否仍按同一方法？** 同一源、只改 `icon-64` 宽高 64→48，写出的像素变了；用原规格预检从 pass 变 fail。换一张太小的源，失败停在 generate，不会假冒预检对照。
3. **复用是否值得？** 相对再写一遍宽高对照：增量是**真的写出文件** + **继续用 M1 预检**。不值得的做法（宣称 `raster.prepare`、改 Host、公开市场）没做。

---

## 5. 与未公开制作合同的关系

目录里的 `org.openadam.brand-asset.prepare@0.3.0` 仍是单张、destructive 四阶段：

1. `raster.prepare` `trim-transparent`
2. 可选 `projective.transform` `render`
3. `raster.prepare` `resize`（一张、一个宽高，contain/cover/stretch）
4. `raster.prepare` `apply-brand-mark`

公开能对上的实现仍只有透视那一段（Worldbend）；`asset-prep` / `brand-asset-prep` 仍不是公开仓。

本轮**有意不走那条合同**：没有 trim、没有透视、没有贴标、没有 `raster.prepare` Provider。只做套装级「多尺寸写出」，而且默认比 `raster.prepare resize` 更窄（禁止放大、只 PNG、一次多槽）。这是产品线第二段的**可交付切片**，不是把未公开制作链假装接通。

把 File Vitals 说成制作能力、或把本生成器登记成 `raster.prepare`，都会假。没有做。

---

## 6. 明确没做 / 限制

- 不 `component import`、不改 Host、不改公开 catalog、不 push
- 不做完整 `brand-asset.prepare`、不做 channel-cover 生成、不写 JPEG
- 不做 Kit check/pack、MCP、Skill（本轮载体是 CLI）
- 不做局部重做（失败则整次不写）；不做 Host 真安装
- 完整 6 槽交付规格（含 wordmark / og-cover）超出本切片：256 源会 `sourceTooSmall`

---

## 7. 下一步是否值得（建议，不开工）

本轮停在 M5。

1. **局部重做** — 现在是全成或全不成。值得开的条件：使用者已经在同一源上反复只改一两个槽位，重跑整包成了摩擦。现在一次四张很小，**还不必**。
2. **Host 真安装** — Linux 上 preview 仍会被 GNU tar 列表格式和 `linux-x64` 发行挡住（M1/M4 同因）。值得开的条件：下一个使用者在 macOS 或 Windows，并且明确授权 `component preview`。不要为 Linux 改 Host 核心。
3. **真 Agent 会话选用** — 仍无会话证据。值得开的条件：已安装工具的 Host 会话，看它会不会自己走到这条 CLI。
4. **channel-cover 生成或 JPEG** — 只有当重复劳动已经是「补封面尺寸 / 转 JPEG」时才值得；不要顺手把本切片扩成伪 `brand-asset.prepare`。
5. **公开 `raster.prepare` / `asset-prep`** — 仍缺仓。没有授权实现之前，继续用普通代码，继续标明不是那份合同。

不值得借本轮做的：公开市场、n8n 翻译、工作流 DSL、Direct Runtime 嵌套、扩大 Host。

---

## 8. 中文战略摘要

这一轮补的是交付链上「预检已经会说缺什么 / 尺寸不对」之后，**按规格把图标尺寸写出来再预检一遍**。人不用再手工导出 16/32/64/128，也不用生成完再自己对表。

入口在 `drafts/asset-delivery-generate/`：一张带透明通道的足够大的 PNG，一份槽位 JSON，一个新输出目录。一条 `node src/cli.mjs`。先看 JSON 里的 `stage`：`generate` 失败表示源图根本做不到（例如禁止放大时源比目标还小），通常没有写出槽位；`preflight` 失败表示文件已经写好，但既有预检没过。好源图会整条通过。

这不是品牌制作。公开目录里的 `brand-asset.prepare` 还是 trim、可选透视、单张 resize、贴标；实现和 `raster.prepare` 的 Provider 仍然不公开。本轮用普通 PNG 代码做多尺寸缩小，并且明确禁止放大、不做贴标和透视，所以不要把它说成已经接通制作合同。

改规格里的目标宽高，生成出来的像素会变，再用旧规格预检会失败——方法在跑，不是装饰。完整图标+字标+封面那一套，以及装进 Agent Host、让 Agent 自己选用，都还没做。公开市场和改 Host 仍不在范围内。
