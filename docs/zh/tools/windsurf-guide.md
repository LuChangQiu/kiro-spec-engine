# 在 Windsurf 中使用 sce

> 将 sce 与 Windsurf IDE 集成进行 AI 辅助开发的完整指南

---

**版本**: 1.42.0  
**最后更新**: 2026-02-11  
**工具**: Windsurf IDE  
**集成模式**: 原生 + Watch 模式  
**预计设置时间**: 2 分钟

---

## 概述

**Windsurf** 是一个 AI 驱动的 IDE，具有强大的命令执行能力。它可以直接运行 shell 命令，使其成为 sce 的理想选择。

**sce 与 Windsurf 的集成**支持**原生模式**和**Watch 模式**，实现最无缝的体验。

### 为什么在 Windsurf 中使用 sce？

- ✅ **原生命令执行** - Windsurf 可以直接运行 sce 命令
- ✅ **自动化工作流** - 无需手动导出/粘贴
- ✅ **Watch 模式支持** - 自动上下文更新
- ✅ **完全集成** - 最无缝的 sce 体验

---

## 集成模式

**模式：** 原生 + Watch 模式

**工作原理：**
1. 你在 sce 中创建 Spec（需求、设计、任务）
2. 你告诉 Windsurf："使用 sce 检查 spec 并实现任务 1.1"
3. Windsurf 自动运行 `sce context export`
4. Windsurf 读取导出的上下文
5. Windsurf 生成代码
6. Windsurf 可以更新 tasks.md 中的任务状态

---

## 设置

### 前置条件

