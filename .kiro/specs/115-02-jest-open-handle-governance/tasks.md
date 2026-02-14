# Implementation Plan: 115-02 Jest Open Handle Governance

## Tasks

- [ ] 1. 建立诊断基线
  - [ ] 1.1 新增句柄检测执行脚本
  - [ ] 1.2 记录当前泄漏信号

- [ ] 2. 修复异步资源泄漏
  - [ ] 2.1 修复 watch/integration 测试清理逻辑
  - [ ] 2.2 修复遗留 timer/process 清理逻辑

- [ ] 3. 收敛配置
  - [ ] 3.1 移除默认 `forceExit`
  - [ ] 3.2 如需过渡，添加短期 fallback 说明

- [ ] 4. 验证
  - [ ] 4.1 执行 full 测试
  - [ ] 4.2 输出治理报告并同步主 Spec
