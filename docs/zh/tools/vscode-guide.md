# 在 VS Code + Copilot 中使用 sce

> 将 sce 与 VS Code 和 GitHub Copilot 集成进行 AI 辅助开发的完整指南

---

**版本**: 1.42.0  
**最后更新**: 2026-02-11  
**工具**: VS Code + GitHub Copilot  
**集成模式**: 手动导出 + 内联注释  
**预计设置时间**: 5 分钟

---

## 概述

**VS Code** 是最流行的代码编辑器，**GitHub Copilot** 提供 AI 驱动的代码补全。

**sce 与 VS Code + Copilot 的集成**使用**手动导出**和**内联注释**，让 Copilot 理解你的 Spec 并生成匹配你设计的代码。

### 为什么在 VS Code + Copilot 中使用 sce？

- ✅ **熟悉的环境** - 使用你已知的编辑器
- ✅ **智能补全** - Copilot 遵循你的 Spec
- ✅ **内联建议** - 在你输入时获得上下文感知的代码
- ✅ **灵活集成** - 多种使用 sce 的方式

---

## 集成模式

**模式：** 手动导出 + 内联注释

**工作原理：**
1. 你在 sce 中创建 Spec（需求、设计、任务）
2. 你在代码中添加引用 Spec 的注释
3. Copilot 读取注释和 Spec 文件
4. Copilot 生成匹配你设计的代码
5. 你在 tasks.md 中更新任务状态

---

## 设置

### 前置条件

