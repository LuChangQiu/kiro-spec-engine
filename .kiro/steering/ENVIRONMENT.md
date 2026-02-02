# 项目环境配置

## 📋 项目信息

- **项目**: kiro-spec-engine (kse)
- **类型**: CLI 工具 + npm 包
- **技术**: Node.js + Jest
- **语言**: JavaScript
- **仓库**: https://github.com/heguangyong/kiro-spec-engine

## 🖥️ 环境

**本地**: Windows (cmd) | Python 3.8+ | Kiro IDE

**核心组件**:
- `.kiro/specs/` - Spec 驱动开发
- `.kiro/steering/` - AI 行为规则
- `.kiro/tools/` - Ultrawork 工具

## 🔧 配置

**Steering**: CORE_PRINCIPLES | ENVIRONMENT | CURRENT_CONTEXT | RULES_GUIDE

**Spec**: requirements.md | design.md | tasks.md

## 🔐 AI 权限

**授权**: ✅ Spec 文档 | ✅ Steering 规则 | ✅ Ultrawork 工具 | ✅ Python 脚本

**限制**: ❌ 修改 CORE_PRINCIPLES 需用户同意 | 新工具需先设计

## 📦 发布流程

**步骤**: 更新版本 → 更新 CHANGELOG → 提交 → 打 tag → 推送 tag → GitHub Actions 自动发布

**命令**:
```bash
git commit -m "chore: release vX.Y.Z"
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

**CI 失败处理**: 修复 → 删除 tag → 增加版本号 → 重新发布

**禁止**: ❌ 手动 npm publish

---

v7.0 | 2026-02-02 | 精简 60% token
