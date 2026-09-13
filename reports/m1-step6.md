# Milestone 1 — 步 6：Developer Kit check / pack（不自动 import Host）

日期：2026-09-12  
工作根：`/workspace/openadam-procedure-reuse/`  
约束：不改 Host；不 `component import`；不实现 `raster.verify`；不改公开 catalog；不 push。  
Node：工作区 `.tools/node` **v22.23.2**。Kit CLI：`repos/agent-tool-development-kit` `node src/cli.mjs`（对该 clone 做了 `npm ci`，未改源码）。

结论先行：**草稿项目已手写 `agent-tool.json`，`openadam-dev check` PASS，`openadam-dev pack` 打出密封 `tar.gz`。** 观察仍只绑 `file.inspect@0.1.0` / File Vitals；对照仍是 `preflight.mjs`。为满足 Kit pack 的 MCP stdio 集成，加了**薄** MCP 载体，工具直接调用 `runPreflight`，没有 `CORE_NOT_IMPLEMENTED`。  
本机 Linux 上 `agent-host component preview` **未能**走完官方 CLI 准入（GNU tar 列表格式 + Host 不支持 `linux-x64`）；**没有 import**。抽出密封包后的 MCP 预检烟测通过。

---

## 1. 做了什么（最小诚实包装）

当前草稿是 Procedure 适配器 + CLI 预检，不是完整 MCP Provider 脚手架。没有 `openadam-dev init`，没有整仓复制 `templates/node-mcp-provider/`。

补齐 Kit 项目合同要求的事实：

| 路径 | 作用 |
| --- | --- |
| `drafts/asset-delivery-preflight/agent-tool.json` | 手写项目声明（Kit 不推断架构） |
| `docs/PRODUCT_MODEL.md` / `docs/REVIEW_CONTRACT.md` | 产品边界与审查合同 |
| `LICENSE` / `NOTICE` / `THIRD_PARTY_NOTICES.txt` / `sbom.spdx.json` | Apache-2.0 + 捆绑 File Vitals 适配器的第三方声明 |
| `packaging/agent-host-integration.json` | Host 集成 **v0.2**（MCP stdio + `suite-node`；无 v0.3 discovery） |
| `src/mcp-server.mjs` | 薄 MCP：工具 `asset_delivery_preflight` → `runPreflight` |
| `plugins/asset-delivery-preflight/` | Codex plugin / Skill / `.mcp.json` 身份文件 |
| `scripts/kit-development-check.mjs` | development-regression：语法 + 既有预检测试 + MCP 测试 |
| `scripts/package-component.mjs` | 只往 `OPENADAM_COMPONENT_STAGE` 写 payload |
| `scripts/run-procedure-conformance.sh` | **独立** `procedure-conformance` lane（PROJECT_CONTRACT 硬性要求） |

`contracts.procedureImplementationManifest` 指向步 5 的 `procedure/implementation-manifest.json`。没有声明 Capability provider manifest，因此没有 `capability-conformance` lane，也没有宣称新 Capability。

Carriers（均可执行、非空壳）：

- CLI：`preflight.mjs`
- Procedure JSONL：`procedure/adapter.mjs`
- MCP：`src/mcp-server.mjs`
- Skill + Codex plugin 身份文件

打包时复制进密封组件的运行时：`preflight.mjs`、MCP 载体、`bin/capability-adapter`（File Vitals JSONL `inspect`，`-trimpath` 构建以免源机路径泄漏）。

### 与步 4 绑定一致

- 观察：`org.openadam.file.inspect@0.1.0` / File Vitals
- 对照：组合代码
- **不**实现、不宣称 `raster.verify`
- 输出 `observer.capability` 仍是 `org.openadam.file.inspect@0.1.0`

### 与 Kit 的冲突与选择

Kit pack 的 Agent Host 集成形状**强制** MCP stdio（v0.2/v0.3/v0.5 都是）。纯 Procedure JSONL 不能单独密封。选择：加一层真实调用预检的 MCP，而不是为过检查留 scaffold。  
未上 v0.3 `skill-cli` discovery（Host 生成 launcher，provider 字节里不得带该路径）；Skill 只作身份与路由说明。

---

## 2. 命令与结果

工作根，Node 22 在 PATH：

```bash
export PATH="$PWD/.tools/node/bin:$PATH"

node repos/agent-tool-development-kit/src/cli.mjs check \
  --root drafts/asset-delivery-preflight --json

node repos/agent-tool-development-kit/src/cli.mjs pack \
  --root drafts/asset-delivery-preflight --json
```

### check — PASS

观察目录：`drafts/asset-delivery-preflight/.verify/openadam-dev/2026-09-12T012859-281Z`

| id | lane | status | 耗时 |
| --- | --- | --- | --- |
| `development` | `development-regression` | ok | ~1.5 s |
| `procedure-result-boundary` | `procedure-conformance` | ok | ~1.2 s |

development 输出末行：`PASS development-regression syntax+preflight+mcp`（17/17 测试，含步 3 的 11 个预检用例）。  
procedure-conformance 输出含：

```text
PASS capability-refs procedures=1 stages=1 capabilities=1
PASS contract-set org.openadam.asset-delivery.preflight@0.1.0 claim=result-boundary cases=4
PASS good-delivery-pass
PASS missing-required-slot-fail
PASS wrong-size-fail
PASS spec-height-change-fail
PASS result-conformance implementation=org.openadam.asset-delivery-preflight@0.1.0
PASS stage-provider-bindings stages=1 providers=1
```

