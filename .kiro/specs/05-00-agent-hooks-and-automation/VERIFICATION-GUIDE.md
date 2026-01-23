# v1.3.0 功能验证指南

> 完整的人工验证清单，确保所有功能正常工作

**版本**: v1.3.0  
**日期**: 2026-01-23  
**验证人**: _____________

---

## 📋 验证概览

### 验证范围
- ✅ Watch Mode 核心功能
- ✅ CLI 命令
- ✅ 自动化预设
- ✅ 工具检测
- ✅ 手动工作流
- ✅ 文档完整性

### 验证环境
- **操作系统**: Windows / macOS / Linux
- **Node.js**: >= 16.0.0
- **npm**: 最新版本
- **kse 版本**: 1.3.0

---

## 🚀 准备工作

### 1. 安装/更新到 v1.3.0

```bash
# 全局安装
npm install -g kiro-spec-engine@1.3.0

# 或更新现有安装
npm update -g kiro-spec-engine

# 验证版本
kse --version
# 预期输出: 1.3.0
```

**验证结果**: ⬜ 通过 / ⬜ 失败  
**备注**: _____________

---

### 2. 创建测试项目

```bash
# 创建测试目录
mkdir kse-v1.3.0-test
cd kse-v1.3.0-test

# 初始化项目
kse init "v1.3.0 Test Project"
```

**验证结果**: ⬜ 通过 / ⬜ 失败  
**备注**: _____________

---

## 🤖 Watch Mode 功能验证

### 3. Watch Init - 初始化配置

```bash
kse watch init
```

**验证点**:
- ⬜ 创建 `.kiro/watch-config.json` 文件
- ⬜ 配置文件包含默认设置
- ⬜ 显示成功消息

**预期输出**:
```
✅ Watch configuration initialized
📁 Config file: .kiro/watch-config.json
```

**验证结果**: ⬜ 通过 / ⬜ 失败  
**备注**: _____________

---

### 4. Watch Init - 强制覆盖

```bash
kse watch init --force
```

**验证点**:
- ⬜ 覆盖现有配置文件
- ⬜ 显示覆盖警告
- ⬜ 成功创建新配置

**验证结果**: ⬜ 通过 / ⬜ 失败  
**备注**: _____________

---

### 5. Watch Presets - 列出预设

```bash
kse watch presets
```

**验证点**:
- ⬜ 显示 4 个预设：auto-sync, prompt-regen, context-export, test-runner
- ⬜ 每个预设有名称和描述
- ⬜ 格式清晰易读

**预期输出**:
```
📋 Available Watch Presets

  auto-sync
    Automatic Workspace Synchronization
    ...

  prompt-regen
    Automatic Prompt Regeneration
    ...

  context-export
    Automatic Context Export
    ...

  test-runner
    Automatic Test Runner
    ...
```

**验证结果**: ⬜ 通过 / ⬜ 失败  
**备注**: _____________

---

### 6. Watch Install - 安装预设

```bash
kse watch install auto-sync
```

**验证点**:
- ⬜ 成功安装预设
- ⬜ 更新配置文件
- ⬜ 显示安装的模式和动作

**预期输出**:
```
✅ Installed preset: auto-sync
📋 Patterns added: 1
⚡ Actions added: 1
```

**验证结果**: ⬜ 通过 / ⬜ 失败  
**备注**: _____________

---

### 7. Watch Install - 安装其他预设

```bash
kse watch install prompt-regen
kse watch install context-export
kse watch install test-runner
```

**验证点**:
- ⬜ 每个预设都能成功安装
- ⬜ 不覆盖已有配置
- ⬜ 合并模式和动作

**验证结果**: ⬜ 通过 / ⬜ 失败  
**备注**: _____________

---

### 8. Watch Status - 停止状态

```bash
kse watch status
```

**验证点**:
- ⬜ 显示 "Stopped" 状态
- ⬜ 显示配置的模式数量
- ⬜ 显示配置的动作数量

**预期输出**:
```
📊 Watch Mode Status

Status: Stopped
Patterns: 4
Actions: 4
```

**验证结果**: ⬜ 通过 / ⬜ 失败  
**备注**: _____________

---

### 9. Watch Start - 启动监控

```bash
kse watch start
```

**验证点**:
- ⬜ 成功启动 watch mode
- ⬜ 显示监控的模式
- ⬜ 后台运行

**预期输出**:
```
🚀 Starting watch mode...
✅ Watch mode started
📁 Watching patterns:
  - **/*.md
  - **/*.js
  ...
```

**验证结果**: ⬜ 通过 / ⬜ 失败  
**备注**: _____________

---

### 10. Watch Status - 运行状态

```bash
kse watch status
```

**验证点**:
- ⬜ 显示 "Running" 状态
- ⬜ 显示活跃的监控
- ⬜ 显示最近的活动

