# Workflow Integration Guide - 工作流集成指南

**Spec**: 04-00-ultrawork-integration-and-quality-automation  
**Date**: 2026-01-23  
**Version**: 1.0

---

## 概述

本指南说明如何将 Ultrawork 质量门控集成到 `requirements-first-workflow` subagent 中，实现 Spec 创建过程中的自动质量保障。

---

## 集成架构

```
requirements-first-workflow subagent
    ↓
    创建 requirements.md
    ↓
    调用 workflow_quality_gate.py requirements
    ↓
    [质量门检查] → 未通过 → 自动增强 → 重新检查
    ↓ 通过
    创建 design.md
    ↓
    调用 workflow_quality_gate.py design
    ↓
    [质量门检查] → 未通过 → 自动增强 → 重新检查
    ↓ 通过
    创建 tasks.md
    ↓
    调用 workflow_quality_gate.py tasks
    ↓
    [质量门检查] → 未通过 → 报告问题
    ↓ 通过
    Spec 创建完成
```

---

## 命令行接口

### 基本用法

```bash
# 检查 Requirements 质量门
python template/.sce/tools/workflow_quality_gate.py requirements <path>

# 检查 Design 质量门
python template/.sce/tools/workflow_quality_gate.py design <design_path> <requirements_path>

# 检查 Tasks 质量门
python template/.sce/tools/workflow_quality_gate.py tasks <path>
```

### 退出码

- **0**: 质量门通过 (PASSED)
- **1**: 质量门失败 (FAILED)
- **2**: 发生错误 (ERROR)

### 示例

```bash
# Requirements 阶段
python template/.sce/tools/workflow_quality_gate.py requirements .sce/specs/my-feature/requirements.md
# Exit code: 0 (通过) 或 1 (失败)

# Design 阶段
python template/.sce/tools/workflow_quality_gate.py design \
    .sce/specs/my-feature/design.md \
    .sce/specs/my-feature/requirements.md
# Exit code: 0 (通过) 或 1 (失败)

# Tasks 阶段
python template/.sce/tools/workflow_quality_gate.py tasks .sce/specs/my-feature/tasks.md
# Exit code: 0 (通过) 或 1 (失败)
```

---

## 质量阈值

### 默认阈值

- **Requirements**: 9.0/10
- **Design**: 9.0/10
- **Tasks**: 8.0/10

### 自定义阈值

修改 `workflow_quality_gate.py` 中的 `QualityGateEnforcer` 初始化参数：

```python
enforcer = QualityGateEnforcer(
    requirements_threshold=9.0,  # 自定义阈值
    design_threshold=9.0,
    tasks_threshold=8.0
)
```

---

## Subagent 集成方法

### 方法 1: 在 Subagent Steering 中添加规则

在 `requirements-first-workflow` subagent 的 steering 文件中添加：

```markdown
## Quality Gate Integration

After creating each document (requirements.md, design.md, tasks.md), 
you MUST invoke the quality gate checker:

### Requirements Stage
After creating requirements.md:
1. Run: `python template/.sce/tools/workflow_quality_gate.py requirements <path>`
2. Check exit code:
   - 0 (passed): Proceed to design stage
   - 1 (failed): Document was auto-enhanced, verify and proceed
   - 2 (error): Report error to user

### Design Stage
After creating design.md:
1. Run: `python template/.sce/tools/workflow_quality_gate.py design <design_path> <requirements_path>`
2. Check exit code:
   - 0 (passed): Proceed to tasks stage
   - 1 (failed): Document was auto-enhanced, verify and proceed
   - 2 (error): Report error to user

### Tasks Stage
After creating tasks.md:
1. Run: `python template/.sce/tools/workflow_quality_gate.py tasks <path>`
2. Check exit code:
   - 0 (passed): Spec creation complete
   - 1 (failed): Report issues to user for manual review
   - 2 (error): Report error to user
```

### 方法 2: 修改 Subagent 代码

如果 subagent 是 Python 实现，可以直接导入：

```python
from template.sce.tools.workflow_quality_gate import main as check_quality_gate
import subprocess

# 在创建 requirements.md 后
result = subprocess.run(
    ['python', 'template/.sce/tools/workflow_quality_gate.py', 
     'requirements', requirements_path],
    capture_output=True
)

if result.returncode == 0:
    print("✓ Requirements quality gate passed")
elif result.returncode == 1:
    print("✗ Requirements quality gate failed (auto-enhanced)")
else:
    print("✗ Error occurred during quality gate check")
    print(result.stderr.decode())
```

---

## 工作流行为

### Requirements 阶段

1. Subagent 创建 `requirements.md`
2. 调用质量门检查
3. 如果未通过：
   - 自动增强文档（最多 10 次迭代）
   - 达到 9.0/10 或收敛后停止
   - 返回最终结果
4. 如果通过：继续 Design 阶段

### Design 阶段

1. Subagent 创建 `design.md`
2. 调用质量门检查（需要 requirements.md 路径）
3. 如果未通过：
   - 自动增强文档
   - 检查与 requirements 的追溯性
   - 达到 9.0/10 或收敛后停止
4. 如果通过：继续 Tasks 阶段

