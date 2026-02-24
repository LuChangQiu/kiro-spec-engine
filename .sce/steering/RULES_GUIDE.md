# Steering 规则索引

**文件**: CORE_PRINCIPLES (核心规范) | ENVIRONMENT (环境) | CURRENT_CONTEXT (当前场景) | RULES_GUIDE (本文件)

## ⚠️ 关键规则

**Steering 严格管控**: `.sce/steering/` 所有文件每个 session 自动加载！

**只能放置**: 上述 4 个核心文件  
**禁止放置**: 分析报告、历史数据、临时文件、详细文档、子目录

**违规后果**: 增加 token 消耗、减慢响应、污染上下文

**归档位置**: 
- 分析报告 → `.sce/specs/{spec-name}/results/`
- 详细文档 → `docs/`

**精简策略**: 删除已完成阶段详情 | 保留当前核心信息 | Token > 50% 立即精简

---

v3.0 | 2026-02-05 | 精简 70%
