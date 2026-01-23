# 在 Claude Code 中使用 kse

> 将 kse 与 Claude Code 集成进行 AI 辅助开发的完整指南

---

**版本**: 1.0.0  
**最后更新**: 2026-01-23  
**工具**: Claude Code (Anthropic)  
**集成模式**: 手动导出  
**预计设置时间**: 3 分钟

---

## 概述

**Claude Code** 是 Anthropic 的 AI 编码助手，通过对话界面提供代码生成、解释和调试。

**kse 与 Claude 的集成**使用**手动导出**模式，你导出 Spec 上下文并将其粘贴到 Claude 对话中。

### 为什么在 Claude 中使用 kse？

- ✅ **长上下文窗口** - Claude 可以处理大型 Spec
- ✅ **深度理解** - Claude 擅长理解复杂需求
- ✅ **对话式开发** - 自然的来回讨论
- ✅ **代码质量** - 生成高质量、有良好文档的代码

---

## 集成模式

**模式：** 手动导出

**工作原理：**
1. 你在 kse 中创建 Spec（需求、设计、任务）
2. 你使用 `kse context export` 导出上下文
3. 你将上下文复制并粘贴到 Claude 对话中
4. Claude 基于你的 Spec 生成代码
5. 你将代码复制到项目中
6. 你在 tasks.md 中更新任务状态

---

## 设置

### 前置条件

