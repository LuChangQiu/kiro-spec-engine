# 设计文档：Orchestrate Live Status Stream

## 概述

通过“运行期快照 + watch 订阅”实现实时可见性。

## 设计方案

### 1. 快照写入

- 在 `orchestrate run` 生命周期事件（batch start/spec start/spec complete/spec failed）后触发快照写入。
- 文件路径继续使用 `.sce/config/orchestration-status.json`。

### 2. watch 模式

- 新增 `status --watch [--interval]`。
- 文本模式：重绘摘要。
- JSON 模式：每次输出一行 JSON。

### 3. 一致性

- 快照结构与 `StatusMonitor.getOrchestrationStatus()` 对齐。
- 退出条件使用 `status in {completed, failed, stopped}`。

## 变更点

- `lib/commands/orchestrate.js`
- `lib/orchestrator/orchestration-engine.js`
- `tests/orchestrator/orchestrate-command.test.js`
- `tests/orchestrator/orchestration-engine.test.js`
