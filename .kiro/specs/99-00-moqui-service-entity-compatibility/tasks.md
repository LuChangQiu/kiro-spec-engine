# 实现任务

## 任务 1：Service job-status 兼容

- [ ] 1.1 修正 job-status 主路径为 `/api/v1/services/jobs/{jobId}`
  - **验证**: Requirement 1

- [ ] 1.2 增加可选 legacy 回退逻辑
  - **验证**: Requirement 1

## 任务 2：Entity 高级接口

- [ ] 2.1 扩展 ref 解析支持 definition/relationships/batch/related
  - **验证**: Requirement 2, 3

- [ ] 2.2 扩展 HTTP 请求构建
  - **验证**: Requirement 2

- [ ] 2.3 增加缺参校验（id/relationship 等）
  - **验证**: Requirement 3

## 任务 3：测试

- [ ] 3.1 新增单测覆盖新增映射
  - **验证**: Requirement 1, 2, 3

- [ ] 3.2 回归验证原 CRUD/服务调用不受影响
  - **验证**: Requirement 4

- [ ] 3.3 Scene 命令回归验证
  - `scene run` + `scene doctor` 覆盖新增 ref 示例
  - **验证**: Requirement 5
