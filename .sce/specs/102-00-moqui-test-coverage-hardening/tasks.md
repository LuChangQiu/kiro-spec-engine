# 实现任务

## 任务 1：MoquiClient 单测

- [ ] 1.1 创建 `tests/unit/scene-runtime/moqui-client.test.js`
  - login / refresh / re-login / logout / dispose
  - timeout / network / 5xx retry
  - **验证**: Requirement 1

## 任务 2：命令层单测

- [ ] 2.1 为 connect 命令补测试
  - 成功/失败/配置错误/--json
  - **验证**: Requirement 2

- [ ] 2.2 为 discover 命令补测试
  - entities/services/screens/api/monitoring
  - summary + partial warning
  - **验证**: Requirement 2

## 任务 3：新增 ref 回归

- [ ] 3.1 为 `99-00/100-00/101-00` 新增映射补 case
  - **验证**: Requirement 3

- [ ] 3.2 运行 Moqui 相关测试集合并记录结果
  - **验证**: Requirement 3
  - 最低回归命令集：
    - `npx jest tests/unit/scene-runtime/moqui-client.test.js`
    - `npx jest tests/unit/scene-runtime/moqui-adapter.test.js`
    - `npx jest tests/unit/scene-runtime/moqui-extractor.test.js`
    - `npx jest tests/unit/commands/scene.test.js -t \"runSceneConnectCommand|runSceneDiscoverCommand|runSceneExtractCommand|scene run|scene doctor\"`
    - `npx jest tests/unit/scene-runtime/runtime-execution-pilot.test.js`
