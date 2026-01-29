# Steering 规则索引

> **快速参考**: 各文件职责和快速链接

---

## 📚 文件列表

| 文件 | 职责 | 更新频率 |
|------|------|---------|
| **CORE_PRINCIPLES.md** | 核心开发规范 | 很少 |
| **ENVIRONMENT.md** | 环境配置 | 很少 |
| **CURRENT_CONTEXT.md** | 当前 Spec 场景 | 每个 Spec ⚠️ |

---

## 🔗 快速链接

- **当前场景**: `CURRENT_CONTEXT.md` - 当前正在推进的 Spec
- **开发规范**: `CORE_PRINCIPLES.md` - 适用于所有 Spec 的规范
- **环境配置**: `ENVIRONMENT.md` - 项目环境信息
- **Spec 工作流**: `../ specs/SPEC_WORKFLOW_GUIDE.md` - Spec 创建和执行流程
- **体系说明**: `../README.md` - 新项目引导文档

---

## ⚠️ 重要提示

### CURRENT_CONTEXT.md 管控

- **每个新 Spec 开始前**：更新为新 Spec 的场景
- **Spec 推进中**：及时精简已完成内容
- **Spec 完成后**：清空，准备下一个 Spec
- **Token 消耗 > 50% 时**：立即精简

### Steering 目录严格管控 ⚠️⚠️⚠️

**关键规则**: `.kiro/steering/` 目录下的所有文件（包括子目录）会在每个 session 自动加载！

**只能放置**:
- ✅ CORE_PRINCIPLES.md - 核心开发原则
- ✅ ENVIRONMENT.md - 环境配置
- ✅ CURRENT_CONTEXT.md - 当前 Spec 场景
- ✅ RULES_GUIDE.md - 规则索引（本文件）

**禁止放置**:
- ❌ 分析报告、历史数据
- ❌ 临时文件、测试结果
- ❌ 详细文档、长篇说明
- ❌ 任何子目录

**违规后果**:
- 增加每个 session 的 token 消耗
- 减慢 AI 响应速度
- 污染核心规则上下文

**检测工具**:
```bash
node .kiro/specs/17-00-test-suite-optimization/scripts/check-steering-directory.js
```

**其他内容归档到**:
- 分析报告 → `.kiro/specs/{spec-name}/results/`
- 历史数据 → `.kiro/specs/{spec-name}/`
- 详细文档 → `docs/`

### 精简策略

- ❌ 删除：已完成阶段的详细配置、命令、表格
- ❌ 删除：历史测试数据和详细流程
- ✅ 保留：当前阶段的核心信息
- ✅ 保留：关键经验教训（1-2 行）

---

**版本**: v2.0  
**更新**: 2025-01-22
