# 实现任务

## 任务 1：Adapter 命名空间扩展

- [ ] 1.1 扩展 `parseBindingRef` 支持 `moqui.api.*` 与 `moqui.monitor.*`
  - **验证**: Requirement 1, 2

- [ ] 1.2 扩展 `buildHttpRequest` 路径映射
  - **验证**: Requirement 1, 2

## 任务 2：Discover 命令扩展

- [ ] 2.1 扩展 `--type` 校验（api/monitoring）
  - **验证**: Requirement 3

- [ ] 2.2 扩展 summary 聚合与 partial warning
  - **验证**: Requirement 3

## 任务 3：测试

- [ ] 3.1 Adapter 单测覆盖 api/monitoring refs
  - **验证**: Requirement 1, 2

- [ ] 3.2 scene discover 命令单测
  - **验证**: Requirement 3

- [ ] 3.3 Scene 命令回归验证
  - `scene run` + `scene doctor` 覆盖 api/monitoring ref 示例
  - **验证**: Requirement 4
