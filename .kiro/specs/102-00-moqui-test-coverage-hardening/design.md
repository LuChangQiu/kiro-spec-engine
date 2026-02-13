# 设计文档：Moqui Test Coverage Hardening

## 概述

采用“纯单元 mock + 命令路径测试”的策略，避免真实网络依赖，确保测试稳定和可重复。

## 测试分层

### 1. Protocol 层

- 文件：`tests/unit/scene-runtime/moqui-client.test.js`
- 方法：mock `_httpRequest`，覆盖认证与重试状态机

### 2. Adapter 层

- 文件：`tests/unit/scene-runtime/moqui-adapter.test.js`
- 方法：覆盖新增 ref 解析与 HTTP 映射

### 3. Command 层

- 文件：`tests/unit/commands/scene.test.js`
- 方法：通过依赖注入模拟 client 与配置加载

## 质量门槛

1. 新增测试必须断言 error code/message 关键字段
2. 命令测试必须包含 `--json` 与非 `--json` 两个分支
3. 关键回归点（job-status 路径、discover 新类型）必须有独立 case
