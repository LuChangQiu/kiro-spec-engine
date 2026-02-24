# 实现任务

## 任务 1：OrchestratorConfig — 配置管理

- [x] 1.1 创建 `lib/orchestrator/orchestrator-config.js`
  - 实现 OrchestratorConfig 类
  - `getConfig()`: 读取 `.sce/config/orchestrator.json`，不存在时返回默认值
  - `updateConfig(updates)`: 合并写入配置
  - `getBootstrapTemplate()`: 获取 bootstrap prompt 模板
  - 默认值：agentBackend="codex", maxParallel=3, timeoutSeconds=600, maxRetries=2, apiKeyEnvVar="CODEX_API_KEY"
  - 无效 JSON 回退到默认配置，未知字段忽略
  - **验证**: Requirements 7.1, 7.2, 7.3, 7.4, 7.5

- [x] 1.2 OrchestratorConfig 单元测试
  - 创建 `tests/orchestrator/orchestrator-config.test.js`
  - 测试：默认配置、配置读取、配置更新、无效 JSON 回退、未知字段忽略
  - **验证**: Requirements 7.1-7.5

- [x] 1.3 🧪 Property 10：配置解析健壮性属性测试
  - 创建 `tests/orchestrator/orchestrator-config.property.test.js`
  - 使用 fast-check 生成随机配置对象（有效字段、无效字段、未知字段的任意组合）
  - 验证：已知有效字段正确加载、未知字段忽略、缺失字段使用默认值
  - **Validates: Requirements 7.4, 7.5**

## 任务 2：BootstrapPromptBuilder — Prompt 构建器

- [x] 2.1 创建 `lib/orchestrator/bootstrap-prompt-builder.js`
  - 实现 BootstrapPromptBuilder 类
  - `buildPrompt(specName)`: 构建包含 Spec 路径、kse 规范、steering 上下文、任务执行指令的 prompt
  - 支持自定义模板（通过 orchestrator.json 的 bootstrapTemplate 配置）
  - 默认模板包含：项目 README 摘要、Spec 路径、steering 上下文、执行指令
  - **验证**: Requirements 2.1, 2.2, 2.3, 2.4

- [x] 2.2 BootstrapPromptBuilder 单元测试
  - 创建 `tests/orchestrator/bootstrap-prompt-builder.test.js`
  - 测试：默认模板生成、自定义模板、Spec 路径包含、steering 上下文包含
  - **验证**: Requirements 2.1-2.4

- [x] 2.3 🧪 Property 2：Bootstrap Prompt 完整性属性测试
  - 创建 `tests/orchestrator/bootstrap-prompt-builder.property.test.js`
  - 使用 fast-check 生成随机 Spec 名称
  - 验证：prompt 包含 Spec 路径、kse 规范引用、任务执行指令
  - **Validates: Requirements 2.1, 2.2, 2.3**

## 任务 3：AgentSpawner — 进程管理器

- [x] 3.1 创建 `lib/orchestrator/agent-spawner.js`
  - 实现 AgentSpawner 类（继承 EventEmitter）
  - `spawn(specName)`: 通过 child_process.spawn 启动 `codex exec --full-auto --json --sandbox danger-full-access "<prompt>"`
  - 通过环境变量 CODEX_API_KEY 传递认证
  - 进程状态管理：running → completed/failed/timeout
  - 超时检测和强制终止（SIGTERM → 5s → SIGKILL）
  - `kill(agentId)`: 终止指定子进程
  - `killAll()`: 终止所有子进程
  - `getActiveAgents()`: 获取活跃子进程
  - 事件发射：agent:completed, agent:failed, agent:timeout, agent:output
  - 与 AgentRegistry 集成（启动时注册，完成时注销）
  - **验证**: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7

- [x] 3.2 AgentSpawner 单元测试
  - 创建 `tests/orchestrator/agent-spawner.test.js`
  - Mock child_process.spawn
  - 测试：进程启动参数、状态转换、超时处理、kill/killAll、事件发射
  - **验证**: Requirements 1.1-1.7

- [x] 3.3 🧪 Property 1：进程退出码 → 状态映射属性测试
  - 创建 `tests/orchestrator/agent-spawner.property.test.js`
  - 使用 fast-check 生成随机退出码
  - 验证：exit code 0 → completed, exit code 非 0 → failed
  - **Validates: Requirements 1.4, 1.5**

## 任务 4：StatusMonitor — 状态监控

- [x] 4.1 创建 `lib/orchestrator/status-monitor.js`
  - 实现 StatusMonitor 类
  - `handleEvent(agentId, event)`: 解析 Codex JSON Lines 事件
  - `getOrchestrationStatus()`: 返回编排整体状态
  - `getSpecStatus(specName)`: 返回指定 Spec 状态
  - `syncExternalStatus(specName, status)`: 更新 SpecLifecycleManager 和 ContextSyncManager
  - 支持事件类型：thread.started, turn.started, turn.completed, item.*, error
  - 无效 JSON 优雅处理（不抛异常）
  - **验证**: Requirements 4.1, 4.2, 4.3, 4.4, 4.5

- [x] 4.2 StatusMonitor 单元测试
  - 创建 `tests/orchestrator/status-monitor.test.js`
  - 测试：事件解析、状态聚合、外部状态同步、无效 JSON 处理
  - **验证**: Requirements 4.1-4.5

- [x] 4.3 🧪 Property 8：JSON Lines 事件解析属性测试
  - 创建 `tests/orchestrator/status-monitor.property.test.js`
  - 使用 fast-check 生成随机 JSON Lines 字符串（有效和无效）
  - 验证：有效 JSON 正确解析、无效 JSON 不抛异常
  - **Validates: Requirements 4.2**