### Tasks 阶段

1. Subagent 创建 `tasks.md`
2. 调用质量门检查
3. 如果未通过：
   - 验证任务完整性
   - 报告问题给用户
   - 不自动修改（任务列表需要用户确认）
4. 如果通过：Spec 创建完成

---

## 错误处理

### 文件不存在

```
Error: File not found: <path>
Exit code: 2
```

**处理**: 确认文件路径正确，文件已创建

### 质量门失败

```
Quality Gate Result: REQUIREMENTS
Status: FAILED ✗
Score: 7.50/10
Threshold: 9.0/10
Exit code: 1
```

**处理**: 
- Requirements/Design: 文档已自动增强，检查结果
- Tasks: 报告给用户，手动修复

### 增强器错误

```
Error: <error message>
Exit code: 2
```

**处理**: 检查错误日志，修复问题后重试

---

## 输出示例

### 成功通过

```
============================================================
Quality Gate: Requirements
Threshold: 9.0/10
============================================================

[Enhancement process...]

✓ Requirements quality gate PASSED (9.20/10)

============================================================
Quality Gate Result: REQUIREMENTS
============================================================
Status: PASSED ✓
Score: 9.20/10
Threshold: 9.0/10

Enhancement Details:
  Initial Score: 6.50/10
  Final Score: 9.20/10
  Improvement: +2.70
  Iterations: 5
  Stopping Reason: threshold_reached
============================================================
```

### 失败（已增强）

```
============================================================
Quality Gate: Design
Threshold: 9.0/10
============================================================

[Enhancement process...]

✗ Design quality gate FAILED (8.50/10)

============================================================
Quality Gate Result: DESIGN
============================================================
Status: FAILED ✗
Score: 8.50/10
Threshold: 9.0/10

Enhancement Details:
  Initial Score: 5.00/10
  Final Score: 8.50/10
  Improvement: +3.50
  Iterations: 10
  Stopping Reason: max_iterations_reached
============================================================
```

---

## 配置选项

### 增强器配置

在 `workflow_quality_gate.py` 中修改 `QualityGateEnforcer` 参数：

```python
enforcer = QualityGateEnforcer(
    requirements_threshold=9.0,      # Requirements 阈值
    design_threshold=9.0,            # Design 阈值
    tasks_threshold=8.0              # Tasks 阈值
)
```

### 收敛控制

在 `quality_gate_enforcer.py` 中修改 `UltraworkEnhancerV3` 参数：

```python
self.enhancer = UltraworkEnhancerV3(
    quality_threshold=requirements_threshold,
    max_iterations=10,               # 最大迭代次数
    plateau_iterations=3,            # 平台检测迭代次数
    create_backups=True,             # 创建备份
    cleanup_backups_on_success=True  # 成功后清理备份
)
```

---

## 故障排查

### 问题 1: 质量门一直失败

**症状**: 增强器运行 10 次迭代后仍未达到阈值

**原因**: 
- 文档初始质量太低
- 改进识别不准确
- 模板不适合当前文档

**解决**:
1. 检查初始分数和最终分数
2. 查看增强日志，确认应用了哪些改进
3. 手动检查文档，补充缺失内容
4. 降低阈值（临时方案）

### 问题 2: 增强器修改了不该修改的内容

**症状**: 文档内容被意外修改

**原因**: 
- 内容保护逻辑有 bug
- 改进应用逻辑错误

**解决**:
1. 从备份恢复：`.sce/specs/{spec-name}/backups/`
2. 报告 bug，提供文档样本
3. 手动修复文档

### 问题 3: 脚本找不到模块

**症状**: `ModuleNotFoundError: No module named 'quality_gate_enforcer'`

**原因**: Python 路径问题

**解决**:
```bash
# 方法 1: 设置 PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:template/.sce/tools"
python template/.sce/tools/workflow_quality_gate.py requirements <path>

# 方法 2: 使用绝对路径
cd template/.sce/tools
python workflow_quality_gate.py requirements ../../../.sce/specs/my-feature/requirements.md
```

---

## 最佳实践

### 1. 渐进式集成

- 先在 Requirements 阶段集成
- 验证效果后再集成 Design 和 Tasks

### 2. 监控质量趋势

- 记录每个 Spec 的初始分数和最终分数
- 分析常见问题，优化模板

### 3. 用户反馈循环

- 收集用户对增强结果的反馈
- 持续改进改进识别和应用逻辑

### 4. 备份策略

- 始终启用备份（`create_backups=True`）
- 定期清理旧备份
- 失败时保留备份供分析

---

## 参考

- **质量门控器**: `template/.sce/tools/quality_gate_enforcer.py`
- **工作流脚本**: `template/.sce/tools/workflow_quality_gate.py`
- **增强器**: `template/.sce/tools/ultrawork_enhancer_v3.py`
- **Spec 文档**: `.sce/specs/04-00-ultrawork-integration-and-quality-automation/`

---

## 版本历史

- **v1.0** (2026-01-23): 初始版本，完整集成指南

---

**状态**: ✅ Ready for Integration  
**维护者**: Ultrawork Team  
**最后更新**: 2026-01-23
