# 项目环境配置

---

## 📋 项目基本信息

- **项目名称**: kiro-spec-engine (kse)
- **项目类型**: CLI 工具 + npm 包
- **核心技术**: Node.js + Jest
- **开发语言**: JavaScript
- **仓库**: https://github.com/heguangyong/kiro-spec-engine

---

## 🖥️ 开发环境

### 本地环境
- **操作系统**: Windows (cmd shell)
- **Python**: 3.8+ (用于 Ultrawork 工具)
- **Kiro IDE**: 最新版本

### 核心组件
- **Spec 系统**: `.kiro/specs/` - Spec 驱动开发的核心
- **Steering 系统**: `.kiro/steering/` - AI 行为规则和上下文管理
- **工具系统**: `.kiro/tools/` - Ultrawork 增强工具

---

## 🔧 配置文件

**核心配置**:
- `CORE_PRINCIPLES.md` - 基准开发规则(包含 Ultrawork 原则)
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
- `.kiro/tools/` - Ultrawork 增强工具
- `docs/` - 项目文档

---

## 🔐 AI 权限

**授权范围**:
- ✅ 查看和修改 Spec 文档
- ✅ 创建和修改 Steering 规则
- ✅ 使用 Ultrawork 工具增强质量
- ✅ 执行 Python 脚本(工具层)
- ❌ 不能修改核心原则(CORE_PRINCIPLES.md)未经用户同意

**操作限制**:
- 修改 CORE_PRINCIPLES.md 前必须征得用户同意
- 创建新工具前应先在 Spec 中设计
- 保持"有节制的 AI 权限"原则

---

## 📦 项目结构

```
project-root/
├── .kiro/                      # Kiro 核心目录
│   ├── specs/                  # Spec 存储
│   │   └── SPEC_WORKFLOW_GUIDE.md
│   ├── steering/               # AI 行为规则
│   │   ├── CORE_PRINCIPLES.md
│   │   ├── ENVIRONMENT.md (本文件)
│   │   ├── CURRENT_CONTEXT.md
│   │   └── RULES_GUIDE.md
│   ├── tools/                  # Ultrawork 工具
│   │   └── ultrawork_enhancer.py
│   ├── ultrawork-application-guide.md
│   ├── ultrawork-integration-summary.md
│   └── sisyphus-deep-dive.md
├── docs/                       # 项目文档
├── ultrawork.bat              # Ultrawork 便捷脚本
└── README.md                   # 项目说明
```

---

## 🔥 Ultrawork 功能

**已集成 Sisyphus 的"不懈努力"精神**:
- 专业级质量评估体系 (0-10 评分)
- Requirements/Design/Tasks 三阶段增强
- 自动改进识别和应用
- 便捷的批处理脚本

**使用方法**:
```bash
.\ultrawork.bat spec-name requirements  # 增强需求文档
.\ultrawork.bat spec-name design       # 增强设计文档
.\ultrawork.bat spec-name tasks        # 检查任务完成
.\ultrawork.bat spec-name all          # 全阶段增强
```

---

## 📦 发布流程

**⚠️ 重要**: 本项目使用 GitHub Actions 自动发布到 npm

**发布步骤**:
1. 更新 `package.json` 中的版本号
2. 更新 `CHANGELOG.md` 记录变更
3. 提交所有更改: `git commit -m "chore: release vX.Y.Z"`
4. 创建并推送 tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"` + `git push origin vX.Y.Z`
5. **GitHub Actions 会自动发布到 npm** ✅

**禁止操作**:
- ❌ 不要手动运行 `npm publish`
- ❌ 不要手动运行 `npm run publish:manual`
- ❌ tag 推送后会自动触发 CI/CD 发布流程

**CI 测试失败处理** ⚠️:
- 如果 tag 推送后 CI 测试失败，必须：
  1. 修复测试问题并提交
  2. 删除失败的 tag（本地和远程）: `git tag -d vX.Y.Z` + `git push origin :refs/tags/vX.Y.Z`
  3. **增加版本号**（如 v1.13.0 失败 → 修复后发布 v1.13.1）
  4. 更新 `package.json` 和 `CHANGELOG.md` 为新版本号
  5. 重新提交并打新 tag
- **原因**: 避免版本号混乱，保持发布历史清晰

**验证发布**:
- 检查 GitHub Actions 工作流状态
- 等待几分钟后在 npm 上验证: `npm view kiro-spec-engine@X.Y.Z`

**package.json 配置**:
- `prepublishOnly`: 发布前自动运行 CI 测试
- `publish:manual`: 仅用于紧急手动发布（需要 npm 权限）

---

**版本**: v6.0  
**更新**: 2026-01-29  
**项目**: kiro-spec-engine  
**说明**: 添加 CI 测试失败处理规则
