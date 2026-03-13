# 设计文档：Spec Delivery Sync Integrity Gate

## 概述

本设计采用“manifest + audit + gate”方案，不实现文件同步工具，不绕过 git。git 仍是唯一可信的交付事实来源。

## 核心设计

### Manifest

- 位置：`.sce/specs/<spec>/deliverables.json`
- 目标：只声明需要跨机器复现的交付文件，不纳入临时草稿和运行态产物
- 模式：
  - `blocking`: 违反时阻断门禁
  - `advisory`: 违反时只输出 warning

### Audit

- 命令：`sce workspace delivery-audit`
- 输入：当前工作区、可选 `--spec`、可选 `--require-manifest`
- 检查项：
  - manifest 是否存在
  - declared file 是否存在
  - declared file 是否被 git 跟踪
  - declared file 是否存在脏状态
  - 当前分支是否已配置 upstream
  - 当前分支是否 ahead/behind upstream

### Gate 接入

- `sce auto handoff preflight-check`
  - 默认启用 `require_spec_delivery_sync`
  - 无 manifest 时保持 advisory
- `sce auto handoff run`
  - 在 precheck phase 直接执行 audit
  - blocking violation 直接阻断 handoff
- `studio release` gate steps
  - 新增必跑步骤 `spec-delivery-audit`

## 取舍

### 为什么不做自动同步

自动复制或自动补推送会模糊交付边界，也容易污染工作区。v1 只做显式声明和可审计检查，避免“看似同步、实际不可复现”。

### 为什么按 Spec 声明

问题的根因不是“仓库里有未提交文件”，而是“某个推进中的 Spec 产出了关键交付，但没有被纳入版本化治理”。因此交付归属应回到 spec 维度。

## 变更点

- `lib/workspace/spec-delivery-audit.js`
- `bin/scene-capability-engine.js`
- `lib/commands/studio.js`
- `lib/commands/auto.js`
- `lib/auto/handoff-run-service.js`
- `tests/unit/workspace/spec-delivery-audit.test.js`
- `tests/unit/commands/auto.test.js`
- `tests/unit/auto/handoff-run-service.test.js`
- `tests/unit/commands/studio.test.js`
- `tests/integration/workspace-delivery-audit-cli.integration.test.js`
