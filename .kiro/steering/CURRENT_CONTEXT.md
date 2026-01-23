# 当前场景规则（可变）

> **重要**: 这些规则针对当前 Spec 场景优化，每个新 Spec 开始前应该更新。
> 基准规则请参考 `CORE_PRINCIPLES.md`，环境配置请参考 `ENVIRONMENT.md`

---

## 🎯 当前状态

**状态**: 📝 Spec 07 已创建 - 用户引导和文档改进  
**Spec**: 07-00-user-onboarding-and-documentation  
**阶段**: Requirements-First 工作流完成（Requirements → Design → Tasks）  
**项目**: kiro-spec-engine  
**最后更新**: 2026-01-23

---

## 📝 当前 Spec 信息

**Spec 07-00**: user-onboarding-and-documentation 📝 规划完成
- 目标：系统梳理和改进文档体系，降低新用户学习曲线
- 范围：
  - 重构 README.md，聚焦核心价值和快速开始
  - 为 6 个主流 AI 工具创建专门使用指南
  - 创建可视化工作流程图（Mermaid）
  - 改进快速入门文档，5 分钟完成第一个 Spec
  - 创建 troubleshooting 和 FAQ 文档
  - 中英文文档同步更新
- 特点：纯文档项目，无代码变更
- 任务策略：可选验证测试，优先完成核心文档创建

---

## 📝 最近完成的工作

**Spec 06-00**: test-stability-and-reliability ✅ 已完成
- 目标：验证并修复测试套件的间歇性失败
- 结果：通过10次连续运行验证，测试套件100%稳定
- 产出：
  - Flaky test检测工具（可重用）
  - Async wait helpers测试工具库
  - 稳定性验证报告
- 结论：无需修复，测试已稳定，不发布v1.3.1

---

## 💡 历史 Spec 总结

**Spec 07-00**: user-onboarding-and-documentation 📝 规划完成
- 文档改进项目，三层文档结构，6个工具指南，中英双语

**Spec 06-00**: test-stability-and-reliability ✅ 已完成
- 验证测试稳定性，10次连续运行100%通过，无需修复

**Spec 05-00**: agent-hooks-and-automation ✅ 已完成
- Watch Mode自动化、工具检测、手动工作流

**Spec 04-00**: ultrawork-integration-and-quality-automation ✅ 已完成
- 文档增强系统、质量门控

**Spec 03-00**: multi-user-and-cross-tool-support ⏸️ Phase 1 完成
- Steering管理、任务认领、团队协作

**Spec 02-00**: project-adoption-and-upgrade ✅ 已完成  
- 项目采用系统、版本升级

**Spec 01-00**: npm-github-release-pipeline ✅ 已完成
- GitHub + npm发布闭环

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

**版本**: v7.0  
**创建**: 2026-01-23  
**项目**: kiro-spec-engine  
**说明**: Spec 07 已创建，文档改进项目规划完成，准备执行任务
