# 素材交付：按规格生成版本（草稿）

检查输入 → **生成所需版本** → 检查输出 → 交付。本目录只做有边界的第二段：**一张源 PNG → 图标套装多尺寸**，写到**新目录**，再调用已有预检。

不是 `brand-asset.prepare`，不是 `raster.prepare`，不绑定未公开的 `asset-prep`。缩放是普通 PNG 代码（cover 裁切、禁止放大）。对照规则仍在 `../asset-delivery-preflight/` 的 `runPreflight`，这里不复制。

预检、整批战役、外人入口仍从
[`../batch-delivery-preflight/HANDOFF.md`](../batch-delivery-preflight/HANDOFF.md)
进。本目录只补「缺尺寸时按规格写出」。

## 做什么 / 不做什么

做：

- 读一份 asset-delivery 槽位规格（宽高 / 格式 / 命名 / alpha）
- 从一张源 PNG 生成各 PNG 槽位到 `--out`
- 默认不改源文件、不覆盖已有槽位文件
- 生成成功后再跑 `asset-delivery-preflight`
- 任一**必需**槽无法生成（源太小、缺 alpha、非 PNG 等）则整次失败，不写部分文件

不做：

- 品牌贴标、透视、审美、透明边裁切
- JPEG / ICO / ICNS
- 放大（源 cover 区域小于目标宽高 → 生成失败）
- 完整四阶段 `brand-asset.prepare`
- Host import、公开 catalog

## 最短命令

工作目录：`drafts/asset-delivery-generate/`

```bash
node src/cli.mjs \
  --source fixtures/source/master-256.png \
  --spec specs/icons.json \
  --out /tmp/icon-pack \
  --compact
```

好源图（256×256、带 alpha）→ 写出 `icon-16/32/64/128.png` → 预检 **pass**，exit **0**。

故意失败（源 32×32，禁止放大，规格仍要 64/128）：

```bash
node src/cli.mjs \
  --source fixtures/source/too-small-32.png \
  --spec specs/icons.json \
  --out /tmp/icon-pack-small \
  --compact
```

`stage=generate`，`failedIds` 含 `sourceTooSmall`，**不写槽位文件**，exit **1**。这不是预检失败。

改规格必须改结果：

```bash
node src/cli.mjs --source fixtures/source/master-256.png --spec specs/icons-64-as-48.json --out /tmp/icon-pack-48 --compact
# icon-64.png 实际是 48×48；对该规格预检 pass
# 把这个目录再交给 icons.json 预检 → width/height 失败
```

## 怎么读结果

JSON 里先看 `stage`，再看 `status`。

| `stage` | `status` | exit | 含义 |
| --- | --- | --- | --- |
| `preflight` | `pass` | 0 | 写出了文件，且既有预检通过 |
| `preflight` | `fail` | 1 | 写出了文件，预检未过（看 `preflight.summary.failedIds`） |
| `generate` | `fail` | 1 | 源图满足不了规格（太小 / 无 alpha / 非 PNG 槽等），通常不写槽位 |
| （stderr） |  | 2 | 用法、规格、适配器错误 |

生成器声明：`generator.kind = ordinary-code`，`upscale = forbidden`。预检观察仍是 `org.openadam.file.inspect@0.1.0`。

## 测试

```bash
node scripts/write-source-fixtures.mjs   # 已提交的夹具；改图案时再跑
node --test src/generate.test.mjs
```

## 明确不是什么

- 不是公开 `org.openadam.raster.prepare` 的实现
- 不是 `org.openadam.brand-asset.prepare`（trim → 可选透视 → resize → 贴标）
- 不是 `raster.verify`；预检对照仍是 M1 组合代码
- 不把 File Vitals 说成制作能力