### pack — PASS

观察目录：`drafts/asset-delivery-preflight/.verify/openadam-dev/2026-09-12T012910-931Z-pack`  
`hostAdmission: not-performed`（pack 不预览、不安装）

| 项 | 值 |
| --- | --- |
| 组件 id | `asset-delivery-preflight` `0.1.0` |
| 项目相对产物 | `drafts/asset-delivery-preflight/dist/asset-delivery-preflight-0.1.0.tar.gz` |
| 工作区副本 | `dist/asset-delivery-preflight-0.1.0.tar.gz` |
| 归档 | 2 299 155 bytes · `sha256:16dbceaa3ef4a6314dc22d972528ae20391787a3f7dbff3bc1e93ba80f8e33ed` |
| 描述符 | `sha256:02c2322e7fc4d612713144ac1b816c7376a7e73d120c79754d1cf82ba85b5cd8` |
| 文件 | 11（payload；另加 Kit 密封的 `component.json`） |
| SPDX | Apache-2.0 |

`scripts/package-component.mjs` 只向 `OPENADAM_COMPONENT_STAGE` 写入 marketplace/plugin/legal/适配器；**未**自写 `component.json` 或最终 archive。

---

## 3. Host preview（强烈建议；未 import）

Host CLI **要求** `--license-spdx`；本集成声明了 workspace grant，因此还需要 `--workspace-root`。`--standalone` 避免读写已安装 Agent 状态。

```bash
node repos/agent-host-suite/bin/agent-host.mjs component preview \
  --artifact "$PWD/drafts/asset-delivery-preflight/dist/asset-delivery-preflight-0.1.0.tar.gz" \
  --license-spdx Apache-2.0 \
  --standalone \
  --workspace-root "$PWD/drafts/asset-delivery-preflight" \
  --json
```

**官方 CLI 结果：失败，未 import。**

```text
LOCAL_COMPONENT_ARCHIVE_INVALID:
The local component archive inventory could not be bounded before extraction
```

原因（环境，不是包内容损坏）：

1. Host 用 `/usr/bin/tar -tvzf` 解析文件大小，正则按 **BSD/macOS** 列表（`uid` 数字 + owner + group）。本机是 **GNU tar 1.35**，行为 `root/wheel     4299`，对不上。
2. Host `package.json` 的 `os` 是 `darwin` / `win32`。把 GNU 列表改写成 BSD 形状后再调 `previewLocalComponent`，下一步是 `RELEASE_PLATFORM_UNSUPPORTED: No Agent Host release is available for linux-x64`。

未改 Host。未 `component import`。

**密封包内 MCP 烟测（抽出 tar.gz，不经 Host 准入）：** `suite-node` 启动 `runtime/mcp-server.mjs`，对 `fixtures/good` + `specs/good.json` 得到 `status: pass`、`observer.capability = org.openadam.file.inspect@0.1.0`；空参数得到 JSON-RPC `-32602`。证明密封字节里仍是真实预检，不是空壳。

---

## 4. 方法文件仍驱动执行

| 证明 | 结果 |
| --- | --- |
| `node --test preflight.test.mjs src/mcp-server.test.mjs` | 17/17 绿（含改规格改结果） |
| Kit `procedure-conformance` 4 例 result-boundary | 全 PASS |
| MCP 好套 / 缺槽 | 同一 `runPreflight`：pass / fail+`missing` |
| 密封包抽出后再跑 MCP | 好套仍 pass |

未复制对照逻辑。`procedure/adapter.mjs` 与 `src/mcp-server.mjs` 都 import `../preflight.mjs`。

---

## 5. 明确没做 / 限制

- 不改 Host 源码、profile、公开 catalog
- 不 `component import`、不安装到用户 Agent、不 push
- 不实现 `raster.verify`、不生成链 / `brand-asset.prepare`
- 无 composition-suite（仍后置）
- 无 v0.3 Skill-CLI discovery、无 Direct Capability 绑定
- 本机无法完成官方 `agent-host component preview` 准入（Linux / GNU tar / 无 linux-x64 发行）
- 为跑 Kit/Host CLI，在 `repos/agent-tool-development-kit` 与 `repos/agent-host-suite` 执行了 `npm ci`（host 因 `os` 字段用了 `--force`）；`git status` 源文件干净

---

## 6. 中文用户摘要

本草稿已经是 Kit 能检查、能打包的项目：手写了 `agent-tool.json`，`check` 通过，打出了密封 `tar.gz`（约 2.2 MiB），路径在草稿 `dist/` 和工作区 `dist/`。  
预检方法没变：File Vitals 观察文件，普通代码对照套装；没有做成 `raster.verify`。  
为了让 Kit 能密封成 Host 组件，加了一层很薄的 MCP，工具会真的跑原来的预检，不是空壳。  
好套、缺文件、改规格这些既有测试和 Procedure 符合性都还是绿的。  
没有改 Host、没有 import、没有发布。这台 Linux 机器上官方 `component preview` 走不通（Host 按 macOS/Windows 的 tar 和平台来的），抽出包自己启动 MCP 仍能预检通过。
