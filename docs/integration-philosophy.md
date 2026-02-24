# sce 集成哲学

> sce 如何与 AI 编码工具配合工作

---

## 核心定位

**sce 不是替代 AI 工具，而是增强 AI 工具**

```
┌─────────────────────────────────────┐
│         AI 编码工具                  │
│    (Codex/Claude/Cursor/Windsurf)   │
│                                      │
│  用户主要工作界面 ← 这里写代码        │
└──────────────┬──────────────────────┘
               │
               │ 读取上下文
               ▼
┌─────────────────────────────────────┐
│            sce                       │
│                                      │
│  Spec 管理 + 上下文生成               │
│  (后台运行，提供结构化信息)            │
└─────────────────────────────────────┘
```

---

## 三种集成模式

### 模式 1：AI 主动调用 sce（最佳）⭐

**适用工具**：Windsurf、Cline、Aider（可执行命令的 AI）

**工作流**：
```
用户 → AI 工具 → AI 自动执行 sce 命令 → 获取上下文 → 生成代码
```

**示例对话**：
```
用户：我要实现用户登录功能

AI：好的，让我先查看项目的 Spec
    [自动执行] sce context export 01-00-user-login
    [读取文件] .sce/specs/01-00-user-login/context-export.md
    
    我看到设计文档中定义了 AuthController...
    [生成代码]
    
    [自动执行] sce task claim 01-00-user-login 1.1
    任务已认领，开始实现...
```

**配置方法**：

在 AI 工具的系统提示中添加：
```markdown
你可以使用以下 sce 命令来管理项目：

- `sce context export <spec-name>` - 导出 Spec 上下文
- `sce prompt generate <spec-name> <task-id>` - 生成任务提示
- `sce task claim <spec-name> <task-id>` - 认领任务
- `sce status` - 查看项目状态

在实现功能前，先用 sce 命令查看相关 Spec。
```

**优势**：
- ✅ 完全自动化
- ✅ 用户无需手动操作
- ✅ AI 自动管理 Spec 生命周期

---

### 模式 2：手动导出 + AI 使用（当前）

**适用工具**：Claude Code、ChatGPT、GitHub Copilot

**工作流**：
```
用户 → 手动执行 sce 命令 → 复制上下文 → 粘贴到 AI → AI 生成代码
```

**示例流程**：
```bash
# 1. 用户手动导出
sce context export 01-00-user-login

# 2. 复制内容
cat .sce/specs/01-00-user-login/context-export.md | pbcopy

# 3. 粘贴到 Claude/ChatGPT

# 4. 对话
用户：请实现任务 1.1
AI：[生成代码]

# 5. 手动更新任务状态
# 编辑 tasks.md: - [x] 1.1 ...
```

**改进建议**：
```bash
# 添加快捷命令
sce clip 01-00-user-login          # 自动复制到剪贴板
sce clip 01-00-user-login 1.1      # 只复制任务 1.1 的上下文
```

**优势**：
- ✅ 适用于所有 AI 工具
- ✅ 用户完全控制

**劣势**：
- ❌ 需要手动操作
- ❌ 步骤较多

---

### 模式 3：Watch Mode 自动化（进阶）

**适用场景**：频繁修改 Spec 的项目

**工作流**：
```
用户修改 Spec → sce 自动检测 → 自动重新导出 → AI 工具自动刷新
```

**配置**：
```bash
# 启动 Watch Mode
sce watch init
sce watch install auto-export
sce watch start

# 现在修改任何 Spec 文件，都会自动重新导出
```

**Watch 配置示例**：
```json
{
  "patterns": [
    ".sce/specs/**/requirements.md",
    ".sce/specs/**/design.md",
    ".sce/specs/**/tasks.md"
  ],
  "actions": [
    {
      "name": "auto-export",
      "command": "sce context export ${spec-name}"
    }
  ]
}
```

**优势**：
- ✅ 完全自动化
- ✅ Spec 修改立即生效

---

## 推荐配置

### 对于 Windsurf/Cline 用户（推荐）⭐

**在 AI 系统提示中添加**：

