# 当前场景规则

> **当前 Spec**: 26-00-repo-config-hotfix

## 🎯 当前状态

**阶段**: ✅ Spec 创建完成，准备执行任务

**Spec 概述**: 修复 v1.20.0 中的三个关键 bug（配置保存失败、父引用验证错误、git 命令重复）

**已完成**:
- ✅ requirements.md - 9 个需求（覆盖路径规范化、父引用验证、命令去重、向后兼容）
- ✅ design.md - 最小化修改设计，6 个正确性属性
- ✅ tasks.md - 7 个主任务（可选测试任务标记为 *）

**核心修复**:
1. ConfigManager 添加 `_normalizePath()` 方法
2. `_validateParentReferences()` 使用规范化路径比较
3. RepoManager `execInRepo()` 检测并避免 "git" 前缀重复

**下一步**: 
- 执行任务（打开 tasks.md，点击 "Start task"）
- 目标版本：v1.20.1（hotfix）

---

v72.0 | 2026-02-01 | Spec 26-00 创建完成

