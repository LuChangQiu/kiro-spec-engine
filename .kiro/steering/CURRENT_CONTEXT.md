# 当前场景规则（可变）

> **重要**: 这些规则针对当前 Spec 场景优化，每个新 Spec 开始前应该更新。
> 基准规则请参考 `CORE_PRINCIPLES.md`，环境配置请参考 `ENVIRONMENT.md`

---

## 🎯 当前状态

**状态**: ✅ Spec 05 完成，准备发布 v1.3.0  
**Spec**: 05-00-agent-hooks-and-automation (已完成)  
**项目**: kiro-spec-engine  
**最后更新**: 2026-01-23

---

## 📝 当前 Spec 信息

**Spec 名称**: 05-00-agent-hooks-and-automation

**目标**: 实现跨工具自动化和 Agent Hooks 系统

**当前阶段**: ✅ 全部完成 (14/14 任务，100%)

**已完成核心功能**:
- ✅ Watch Mode 核心组件 (5个组件，2150+行代码)
- ✅ CLI 命令系统 (7个命令)
- ✅ 自动化预设 (4个预设)
- ✅ 工具检测和自动配置
- ✅ 手动工作流系统
- ✅ 完整测试覆盖 (289个测试)
- ✅ 项目文档更新

**版本发布**: v1.3.0 准备就绪

---

## 💡 历史 Spec 总结

**Spec 01-00**: npm-github-release-pipeline ✅ 已完成
- 核心成果：完整的 GitHub + npm 发布闭环

**Spec 02-00**: project-adoption-and-upgrade ✅ 已完成  
- 核心成果：项目采用系统、版本升级系统

**Spec 03-00**: multi-user-and-cross-tool-support ⏸️ Phase 1 完成
- 核心成果：Steering 管理、个人工作区、任务认领、团队状态、工作区同步
- 状态：核心功能完成，Phase 2 待定

**Spec 04-00**: ultrawork-integration-and-quality-automation ✅ 已完成
- 核心成果：文档增强系统、质量门控、工作流集成

**Spec 05-00**: agent-hooks-and-automation ✅ 已完成
- 核心成果：Watch Mode 自动化系统、工具检测、手动工作流
- 状态：全部完成，v1.3.0 发布

---

## 🔧 已完成的 Spec 功能

**Spec 04**: Ultrawork 质量增强系统 ✅
- 文档评估、改进识别、自动修改
- 质量评分、收敛控制、备份安全
- 工作流集成脚本

**Spec 03 Phase 1**: 多用户协作基础 ✅
- Steering 管理、个人工作区
- 任务认领、团队状态、工作区同步

**使用方法**: 参考各 Spec 的文档目录

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

**版本**: v3.0  
**创建**: 2026-01-22  
**项目**: 通用 Kiro AI-OS 模板  
**说明**: 已清理项目特定内容，可复制到简化测试项目使用
