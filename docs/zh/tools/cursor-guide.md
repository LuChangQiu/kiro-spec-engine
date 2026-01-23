# 在 Cursor 中使用 kse

> 将 kse 与 Cursor IDE 集成进行 AI 辅助开发的完整指南

---

**版本**: 1.0.0  
**最后更新**: 2026-01-23  
**工具**: Cursor IDE  
**集成模式**: 手动导出  
**预计设置时间**: 5 分钟

---

## 概述

**Cursor** 是一个基于 VS Code 构建的 AI 驱动 IDE，通过 Composer 模式提供智能代码补全、基于聊天的编码和 AI 结对编程。

**kse 与 Cursor 的集成**使用**手动导出**模式，你导出 Spec 上下文并将其提供给 Cursor 的 AI 功能（Chat、Composer 或内联建议）。

### 为什么在 Cursor 中使用 kse？

- ✅ **结构化上下文** - Cursor 理解你的需求和设计
- ✅ **更好的代码生成** - AI 遵循你的架构决策
- ✅ **一致的实现** - 所有代码都匹配你的 Spec
- ✅ **进度跟踪** - 知道什么已完成，什么是下一步

---

## 集成模式

**模式：** 手动导出

**工作原理：**
1. 你在 kse 中创建 Spec（需求、设计、任务）
2. 你使用 `kse context export` 导出上下文
3. 你将上下文提供给 Cursor（Chat、Composer 或 .cursorrules）
4. Cursor 基于你的 Spec 生成代码
5. 你在 tasks.md 中更新任务状态

---

## 设置

### 前置条件

