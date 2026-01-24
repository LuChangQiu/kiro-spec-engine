# 当前场景规则（可变）

> **重要**: 这些规则针对当前 Spec 场景优化，每个新 Spec 开始前应该更新。
> 基准规则请参考 `CORE_PRINCIPLES.md`，环境配置请参考 `ENVIRONMENT.md`

---

## 🎯 当前状态

**状态**: 🚀 Spec 09 已创建 - 文档治理自动化  
**Spec**: 09-00-document-governance-automation  
**阶段**: 规划完成，准备执行  
**项目**: kiro-spec-engine  
**最后更新**: 2026-01-24

---

## 📝 当前 Spec 信息

**Spec 09-00**: document-governance-automation 🚀 规划完成
- 目标：开发自动化工具强制执行文档生命周期管理规则
- 核心功能：
  - 文档检测和诊断 (kse doctor --docs)
  - 自动清理工具 (kse cleanup)
  - 目录结构验证 (kse validate)
  - 自动归档工具 (kse archive)
  - Git Hooks 集成 (kse hooks install)
  - 配置和统计 (kse config docs, kse docs stats)
- 技术栈：Node.js, Jest, fast-check (property-based testing)
- 任务策略：可选的 property-based tests，专注核心功能 MVP

---

## 📝 最近完成的工作

**Spec 08-00**: document-lifecycle-management ✅ 已完成
- 文档分类系统：永久/归档/临时，清理6个临时文档，建立文档管理规范

---

## 💡 历史 Spec 总结

**Spec 08-00**: document-lifecycle-management ✅ 已完成
- 文档管理规范，清理6个临时文档，标准化目录结构

**Spec 07-00**: user-onboarding-and-documentation ✅ 已完成
- 文档改进项目，三层文档结构，6个工具指南，中英双语

**Spec 06-00**: test-stability-and-reliability ✅ 已完成
- 验证测试稳定性，10次连续运行100%通过，无需修复

**Spec 05-00**: agent-hooks-and-automation ✅ 已完成
- Watch Mode自动化、工具检测、手动工作流

---

## 💡 提示

### 开始新 Spec 前的检查清单

- [ ] 确认 Spec 已创建（requirements.md, design.md）
- [ ] 更新本文档为新 Spec 的场景信息
- [ ] 移除上一个 Spec 的详细内容
- [ ] 只保留当前 Spec 的核心信息
- [ ] 检查 token 使用率

### 内容精简原则

**每完成一个 Spec**:
- 立即精简历史详细内容
- 只保留核心经验教训
- 为新 Spec 腾出空间

**Token 管控**:
- Token 使用率 > 50% 时,立即精简本文档
- 删除已完成阶段的详细配置和命令
- 保留关键经验教训 (1-2 行)

---

**版本**: v9.0  
**创建**: 2026-01-24  
**项目**: kiro-spec-engine  
**说明**: Spec 09 规划完成，文档治理自动化系统设计完成，准备执行任务
