# Design Document

## Overview

采用“先观测、再修复、后收敛”的三步策略：

1. 建立 open handles 诊断入口
2. 对高风险测试补充清理逻辑
3. 逐步移除 `forceExit`

## Design Details

### 1. 诊断策略

- 增加诊断命令（如 `test:handles`）启用 Jest 句柄检测参数。
- 将检测结果落盘到 `custom/` 报告文件。

### 2. 修复策略

- 优先处理 `watch` 与 integration 测试中的异步资源。
- 对 child process、file watcher、timer 增加显式关闭。

### 3. 配置策略

- 将 `forceExit` 从默认路径中移除。
- 如需过渡，设置仅限临时场景的 fallback 脚本。

## Verification

1. 诊断命令可输出可读问题列表。
2. full 测试无强制退出提示。
3. 变更记录进入 `CHANGELOG.md`。
