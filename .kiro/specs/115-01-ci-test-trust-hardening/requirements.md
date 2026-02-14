# Requirements Document

## Introduction

本 Spec 聚焦“CI 测试可信度”，目标是解决当前 CI 只跑 integration 的覆盖盲区，并建立分层测试策略，确保回归风险可控。

## Requirements

### Requirement 1: 分层测试策略

**User Story:** 作为维护者，我希望区分 smoke 与 full 测试策略，以便在速度与可信度之间平衡。

#### Acceptance Criteria

1. THE SYSTEM SHALL 提供快速 smoke 测试入口（用于 PR 快速反馈）。
2. THE SYSTEM SHALL 提供 full 测试入口（覆盖 unit/integration/properties）。
3. WHEN 发布前或主分支校验 THEN full 测试 SHALL 作为强门禁。

### Requirement 2: Skip 测试治理

**User Story:** 作为质量负责人，我希望降低 `test.skip` 规模并防止新增，以便避免“绿灯但无覆盖”。

#### Acceptance Criteria

1. THE SYSTEM SHALL 统计并报告现存 skip 测试分布。
2. THE SYSTEM SHALL 提供防回归检查，阻止新增 skip 测试（白名单例外可配置）。
3. WHEN skip 数量下降 THEN 结果 SHALL 被记录到验证报告。

### Requirement 3: 文档与发布对齐

**User Story:** 作为发布执行者，我希望测试策略在文档中可追踪，以便团队按统一方式执行。

#### Acceptance Criteria

1. `README` 与 `docs/release-checklist.md` SHALL 明确 smoke/full 的使用场景。
2. `CHANGELOG.md` SHALL 记录测试策略变更。
