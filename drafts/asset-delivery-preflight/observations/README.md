# File Vitals 观察样例

本目录由 `scripts/capture-observations.mjs` 写入，证明观察层能读到 name、签名 format、width、height，以及可判定时的 `has_alpha`。省略 `has_alpha` 时不得脑补。

| 文件 | 来源 | 期望看见 |
| --- | --- | --- |
| `finspect-good-icon-16.json` | 好套 16px PNG | format PNG，16×16，`has_alpha: true` |
| `finspect-good-wordmark-opaque.json` | 好套 RGB wordmark | format PNG，320×64，`has_alpha: false` |
| `finspect-bad-wrong-size-icon-64.json` | 48×48 冒充 64 | width/height 是 48，不是规格 |
| `finspect-bad-wrong-format-wordmark.json` | JPEG 字节、`.png` 名 | 签名 JPEG，`extension_match: false` |
| `finspect-sample-vp8l-unknown-alpha.json` | VP8L WebP | 有宽高；**无** `has_alpha`（unknown） |
| `finspect-sample-ico-no-identity.json` | ICO 容器 | 不是已支持图标格式 |
| `finspect-batch-good.json` | 好套 6 文件 batch | 产品 CLI，不是 portable Capability |
| `jsonl-inspect-icon-16.jsonl` | capability-adapter `inspect` | 预检真正调用的 JSONL 信封 |

`finspect-summary.json` 只抽 name / format / width / height / has_alpha，便于人读。
