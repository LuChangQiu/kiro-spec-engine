# 需求文档

## 简介

本 Spec 以回归稳定为目标，补齐 Moqui 相关测试缺口，重点覆盖 `moqui-client` 与 `scene connect/discover` 命令路径。

## 术语表

- **Coverage_Pack**: 本 Spec 新增的 Moqui 测试集合
- **Command_Path_Test**: 针对 CLI 的 normalize/validate/run/print 测试
- **Protocol_Test**: 针对 client 认证与重试协议的测试

## 需求

### 需求 1：MoquiClient 协议测试补齐

**用户故事：** 作为维护者，我希望客户端核心协议有测试保障，避免认证与重试回归。

#### 验收标准

1. THE 测试 SHALL 覆盖 login success/failure
2. THE 测试 SHALL 覆盖 401 -> refresh -> retry
3. THE 测试 SHALL 覆盖 refresh 失败后的 re-login
4. THE 测试 SHALL 覆盖 timeout/network/5xx retry 行为
5. THE 测试 SHALL 覆盖 dispose/logout 生命周期

### 需求 2：CLI 命令测试补齐

**用户故事：** 作为维护者，我希望 connect/discover 命令行为可回归。

#### 验收标准

1. THE 测试 SHALL 覆盖 `runSceneConnectCommand` 成功与失败路径
2. THE 测试 SHALL 覆盖 `runSceneDiscoverCommand` 各 `--type` 分支与 summary
3. THE 测试 SHALL 覆盖 `--json` 与人类可读输出分支

### 需求 3：新增能力回归护栏

**用户故事：** 作为开发者，我希望新增 endpoints/ref 语法都有对应测试。

#### 验收标准

1. THE 测试 SHALL 覆盖 `99-00/100-00/101-00` 的新增 ref 映射
2. THE 测试 SHALL 覆盖缺参校验与错误映射一致性
3. THE 测试 SHALL 在 CI 可稳定执行且不依赖真实 Moqui 实例