- **Claude 账户**（[注册](https://claude.ai/)）
- 已全局安装 **kse**（`npm install -g kiro-spec-engine`）
- 项目已被 kse **采用**（`kse adopt`）

### 无需特殊设置

Claude 通过 Web 界面工作，无需特殊配置。只需导出上下文并粘贴！

---

## 使用方法

### 方法 1：完整 Spec 上下文（推荐用于新功能）

**适用于：** 实现完整功能或多个相关任务

**步骤：**

1. **导出 Spec 上下文：**
   ```bash
   kse context export 01-00-user-login
   ```

2. **复制上下文到剪贴板：**
   ```bash
   # macOS
   cat .kiro/specs/01-00-user-login/context-export.md | pbcopy
   
   # Windows
   type .kiro\specs\01-00-user-login\context-export.md | clip
   
   # Linux
   cat .kiro/specs/01-00-user-login/context-export.md | xclip -selection clipboard
   ```

3. **开始新的 Claude 对话**

4. **粘贴上下文并添加你的请求：**
   ```
   [粘贴完整的 context-export.md 内容]
   
   我已提供用户登录功能的完整 Spec。请实现任务 1.1："设置项目依赖"。
   
   严格遵循 design.md 中的架构。
   ```

5. **Claude 将：**
   - 分析你的需求和设计
   - 生成匹配你架构的代码
   - 解释实现决策
   - 提供使用说明

6. **复制代码到你的项目**

7. **在 tasks.md 中标记任务为完成**

### 方法 2：任务特定提示（推荐用于单个任务）

**适用于：** 实现单个任务或小的更改

**步骤：**

1. **生成任务特定提示：**
   ```bash
   kse prompt generate 01-00-user-login 1.1
   ```

2. **复制生成的提示**

3. **粘贴到 Claude 对话中**

4. **Claude 将：**
   - 专注于该特定任务
   - 提供更简洁的响应
   - 包含相关的设计上下文

---

## 工作流示例

### 完整功能实现工作流

```bash
# 1. 创建 Spec
kse create-spec 01-00-user-login

# 2. 编写 requirements.md、design.md、tasks.md

# 3. 导出并复制上下文
kse context export 01-00-user-login
cat .kiro/specs/01-00-user-login/context-export.md | pbcopy

# 4. 在 Claude 中：
# - 粘贴上下文
# - 请求："请实现任务 1.1"

# 5. 从 Claude 复制代码到你的项目

# 6. 更新 tasks.md：
- [x] 1.1 设置项目依赖

# 7. 对下一个任务重复步骤 4-6
```

### 迭代开发工作流

```bash
# 1. 实现第一个任务
"请实现任务 1.1：设置项目依赖"

# 2. 审查并调整
"代码看起来不错，但请使用 TypeScript 而不是 JavaScript"

# 3. 继续下一个任务
"太好了！现在请实现任务 1.2：创建 User 模型"

# 4. 在同一对话中继续
# Claude 记住上下文和之前的决策
```

---

## 最佳实践

### 1. 使用对话历史

Claude 在对话中记住上下文。在同一对话中实现多个相关任务：
```
任务 1.1 → 任务 1.2 → 任务 1.3
```

### 2. 明确你的指令

在请求中明确：
- ✅ "严格遵循 design.md 中的架构"
- ✅ "使用 design.md 中指定的确切组件名称"
- ✅ "包含 requirements.md 中的所有验收标准"

### 3. 要求解释

Claude 擅长解释。询问：
```
"请解释为什么你选择这种方法"
"这如何满足 NFR-1（安全性）要求？"
```

### 4. 迭代改进

不要犹豫要求更改：
```
"请添加更多错误处理"
"请添加 JSDoc 注释"
"请使这更符合我们的编码标准"
```

### 5. 保存对话

为重要的实现保存 Claude 对话以供将来参考。

---

## 示例提示

### 实现新功能

```
我已提供用户登录功能的完整 Spec（需求、设计和任务）。

请实现任务 1.1："设置项目依赖"

要求：
1. 严格遵循 design.md 中的架构
2. 使用 design.md 中指定的技术栈
3. 包含所有必需的依赖项
4. 提供安装说明

请提供：
- package.json 更新
- 安装命令
- 任何必要的配置文件
```

### 调试问题

```
我正在实现 .kiro/specs/01-00-user-login/ 中的用户登录功能。

任务 2.1（ValidationService）已完成，但测试失败并出现此错误：
[粘贴错误消息]

这是我的代码：
[粘贴代码]

请帮助我调试这个问题，同时遵循 design.md 中的设计。
```

### 代码审查

```
我已实现 .kiro/specs/01-00-user-login/ 中的任务 1.1-1.3。

这是我的代码：
[粘贴代码]

请审查此代码并检查：
1. 它是否遵循 design.md 中的架构？
2. 它是否满足 requirements.md 中的所有需求？
3. 有什么可以改进的地方吗？
```

---

## 故障排除

### 问题：Claude 不遵循我的设计

**解决方案：**
1. 使你的 design.md 更详细
2. 在 design.md 中添加代码示例
3. 在提示中明确："严格遵循 design.md"
4. 引用设计中的特定部分

### 问题：上下文太大

**解决方案：**
1. 使用任务特定提示：
   ```bash
   kse prompt generate 01-00-user-login 1.1
   ```
2. 或手动提供较小的上下文：
   - 仅粘贴相关的设计部分
   - 仅包含当前任务

### 问题：Claude 忘记了之前的上下文

**解决方案：**
1. 在同一对话中保持相关任务
2. 对于新任务，重新粘贴上下文
3. 引用之前的响应："如你在任务 1.1 中实现的..."

---

## 高级技巧

### 1. 使用项目文件

在提示中包含现有的项目文件：
```
这是我们现有的 User 模型：
[粘贴 User.js]

请实现 AuthService，它使用这个 User 模型。
```

### 2. 要求测试

```
请为 AuthService 实现提供全面的单元测试。
包含：
- 成功场景
- 错误场景
- 边界情况
```

### 3. 要求文档

```
请为 AuthController API 提供 API 文档。
使用 OpenAPI/Swagger 格式。
```

### 4. 分阶段实现

```
让我们分阶段实现任务 2.1：
1. 首先，仅实现 validateEmail()
2. 然后我们将添加 validatePassword()
3. 最后，我们将添加测试
```

---

## 相关文档

- 📖 [快速入门指南](../quick-start.md) - 开始使用 kse
- 🔌 [集成模式](../integration-modes.md) - 理解手动导出模式
- 📋 [Spec 工作流](../spec-workflow.md) - 创建有效的 Spec
- 🔧 [故障排除](../troubleshooting.md) - 常见问题

---

## 下一步

- 尝试使用 Claude 实现你的第一个任务
- 探索 [Cursor 指南](cursor-guide.md) 获取 IDE 集成
- 查看 [API 示例](../examples/add-rest-api/) 获取完整的 Spec 示例

---

**版本**: 1.0.0  
**最后更新**: 2026-01-23
