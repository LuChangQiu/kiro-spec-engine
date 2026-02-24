# 实现计划: Spec 级 Steering 约束与多 Agent 上下文协调

## 概述

基于设计文档，按组件逐步实现 Spec 级 Steering（L4）、SteeringLoader、ContextSyncManager、SpecLifecycleManager 和 SyncBarrier。每个组件实现后紧跟属性测试和单元测试，确保增量验证。

## 任务

- [x] 1. 实现 SpecSteering 组件
  - [x] 1.1 创建 `lib/steering/spec-steering.js`，实现 SpecSteering 类
    - 实现 `parse(content)` 和 `format(data)` 方法（Markdown ↔ 结构化对象）
    - 实现 `createTemplate(specName)`（多 Agent 模式守卫 + 模板生成）
    - 实现 `read(specName)` 和 `write(specName, data)`（原子写）
    - _Requirements: 1.1, 1.3, 1.4, 7.1, 7.2, 7.3_

  - [ ]* 1.2 编写 SpecSteering 属性测试
    - **Property 1: steering.md 往返一致性**
    - **Validates: Requirements 1.4, 7.2, 7.3, 7.4**

  - [ ]* 1.3 编写 SpecSteering 单元测试
    - 模板生成验证（包含三个区域）
    - 损坏文件处理（返回空对象）
    - 单 Agent 模式下 createTemplate 为 no-op
    - _Requirements: 1.1, 1.5, 6.1_

  - [ ]* 1.4 编写 Spec 间写隔离属性测试
    - **Property 4: Spec 间写隔离**
    - **Validates: Requirements 1.3**

- [x] 2. 实现 SteeringLoader 组件
  - [x] 2.1 创建 `lib/steering/steering-loader.js`，实现 SteeringLoader 类
    - 实现 `load(specName)` 加载 L1-L4 四层
    - 实现 `loadMerged(specName)` 合并所有层级
    - 单 Agent 模式下跳过 L4
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.4_

  - [ ]* 2.2 编写 SteeringLoader 属性测试
    - **Property 3: Steering 合并优先级**
    - **Validates: Requirements 1.2, 2.3**

  - [ ]* 2.3 编写缺失文件优雅降级属性测试
    - **Property 11: 缺失文件优雅降级**
    - **Validates: Requirements 2.4, 2.5**

  - [ ]* 2.4 编写 SteeringLoader 单元测试
    - 四层全部存在时的加载验证
    - 部分层级缺失时的加载验证
    - 单 Agent 模式下 L4 为 null
    - _Requirements: 2.1, 2.4, 6.4_

- [x] 3. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 4. 实现 ContextSyncManager 组件
  - [x] 4.1 创建 `lib/steering/context-sync-manager.js`，实现 ContextSyncManager 类
    - 实现 `parseContext(content)` 和 `formatContext(context)`（Markdown ↔ 结构化对象）
    - 实现 `readContext()` 和 `writeContext(context)`
    - 实现 `updateSpecProgress(specName, entry)`（使用 SteeringFileLock）
    - 实现 `computeProgress(specName)`（基于 TaskClaimer 解析 tasks.md）
    - 单 Agent 模式下 updateSpecProgress 为 no-op
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.2_

  - [ ]* 4.2 编写 CURRENT_CONTEXT 往返一致性属性测试
    - **Property 2: CURRENT_CONTEXT 往返一致性**
    - **Validates: Requirements 3.1**

  - [ ]* 4.3 编写 Context 更新隔离属性测试
    - **Property 5: Context 更新隔离**
    - **Validates: Requirements 3.2**

  - [ ]* 4.4 编写进度计算正确性属性测试
    - **Property 6: 进度计算正确性**
    - **Validates: Requirements 3.4**

  - [ ]* 4.5 编写 ContextSyncManager 单元测试
    - SteeringFileLock 集成验证
    - 单 Agent 模式下为 no-op
    - _Requirements: 3.3, 3.5_

- [x] 5. 实现 SpecLifecycleManager 组件
  - [x] 5.1 创建 `lib/collab/spec-lifecycle-manager.js`，实现 SpecLifecycleManager 类
    - 定义 VALID_TRANSITIONS 状态转换表
    - 实现 `getStatus(specName)` 和 `transition(specName, newStatus)`
    - 实现 `checkCompletion(specName)`（基于 TaskClaimer 检测所有任务完成）
    - 实现 `readLifecycle(specName)` 和 `writeLifecycle(specName, lifecycle)`
    - 状态转换为 completed 时触发 ContextSyncManager 更新和 AgentRegistry 通知
    - 单 Agent 模式下为 no-op
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 6.3_

  - [ ]* 5.2 编写非法状态转换拒绝属性测试
    - **Property 7: 非法状态转换拒绝**
    - **Validates: Requirements 4.5**

  - [ ]* 5.3 编写生命周期持久化往返一致性属性测试
    - **Property 8: 生命周期持久化往返一致性**
    - **Validates: Requirements 4.6**

  - [ ]* 5.4 编写自动完成检测属性测试
    - **Property 9: 自动完成检测**
    - **Validates: Requirements 4.2**

  - [ ]* 5.5 编写 SpecLifecycleManager 单元测试
    - 五状态识别验证
    - completed 触发 ContextSyncManager 更新
    - completed 触发 AgentRegistry 通知
    - 单 Agent 模式下不创建 lifecycle.json
    - _Requirements: 4.1, 4.3, 4.4, 6.3_

- [x] 6. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 7. 实现 SyncBarrier 组件
  - [x] 7.1 创建 `lib/collab/sync-barrier.js`，实现 SyncBarrier 类
    - 实现 `prepareSwitch(specName)`（Git 状态检查 + Steering 重新加载）
    - 实现 `hasUncommittedChanges()`（调用 `git status --porcelain`）
    - 单 Agent 模式下返回 `{ready: true}`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 7.2 编写单 Agent 模式零开销属性测试
    - **Property 10: 单 Agent 模式零开销**
    - **Validates: Requirements 3.5, 5.4, 6.1, 6.2, 6.3, 6.4**

  - [ ]* 7.3 编写未提交更改阻止切换属性测试
    - **Property 12: 未提交更改阻止切换**
    - **Validates: Requirements 5.3**

  - [ ]* 7.4 编写 SyncBarrier 单元测试
    - prepareSwitch 调用 Git 命令验证
    - Steering 重新加载验证
    - 单 Agent 模式下跳过所有检查
    - _Requirements: 5.1, 5.2, 5.4_

- [x] 8. 集成与接线
  - [x] 8.1 将新组件集成到现有 Coordinator
    - 在 Coordinator.completeTask 中调用 SpecLifecycleManager.checkCompletion
    - 在 Coordinator.assignTask 中调用 SyncBarrier.prepareSwitch
    - _Requirements: 4.2, 5.1_

  - [x] 8.2 导出新模块并更新 index.js
    - 导出 SpecSteering、SteeringLoader、ContextSyncManager、SpecLifecycleManager、SyncBarrier
    - _Requirements: 全部_

  - [ ]* 8.3 编写集成测试
    - Coordinator 完成任务后自动检测 Spec 完成
    - 端到端流程：创建 Spec → 分配 → 执行 → 完成 → 上下文更新
    - _Requirements: 4.2, 4.3, 3.2_

- [x] 9. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

## 备注

- 标记 `*` 的任务为可选，可跳过以加速 MVP
- 每个任务引用具体需求以确保可追溯性
- 检查点确保增量验证
- 属性测试验证通用正确性属性
- 单元测试验证具体示例和边界情况
