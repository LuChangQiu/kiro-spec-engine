# 实现任务

## 任务 1：Spec 与规则基线

- [x] 1.1 新增协作治理审计 spec 文档
  - **验证**: Requirement 5

- [x] 1.2 固化首版审计规则清单
  - **验证**: Requirement 2, 3, 4

## 任务 2：审计服务与 CLI

- [x] 2.1 新增 `lib/workspace/collab-governance-audit.js`
  - **验证**: Requirement 1, 2, 3, 4

- [x] 2.2 提供 `sce workspace collab-governance-audit` 命令
  - **验证**: Requirement 1

## 任务 3：测试与文档

- [x] 3.1 新增单测覆盖缺失 ignore、错误跟踪 runtime 文件、缺失 multi-agent 配置、legacy 引用等场景
  - **验证**: Requirement 2, 3, 4, 5

- [x] 3.2 新增 CLI/integration test 覆盖严格失败场景
  - **验证**: Requirement 1, 5

- [x] 3.3 更新命令参考与交付清单
  - **验证**: Requirement 5
