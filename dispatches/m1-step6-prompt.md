# Milestone 1 — 步 6：Developer Kit check / pack（不自动 import Host）

你是实施 agent（Grok Build）。调度者 hostor。工作根：`/workspace/openadam-procedure-reuse/`。

先读：
- `PLAN_BRIEF.md`
- `reports/m1-inventory.md`（步 6）
- `reports/m1-step4-binding-decision.md`
- `reports/m1-step5.md`
- `drafts/asset-delivery-preflight/`（含 `procedure/`）
- `repos/agent-tool-development-kit/docs/PROJECT_CONTRACT.md`
- `repos/agent-tool-development-kit/templates/node-mcp-provider/`（样板，勿盲目整仓复制）
- Kit CLI：`repos/agent-tool-development-kit` → `node src/cli.mjs` / `openadam-dev`

## 目标
让素材交付预检草稿成为 **Kit 可 `check`、可 `pack` 的项目**：手写 `agent-tool.json`（Kit 不推断架构）；跑通检查；打出密封 `tar.gz`。  
可选：用现成 `agent-host component preview --artifact` 证明包可预览。  
**禁止** `component import`、改 Host、改公开 catalog、push/发布。

## 必须遵守
1. 继续步 4 绑定：观察 = `file.inspect` / File Vitals；对照在组合代码；**不**实现/宣称 `raster.verify`。
2. 复用已有 `preflight.mjs` + `procedure/`；避免两套对照逻辑。
3. 声明 Procedure manifest 时，**必须**有独立的 `procedure-conformance` check lane（PROJECT_CONTRACT 硬性要求）。
4. 不发明不存在的 Capability；carriers / probes 必须对应真实可执行入口。
5. 代码与产物只在 `drafts/asset-delivery-preflight/`（及本工作区 `dist/` / `reports/`）；`repos/` 只读。
6. Node：契约/Kit 可能需要 Node 22+；用工作区 `.tools/node`（步 5 已装）或按需补齐。

## 建议实施路径（可调整，但要诚实）
当前草稿是 Procedure 适配器 + CLI 预检，不是完整 MCP Provider 脚手架。你可以：

A. **最小诚实包装**：补齐 Kit 要求的文档（PRODUCT_MODEL / REVIEW_CONTRACT）、legal 文件、`agent-tool.json`、必要的 carrier（若 pack 强制 MCP/skill，就加**薄** MCP 或 skill，工具必须真实调用现有预检，禁止 scaffold 假实现留 `CORE_NOT_IMPLEMENTED`）。  
B. 若某条 Kit 要求与「只读预检草稿」冲突：在报告写明冲突与选择的最小子集；优先让 `check` + `pack` 对真实预检有意义，而不是为过检查造空壳。

包命令必须遵守 Kit：只往 `OPENADAM_COMPONENT_STAGE` 写 payload，不自写最终 `component.json`/archive（由 Kit 密封）。

## 验收
1. `openadam-dev check`（或等价 `node .../cli.mjs check`）对草稿项目 **PASS**（或报告精确失败并修到 PASS）。
2. `openadam-dev pack` 产出密封 `tar.gz`；路径写入报告。
3. （强烈建议）`agent-host component preview --artifact <tar.gz>` 能预览；**不要** import。
4. 报告 `reports/m1-step6.md`：做了什么、命令、结果、限制、中文用户摘要（10 行内）。
5. 证明方法文件/适配器仍驱动执行：至少复跑既有 procedure conformance 或预检测试仍绿。

## 明确不做
- Host 源码/profile 修改；自动 import；自动安装到用户 Agent  
- 公开目录改契约；新造工作流 DSL  
- 生成链 / brand-asset.prepare  
- 无限扩张成第二个通用 Provider 平台
