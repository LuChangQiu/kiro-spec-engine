# 快速入门：配合 AI 工具使用 sce

> 5分钟学会如何用 sce 配合 Claude、Cursor、Copilot 等 AI 工具

---

## ⚠️ 重要：sce 的定位

**sce 不是独立开发工具，而是 AI 工具的增强器**

```
你的工作界面 = AI 工具（Codex/Claude/Cursor）
sce 的角色 = 后台管理 Spec，为 AI 提供结构化上下文
```

**简单理解**：
- ❌ sce 不是用来写代码的
- ✅ sce 是用来**组织项目信息**，让 AI 更好地帮你写代码
- ✅ 你主要在 AI 工具中工作，sce 在后台提供支持

**三种使用模式**：
1. **AI 主动调用 sce**（Windsurf/Cline）- 最佳，完全自动 ⭐
2. **手动导出上下文**（Claude/ChatGPT）- 当前方式
3. **Watch Mode 自动化**（所有工具）- 进阶用法

**详细说明**：查看 [集成哲学文档](./integration-philosophy.md)

---

## 核心理念

**sce 是什么？**
- 一个 CLI 工具，帮你管理项目的 Spec（需求、设计、任务）
- 生成结构化的上下文，让 AI 工具更好地理解你的项目

**为什么需要 sce？**
- AI 工具需要清晰的上下文才能生成高质量代码
- sce 帮你组织和导出这些上下文
- 让 AI 按照你的设计和规范工作

---

## 工作流程图

```
┌─────────────┐
│  1. 用 sce  │
│  创建 Spec  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  2. 导出    │
│  上下文     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  3. 复制到  │
│  AI 工具    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  4. AI 帮你 │
│  写代码     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  5. 更新    │
│  任务状态   │
└─────────────┘
```

---

## 5分钟快速开始

### 步骤 1：安装 sce

```bash
npm install -g scene-capability-engine
```

### 步骤 2：初始化项目

```bash
cd your-project
sce adopt
```

这会在项目中创建 `.sce/` 目录。

### 步骤 3：创建你的第一个 Spec

```bash
sce spec bootstrap --name 01-00-user-login --non-interactive
```

然后编辑生成的文件：
- `.sce/specs/01-00-user-login/requirements.md` - 写需求
- `.sce/specs/01-00-user-login/design.md` - 写设计
- `.sce/specs/01-00-user-login/tasks.md` - 列任务

### 步骤 4：导出上下文

```bash
sce context export 01-00-user-login
```

这会生成：`.sce/specs/01-00-user-login/context-export.md`

### 步骤 5：使用 AI 工具

#### 方式 A：Claude Code / ChatGPT

1. 打开生成的 `context-export.md`
2. 复制全部内容
3. 粘贴到 Claude/ChatGPT 对话框
4. 说："请帮我实现任务 1.1"

#### 方式 B：Cursor

1. 生成任务提示：
   ```bash
   sce prompt generate 01-00-user-login 1.1
   ```

2. 打开 Cursor Composer (Cmd+K)
3. 粘贴生成的提示
4. Cursor 会根据上下文生成代码

#### 方式 C：GitHub Copilot

1. 在代码文件中添加注释：
   ```javascript
   // Task 1.1: Implement user login
   // See: .sce/specs/01-00-user-login/design.md
   ```

2. Copilot 会根据 Spec 文件生成代码

### 步骤 6：更新任务状态

完成任务后，编辑 `tasks.md`：

```markdown
- [x] 1.1 实现用户登录功能  ← 改成 [x] 表示完成
- [ ] 1.2 添加密码加密
```

---

## 详细示例：用 Claude Code 实现登录功能

### 1. 创建 Spec

```bash
sce spec bootstrap --name 01-00-user-login --non-interactive
```

### 2. 编写需求（requirements.md）

```markdown
# 用户登录功能

## 1. 功能需求

### 1.1 用户可以用邮箱和密码登录
- 输入：邮箱、密码
- 输出：登录成功返回 token，失败返回错误信息
- 验证：邮箱格式、密码长度 >= 6
```

### 3. 编写设计（design.md）

```markdown
# 设计方案

## 1. API 设计

### 1.1 登录接口
- 路径：POST /api/auth/login
- 请求体：{ email: string, password: string }
- 响应：{ token: string } 或 { error: string }

## 2. 实现方案

### 2.1 AuthController
- validateEmail() - 验证邮箱格式
- validatePassword() - 验证密码长度
- login() - 处理登录逻辑
```

### 4. 列出任务（tasks.md）

```markdown
- [ ] 1.1 实现 AuthController 类
- [ ] 1.2 实现邮箱验证
- [ ] 1.3 实现密码验证
- [ ] 1.4 实现登录逻辑
- [ ] 1.5 编写单元测试
```

