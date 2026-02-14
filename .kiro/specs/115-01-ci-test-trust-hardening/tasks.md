# Implementation Plan: 115-01 CI Test Trust Hardening

## Tasks

- [ ] 1. 盘点现状
  - [ ] 1.1 统计 skip 测试数量与位置
  - [ ] 1.2 确认 smoke/full 当前覆盖边界

- [ ] 2. 调整测试脚本
  - [ ] 2.1 新增 `test:smoke`
  - [ ] 2.2 新增 `test:full`
  - [ ] 2.3 新增 `test:skip-audit`

- [ ] 3. 接入策略与文档
  - [ ] 3.1 更新发布清单与 README 测试入口
  - [ ] 3.2 更新 CHANGELOG

- [ ] 4. 验证
  - [ ] 4.1 执行 smoke/full/skip-audit
  - [ ] 4.2 输出验证摘要
