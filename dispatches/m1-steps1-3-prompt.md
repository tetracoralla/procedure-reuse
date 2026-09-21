# Milestone 1 — 步 1–3：夹具 + File Vitals + 手写预检

你是实施 agent（Grok Build）。调度者 hostor。工作根：`/workspace/openadam-procedure-reuse/`。先读 `PLAN_BRIEF.md` 与 `reports/m1-inventory.md`。

## 目标
做出**有用的素材交付预检**草稿：期望规格驱动；改规格必须改结果；换符合同一规格的输入仍走同一方法。不改 Host，不新造 DSL，不碰公开仓目录（只读 `repos/`），代码与夹具只写在本工作区草稿里。

## 步 1 — 冻结夹具与期望规格
在 `drafts/asset-delivery-preflight/` 创建：

1. `fixtures/`：一套小交付（建议 4–8 个真实 PNG；可用程序生成合法 PNG，不要假扩展名空文件冒充）。至少覆盖：
   - 全部符合规格的「好套」目录 `fixtures/good/`
   - 「坏套」`fixtures/bad/`：错尺寸、错格式或错 alpha、缺必需槽、多余文件（可分多个 bad 子目录，或一个 bad 套内多问题）
2. `spec.example.json`（或 `specs/*.json`）：槽位 id、相对路径/文件名、format、width、height、alpha（present/absent/unknown 策略写清）、required。**禁止审美字段。**
3. `README.md`：人不用跑代码也能对照目录说出谁该过、谁该失败。

**验收：** 规格只有技术项；好坏预期写清楚。

## 步 2 — File Vitals 观察层
`repos/file-vitals` 已在盘点时 clone。构建 `finspect` 与 `capability-adapter`（注意 Go 版本要求；不够则升级工具链或记录阻塞并尽量用可用路径）。

对夹具跑单文件 inspect（及可选 batch），把样例输出落到 `drafts/asset-delivery-preflight/observations/`。

**验收：** JSON 可见 name、签名 format、width、height、可判定时的 has_alpha；unknown alpha 不得脑补。

环境：若 Go/Node 版本不够，优先安装满足 `file-vitals` 的 Go（go.mod 要求），再构建。不要因此改 Host。

## 步 3 — 手写组合器
在 `drafts/asset-delivery-preflight/` 用普通代码（优先 Node 或 Python）实现预检：

- 读规格 JSON
- 对每个必需路径调用 File Vitals **JSONL** `inspect`（显式 workspace grant / `OPENADAM_CAPABILITY_WORKSPACE_ROOT`）
- 对照：name / format / width / height / alpha + missing / extra
- 输出有序 checks + 整套 `pass|fail`（结构化 JSON）
- CLI 示例：`node preflight.mjs --spec specs/good.json --root fixtures/good`

**硬验收：**
1. 好夹具整套 pass；坏夹具按 check id 失败（`name`/`format`/`width`/`height`/`alpha`/`missing`/`extra`）
2. 改规格中某一期望宽高，同一套文件从 pass 变 fail（写进演示或小测试）
3. 无审美字段、无 Host 改动、无新 DSL
4. 不要把 File Vitals 宣称成 `raster.verify`；不要发明不存在的 Capability

提供：
- 可运行入口与依赖说明（`README.md` 更新）
- `reports/m1-steps1-3.md`：做了什么、如何跑、验收结果（含实际命令输出摘要）、已知限制（ICO/ICNS、batch 上限、alpha unknown 等）

## 明确不做
brand-asset.prepare 生成链、Kit 脚手架、公开目录改契约、push/发布/安装到用户 Agent、改 Host。

## 完成后
写中文「给用户的摘要」到 `reports/m1-steps1-3.md` 末尾（10 行内）：能跑什么、怎么跑、下一步建议。
