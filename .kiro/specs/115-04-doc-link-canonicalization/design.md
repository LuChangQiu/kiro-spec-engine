# Design Document

## Overview

采用“规则定义 + 批量替换 + 自动扫描”三段式治理：

1. 先确定 canonical 仓库 URL。
2. 统一替换文档内历史链接。
3. 用扫描脚本阻断新增混用链接。

## Design Details

### 1. 规则定义

- 在文档治理脚本或发布检查中声明 canonical URL。
- 允许保留极少数历史资料链接（白名单）并注明原因。

### 2. 批量替换范围

- `README*`
- `docs/**`
- `START_HERE.txt`
- `INSTALL_OFFLINE.txt`

### 3. 扫描实现

- 使用 `rg` 扫描非 canonical 模式。
- 在 CI 或 release checklist 中提供执行命令。

## Verification

1. 文档扫描结果仅剩 canonical 链接（或白名单项）。
2. 关键入口文档人工 spot check 通过。
