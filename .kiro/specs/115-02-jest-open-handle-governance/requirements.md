# Requirements Document

## Introduction

本 Spec 聚焦 Jest 异步资源泄漏治理，目标是去除对 `forceExit` 的长期依赖，消除 “Force exiting Jest” 这类不确定信号，提升测试结果可信度。

## Requirements

### Requirement 1: 泄漏信号显式化

**User Story:** 作为测试维护者，我希望能稳定复现并定位 open handles，以便精确修复而不是强行退出。

#### Acceptance Criteria

1. THE SYSTEM SHALL 提供一条用于定位 open handles 的诊断执行路径。
2. WHEN 存在泄漏 THEN 日志 SHALL 能定位到具体测试或资源类型。

### Requirement 2: `forceExit` 治理

**User Story:** 作为质量负责人，我希望避免默认依赖 `forceExit`，以便测试结束行为可预期。

#### Acceptance Criteria

1. Jest 配置 SHALL 不再将 `forceExit` 作为常态依赖。
2. 若短期无法彻底移除 THEN SHALL 提供阶段性开关与明确移除计划。

### Requirement 3: 资源生命周期收敛

**User Story:** 作为开发者，我希望测试在结束时正确释放 watcher/timer/process，以便测试不悬挂。

#### Acceptance Criteria

1. 涉及 watch/process/timer 的测试 SHALL 在 `afterEach/afterAll` 显式清理。
2. 修复后执行 full 测试 SHALL 无强制退出提示。
