# 项目环境配置（模板）

> **重要**: 这是项目的环境配置模板，复制到新项目时请根据实际情况修改。

---

## 📋 项目基本信息

- **项目名称**: kiro-spec-engine
- **项目类型**: Spec 驱动开发 CLI 工具
- **核心技术**: Node.js + Jest + Spec 驱动开发
- **开发语言**: JavaScript (Node.js)

---

## 🖥️ 开发环境

### 本地环境
- **操作系统**: Windows (cmd shell)
- **Node.js**: 14+ 
- **npm**: 6+
- **开发工具**: Kiro IDE / VS Code / Cursor

### 核心组件
- **Spec 系统**: `.kiro/specs/` - Spec 驱动开发的核心
- **Steering 系统**: `.kiro/steering/` - AI 行为规则和上下文管理
- **CLI 系统**: `bin/kse.js` - 命令行工具入口

---

## 🔧 配置文件

**核心配置**:
- `CORE_PRINCIPLES.md` - 基准开发规则
- `ENVIRONMENT.md` - 环境配置(本文件)
- `CURRENT_CONTEXT.md` - 当前 Spec 场景(每个 Spec 更新)
- `RULES_GUIDE.md` - 规则索引

**Spec 结构**:
- `requirements.md` - 需求文档
- `design.md` - 设计文档
- `tasks.md` - 任务列表

---

## 🌐 关键目录

- `.kiro/specs/` - 所有 Spec 的存储目录
- `.kiro/steering/` - AI 行为规则和上下文
- `lib/` - 核心功能实现
- `bin/` - CLI 入口
- `tests/` - 测试文件
- `docs/` - 项目文档

---

## 🔐 AI 权限

**授权范围**:
- ✅ 查看和修改 Spec 文档
- ✅ 创建和修改 Steering 规则
- ✅ 修改项目代码和测试
- ✅ 执行 npm 命令和测试
- ❌ 不能修改核心原则(CORE_PRINCIPLES.md)未经用户同意

**操作限制**:
- 修改 CORE_PRINCIPLES.md 前必须征得用户同意
- 重大架构变更应先在 Spec 中设计
- 保持"有节制的 AI 权限"原则

---

## 📦 项目结构

```
kiro-spec-engine/
├── .kiro/                      # Kiro 核心目录
│   ├── specs/                  # Spec 存储
│   │   └── SPEC_WORKFLOW_GUIDE.md
│   └── steering/               # AI 行为规则
│       ├── CORE_PRINCIPLES.md
│       ├── ENVIRONMENT.md (本文件)
│       ├── CURRENT_CONTEXT.md
│       └── RULES_GUIDE.md
├── bin/                        # CLI 入口
│   └── kse.js
├── lib/                        # 核心功能
│   ├── commands/               # CLI 命令
│   ├── watch/                  # Watch Mode
│   ├── context/                # 上下文导出
│   ├── task/                   # 任务管理
│   └── ...
├── tests/                      # 测试文件
│   ├── unit/
│   └── integration/
├── docs/                       # 项目文档
├── package.json
└── README.md
```

---

## 🚀 核心功能

**已实现的主要功能**:
- Spec 驱动开发工作流
- 项目采用和升级系统
- 多用户协作支持
- Watch Mode 自动化
- 上下文导出和提示生成
- 任务管理和认领
- 工具检测和自动配置

**CLI 命令**:
```bash
kse adopt              # 采用 Spec 系统
kse status             # 查看项目状态
kse task claim         # 认领任务
kse watch start        # 启动 Watch Mode
kse context export     # 导出上下文
kse workflows          # 查看工作流
```

---

**版本**: v5.0  
**更新**: 2026-01-23  
**项目**: kiro-spec-engine  
**说明**: 针对 kiro-spec-engine 项目的环境配置
