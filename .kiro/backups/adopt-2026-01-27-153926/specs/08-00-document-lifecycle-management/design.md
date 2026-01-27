# Design - Document Lifecycle Management

**Spec**: 08-00-document-lifecycle-management  
**Created**: 2026-01-24  
**Status**: Draft

---

## 1. Overview

### 1.1 Design Goals

- 建立清晰的文档分类和管理规则
- 清理现有的临时文档
- 确保未来文档管理的一致性
- 保持项目整洁和可维护性

### 1.2 Approach

这是一个纯文档管理的 Spec，不涉及代码开发：
1. 定义文档分类规则
2. 清理现有临时文档
3. 更新核心原则文档
4. 创建文档管理指南

---

## 2. Document Classification System

### 2.1 Classification Matrix

| 类型 | 位置 | 生命周期 | 示例 |
|------|------|---------|------|
| **永久文档** | 根目录, docs/, Spec核心 | 永久保留 | README.md, requirements.md |
| **归档文档** | Spec子目录 | Spec完成后保留 | reports/, scripts/ |
| **临时文档** | 任何位置 | Spec完成后删除 | *-SUMMARY.md, *-GUIDE.md |

### 2.2 Decision Tree

```
新建文档
├─ 是否是项目入口文档？
│  └─ 是 → 永久文档 → 根目录
│  └─ 否 → 继续
├─ 是否是用户文档？
│  └─ 是 → 永久文档 → docs/
│  └─ 否 → 继续
├─ 是否是 Spec 核心文档？
│  └─ 是 → 永久文档 → Spec根目录
│  └─ 否 → 继续
├─ 是否是 Spec 产物？
│  └─ 是 → 归档文档 → Spec子目录
│  └─ 否 → 继续
└─ 临时文档 → Spec完成后删除
```

---

## 3. Directory Structure Standards

### 3.1 Root Directory

**允许的文件**:
```
/
├── README.md              # 项目入口（英文）
├── README.zh.md           # 项目入口（中文）
├── CHANGELOG.md           # 版本历史
├── CONTRIBUTING.md        # 贡献指南
├── LICENSE                # 许可证
├── package.json           # npm配置
├── jest.config.js         # 测试配置
├── .gitignore             # Git忽略
└── .kiroignore            # Kiro忽略
```

**禁止的文件**:
- 任何 `*-SUMMARY.md`
- 任何 `SESSION-*.md`
- 任何 `*-GUIDE.md`（除非是永久指南，应放在 docs/）
- 任何 Spec 特定文档

### 3.2 Spec Directory

**标准结构**:
```
.kiro/specs/{spec-name}/
├── requirements.md        # 必需：需求文档
├── design.md             # 必需：设计文档
├── tasks.md              # 必需：任务列表
├── reports/              # 可选：分析报告、测试报告
├── scripts/              # 可选：诊断脚本、工具脚本
├── tests/                # 可选：Spec特定测试
├── results/              # 可选：执行结果
└── docs/                 # 可选：Spec特定文档
```

**禁止的文件**:
- 根级别的 `*-SUMMARY.md`
- 根级别的 `*-GUIDE.md`
- 根级别的 `*-COMPLETE.md`
- 根级别的 `VERIFICATION-*.md`

---

## 4. Document Lifecycle

### 4.1 Creation Phase

**步骤**:
1. 确定文档类型（永久/归档/临时）
2. 选择正确的存放位置
3. 使用规范的命名约定

**命名约定**:
- 永久文档：小写，连字符分隔（`quick-start.md`）
- 归档文档：描述性名称（`initial-analysis.md`）
- 临时文档：大写前缀（`TEMP-*.md`, `WIP-*.md`）

### 4.2 Active Phase

**Spec 推进中**:
- 临时文档可以存在
- 但要明确标记为临时
- 产物文档及时归档到子目录

### 4.3 Completion Phase

**Spec 完成后**:
1. 提取关键信息到 CHANGELOG.md
2. 删除所有临时文档
3. 归档产物到子目录
4. 验证目录结构符合规范