**预期输出**:
```
📊 Watch Mode Status

Status: Running
Uptime: 00:00:30
Patterns: 4
Actions: 4
Recent Activity: 0 executions
```

**验证结果**: ⬜ 通过 / ⬜ 失败  
**备注**: _____________

---

### 11. Watch Logs - 查看日志

```bash
kse watch logs
```

**验证点**:
- ⬜ 显示执行日志
- ⬜ 如果没有日志，显示提示
- ⬜ 日志格式正确

**验证结果**: ⬜ 通过 / ⬜ 失败  
**备注**: _____________

---

### 12. Watch Logs - Tail 模式

```bash
kse watch logs --tail 10
```

**验证点**:
- ⬜ 只显示最后 10 行
- ⬜ 参数正确工作

**验证结果**: ⬜ 通过 / ⬜ 失败  
**备注**: _____________

---

### 13. Watch Metrics - 查看指标

```bash
kse watch metrics
```

**验证点**:
- ⬜ 显示执行统计
- ⬜ 显示成功率
- ⬜ 显示节省的时间

**预期输出**:
```
📊 Watch Mode Metrics

Total Executions: 0
Successful: 0
Failed: 0
Success Rate: 0%
Time Saved: 0 seconds
```

**验证结果**: ⬜ 通过 / ⬜ 失败  
**备注**: _____________

---

### 14. Watch Metrics - JSON 格式

```bash
kse watch metrics --format json
```

**验证点**:
- ⬜ 输出有效的 JSON
- ⬜ 包含所有指标数据

**验证结果**: ⬜ 通过 / ⬜ 失败  
**备注**: _____________

---

### 15. Watch Stop - 停止监控

```bash
kse watch stop
```

**验证点**:
- ⬜ 成功停止 watch mode
- ⬜ 清理资源
- ⬜ 显示停止消息

**预期输出**:
```
🛑 Stopping watch mode...
✅ Watch mode stopped
```

**验证结果**: ⬜ 通过 / ⬜ 失败  
**备注**: _____________

---

### 16. Watch 实际文件监控测试

```bash
# 启动 watch mode
kse watch start

# 在另一个终端创建测试文件
echo "test" > test.md

# 等待几秒后检查日志
kse watch logs

# 停止 watch mode
kse watch stop
```

**验证点**:
- ⬜ 检测到文件变化
- ⬜ 触发相应动作
- ⬜ 记录到日志

**验证结果**: ⬜ 通过 / ⬜ 失败  
**备注**: _____________

---

## 🔍 工具检测功能验证

### 17. Adopt 命令 - 工具检测

```bash
# 在测试项目中运行
kse adopt --dry-run
```

**验证点**:
- ⬜ 检测当前 IDE/编辑器
- ⬜ 显示检测结果和置信度
- ⬜ 提供自动化建议

**预期输出**:
```
🔍 Detecting your development environment...

Tool Detected: vscode (或 kiro/cursor/other)
Confidence: high

ℹ️  VS Code detected - watch mode recommended
ℹ️  Run suggested commands to set up automation

💡 Automation setup:
  kse watch init
  kse watch install auto-sync
  kse watch start
```

**验证结果**: ⬜ 通过 / ⬜ 失败  
**备注**: _____________

---

## 📚 手动工作流功能验证

### 18. Workflows - 列出工作流

```bash
kse workflows
```

**验证点**:
- ⬜ 显示 6 个工作流
- ⬜ 每个工作流有 ID、名称、描述、时间估计
- ⬜ 显示使用提示

**预期输出**:
```
📋 Available Workflows

  task-sync
    Task Sync Workflow
    Keep workspace synchronized with task progress
    Time: 30-60 seconds

  context-export
    Context Export Workflow
    ...

  prompt-generation
    ...

  daily
    ...

  task-completion
    ...

  spec-creation
    ...

Run kse workflows show <workflow-id> to view details
Run kse workflows guide to open full guide
```

**验证结果**: ⬜ 通过 / ⬜ 失败  
**备注**: _____________

---

### 19. Workflows Show - 显示工作流详情

```bash
kse workflows show task-sync
```

**验证点**:
- ⬜ 显示工作流名称和描述
- ⬜ 显示时间估计
- ⬜ 显示文档链接

**预期输出**:
```
📋 Task Sync Workflow

Description: Keep workspace synchronized with task progress
Time Estimate: 30-60 seconds

📖 Full documentation:
  docs/manual-workflows-guide.md#task-sync-workflow

Tip: Open the file in your editor for complete instructions
```

**验证结果**: ⬜ 通过 / ⬜ 失败  
**备注**: _____________

---

### 20. Workflows Guide - 打开完整指南

```bash
kse workflows guide
```

**验证点**:
- ⬜ 显示指南文件路径
- ⬜ 显示内容概览
- ⬜ 提示如何打开

