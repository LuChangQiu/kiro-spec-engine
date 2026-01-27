# Document Management Guide

**Purpose**: 明确的文档分类和生命周期管理规则  
**Created**: 2026-01-24

---

## 📋 Document Classification

### 1. Permanent Documents (永久保留)

**根目录**:
```
README.md, README.zh.md    # 项目入口
CHANGELOG.md               # 版本历史
CONTRIBUTING.md            # 贡献指南  
LICENSE                    # 许可证
```

**docs/ 目录**:
- 所有用户文档
- 工具指南（docs/tools/）
- 示例（docs/examples/）

**Spec 目录**:
```
requirements.md    # 需求
design.md          # 设计
tasks.md           # 任务
```

### 2. Archival Documents (归档保留)

**Spec 产物** - 保留在子目录：
```
reports/    # 分析报告、测试报告
scripts/    # 诊断脚本、工具脚本
tests/      # 特定测试文件
results/    # 执行结果
docs/       # Spec 特定文档
```

### 3. Temporary Documents (临时删除)

**会话总结类**:
- `*-SUMMARY.md`
- `SESSION-*.md`

**临时指南类**:
- `*-GUIDE.md` (除非转化为永久文档)
- `*-COMPLETE.md`
- `MVP-*.md`

---

## 🗂️ Directory Structure Rules

### Root Directory

**允许的 .md 文件**:
- README.md
- README.zh.md
- CHANGELOG.md
- CONTRIBUTING.md

**不允许**:
- 任何临时总结文档
- 任何会话记录文档
- 任何 Spec 特定文档

### Spec Directory

**标准结构**:
```
.kiro/specs/{spec-name}/
├── requirements.md       # 必需
├── design.md            # 必需
├── tasks.md             # 必需
├── reports/             # 可选：报告
├── scripts/             # 可选：脚本
├── tests/               # 可选：测试
├── results/             # 可选：结果
└── docs/                # 可选：文档
```

**不允许**:
- 根级别的 `*-SUMMARY.md`
- 根级别的 `*-GUIDE.md`
- 根级别的 `*-COMPLETE.md`

---

## 🔄 Document Lifecycle

### Creation Phase

**新建文档时**:
1. 确定文档类型（永久/归档/临时）
2. 选择正确的存放位置
3. 使用规范的命名

### Active Phase

**Spec 推进中**:
- 临时文档可以存在
- 但要明确标记为临时
- 产物文档放入子目录

### Completion Phase

**Spec 完成后**:
1. 提取关键信息到 CHANGELOG.md
2. 删除所有临时文档
3. 归档产物到子目录
4. 只保留三个核心文档

---

## ✅ Cleanup Checklist

### Root Directory Cleanup

- [ ] 删除所有 `*-SUMMARY.md`
- [ ] 删除所有 `SESSION-*.md`
- [ ] 删除所有临时指南文档
- [ ] 确认只有 4 个 .md 文件

### Spec Directory Cleanup

对每个已完成的 Spec：
- [ ] 删除根级别临时文档
- [ ] 移动产物到子目录
- [ ] 确认只有 requirements.md, design.md, tasks.md

---

## 📝 Naming Conventions

### Permanent Documents

- 使用清晰的名称：`quick-start.md`, `faq.md`
- 小写字母，连字符分隔
- 避免缩写

### Archival Documents

- 使用描述性名称：`initial-analysis.md`, `final-summary.md`
- 包含日期或版本号（如需要）
- 放在对应的子目录

### Temporary Documents

- 明确标记为临时：`TEMP-*.md`, `WIP-*.md`
- 使用大写以示区别
- Spec 完成后必须删除

---

## 🎯 Best Practices

### DO ✅

- 临时文档用完立即删除
- 产物文档归档到子目录
- 保持根目录整洁
- 遵循标准目录结构

### DON'T ❌

- 不要在根目录创建临时文档
- 不要在 Spec 根级别堆积文档
- 不要保留过时的总结文档
- 不要混淆永久和临时文档

---

## 🔍 Review Process

### Before Spec Completion

检查清单：
1. 所有临时文档是否已删除？
2. 产物文档是否已归档？
3. 目录结构是否符合规范？
4. 关键信息是否已提取到 CHANGELOG？

### Periodic Review

每个季度：
1. 审查根目录文档
2. 审查 Spec 目录结构
3. 清理遗漏的临时文档
4. 更新文档管理指南

---

## 📊 Success Metrics

- **Root Directory**: ≤ 4 .md files
- **Spec Consistency**: 100% 遵循标准结构
- **Temporary Docs**: 0 个临时文档残留
- **Discoverability**: 重要文档易于查找

---

**Version**: 1.0  
**Last Updated**: 2026-01-24  
**Status**: Active