- 已安装 **Windsurf IDE**（[下载](https://windsurf.ai/)）
- 已全局安装 **sce**（`npm install -g scene-capability-engine`）
- 项目已被 sce **采用**（`sce adopt`）

### 步骤 1：验证 sce 可访问

在 Windsurf 终端中：
```bash
sce --version
```

应显示版本号（例如 1.3.0）。

### 步骤 2：启用 Watch 模式（可选但推荐）

Watch 模式在文件更改时自动更新上下文：

```bash
sce watch start
```

这会在后台启动文件监视器。

---

## 使用方法

### 方法 1：直接命令（推荐）

**最简单的方法** - 只需告诉 Windsurf 使用 sce！

**步骤：**

1. **在 Windsurf 中打开聊天**

2. **告诉 Windsurf：**
   ```
   使用 sce 检查 01-00-user-login 的 spec 并实现任务 1.1
   ```

3. **Windsurf 将：**
   - 运行 `sce context export 01-00-user-login`
   - 读取导出的上下文
   - 理解需求和设计
   - 生成代码
   - 创建或修改文件
   - 可选：更新 tasks.md

### 方法 2：分步命令

**更多控制** - 明确告诉 Windsurf 每一步做什么。

**步骤：**

1. **导出上下文：**
   ```
   请运行：sce context export 01-00-user-login
   ```

2. **读取上下文：**
   ```
   请读取 .sce/specs/01-00-user-login/context-export.md
   ```

3. **实现任务：**
   ```
   现在请实现任务 1.1："设置项目依赖"
   严格遵循 design.md 中的架构。
   ```

4. **更新任务状态：**
   ```
   请在 .sce/specs/01-00-user-login/tasks.md 中将任务 1.1 标记为完成
   ```

### 方法 3：Watch 模式 + 自动更新

**最自动化** - 文件更改时自动更新上下文。

**步骤：**

1. **启动 Watch 模式：**
   ```bash
   sce watch start
   ```

2. **配置 Watch 模式以在更改时导出：**
   ```bash
   sce watch add --pattern ".sce/specs/*/requirements.md" --action "sce context export {spec}"
   sce watch add --pattern ".sce/specs/*/design.md" --action "sce context export {spec}"
   ```

3. **现在，当你更新 Spec 文件时：**
   - Watch 模式自动重新导出上下文
   - Windsurf 始终拥有最新的上下文
   - 无需手动重新导出！

---

## 工作流示例

### 完整功能实现工作流

```bash
# 1. 创建 Spec
sce spec bootstrap --name 01-00-user-login --non-interactive

# 2. 编写 requirements.md、design.md、tasks.md

# 3. 在 Windsurf 中告诉 AI：
"使用 sce 检查 01-00-user-login 的 spec 并实现任务 1.1"

# 4. Windsurf 自动：
# - 导出上下文
# - 读取 Spec
# - 生成代码
# - 更新任务状态

# 5. 审查更改

# 6. 对下一个任务重复
"现在请实现任务 1.2"
```

### 使用 Watch 模式的迭代开发

```bash
# 1. 启动 Watch 模式
sce watch start

# 2. 在 Windsurf 中实现任务
"使用 sce 实现 01-00-user-login 的任务 1.1"

# 3. 如果需要，更新 design.md
# Watch 模式自动重新导出上下文

# 4. 继续下一个任务
"现在请实现任务 1.2"
# Windsurf 使用更新的上下文
```

---

## 最佳实践

### 1. 使用自然语言

Windsurf 理解自然语言。只需说：
```
"使用 sce 检查 user-login spec 并实现下一个任务"
```

### 2. 让 Windsurf 管理任务

Windsurf 可以更新任务状态：
```
"实现任务 1.1 并在 tasks.md 中标记为完成"
```

### 3. 使用 Watch 模式进行活跃开发

在活跃开发期间启动 Watch 模式：
```bash
sce watch start
```

完成后停止：
```bash
sce watch stop
```

### 4. 批量实现任务

Windsurf 可以实现多个任务：
```
"使用 sce 实现 01-00-user-login 的任务 1.1、1.2 和 1.3"
```

### 5. 要求验证

让 Windsurf 验证实现：
```
"实现任务 1.1 并运行测试以验证它是否有效"
```

---

## 示例提示

### 实现新功能

```
使用 sce 检查 .sce/specs/01-00-user-login/ 中的 spec 并实现任务 1.1："设置项目依赖"。

严格遵循 design.md 中的架构。
完成后在 tasks.md 中标记任务为完成。
```

### 实现多个任务

```
使用 sce 检查 01-00-user-login spec 并实现阶段 1 的所有任务（1.1 和 1.2）。

对于每个任务：
1. 实现代码
2. 编写测试
3. 在 tasks.md 中标记为完成
```

### 调试问题

```
我正在实现 01-00-user-login spec。

任务 2.1 已完成，但测试失败。请：
1. 使用 sce 检查 spec
2. 审查我的代码
3. 识别问题
4. 修复它
5. 运行测试以验证
```

---

## Watch 模式配置

### 基本 Watch 配置

在 Spec 更改时自动导出上下文：

```bash
# 监视 requirements.md 更改
sce watch add --pattern ".sce/specs/*/requirements.md" --action "sce context export {spec}"

# 监视 design.md 更改
sce watch add --pattern ".sce/specs/*/design.md" --action "sce context export {spec}"

# 监视 tasks.md 更改
sce watch add --pattern ".sce/specs/*/tasks.md" --action "sce context export {spec}"
```

### 高级 Watch 配置

在 Spec 更改时运行测试：

```bash
# 在任务更新时运行测试
sce watch add --pattern ".sce/specs/*/tasks.md" --action "npm test"

# 在设计更改时运行 linter
sce watch add --pattern ".sce/specs/*/design.md" --action "npm run lint"
```

### 检查 Watch 状态

```bash
# 查看 Watch 模式是否正在运行
sce watch status

# 列出所有 watch 规则
sce watch list

# 停止 Watch 模式
sce watch stop
```

---

## 故障排除

### 问题：Windsurf 找不到 sce 命令

**解决方案：**
1. 验证 sce 已全局安装：
   ```bash
   npm list -g scene-capability-engine
   ```
2. 重启 Windsurf
3. 检查 PATH 是否包含 npm 全局 bin

### 问题：Watch 模式未触发

**解决方案：**
1. 检查 Watch 模式是否正在运行：
   ```bash
   sce watch status
   ```
2. 验证文件模式是否正确：
   ```bash
   sce watch list
   ```
3. 重启 Watch 模式：
   ```bash
   sce watch stop
   sce watch start
   ```

### 问题：Windsurf 不遵循设计

**解决方案：**
1. 使你的 design.md 更详细
2. 在提示中明确："严格遵循 design.md"
3. 要求 Windsurf 先读取设计：
   ```
   首先读取 .sce/specs/01-00-user-login/design.md
   然后实现任务 1.1
   ```

---

## 相关文档

- 📖 [快速入门指南](../quick-start.md) - 开始使用 sce
- 🔌 [集成模式](../integration-modes.md) - 理解原生和 Watch 模式
- 📋 [Spec 工作流](../spec-workflow.md) - 创建有效的 Spec
- 🔧 [故障排除](../troubleshooting.md) - 常见问题

---

## 下一步

- 尝试使用 Windsurf 的原生命令实现你的第一个任务
- 设置 Watch 模式进行自动上下文更新
- 探索批量任务实现
- 查看 [API 示例](../examples/add-rest-api/) 获取完整的 Spec 示例

---

**版本**: 1.42.0  
**最后更新**: 2026-02-11

