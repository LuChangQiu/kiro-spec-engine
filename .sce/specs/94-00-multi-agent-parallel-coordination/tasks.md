# 实现计划：Multi-Agent Parallel Coordination

## 概述

基于设计文档，将多 Agent 并行协调功能分解为增量式编码任务。每个任务构建在前一个任务之上，最终将所有组件集成。项目使用 Node.js，测试使用 Jest + fast-check。

## 任务

- [x] 1. 多 Agent 配置与模式检测
  - [x] 1.1 创建 `lib/collab/multi-agent-config.js`
    - 实现 `MultiAgentConfig` 类，负责读取/写入 `.sce/config/multi-agent.json`
    - 提供 `isEnabled()`、`isCoordinatorEnabled()`、`getConfig()` 方法
    - 文件不存在时返回默认配置（disabled）
    - 使用 `fs-utils.writeJSON` 进行原子写入
    - _Requirements: 7.1, 7.4_

  - [ ]* 1.2 编写 MultiAgentConfig 单元测试
    - 测试文件不存在时返回默认配置
    - 测试配置文件损坏时的降级行为
    - 测试首次启用时的初始化
    - _Requirements: 7.1, 7.4_

- [x] 2. Agent 注册表
  - [x] 2.1 创建 `lib/collab/agent-registry.js`
    - 实现 `AgentRegistry` 类，管理 `.sce/config/agent-registry.json`
    - 实现 `register()`：基于 MachineIdentifier 生成 `{machineId}:{instanceIndex}` 格式的 AgentID
    - 实现 `deregister(agentId)`：移除记录
    - 实现 `heartbeat(agentId)`：更新 lastHeartbeat 时间戳
    - 实现 `getActiveAgents()`、`getAgent(agentId)`
    - 实现 `cleanupInactive()`：检测心跳超时的 Agent 并标记为 inactive
    - 注册表文件不存在时自动创建空注册表
    - 所有写操作使用原子写入
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7_

  - [ ]* 2.2 编写 Agent 注册完整性属性测试
    - **Property 1: Agent 注册完整性**
    - **Validates: Requirements 1.1**

  - [ ]* 2.3 编写 Agent ID 唯一性属性测试
    - **Property 4: Agent ID 唯一性**
    - **Validates: Requirements 1.5**

  - [ ]* 2.4 编写不活跃 Agent 检测属性测试
    - **Property 2: 不活跃 Agent 检测**
    - **Validates: Requirements 1.3**

  - [ ]* 2.5 编写 Agent 注销清理属性测试
    - **Property 5: Agent 注销清理**
    - **Validates: Requirements 1.6**

  - [ ]* 2.6 编写 AgentRegistry 单元测试
    - 测试注册表文件不存在时自动创建（Requirements 1.7）
    - 测试心跳更新
    - 测试多实例注册
    - _Requirements: 1.1-1.7_

- [x] 3. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 4. 任务级锁管理器
  - [x] 4.1 创建 `lib/lock/task-lock-manager.js`
    - 实现 `TaskLockManager` 类
    - 实现 `acquireTaskLock(specName, taskId, agentId)`：创建 `.sce/specs/{specName}/locks/{taskId}.lock`
    - 实现 `releaseTaskLock(specName, taskId, agentId)`：删除锁文件
    - 实现 `releaseAllLocks(agentId)`：释放指定 Agent 的所有锁
    - 实现 `getTaskLockStatus(specName, taskId)`、`listLockedTasks(specName)`
    - 实现 `isMultiAgentMode()`：检查配置决定行为模式
    - 单 Agent 模式下委托给现有 LockManager
    - 锁文件使用原子写入（temp + rename）
    - _Requirements: 2.1-2.7_

  - [ ]* 4.2 编写任务锁互斥性属性测试
    - **Property 6: 任务锁互斥性**
    - **Validates: Requirements 2.1, 2.2**

  - [ ]* 4.3 编写任务锁获取-释放往返属性测试
    - **Property 7: 任务锁获取-释放往返**
    - **Validates: Requirements 2.3**

  - [ ]* 4.4 编写单 Agent 模式向后兼容属性测试
    - **Property 8: 单 Agent 模式向后兼容**
    - **Validates: Requirements 2.6, 7.2**

  - [x] 4.5 集成 AgentRegistry 与 TaskLockManager 的清理联动
    - 在 `AgentRegistry.cleanupInactive()` 中调用 `TaskLockManager.releaseAllLocks()`
    - 在 `AgentRegistry.deregister()` 中调用 `TaskLockManager.releaseAllLocks()`
    - _Requirements: 1.4, 2.4_

  - [ ]* 4.6 编写不活跃 Agent 锁清理属性测试
    - **Property 3: 不活跃 Agent 锁清理**
    - **Validates: Requirements 1.4, 2.4**

- [x] 5. 任务状态安全存储
  - [x] 5.1 创建 `lib/task/task-status-store.js`
    - 实现 `TaskStatusStore` 类
    - 实现 `updateStatus(specName, taskId, status)`：带文件锁和重试的状态更新
    - 实现 `claimTask(specName, taskId, agentId, username)`：带锁的任务认领
    - 实现 `unclaimTask(specName, taskId, agentId, username)`：带锁的任务释放
    - 文件锁路径：`.sce/specs/{specName}/tasks.md.lock`
    - 写入前验证目标行未被修改（行内容比对）
    - 冲突时指数退避重试（最多 5 次，初始 100ms）
    - 重试耗尽返回冲突错误，保留原始文件不变
    - 单 Agent 模式下直接委托给现有 TaskClaimer（无锁、无重试）
    - _Requirements: 3.1-3.6_

  - [ ]* 5.2 编写 tasks.md 格式往返兼容属性测试
    - **Property 10: tasks.md 格式往返兼容**
    - **Validates: Requirements 3.6**

  - [ ]* 5.3 编写并发任务状态更新属性测试
    - **Property 9: 并发任务状态更新无丢失**
    - **Validates: Requirements 3.1**

  - [ ]* 5.4 编写 TaskStatusStore 单元测试
    - 测试重试耗尽后的错误返回和文件完整性（Requirements 3.5）
    - 测试行内容比对检测修改（Requirements 3.4）
    - 测试单 Agent 模式下的直接写入（Requirements 7.3）
    - _Requirements: 3.3-3.5, 7.3_