- [x] 4.4 🧪 Property 9：状态报告完整性属性测试
  - 在 `tests/orchestrator/status-monitor.property.test.js` 中追加
  - 使用 fast-check 生成随机 Spec 状态集
  - 验证：报告包含所有 Spec、状态值为有效枚举
  - **Validates: Requirements 4.1, 4.5**

## 任务 5：OrchestrationEngine — 编排引擎

- [x] 5.1 创建 `lib/orchestrator/orchestration-engine.js`
  - 实现 OrchestrationEngine 类（继承 EventEmitter）
  - `start(specNames, options)`: 构建依赖图 → 计算批次 → 批次调度执行
  - `stop()`: 优雅终止所有子进程
  - `getStatus()`: 返回编排状态
  - 依赖图构建：与 DependencyManager 集成，环形依赖检测
  - 批次计算：拓扑排序，同层 Spec 分组
  - 并行度控制：同时运行 ≤ maxParallel
  - 失败传播：失败 Spec 的依赖链标记为 skipped
  - 重试机制：失败 Spec 自动重试（≤ maxRetries）
  - 与 SpecLifecycleManager 集成（状态转换）
  - 事件发射：batch:start, batch:complete, spec:start, spec:complete, spec:failed, orchestration:complete
  - **验证**: Requirements 3.1-3.7, 5.1-5.6, 8.1-8.5

- [x] 5.2 OrchestrationEngine 单元测试
  - 创建 `tests/orchestrator/orchestration-engine.test.js`
  - Mock AgentSpawner、DependencyManager、SpecLifecycleManager
  - 测试：批次计算、并行度控制、失败传播、重试、环形依赖检测、stop
  - **验证**: Requirements 3.1-3.7, 5.1-5.6

- [x] 5.3 🧪 Property 3：批次内无依赖属性测试
  - 创建 `tests/orchestrator/orchestration-engine.property.test.js`
  - 使用 fast-check 生成随机 DAG
  - 验证：同一批次内任意两个 Spec 无直接或间接依赖
  - **Validates: Requirements 3.3**

- [x] 5.4 🧪 Property 5：失败传播属性测试
  - 在 `tests/orchestrator/orchestration-engine.property.test.js` 中追加
  - 使用 fast-check 生成随机 DAG + 随机失败节点
  - 验证：所有直接/间接依赖失败节点的 Spec 被标记为 skipped
  - **Validates: Requirements 3.6**

- [x] 5.5 🧪 Property 6：环形依赖检测属性测试
  - 在 `tests/orchestrator/orchestration-engine.property.test.js` 中追加
  - 使用 fast-check 生成随机图（含环/无环）
  - 验证：有环 → 拒绝执行并报告路径，无环 → 正常构建计划
  - **Validates: Requirements 3.2**

- [x] 5.6 🧪 Property 7：重试策略正确性属性测试
  - 在 `tests/orchestrator/orchestration-engine.property.test.js` 中追加
  - 使用 fast-check 生成随机重试次数和上限
  - 验证：retryCount < maxRetries → 重试，retryCount >= maxRetries → 最终失败
  - **Validates: Requirements 5.2, 5.3**

- [x] 5.7 🧪 Property 4：并行度不变量属性测试
  - 在 `tests/orchestrator/orchestration-engine.property.test.js` 中追加
  - 使用 fast-check 生成随机 maxParallel 值和 Spec 集合
  - 验证：任意时刻 running 状态的 agent 数量 ≤ maxParallel
  - **Validates: Requirements 3.5**

- [x] 5.8 🧪 Property 11：不存在 Spec 错误报告属性测试
  - 在 `tests/orchestrator/orchestration-engine.property.test.js` 中追加
  - 使用 fast-check 生成随机 Spec 列表（含不存在的）
  - 验证：报告具体哪些 Spec 未找到，不启动执行
  - **Validates: Requirements 6.4**

## 任务 6：检查点 — 核心模块测试验证

- [x] 6 运行全量测试套件，确保所有新增测试通过且不影响现有 2361 个测试

## 任务 7：CLI 命令 — `kse orchestrate`

- [x] 7.1 在 `lib/commands/orchestrate.js` 中实现 CLI 命令
  - `kse orchestrate run --specs "<spec列表>" --max-parallel <N>`: 解析参数、构建引擎、启动编排
  - `kse orchestrate status`: 读取编排状态并格式化输出
  - `kse orchestrate stop`: 停止所有子 agent
  - 参数验证：Spec 存在性检查、maxParallel ≥ 1
  - 支持 `--json` 结构化输出
  - **验证**: Requirements 6.1, 6.2, 6.3, 6.4, 6.5

- [x] 7.2 在 `bin/kse.js` 中注册 orchestrate 命令

- [x] 7.3 CLI 命令单元测试
  - 创建 `tests/orchestrator/orchestrate-command.test.js`
  - 测试：参数解析、Spec 验证、状态输出、stop 命令
  - **验证**: Requirements 6.1-6.5

## 任务 8：模块导出与集成

- [x] 8.1 创建 `lib/orchestrator/index.js` 导出所有模块
  - 导出：OrchestratorConfig, BootstrapPromptBuilder, AgentSpawner, StatusMonitor, OrchestrationEngine

- [x] 8.2 集成测试
  - 创建 `tests/orchestrator/integration.test.js`
  - 测试 AgentSpawner + AgentRegistry 集成
  - 测试 OrchestrationEngine + SpecLifecycleManager 集成
  - Mock Codex CLI 进程验证端到端流程

## 任务 9：最终检查点

- [x] 9 运行全量测试套件，确保所有测试通过（目标：2361+ tests, 88+ suites, 0 failures）