```markdown
# Spec 管理规则

项目使用 sce (Scene Capability Engine) 管理需求和设计。

## 工作流程

1. **查看 Spec**：实现功能前，先执行 `sce context export <spec-name>` 查看设计
2. **认领任务**：开始工作前，执行 `sce task claim <spec-name> <task-id>`
3. **实现代码**：严格按照 Spec 中的设计实现
4. **更新状态**：完成后，在 tasks.md 中标记任务为完成 `[x]`

## 可用命令

- `sce status` - 查看项目状态
- `sce context export <spec-name>` - 导出 Spec 上下文
- `sce task claim <spec-name> <task-id>` - 认领任务
- `sce prompt generate <spec-name> <task-id>` - 生成任务提示

## 示例

用户说："实现用户登录"
你应该：
1. 执行 `sce context export 01-00-user-login`
2. 读取导出的上下文
3. 根据设计文档实现代码
4. 执行 `sce task claim 01-00-user-login 1.1`
```

### 对于 Claude/ChatGPT 用户

**创建快捷脚本**：

```bash
# ~/.bashrc 或 ~/.zshrc
alias sce-clip='sce context export $1 && cat .sce/specs/$1/context-export.md | pbcopy && echo "✅ 已复制到剪贴板"'

# 使用
sce-clip 01-00-user-login
# 然后直接粘贴到 Claude
```

### 对于 Cursor 用户

**使用 Cursor Rules**：

创建 `.cursorrules` 文件：
```markdown
# Spec 驱动开发

项目使用 sce 管理 Spec。实现功能前：

1. 查看 `.sce/specs/<spec-name>/design.md`
2. 按照设计实现
3. 更新 `.sce/specs/<spec-name>/tasks.md`

示例：
- 设计文档：`.sce/specs/01-00-user-login/design.md`
- 任务列表：`.sce/specs/01-00-user-login/tasks.md`
```

---

## 未来改进方向

### 1. MCP (Model Context Protocol) 集成

让 AI 工具通过 MCP 直接访问 sce：

```javascript
// AI 工具可以直接调用
const context = await mcp.call('sce.getContext', '01-00-user-login');
const tasks = await mcp.call('sce.getTasks', '01-00-user-login');
```

### 2. IDE 插件

为主流 IDE 提供插件：
- VS Code Extension
- Cursor Extension
- JetBrains Plugin

功能：
- 右键菜单："导出到 AI 工具"
- 状态栏显示当前 Spec
- 快捷键快速导出

### 3. Web Dashboard

提供 Web 界面：
```bash
sce serve
# 打开 http://localhost:3000
# 可视化管理 Spec，一键复制上下文
```

---

## 常见问题

### Q: 为什么不把 sce 做成 AI 工具的插件？

**A**: 
- sce 是**通用工具**，支持所有 AI 工具
- 做成插件会限制在特定工具
- CLI 工具更灵活，可以被任何工具调用

### Q: 能否让 AI 工具自动读取 .sce/ 目录？

**A**: 
- 部分工具支持（Cursor、Copilot）
- 但需要明确的上下文导出更可靠
- sce 的价值在于**结构化和格式化**上下文

### Q: 两套工具确实有点麻烦，有更简单的方案吗？

**A**: 
- **短期**：使用 Windsurf/Cline，让 AI 自动调用 sce
- **中期**：使用快捷脚本（如 `sce-clip`）
- **长期**：MCP 集成，完全无缝

---

## 总结

**sce 的定位**：
- ❌ 不是独立的开发工具
- ❌ 不是 AI 工具的竞争对手
- ✅ 是 AI 工具的**上下文提供者**
- ✅ 是项目的**Spec 管理系统**

**最佳实践**：
1. **用 sce 管理 Spec**（需求、设计、任务）
2. **用 AI 工具写代码**（主要工作界面）
3. **让 AI 工具调用 sce**（自动化集成）

**选择合适的模式**：
- 能执行命令的 AI → 模式 1（AI 主动调用）⭐
- 不能执行命令的 AI → 模式 2（手动导出）
- 频繁修改 Spec → 模式 3（Watch Mode）

---

**记住**：sce 是幕后英雄，AI 工具是前台明星。两者配合，才能发挥最大价值！🚀