- [x] 6. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 7. Steering 文件锁
  - [x] 7.1 创建 `lib/lock/steering-file-lock.js`
    - 实现 `SteeringFileLock` 类
    - 实现 `acquireLock(filename)`、`releaseLock(filename, lockId)`
    - 实现 `withLock(filename, callback)`：带锁执行回调
    - 实现 `writePending(filename, content, agentId)`：降级写入 pending 文件
    - 锁文件路径：`.sce/steering/{filename}.lock`
    - 重试机制：最多 3 次，指数退避
    - 原子写入确保文件完整性
    - _Requirements: 5.1-5.4_

  - [ ]* 7.2 编写 Steering 文件写入串行化属性测试
    - **Property 12: Steering 文件写入串行化**
    - **Validates: Requirements 5.1**

  - [ ]* 7.3 编写 SteeringFileLock 单元测试
    - 测试 pending 文件降级写入（Requirements 5.4）
    - 测试锁获取和释放
    - _Requirements: 5.1-5.4_

- [x] 8. Git 合并协调器
  - [x] 8.1 创建 `lib/collab/merge-coordinator.js`
    - 实现 `MergeCoordinator` 类
    - 实现 `createAgentBranch(agentId, specName)`：创建 `agent/{agentId}/{specName}` 分支
    - 实现 `detectConflicts(branchName, targetBranch)`：检测合并冲突
    - 实现 `merge(branchName, targetBranch)`：执行自动合并
    - 实现 `cleanupBranch(branchName)`：清理已合并分支
    - 实现 `isMultiAgentMode()`：单 Agent 模式跳过分支操作
    - 使用 `child_process.execSync` 执行 Git 命令
    - _Requirements: 4.1-4.6_

  - [ ]* 8.2 编写 Agent 分支命名规范属性测试
    - **Property 11: Agent 分支命名规范**
    - **Validates: Requirements 4.1**

  - [ ]* 8.3 编写 MergeCoordinator 单元测试
    - 测试单 Agent 模式跳过分支创建（Requirements 4.6）
    - 测试分支命名格式
    - _Requirements: 4.1, 4.6_

- [x] 9. 中央协调器
  - [x] 9.1 创建 `lib/collab/coordinator.js`
    - 实现 `Coordinator` 类
    - 实现 `getReadyTasks(specName)`：基于 DependencyManager 计算就绪任务
    - 实现 `assignTask(agentId)`：从未锁定的就绪任务中分配
    - 实现 `completeTask(specName, taskId, agentId)`：标记完成并更新就绪集
    - 实现 `getProgress()`：计算进度汇总
    - 实现 `logAssignment()`：记录到 `coordination-log.json`
    - 协调器未启用时所有方法为无操作
    - _Requirements: 6.1-6.6_

  - [ ]* 9.2 编写依赖驱动就绪任务计算属性测试
    - **Property 13: 依赖驱动的就绪任务计算**
    - **Validates: Requirements 6.1, 6.3**

  - [ ]* 9.3 编写任务分配属性测试
    - **Property 14: 任务分配来自未锁定就绪集**
    - **Validates: Requirements 6.2**

  - [ ]* 9.4 编写进度汇总正确性属性测试
    - **Property 15: 进度汇总正确性**
    - **Validates: Requirements 6.4**

  - [ ]* 9.5 编写协调日志持久化属性测试
    - **Property 16: 协调日志持久化**
    - **Validates: Requirements 6.6**

  - [ ]* 9.6 编写 Coordinator 单元测试
    - 测试协调器禁用时的无操作行为（Requirements 6.5）
    - _Requirements: 6.5_

- [x] 10. 集成与接线
  - [x] 10.1 集成 TaskLockManager 与 TaskClaimer
    - 在 TaskLockManager.acquireTaskLock 中调用 TaskClaimer.claimTask
    - 在 TaskLockManager.releaseTaskLock 中调用 TaskClaimer.unclaimTask
    - 确保锁定和认领操作原子化
    - _Requirements: 2.5_

  - [x] 10.2 导出模块并更新入口点
    - 在 `lib/collab/index.js` 中导出 AgentRegistry、Coordinator、MergeCoordinator
    - 在 `lib/lock/index.js` 中导出 TaskLockManager、SteeringFileLock
    - 在 `lib/task/index.js` 中导出 TaskStatusStore
    - 更新 MultiAgentConfig 的导出
    - _Requirements: 7.1-7.5_

  - [ ]* 10.3 编写集成测试
    - 测试 AgentRegistry + TaskLockManager 清理联动
    - 测试 Coordinator + DependencyManager 任务分配流程
    - 测试完整的 Agent 生命周期：注册 → 锁定任务 → 更新状态 → 释放锁 → 注销
    - _Requirements: 1.1-1.6, 2.1-2.4, 6.1-6.3_

- [x] 11. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加速 MVP
- 每个任务引用具体需求以确保可追溯性
- 检查点确保增量验证
- 属性测试验证通用正确性属性
- 单元测试验证具体示例和边缘情况
- 所有新文件放置在现有目录结构中（lib/collab/, lib/lock/, lib/task/）
