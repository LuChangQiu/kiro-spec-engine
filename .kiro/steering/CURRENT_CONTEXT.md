# 当前场景规则

> Spec 21-00: .gitignore Auto-Fix for Team Collaboration

## 🎯 当前状态

**当前 Spec**: 21-00-gitignore-auto-fix

**阶段**: Spec 创建完成 ✅

**完成内容**:
- ✅ Requirements.md (已存在)
- ✅ Design.md (已创建)
- ✅ Tasks.md (已创建)

**目标版本**: v1.15.0

## 🎯 核心功能

自动检测和修复 .gitignore 文件，确保团队协作正常工作：
- 检测旧的 `.kiro/` 排除模式
- 替换为分层策略（提交 Specs，排除个人状态）
- 集成到 `kse adopt` 和 `kse upgrade` 流程
- 提供独立的 `kse doctor --fix-gitignore` 命令

## 🎯 下一步

用户可以开始执行任务：
1. 打开 `.kiro/specs/21-00-gitignore-auto-fix/tasks.md`
2. 点击任务旁的 "Start task" 开始实现

---

v48.0 | 2026-01-30 | Spec 21-00 创建完成
