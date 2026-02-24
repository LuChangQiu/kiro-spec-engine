# 设计文档：Moqui Runtime Default Adapter

## 概述

本设计将 Moqui 接线从“可选插件能力”提升为“默认可用能力”，并保留 sim 回退以避免非 Moqui 项目回归风险。

## 关键设计

### 1. 默认 handler 决策

- 决策输入：配置是否存在且校验通过
- 决策输出：`moqui.adapter` 或 `builtin.erp-sim`
- 失败策略：回退 sim + warning，不阻断命令执行

### 2. 配置归一

- `loadAdapterConfig` 在解析后执行 normalize：
  - 若存在顶层 `username/password`，转换为 `credentials.username/password`
  - 保留 timeout/retry 默认值逻辑

### 3. Readiness 扩展

- 在 dry_run 时，若发现 ERP binding ref，则触发 readiness 检查
- 保持既有 `hybrid/robot` 流程不回退

## 变更点

- `lib/scene-runtime/runtime-executor.js`
- `lib/scene-runtime/binding-registry.js`
- `lib/scene-runtime/moqui-adapter.js`
- `lib/commands/scene.js`（必要时补充参数或输出）
- `docs/scene-runtime-guide.md`
- `docs/command-reference.md`
- `README.md`
- `README.zh.md`

## 向后兼容

1. Legacy_Config 保留兼容窗口，但输出弃用提示。
2. 未配置 Moqui 的项目仍保持 sim 行为。
3. 对既有 `binding plugin` 机制不做破坏性变更。
