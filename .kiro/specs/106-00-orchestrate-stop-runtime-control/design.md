# 设计文档：Orchestrate Stop Runtime Control

## 概述

通过 Run_ID + 控制通道实现 stop 对活跃实例的真实控制。

## 方案

### 1. 运行注册

- run 启动时写入运行元数据：`runId`、pid、startedAt、status。
- 元数据路径：`.kiro/config/orchestration-runtime.json`。

### 2. 控制执行

- stop 读取运行元数据，定位活跃运行。
- 调用控制入口触发 `engine.stop()`。
- 失败时返回 `STOP_FAILED` 结构化错误。

### 3. 幂等

- 若状态已非 running，返回“no active run”并 exit 0。

## 变更点

- `lib/commands/orchestrate.js`
- `lib/orchestrator/orchestration-engine.js`
- `lib/orchestrator/agent-spawner.js`
- `tests/orchestrator/orchestrate-command.test.js`
