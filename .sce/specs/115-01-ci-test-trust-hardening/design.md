# Design Document

## Overview

采用“双通道测试”策略：

- `test:smoke`: 快速反馈（面向 PR）
- `test:full`: 全量可信（面向主干/发布）

## Design Details

### 1. 脚本层

- 在 `package.json` 新增/调整脚本：
  - `test:smoke`
  - `test:full`
  - `test:skip-audit`（检查新增 skip）

### 2. 配置层

- 保留现有 integration 优势作为 smoke 基线。
- full 模式复用 `jest.config.js` 以覆盖完整测试集。

### 3. 防回归层

- 通过 `rg` 扫描 `test.skip|it.skip|describe.skip`。
- 允许通过白名单文件维护历史债务，但禁止新增。

## Verification

1. `npm run test:smoke` 通过。
2. `npm run test:full` 通过。
3. `npm run test:skip-audit` 能识别新增 skip。
