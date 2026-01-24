# 当前场景规则（可变）

> **重要**: 这些规则针对当前 Spec 场景优化，每个新 Spec 开始前应该更新。
> 基准规则请参考 `CORE_PRINCIPLES.md`，环境配置请参考 `ENVIRONMENT.md`

---

## 🎯 当前状态

**状态**: ✅ v1.6.4 已发布 - 添加 Kiro IDE 区分说明  
**Spec**: 10-00-adopt-conflict-resolution-improvement  
**阶段**: 规划完成，准备执行  
**项目**: kiro-spec-engine  
**最后更新**: 2026-01-24

---

## 📝 当前 Spec 信息

**Spec 10-00**: adopt-conflict-resolution-improvement 🚀 规划完成
- 目标：改进 kse adopt 命令的冲突处理机制，提供交互式冲突解决选项
- 核心功能：
  - 交互式冲突解决提示（跳过/覆盖/逐个审查）
  - 选择性备份（仅备份被覆盖的文件）
  - 文件差异查看器
  - Force/Auto/Dry-run 模式支持
  - 完整的错误处理和恢复
- 技术栈：Node.js, inquirer, chalk, fast-check (property-based testing)
- 任务策略：可选的 property-based tests，专注核心功能 MVP
- 新增组件：ConflictResolver, SelectiveBackup, DiffViewer

---

## 📝 最近完成的工作

**v1.6.4 (2026-01-24)**: 添加 Kiro IDE 区分说明 🎯
- 问题：iFlow (使用 GLM-4.7) 混淆 kse 和 Kiro IDE，下载了错误的软件
- 修复：在 README.md 和 README.zh.md 顶部添加醒目警告框
- 更新：package.json 描述明确说明"NOT the Kiro IDE desktop application"
- 影响：防止 AI 工具（尤其是小模型）混淆 kse 和 Kiro IDE
- 来源：真实用户反馈（iFlow 用 GLM-4.7 下载了 Kiro IDE）

**v1.6.3 (2026-01-24)**: 修复 archive 命令推荐错误 🐛
- 修复 `kse doctor --docs` 和 `kse status` 推荐错误命令的问题

**Spec 10-00**: adopt-conflict-resolution-improvement 🚀 规划完成
- 交互式冲突解决系统，三种策略（跳过/覆盖/逐个审查），选择性备份，差异查看器

**Spec 09-00**: document-governance-automation 📋 已创建
- 文档治理自动化工具规划

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

**版本**: v10.0  
**创建**: 2026-01-24  
**项目**: kiro-spec-engine  
**说明**: v1.6.4 已发布，添加 Kiro IDE 区分说明，防止 AI 工具混淆
