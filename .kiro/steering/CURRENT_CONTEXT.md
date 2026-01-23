# 当前场景规则（可变）

> **重要**: 这些规则针对当前 Spec 场景优化，每个新 Spec 开始前应该更新。
> 基准规则请参考 `CORE_PRINCIPLES.md`，环境配置请参考 `ENVIRONMENT.md`

---

## 🎯 当前状态

**状态**: ✅ Spec 已创建，待执行  
**Spec**: 01-00-npm-github-release-pipeline  
**项目**: kiro-spec-engine  
**最后更新**: 2026-01-22

---

## 📝 当前 Spec 信息

**Spec 名称**: 01-00-npm-github-release-pipeline

**目标**: 建立 kiro-spec-engine 项目的完整发布闭环（GitHub + npm）

**当前阶段**: Spec 文档已完成，准备执行任务

**核心内容**:
- ✅ Requirements: 10 个需求，覆盖仓库配置、npm 发布、Python 检测、CI/CD、文档等
- ✅ Design: 完整架构设计，包含 6 个核心组件和 8 个正确性属性
- ✅ Tasks: 19 个任务，可选任务已标记（测试相关）

**下一步**: 打开 tasks.md，点击任务旁的 "Start task" 开始执行

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