**预期输出**:
```
📖 Manual Workflows Guide

  docs/manual-workflows-guide.md

Open this file in your editor for complete workflow documentation

Contents:
  - Task Sync Workflow
  - Context Export Workflow
  - Prompt Generation Workflow
  - Workflow Checklists
  - Time Estimates
  - Troubleshooting
```

**验证结果**: ⬜ 通过 / ⬜ 失败  
**备注**: _____________

---

### 21. Workflows Complete - 标记完成

```bash
kse workflows complete task-sync
```

**验证点**:
- ⬜ 显示完成消息
- ⬜ 显示时间估计
- ⬜ 建议下一步工作流

**预期输出**:
```
✅ Task Sync Workflow completed!

Time estimate: 30-60 seconds

💡 Next steps:
  kse workflows show context-export - Context Export Workflow
  kse workflows show prompt-generation - Prompt Generation Workflow
```

**验证结果**: ⬜ 通过 / ⬜ 失败  
**备注**: _____________

---

## 📖 文档验证

### 22. README.md 更新验证

```bash
# 查看 README.md
cat README.md | grep -A 20 "Watch Mode"
```

**验证点**:
- ⬜ 包含 Watch Mode 部分
- ⬜ 包含 Manual Workflows 部分
- ⬜ 包含 Automation 部分
- ⬜ Key Features 中提到 watch mode

**验证结果**: ⬜ 通过 / ⬜ 失败  
**备注**: _____________

---

### 23. CHANGELOG.md 验证

```bash
# 查看 CHANGELOG.md
cat CHANGELOG.md | grep -A 50 "1.3.0"
```

**验证点**:
- ⬜ 包含 v1.3.0 条目
- ⬜ 详细列出所有新功能
- ⬜ 包含测试统计
- ⬜ 日期正确

**验证结果**: ⬜ 通过 / ⬜ 失败  
**备注**: _____________

---

### 24. Manual Workflows Guide 验证

```bash
# 查看工作流指南
cat docs/manual-workflows-guide.md
```

**验证点**:
- ⬜ 文件存在
- ⬜ 包含所有 6 个工作流
- ⬜ 每个工作流有详细步骤
- ⬜ 包含时间估计
- ⬜ 包含故障排除部分

**验证结果**: ⬜ 通过 / ⬜ 失败  
**备注**: _____________

---

## 🧪 集成测试

### 25. 完整工作流测试

```bash
# 1. 初始化项目
kse init "Integration Test"

# 2. 初始化 watch mode
kse watch init

# 3. 安装预设
kse watch install auto-sync

# 4. 启动监控
kse watch start

# 5. 创建测试 spec
kse create-spec 01-00-test-feature

# 6. 创建 tasks.md
echo "# Tasks\n- [ ] 1.1 Test task" > .kiro/specs/01-00-test-feature/tasks.md

# 7. 等待自动同步触发

# 8. 检查日志
kse watch logs

# 9. 查看指标
kse watch metrics

# 10. 停止监控
kse watch stop
```

**验证点**:
- ⬜ 所有命令成功执行
- ⬜ Watch mode 检测到文件变化
- ⬜ 自动触发同步动作
- ⬜ 日志记录正确
- ⬜ 指标统计准确

**验证结果**: ⬜ 通过 / ⬜ 失败  
**备注**: _____________

---

## 🔧 错误处理验证

### 26. 无效命令测试

```bash
# 测试无效的预设名称
kse watch install invalid-preset

# 测试无效的工作流 ID
kse workflows show invalid-workflow

# 测试重复启动
kse watch start
kse watch start  # 应该显示错误
```

**验证点**:
- ⬜ 显示清晰的错误消息
- ⬜ 不崩溃
- ⬜ 提供有用的建议

**验证结果**: ⬜ 通过 / ⬜ 失败  
**备注**: _____________

---

## 📊 验证总结

### 功能验证统计

- **总测试项**: 26
- **通过**: _____
- **失败**: _____
- **跳过**: _____
- **通过率**: _____%

### 关键问题记录

1. _____________
2. _____________
3. _____________

### 改进建议

1. _____________
2. _____________
3. _____________

### 总体评价

⬜ **优秀** - 所有功能完美工作  
⬜ **良好** - 大部分功能正常，有小问题  
⬜ **一般** - 部分功能有问题  
⬜ **需改进** - 多个关键功能有问题

### 发布建议

⬜ **批准发布** - 可以正式发布  
⬜ **条件发布** - 修复小问题后发布  
⬜ **暂缓发布** - 需要重大修复

---

## 📝 验证签名

**验证人**: _____________  
**日期**: _____________  
**签名**: _____________

---

**版本**: v1.3.0  
**文档**: VERIFICATION-GUIDE.md  
**最后更新**: 2026-01-23
