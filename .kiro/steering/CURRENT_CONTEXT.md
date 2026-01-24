# 当前场景规则（可变）

> **重要**: 这些规则针对当前 Spec 场景优化，每个新 Spec 开始前应该更新。
> 基准规则请参考 `CORE_PRINCIPLES.md`，环境配置请参考 `ENVIRONMENT.md`

---

## 🎯 当前状态

**状态**: ✅ v1.7.0 已发布 - 交互式冲突解决系统  
**Spec**: 10-00-adopt-conflict-resolution-improvement ✅ 已完成  
**阶段**: 准备下一个 Spec  
**项目**: kiro-spec-engine  
**最后更新**: 2026-01-24

---

## 📝 当前 Spec 信息

**无活跃 Spec** - 准备开始新 Spec

**可选方向**:
- Spec 11-00: ai-autonomy-documentation-alignment (文档对齐 AI 自主性定位)
- 或其他新需求

---

## 📝 最近完成的工作

**v1.7.0 (2026-01-24)**: 交互式冲突解决系统 🎯
- 完成 Spec 10-00: adopt-conflict-resolution-improvement
- 核心功能：交互式冲突解决（跳过/覆盖/逐个审查），选择性备份，文件差异查看器
- 新增组件：ConflictResolver, SelectiveBackup, DiffViewer
- 增强模式：Force/Auto/Dry-run 模式，完整错误处理
- 测试：616 tests pass (7 skipped)
- 发布：GitHub Actions 自动发布到 npm

**v1.6.4 (2026-01-24)**: 添加 Kiro IDE 区分说明
- 防止 AI 工具混淆 kse 和 Kiro IDE

**v1.6.3 (2026-01-24)**: 修复 archive 命令推荐错误

---

## 💡 历史 Spec 总结

**Spec 10-00**: adopt-conflict-resolution-improvement ✅ 已完成
- 交互式冲突解决系统，选择性备份，差异查看器

**Spec 08-00**: document-lifecycle-management ✅ 已完成
- 文档管理规范，清理临时文档

**Spec 07-00**: user-onboarding-and-documentation ✅ 已完成
- 三层文档结构，6个工具指南，中英双语

**Spec 05-00**: agent-hooks-and-automation ✅ 已完成
- Watch Mode自动化、工具检测

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

**版本**: v11.0  
**更新**: 2026-01-24  
**项目**: kiro-spec-engine  
**说明**: v1.7.0 已发布，Spec 10 完成，交互式冲突解决系统上线