- 已安装 **Cursor IDE**（[下载](https://cursor.sh/)）
- 已全局安装 **kse**（`npm install -g kiro-spec-engine`）
- 项目已被 kse **采用**（`kse adopt`）

### 步骤 1：为 kse 配置 Cursor

在项目根目录创建 `.cursorrules` 文件：

```markdown
# 项目规则

此项目使用 kse (Kiro Spec Engine) 进行规范驱动开发。

## Spec 位置
所有 Spec 都在 `.kiro/specs/` 目录中。

## 实现功能前
1. 检查 `.kiro/specs/` 中是否存在 Spec
2. 阅读 requirements.md、design.md 和 tasks.md
3. 严格遵循设计架构
4. 完成任务时更新 tasks.md

## Spec 结构
- requirements.md - 我们要构建什么以及为什么
- design.md - 我们如何构建（架构、API、组件）
- tasks.md - 分步实现计划

## 示例
对于用户登录功能：
- Spec：`.kiro/specs/01-00-user-login/`
- 设计：`.kiro/specs/01-00-user-login/design.md`
- 任务：`.kiro/specs/01-00-user-login/tasks.md`

## 代码标准
[在此添加项目特定的编码标准]
```

---

## 使用方法

### 方法 1：使用 Cursor Composer（推荐）

**Composer** 是 Cursor 的多文件编辑模式，非常适合实现完整功能。

**步骤：**

1. **导出 Spec 上下文：**
   ```bash
   kse context export 01-00-user-login
   ```

2. **打开 Composer：**
   - 按 `Cmd+K`（macOS）或 `Ctrl+K`（Windows/Linux）
   - 或点击右上角的 Composer 图标

3. **提供上下文：**
   ```
   我已在 .kiro/specs/01-00-user-login/ 中创建了用户登录功能的完整 Spec。
   
   请阅读：
   - requirements.md（需求）
   - design.md（设计）
   - tasks.md（任务）
   
   然后实现任务 1.1："设置项目依赖"
   
   严格遵循 design.md 中的架构。
   ```

4. **Cursor 将：**
   - 读取你的 Spec 文件
   - 理解需求和设计
   - 生成匹配你架构的代码
   - 创建或修改多个文件

5. **审查并接受：**
   - 审查 Cursor 的更改
   - 接受或调整代码
   - 在 tasks.md 中标记任务为完成

### 方法 2：使用 Cursor Chat

**Chat** 适合快速问题、代码解释或小的更改。

**步骤：**

1. **生成任务特定提示：**
   ```bash
   kse prompt generate 01-00-user-login 1.1
   ```

2. **打开 Chat：**
   - 按 `Cmd+L`（macOS）或 `Ctrl+L`（Windows/Linux）

3. **粘贴生成的提示** 并发送

4. **Cursor 将：**
   - 提供代码建议
   - 解释实现细节
   - 回答关于 Spec 的问题

### 方法 3：使用内联建议

**内联建议** 在你输入时提供 AI 补全。

**步骤：**

1. **在文件顶部添加上下文注释：**
   ```javascript
   // 任务 1.1：设置项目依赖
   // Spec：.kiro/specs/01-00-user-login/
   // 设计：参见 design.md 中的 AuthController
   
   // 实现 AuthController 类...
   ```

2. **开始输入** - Cursor 将基于你的 Spec 建议代码

3. **按 Tab** 接受建议

---

## 工作流示例

### 完整功能实现工作流

```bash
# 1. 创建 Spec
kse create-spec 01-00-user-login

# 2. 编写 requirements.md、design.md、tasks.md

# 3. 导出上下文
kse context export 01-00-user-login

# 4. 在 Cursor Composer 中（Cmd+K）：
"请实现 .kiro/specs/01-00-user-login/ 中的任务 1.1"

# 5. 审查并接受更改

# 6. 更新 tasks.md：
- [x] 1.1 设置项目依赖

# 7. 对下一个任务重复步骤 4-6
```

---

## 最佳实践

### 1. 使用 .cursorrules

始终在项目根目录创建 `.cursorrules` 文件，告诉 Cursor 关于你的 kse Spec。

### 2. 任务特定提示

对于大型 Spec，使用任务特定提示：
```bash
kse prompt generate 01-00-user-login 1.1
```

这会创建一个更小、更集中的上下文。

### 3. 明确你的指令

在 Composer 提示中明确：
- ✅ "严格遵循 design.md 中的架构"
- ✅ "使用 design.md 中指定的确切组件名称"
- ✅ "实现 requirements.md 中的所有验收标准"

### 4. 迭代审查

- 审查 Cursor 生成的代码
- 确保它匹配你的设计
- 根据需要调整
- 在 tasks.md 中更新任务状态

### 5. 使用 @-mentions

在 Composer 中，使用 `@` 引用特定文件：
```
@.kiro/specs/01-00-user-login/design.md 
请实现 AuthController，如设计文档中所述
```

---

## 故障排除

### 问题：Cursor 不遵循我的设计

**解决方案：**
1. 使你的 design.md 更详细
2. 在 design.md 中添加代码示例
3. 在提示中明确："严格遵循 design.md"
4. 使用 @-mentions 引用设计文件

### 问题：上下文太大

**解决方案：**
使用任务特定提示：
```bash
kse prompt generate 01-00-user-login 1.1
```

### 问题：Cursor 看不到我的 Spec 文件

**解决方案：**
1. 确保文件在 `.kiro/specs/` 中
2. 在 Composer 中使用 @-mentions
3. 检查 `.cursorignore` 是否排除了 `.kiro/`

---

## 相关文档

- 📖 [快速入门指南](../quick-start.md) - 开始使用 kse
- 🔌 [集成模式](../integration-modes.md) - 理解手动导出模式
- 📋 [Spec 工作流](../spec-workflow.md) - 创建有效的 Spec
- 🔧 [故障排除](../troubleshooting.md) - 常见问题

---

## 下一步

- 尝试使用 Cursor Composer 实现你的第一个任务
- 探索 [Watch 模式](../integration-modes.md#watch-mode) 进行自动上下文更新
- 查看 [API 示例](../examples/add-rest-api/) 获取完整的 Spec 示例

---

**版本**: 1.0.0  
**最后更新**: 2026-01-23
