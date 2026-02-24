# Implementation Plan: 115-01 CI Test Trust Hardening

## Tasks

- [x] 1. 盘点现状
  - [x] 1.1 统计 skip 测试数量与位置
  - [x] 1.2 确认 smoke/full 当前覆盖边界

- [x] 2. 调整测试脚本
  - [x] 2.1 新增 `test:smoke`
  - [x] 2.2 新增 `test:full`
  - [x] 2.3 新增 `test:skip-audit`

- [x] 3. 接入策略与文档
  - [x] 3.1 更新发布清单与 README 测试入口
  - [x] 3.2 更新 CHANGELOG

- [x] 4. 验证
  - [x] 4.1 执行 smoke/full/skip-audit
  - [x] 4.2 输出验证摘要
