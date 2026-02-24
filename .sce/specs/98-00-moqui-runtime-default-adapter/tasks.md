# 实现任务

## 任务 1：默认接线实现

- [ ] 1.1 在运行时接入 Moqui 自动注册逻辑
  - 配置有效时优先 `moqui.adapter`
  - 配置无效时回退 `builtin.erp-sim`
  - **验证**: Requirement 1

- [ ] 1.2 补充 warning 可观测输出
  - 在 run/doctor 结果中可见
  - **验证**: Requirement 1

## 任务 2：配置归一与校验

- [ ] 2.1 实现 Legacy_Config -> Canonical_Config 归一
  - **验证**: Requirement 2

- [ ] 2.2 保持错误消息字段路径可读
  - **验证**: Requirement 2

## 任务 3：文档收敛

- [ ] 3.1 更新 Moqui 配置示例与命令示例
  - 覆盖 scene-runtime-guide/command-reference/README
  - **验证**: Requirement 3

## 任务 4：Readiness 扩展

- [ ] 4.1 dry_run 场景增加 ERP readiness 检查
  - **验证**: Requirement 4

## 任务 5：测试

- [ ] 5.1 新增/更新单测
  - 运行时默认 handler 选择
  - 配置归一逻辑
  - readiness 输出
  - **验证**: Requirement 1, 2, 4

- [ ] 5.2 Scene 命令路径回归
  - 覆盖 `scene connect/discover/extract/run/doctor` 的配置归一与默认接线路径
  - **验证**: Requirement 5
