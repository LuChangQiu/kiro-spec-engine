# 设计文档：SCE Collaboration Governance Audit

## 概述

本设计将项目级“协作治理规范化”抽象为 SCE 通用能力，采用“audit first”策略，优先提供统一检查与结构化报告，不在 v1 自动执行迁移或文件移动。

## 核心设计

### 命令形态

- 命令：`sce workspace collab-governance-audit`
- 输出：
  - 默认输出人类可读摘要
  - `--json` 输出结构化报告
  - `--strict` 在存在 violation 时返回非零退出码

### 审计模型

审计结果由多个 section 构成：

- `gitignore`
  - 关键 ignore 规则是否存在
- `runtime_tracking`
  - 运行态/个人态文件是否被 git 跟踪
- `multi_agent`
  - `.sce/config/multi-agent.json` 是否存在、可解析、语义是否最小有效
- `legacy_references`
  - 仓库中是否仍有 `.kiro`、`.kiro-workspaces` 等遗留命名引用
- `steering_boundary`
  - `.sce/steering/` 是否仅保留核心治理文件与允许的 lock/pending 运行态文件

### 规则来源

规则以 SCE 官方能力与现有仓库约束为准，不直接照搬单个项目 spec：

- 官方上下文目录：`.sce/contexts/`
- 多 Agent 配置：`.sce/config/multi-agent.json`
- 运行态文件：
  - `.sce/config/agent-registry.json`
  - `.sce/config/coordination-log.json`
  - `.sce/config/machine-id.json`
  - `.sce/specs/**/locks/`
  - `.sce/specs/**/tasks.md.lock`
  - `.sce/steering/*.lock`
  - `.sce/steering/*.pending.*`

### 取舍

#### 为什么先做 audit，不做 auto-apply

这个问题本质上是治理漂移，不是简单格式化。自动迁移容易误删项目定制文档或错误修改忽略规则。v1 先把风险显式化，并为后续 `governance-apply` 留出空间。

#### 为什么要把 legacy 引用纳入 violation

`.kiro-*` 历史命名会制造错误认知，导致使用者沿用旧路径或旧脚本习惯。只做文档提醒不够，必须形成可执行审计。

## 变更点

- `lib/workspace/collab-governance-audit.js`
- `bin/scene-capability-engine.js`
- `tests/unit/workspace/collab-governance-audit.test.js`
- `tests/integration/workspace-collab-governance-audit-cli.integration.test.js`
- `docs/command-reference.md`
- `.gitignore`

## 非目标

- v1 不自动迁移 `.sce/steering/` 内容
- v1 不自动修复 `.gitignore`
- v1 不自动生成 `.sce/config/multi-agent.json`
- v1 不替代已有 `delivery-audit`、`tracking-audit`、`takeover-audit`
