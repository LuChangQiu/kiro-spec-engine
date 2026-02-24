# Requirements Document

## Introduction

本 Spec 聚焦仓库链接 canonical 统一，解决当前文档中混用多套 GitHub 地址的问题，减少用户跳转歧义并提升品牌一致性。

## Requirements

### Requirement 1: Canonical 仓库地址统一

**User Story:** 作为文档维护者，我希望所有对外仓库链接使用统一 canonical 地址，以便用户总能到达同一目标仓库。

#### Acceptance Criteria

1. THE SYSTEM SHALL 定义唯一 canonical 仓库地址。
2. 文档中历史地址 SHALL 批量替换为 canonical 地址。
3. 关键入口（README/docs/FAQ/troubleshooting） SHALL 不再混用域名。

### Requirement 2: 防回归扫描

**User Story:** 作为发布负责人，我希望新增文档变更自动检查链接一致性，以便防止回归。

#### Acceptance Criteria

1. THE SYSTEM SHALL 提供链接一致性扫描脚本。
2. 扫描脚本 SHALL 在发布检查清单中可执行。

### Requirement 3: 变更可追踪

**User Story:** 作为审计方，我希望链接治理有记录，以便后续版本可追溯。

#### Acceptance Criteria

1. `CHANGELOG.md` SHALL 记录 canonical 化改进。
2. 发布验证报告 SHALL 可包含扫描结果摘要。
