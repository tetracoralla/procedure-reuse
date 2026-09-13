# Procedure 制作与复用 — 开工包（hostor 调度 / Grok Build 实施）

## 角色
- hostor：与用户对接、调度、验收转述
- Grok Build：实施；必须 `--reasoning-effort xhigh`（或 `--effort xhigh`），模型 `grok-4.6`

## 总目标（非目标）
补齐可复用方法的生产与消费链；**不是**通用工作流平台、画布编辑器、公共市场、跨平台工作流翻译器、无限嵌套。

## 主线三部分
1. Procedure 制作能力（基于 Developer Kit）
2. 组合方法再供给（小方法 → 高层 Provider，先两层）
3. 面向任务的交付与反馈

## 首条产品线
素材交付：先预检，再按需求生成交付版本，再模板化差异。

## 里程碑
1. 完成第一类真实工作（素材交付预检）— 可先手写组合
2. 另一方法经制作路径产生（Developer Kit 组合脚手架）
3. 一次真实两层复用
4. 脱离作者的交接
5. 按真实阻碍扩展（生成版本 / 局部重做 / 外部消费者）

## 硬约束
- 复用现有检查/打包/探测/安装；不重建
- 实现用普通代码 + 受控 Provider 调用；不新造工作流 DSL
- 私有方法可先不公共标准化
- 创作 Agent 不得发明不存在的能力
- 副作用走既有授权路径；不因包装扩大权限
- Host 默认不动；真失败才给最小可定位改动依据
- 证明「方法文件改变执行」，不是只生成元数据/跑固定样例

## 验收三问
1. 是否承接了人或 Agent 的重复劳动？
2. 改方法是否真正改变执行？换输入是否仍按同一方法？
3. 复用是否值得（相对脚本/现成工作流）？

## 公开核心仓库（tetracoralla）
- agent-host-execution-architecture（文档）
- capability-contracts
- procedure-contracts
- direct-execution-runtime
- agent-host-suite
- agent-tool-development-kit
- 相关 Provider：file-vitals、BatchTicket、migratory-time、math-anchor；观测旁路 agent-tool-observer
