# [TODO: 项目名称 - 请修改此标题]

> ⚠️ **这是模板文件**: 请搜索并替换所有 `[TODO: ...]` 占位符为实际项目信息

## 🎯 项目概述

这是一个集成了 **Sisyphus Ultrawork 精神** 的 SCE Spec 驱动开发项目。

### 核心特性

- ✅ **Spec 驱动开发**: Requirements → Design → Tasks 标准流程
- ✅ **Ultrawork 精神**: 像西西弗斯一样不懈努力，追求专业级质量
- ✅ **质量增强工具**: 自动评估和改进文档质量 (0-10 评分)
- ✅ **便捷脚本**: 一键应用 Ultrawork 增强

## 🚀 快速开始

### 1. 项目初始化（仅首次使用）

如果这是从模板复制的新项目，请先运行：

```bash
.\setup-project.bat
```

这个脚本会初始化 `.kiro` 目录的配置，更新项目名称。

### 2. 创建和增强 Spec

```bash
# 创建 Spec 目录
mkdir .kiro\specs\01-00-your-feature-name

# 编写基础 requirements.md
# (手动创建基本需求文档)

# 应用 Ultrawork 增强
python .kiro\tools\ultrawork_enhancer.py requirements .kiro\specs\01-00-your-feature-name\requirements.md
```

### 3. 完整工作流

```bash
# 增强需求文档
python .kiro\tools\ultrawork_enhancer.py requirements .kiro\specs\spec-name\requirements.md

# 增强设计文档
python .kiro\tools\ultrawork_enhancer.py design .kiro\specs\spec-name\design.md .kiro\specs\spec-name\requirements.md

# 检查任务完成情况
python .kiro\tools\ultrawork_enhancer.py tasks .kiro\specs\spec-name\tasks.md
```

## 📊 质量标准

### Requirements 阶段 (0-10 分)
- 基础结构、EARS 格式、用户故事
- 验收标准、非功能需求、约束条件

### Design 阶段 (0-10 分)
- 系统概述、架构设计、组件设计
- 需求追溯、技术选型、接口定义

### Tasks 阶段
- 完成率分析、优先级识别
- Ultrawork 激励、执行建议

## 🛠️ 核心脚本

### setup-project.bat
**作用**: 初始化 `.kiro` 目录配置
- 更新项目名称
- 检查工具完整性
- 提供使用指导

## 🛠️ 核心工具

### ultrawork_enhancer.py
**作用**: Ultrawork 质量增强核心工具
- 自动评估文档质量 (0-10 评分)
- 识别和应用改进点
- 支持 Requirements/Design/Tasks 三阶段

**使用方法**:
```bash
# Requirements 阶段
python .kiro\tools\ultrawork_enhancer.py requirements <path-to-requirements.md>

# Design 阶段
python .kiro\tools\ultrawork_enhancer.py design <path-to-design.md> <path-to-requirements.md>

# Tasks 阶段
python .kiro\tools\ultrawork_enhancer.py tasks <path-to-tasks.md>
```

## 🔥 Ultrawork 精神

> 像西西弗斯推石上山一样，永不放弃，不懈努力，直到任务完美完成

- **不满足于"差不多"**: 追求专业级质量标准 (9.0/10)
- **持续改进**: 自动识别和应用改进点
- **永不放弃**: 遇到困难时提供激励和解决方案

## 📚 参考文档

- `.kiro/README.md` - SCE 系统说明
- `.kiro/steering/CORE_PRINCIPLES.md` - 核心原则（包含 Ultrawork 精神）

---

**让每个 Spec 都体现 Sisyphus 的不懈努力精神！** 🔥
