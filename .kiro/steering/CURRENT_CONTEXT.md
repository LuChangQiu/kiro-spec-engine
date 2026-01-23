# 当前场景规则（可变）

> **重要**: 这些规则针对当前 Spec 场景优化，每个新 Spec 开始前应该更新。
> 基准规则请参考 `CORE_PRINCIPLES.md`，环境配置请参考 `ENVIRONMENT.md`

---

## 🎯 当前状态

**状态**: 🔥 执行中  
**Spec**: 04-00-ultrawork-integration-and-quality-automation  
**项目**: kiro-spec-engine  
**最后更新**: 2026-01-23

---

## 📝 当前 Spec 信息

**Spec 名称**: 04-00-ultrawork-integration-and-quality-automation

**目标**: 修复 Ultrawork 工具并集成到 Spec 创建流程，确保所有 Spec 自动达到专业级质量（9.0/10）

**当前阶段**: 开始执行 Task 1 - 重构 Ultrawork 工具

**核心内容**:
- ✅ Requirements: 12 个需求，覆盖文档修改、质量评分、工作流集成、错误处理等
- ✅ Design: 10 个核心组件，12 个正确性属性，完整的错误处理策略
- ✅ Tasks: 20 个任务，4 个检查点

**下一步**: 重构现有 Ultrawork 工具代码，提取模块化组件

---

## 💡 历史 Spec 总结

**Spec 01-00**: npm-github-release-pipeline ✅ 已完成
- 发布版本：v1.0.0 - v1.2.3
- 核心成果：完整的 GitHub + npm 发布闭环，CI/CD 自动化

**Spec 02-00**: project-adoption-and-upgrade ✅ 已完成  
- 发布版本：v1.2.0 - v1.2.3
- 核心成果：项目采用系统、版本升级系统、备份回滚系统、完整文档

**Spec 03-00**: multi-user-and-cross-tool-support ⏸️ 待执行
- 目标：Steering 隔离、多人协同、跨工具兼容
- 状态：文档已创建，等待 Spec 04 完成后执行

---

## 🔧 Ultrawork 精神已集成

**可用工具**:
- ✅ `ultrawork_enhancer.py` - 三阶段质量增强工具
- ✅ `ultrawork.bat` - 便捷批处理脚本
- ✅ 专业级质量评估体系 (0-10 评分)

**使用方法**:
```bash
# 增强 Requirements
.\ultrawork.bat spec-name requirements

# 增强 Design  
.\ultrawork.bat spec-name design

# 检查 Tasks
.\ultrawork.bat spec-name tasks

# 全阶段增强
.\ultrawork.bat spec-name all
```

**参考文档**:
- `.kiro/README.md` - Kiro 系统说明
- `README.md` - 项目使用指南
- `ultrawork.bat` - 便捷脚本

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