---

## 5. Cleanup Strategy

### 5.1 Immediate Cleanup (已完成)

**根目录**:
- ✅ 删除 `SESSION-SUMMARY.md`
- ✅ 删除 `COMMAND-STANDARDIZATION.md`

**Spec 目录**:
- ✅ 删除 Spec 01: `MANUAL_TASKS_GUIDE.md`, `MVP_COMPLETION_SUMMARY.md`
- ✅ 删除 Spec 03: `SPEC_COMPLETE.md`
- ✅ 删除 Spec 05: `VERIFICATION-GUIDE.md`

### 5.2 Verification

**检查清单**:
- [ ] 根目录只有标准文档
- [ ] 所有 Spec 目录结构一致
- [ ] 没有临时文档残留
- [ ] 产物文档已归档

---

## 6. Documentation Updates

### 6.1 Core Principles Update (已完成)

在 `CORE_PRINCIPLES.md` 中添加：
- ✅ 文档生命周期管理原则
- ✅ 文档分类规则
- ✅ 根目录管理规则
- ✅ Spec 目录管理规则

### 6.2 Management Guide (已完成)

创建 `DOCUMENT_MANAGEMENT_GUIDE.md`：
- ✅ 文档分类详细说明
- ✅ 目录结构规则
- ✅ 文档生命周期流程
- ✅ 清理检查清单
- ✅ 命名约定
- ✅ 最佳实践

---

## 7. Enforcement Mechanisms

### 7.1 Manual Review

**Spec 完成时**:
- 人工检查目录结构
- 验证临时文档已删除
- 确认产物已归档

### 7.2 Documentation

**指导文档**:
- CORE_PRINCIPLES.md - 核心规则
- DOCUMENT_MANAGEMENT_GUIDE.md - 详细指南
- 本 design.md - 设计说明

### 7.3 Future Automation (Out of Scope)

可能的自动化工具（未来考虑）:
- 自动检测临时文档
- 自动验证目录结构
- 自动生成清理报告

---

## 8. Success Criteria

### 8.1 Immediate Success

- ✅ 根目录临时文档已删除
- ✅ Spec 临时文档已删除
- ✅ CORE_PRINCIPLES.md 已更新
- ✅ DOCUMENT_MANAGEMENT_GUIDE.md 已创建

### 8.2 Long-term Success

- 所有新 Spec 遵循文档管理规则
- 项目保持整洁和可维护
- 文档易于发现和理解
- 没有文档混乱问题

---

## 9. Traceability Matrix

| Requirement | Design Component | Implementation |
|-------------|------------------|----------------|
| AC 3.1.1 | 2.1 Classification Matrix | DOCUMENT_MANAGEMENT_GUIDE.md |
| AC 3.1.2 | 2.2 Decision Tree | DOCUMENT_MANAGEMENT_GUIDE.md |
| AC 3.2.1 | 5.1 Immediate Cleanup | 手动删除 |
| AC 3.2.2 | 3.1 Root Directory | CORE_PRINCIPLES.md |
| AC 3.3.1 | 3.2 Spec Directory | CORE_PRINCIPLES.md |
| AC 3.3.2 | 5.1 Immediate Cleanup | 手动删除 |
| AC 3.4.1 | 6.2 Management Guide | DOCUMENT_MANAGEMENT_GUIDE.md |
| AC 3.4.2 | 6.1 Core Principles Update | CORE_PRINCIPLES.md |

---

## 10. Implementation Notes

### 10.1 No Code Changes

这个 Spec 不涉及任何代码修改：
- 纯文档管理
- 手动清理
- 规则文档化

### 10.2 Minimal Disruption

清理过程不影响：
- 项目功能
- 测试运行
- 用户使用

### 10.3 Immediate Benefits

- 项目更整洁
- 文档更易找
- 维护更简单
- 新人更友好

---

**Version**: 1.0  
**Last Updated**: 2026-01-24  
**Status**: Implementation Complete