- 已安装 **VS Code**（[下载](https://code.visualstudio.com/)）
- 已安装 **GitHub Copilot** 扩展
- 已全局安装 **sce**（`npm install -g scene-capability-engine`）
- 项目已被 sce **采用**（`sce adopt`）

### 步骤 1：安装推荐的扩展

在 VS Code 中安装这些扩展：

1. **GitHub Copilot** - AI 代码补全
2. **GitHub Copilot Chat** - 与 Copilot 聊天
3. **Markdown All in One** - 更好的 Spec 编辑
4. **Mermaid Preview** - 可视化设计图

### 步骤 2：配置 VS Code 设置

创建 `.vscode/settings.json`：

```json
{
  "files.associations": {
    "*.md": "markdown"
  },
  "markdown.preview.breaks": true,
  "github.copilot.enable": {
    "*": true,
    "markdown": true
  },
  "github.copilot.advanced": {
    "inlineSuggestCount": 3
  }
}
```

### 步骤 3：创建 Workspace 片段（可选但推荐）

创建 `.vscode/sce.code-snippets`：

```json
{
  "sce Spec Reference": {
    "prefix": "sce-ref",
    "body": [
      "// Task ${1:1.1}: ${2:Task description}",
      "// Spec: .kiro/specs/${3:spec-name}/",
      "// Design: See ${4:ComponentName} in design.md",
      "// Requirements: ${5:FR-1, FR-2}",
      "//"
    ],
    "description": "Add sce Spec reference comment"
  },
  "sce Task Header": {
    "prefix": "sce-task",
    "body": [
      "/**",
      " * Task ${1:1.1}: ${2:Task description}",
      " * ",
      " * Spec: .kiro/specs/${3:spec-name}/",
      " * Requirements: ${4:FR-1}",
      " * Design: ${5:ComponentName} in design.md",
      " * ",
      " * Implementation notes:",
      " * - ${6:Note 1}",
      " */"
    ],
    "description": "Add sce task header comment"
  }
}
```

---

## 使用方法

### 方法 1：内联 Spec 引用（推荐）

**最佳用于：** 实现新功能和组件

**步骤：**

1. **创建新文件**（例如 `src/auth/AuthController.js`）

2. **添加 Spec 引用注释：**
   ```javascript
   /**
    * Task 1.1: 设置项目依赖
    * 
    * Spec: .kiro/specs/01-00-user-login/
    * Requirements: FR-1, FR-2, NFR-1
    * Design: AuthController in design.md
    * 
    * 实现说明：
    * - 使用 Express 进行路由
    * - 使用 bcrypt 进行密码哈希
    * - 使用 JWT 进行令牌
    * - 实现速率限制
    */
   ```

3. **开始输入** - Copilot 将：
   - 读取你的注释
   - 读取引用的 Spec 文件
   - 建议匹配你设计的代码

4. **按 Tab** 接受建议

### 方法 2：使用 Copilot Chat

**最佳用于：** 复杂实现和讨论

**步骤：**

1. **打开 Copilot Chat**
   - 按 `Cmd+Shift+I`（macOS）或 `Ctrl+Shift+I`（Windows/Linux）
   - 或点击侧边栏中的 Copilot 图标

2. **引用你的 Spec：**
   ```
   我正在实现 .kiro/specs/01-00-user-login/ 中的用户登录功能。
   
   请阅读：
   - requirements.md
   - design.md
   - tasks.md
   
   然后帮我实现任务 1.1："设置项目依赖"
   ```

3. **Copilot 将：**
   - 读取你的 Spec 文件
   - 提供代码建议
   - 解释实现决策

4. **插入代码** 到你的文件中

### 方法 3：使用 Workspace 片段

**最佳用于：** 快速添加 Spec 引用

**步骤：**

1. **在文件中输入：**
   ```
   sce-ref
   ```

2. **按 Tab** - 片段展开为：
   ```javascript
   // Task 1.1: Task description
   // Spec: .kiro/specs/spec-name/
   // Design: See ComponentName in design.md
   // Requirements: FR-1, FR-2
   //
   ```

3. **填写详细信息** 并开始编码

4. **Copilot 使用此上下文** 进行建议

---

## 工作流示例

### 完整功能实现工作流

```bash
# 1. 创建 Spec
sce spec bootstrap --name 01-00-user-login --non-interactive

# 2. 在 VS Code 中编写 Spec
# - 打开 requirements.md
# - 打开 design.md
# - 打开 tasks.md

# 3. 创建实现文件
# src/auth/AuthController.js

# 4. 添加 Spec 引用（使用 sce-ref 片段）
sce-ref [Tab]

# 5. 开始编码 - Copilot 建议代码

# 6. 接受建议（Tab）

# 7. 在 tasks.md 中标记任务为完成
- [x] 1.1 设置项目依赖

# 8. 对下一个任务重复
```

---

## 最佳实践

### 1. 始终添加 Spec 引用

在每个文件顶部添加 Spec 引用：
```javascript
// Spec: .kiro/specs/01-00-user-login/
// Task: 1.1 - 设置项目依赖
```

### 2. 使用描述性注释

Copilot 读取注释。要具体：
```javascript
// 实现 AuthController.login() 方法
// 要求：
// - 验证邮箱和密码
// - 检查速率限制
// - 返回 JWT 令牌
```

### 3. 在注释中引用设计

```javascript
// 参见 design.md 中的 AuthController 设计
// 使用 design.md 中指定的确切方法名称
```

### 4. 分解复杂任务

对于复杂任务，添加分步注释：
```javascript
// 步骤 1：验证输入
// 步骤 2：检查速率限制
// 步骤 3：验证凭据
// 步骤 4：生成令牌
// 步骤 5：返回响应
```

### 5. 使用 Copilot Chat 进行复杂逻辑

对于复杂实现，使用 Copilot Chat：
- 讨论方法
- 获取代码示例
- 要求解释

---

## 示例代码模式

### 模式 1：组件实现

```javascript
/**
 * AuthController - 处理认证请求
 * 
 * Spec: .kiro/specs/01-00-user-login/
 * Task: 3.1 - 实现 AuthController
 * Design: 参见 design.md 中的 AuthController
 * Requirements: FR-1, FR-2, NFR-1
 * 
 * 此控制器实现：
 * - POST /api/auth/login - 用户登录
 * - 输入验证
 * - 速率限制
 * - JWT 令牌生成
 */

class AuthController {
  // Copilot 将基于上述上下文建议实现
}
```

### 模式 2：方法实现

```javascript
/**
 * 验证用户凭据
 * 
 * Task: 2.2 - 实现 AuthService.authenticate()
 * Design: 参见 design.md 中的 AuthService
 * 
 * @param {string} email - 用户邮箱
 * @param {string} password - 用户密码
 * @returns {Promise<User|null>} 如果有效则返回用户，否则返回 null
 * 
 * 实现：
 * 1. 通过邮箱查找用户
 * 2. 使用 bcrypt 比较密码
 * 3. 如果匹配则返回用户
 */
async authenticate(email, password) {
  // Copilot 将建议实现
}
```

### 模式 3：测试实现

```javascript
/**
 * AuthService 测试
 * 
 * Spec: .kiro/specs/01-00-user-login/
 * Task: 4.1 - 编写全面的测试
 * 
 * 测试场景：
 * - 有效凭据 → 返回用户
 * - 无效凭据 → 返回 null
 * - 缺少邮箱 → 抛出错误
 * - 无效邮箱格式 → 抛出错误
 */

describe('AuthService', () => {
  // Copilot 将建议测试用例
});
```

---

## 故障排除

### 问题：Copilot 不遵循我的 Spec

**解决方案：**
1. 使你的注释更详细
2. 在注释中引用特定的设计部分
3. 在 design.md 中添加代码示例
4. 使用 Copilot Chat 进行复杂实现

### 问题：Copilot 建议不相关的代码

**解决方案：**
1. 添加更多上下文到注释
2. 引用 Spec 文件：`// Spec: .kiro/specs/...`
3. 要具体："实现 design.md 中的确切 AuthController"

### 问题：Copilot 看不到我的 Spec 文件

**解决方案：**
1. 确保 Spec 文件在工作区中
2. 在 VS Code 中打开 Spec 文件
3. 在注释中使用相对路径
4. 检查 `.gitignore` 是否排除了 `.kiro/`

---

## 高级技巧

### 1. 使用多文件上下文

在多个文件中打开 Spec：
- requirements.md
- design.md
- 你的实现文件

Copilot 使用所有打开文件的上下文。

### 2. 使用 Copilot Labs

如果你有 Copilot Labs：
- 使用"解释"功能理解 Spec
- 使用"翻译"功能转换设计为代码
- 使用"测试"功能生成测试

### 3. 创建模板文件

为常见模式创建模板：
```javascript
// templates/controller-template.js
/**
 * [ComponentName] - [Description]
 * 
 * Spec: .kiro/specs/[spec-name]/
 * Task: [task-id] - [task-description]
 * Design: See [ComponentName] in design.md
 * Requirements: [requirements]
 */
```

### 4. 使用任务注释

在 tasks.md 中添加实现注释：
```markdown
- [ ] 1.1 设置项目依赖
  <!-- 实现：src/package.json -->
  <!-- 参考：design.md 中的技术栈部分 -->
```

---

## 相关文档

- 📖 [快速入门指南](../quick-start.md) - 开始使用 sce
- 🔌 [集成模式](../integration-modes.md) - 理解手动导出模式
- 📋 [Spec 工作流](../spec-workflow.md) - 创建有效的 Spec
- 🔧 [故障排除](../troubleshooting.md) - 常见问题

---

## 下一步

- 设置 VS Code 片段以快速引用 Spec
- 尝试使用 Copilot Chat 进行复杂实现
- 探索 [Cursor 指南](cursor-guide.md) 获取更集成的体验
- 查看 [API 示例](../examples/add-rest-api/) 获取完整的 Spec 示例

---

**版本**: 1.42.0  
**最后更新**: 2026-02-11

