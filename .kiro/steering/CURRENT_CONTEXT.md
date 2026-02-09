# 当前场景

**版本**: v1.25.0 已发布  
**状态**: ✅ 1806 tests | 84 suites | Spec 76 完成  
**当前**: Spec 76 (76-00-scene-template-instantiation) 已完成  
**内容**: scene instantiate 命令 — 模板包实例化闭环（registry→继承→验证→渲染→manifest→log→hook）

**已实现**: normalizeSceneInstantiateOptions, validateSceneInstantiateOptions, buildInstantiateRegistry, buildInstantiationManifest, appendInstantiationLog, executePostInstantiateHook, promptMissingVariables, parseInstantiateValues, printSceneInstantiateSummary, runSceneInstantiateCommand + CLI 注册 + exports

**待办**: 发布 v1.26.0 或继续下一个 Spec

---

v9.0 | 2026-02-09 | Spec 76 执行完成
