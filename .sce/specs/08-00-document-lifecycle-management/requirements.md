# Requirements - Document Lifecycle Management

**Spec**: 08-00-document-lifecycle-management  
**Created**: 2026-01-24  
**Status**: Draft

---

## 1. Overview

### 1.1 Problem Statement

当前项目存在文档管理混乱的问题：
- 临时性文档散落在根目录（SESSION-SUMMARY.md, COMMAND-STANDARDIZATION.md）
- Spec 内部有各种临时总结文档（MANUAL_TASKS_GUIDE.md, MVP_COMPLETION_SUMMARY.md, SPEC_COMPLETE.md, VERIFICATION-GUIDE.md）
- 没有明确的文档生命周期管理规则
- 长期来看，文档会越来越多，淹没真正重要的信息

### 1.2 Goals

建立清晰的文档分类和生命周期管理机制，确保：
- 永久性文档易于查找和维护
- 临时性文档有明确的归档或清理策略
- 项目根目录保持整洁
- Spec 目录结构清晰一致

---

## 2. Document Classification

### 2.1 Permanent Documents (永久保留)

**根目录级别**:
- README.md, README.zh.md - 项目入口文档
- CHANGELOG.md - 版本历史
- CONTRIBUTING.md - 贡献指南
- LICENSE - 许可证

**docs/ 目录**:
- 所有用户文档（quick-start.md, faq.md, troubleshooting.md等）
- 工具指南（docs/tools/）
- 示例文档（docs/examples/）

**Spec 目录**:
- requirements.md - 需求文档
- design.md - 设计文档
- tasks.md - 任务列表

### 2.2 Archival Documents (归档保留)

**Spec 产物** - 保留在 Spec 目录下的子目录：
- reports/ - 分析报告、测试报告
- scripts/ - 诊断脚本、工具脚本
- tests/ - 测试文件（如果不适合放在项目 tests/ 目录）
- results/ - 执行结果、验证结果

**归档规则**:
- Spec 完成后，产物文档保留在 Spec 目录
- 作为历史记录和参考资料
- 不影响项目根目录整洁度

### 2.3 Temporary Documents (临时删除)

**会话总结类**:
- SESSION-SUMMARY.md
- COMMAND-STANDARDIZATION.md
- 各种 *-SUMMARY.md

**临时指南类**:
- MANUAL_TASKS_GUIDE.md
- VERIFICATION-GUIDE.md
- MVP_COMPLETION_SUMMARY.md
- SPEC_COMPLETE.md

**处理策略**:
- Spec 完成后，提取关键信息到 CHANGELOG.md
- 删除临时文档，不保留
- 如果有价值，转化为永久文档（如 docs/ 下的指南）

---

## 3. Acceptance Criteria

### 3.1 Document Classification Rules

**AC 3.1.1**: 定义清晰的文档分类规则
- Given: 项目中的任何文档
- When: 需要判断文档类型
- Then: 能够明确判断是永久、归档还是临时文档

**AC 3.1.2**: 文档分类规则文档化
- Given: 新的 Spec 或文档需求
- When: 创建新文档
- Then: 有明确的指导说明文档应该放在哪里

### 3.2 Root Directory Cleanup

**AC 3.2.1**: 清理根目录临时文档
- Given: 根目录存在临时文档
- When: 执行清理操作
- Then: 只保留永久性文档

**AC 3.2.2**: 根目录文档数量控制
- Given: 项目根目录
- When: 查看文档列表
- Then: 除了标准文档（README, CHANGELOG, CONTRIBUTING, LICENSE）外，不应有其他 .md 文件

### 3.3 Spec Directory Structure

**AC 3.3.1**: 标准化 Spec 目录结构
- Given: 任何 Spec 目录
- When: 查看目录结构
- Then: 应该只包含：requirements.md, design.md, tasks.md 和子目录（reports/, scripts/, tests/, results/）

**AC 3.3.2**: 清理 Spec 临时文档
- Given: Spec 目录存在临时总结文档
- When: Spec 完成后
- Then: 临时文档应该被删除或归档到子目录

### 3.4 Documentation Guidelines

**AC 3.4.1**: 创建文档管理指南
- Given: 需要创建新文档
- When: 查阅文档管理指南
- Then: 能够明确知道文档应该放在哪里、何时归档、何时删除

**AC 3.4.2**: 更新 CORE_PRINCIPLES.md
- Given: 文档管理规则
- When: 添加到核心原则
- Then: 所有 Spec 都遵循统一的文档管理规则

---

## 4. Non-Functional Requirements

### 4.1 Maintainability

- 文档分类规则应该简单明了，易于理解和执行
- 不应该增加开发者的认知负担

### 4.2 Consistency

- 所有 Spec 应该遵循相同的文档结构
- 文档命名应该有统一的规范

### 4.3 Discoverability

- 重要的永久性文档应该易于发现
- 归档文档应该有清晰的组织结构

---

## 5. Out of Scope

- 不涉及代码文件的组织
- 不涉及测试文件的重组（tests/ 目录保持现状）
- 不涉及自动化清理工具的开发（手动清理即可）

---

## 6. Success Metrics

- 根目录 .md 文件数量 ≤ 4（README.md, README.zh.md, CHANGELOG.md, CONTRIBUTING.md, LICENSE）
- 所有 Spec 目录结构一致
- 有明确的文档管理指南文档
- CORE_PRINCIPLES.md 包含文档管理规则

---

**Version**: 1.0  
**Last Updated**: 2026-01-24