### 5. 导出上下文

```bash
sce context export 01-00-user-login
```

### 6. 在 Claude Code 中使用

**对话示例**：

```
你：[粘贴 context-export.md 的全部内容]

你：请帮我实现任务 1.1 "实现 AuthController 类"，
    按照设计文档中的方案，用 TypeScript 实现。

Claude：好的，我会根据设计文档实现 AuthController 类...
[生成代码]

你：很好！现在请为这个类编写单元测试。

Claude：[生成测试代码]

你：完美！请帮我更新 tasks.md，标记任务 1.1 为完成。

[你手动更新 tasks.md：- [x] 1.1 实现 AuthController 类]
```

---

## 不同 AI 工具的最佳实践

### Claude Code / ChatGPT
✅ **优势**：大上下文窗口，可以一次加载完整 Spec  
📝 **用法**：复制 `context-export.md` 全部内容  
💡 **技巧**：一次对话可以完成多个任务

### Cursor
✅ **优势**：IDE 集成，可以直接修改文件  
📝 **用法**：用 `sce prompt generate` 生成任务提示  
💡 **技巧**：使用 Composer 模式，让 Cursor 直接编辑文件

### GitHub Copilot
✅ **优势**：实时代码补全  
📝 **用法**：在代码注释中引用 Spec 文件  
💡 **技巧**：写详细的注释，Copilot 会根据 Spec 生成代码

### Windsurf / Cline
✅ **优势**：可以执行命令和修改文件  
📝 **用法**：让 AI 直接运行 `sce` 命令  
💡 **技巧**：AI 可以自动导出上下文和更新任务状态

---

## 常见问题

### Q: 每次都要复制粘贴上下文吗？

**A**: 取决于 AI 工具：
- **Claude/ChatGPT**：是的，每次新对话需要重新加载
- **Cursor**：可以在项目中持续使用，Cursor 会记住上下文
- **Copilot**：不需要，它会自动读取项目文件

### Q: 上下文太大怎么办？

**A**: 使用任务级别的提示：
```bash
# 只导出特定任务的上下文
sce prompt generate 01-00-user-login 1.1
```

### Q: AI 生成的代码不符合设计怎么办？

**A**: 
1. 检查 `design.md` 是否写得够详细
2. 在提示中明确说："严格按照设计文档实现"
3. 提供代码示例在设计文档中

### Q: 如何让 AI 遵循项目规范？

**A**: 使用 Steering Rules：
```bash
# 导出时包含规范
sce context export 01-00-user-login --steering --steering-files=CORE_PRINCIPLES.md
```

### Q: 可以自动更新任务状态吗？

**A**: 
- **AI IDE**：支持自动更新
- **其他工具**：需要手动更新 `tasks.md`
- **未来**：计划支持更多工具的自动更新

---

## 进阶技巧

### 1. 使用 Steering Rules 控制 AI 行为

创建 `.sce/steering/CODING_STANDARDS.md`：

```markdown
# 编码规范

- 使用 TypeScript
- 所有函数必须有 JSDoc 注释
- 使用 async/await 而不是 Promise.then
- 错误处理使用 try-catch
```

导出时包含：
```bash
sce context export 01-00-user-login --steering
```

### 2. 为不同工具生成不同格式的提示

```bash
# 为 Claude 生成
sce prompt generate 01-00-user-login 1.1 --tool=claude-code

# 为 Cursor 生成
sce prompt generate 01-00-user-login 1.1 --tool=cursor

# 通用格式
sce prompt generate 01-00-user-login 1.1
```

### 3. 批量导出多个任务

```bash
# 导出整个 Spec
sce context export 01-00-user-login

# 然后在 AI 工具中说：
# "请按顺序实现任务 1.1 到 1.5"
```

---

## 总结

**sce 的价值**：
1. ✅ 结构化管理项目需求和设计
2. ✅ 生成 AI 友好的上下文
3. ✅ 让 AI 按照你的规范工作
4. ✅ 跟踪任务进度

**配合 AI 工具的流程**：
1. 用 sce 写 Spec（需求、设计、任务）
2. 导出上下文
3. 复制给 AI 工具
4. AI 帮你写代码
5. 更新任务状态

**下一步**：
- 查看 [完整跨工具指南](./cross-tool-guide.md)
- 查看 [命令参考](./command-reference.md)
- 查看 [手动工作流指南](./manual-workflows-guide.md)

---

**开始使用！** 🚀

```bash
npm install -g scene-capability-engine
sce adopt
sce spec bootstrap --name 01-00-my-feature --non-interactive
```

