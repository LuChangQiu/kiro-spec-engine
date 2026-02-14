# Implementation Plan: 115-04 Doc Link Canonicalization

## Tasks

- [ ] 1. 规则确认
  - [ ] 1.1 确认 canonical 仓库地址
  - [ ] 1.2 定义白名单（如有）

- [ ] 2. 批量治理
  - [ ] 2.1 扫描并替换 README/docs/离线文档中的历史链接
  - [ ] 2.2 复核关键入口文档

- [ ] 3. 防回归
  - [ ] 3.1 添加链接扫描命令到 release checklist
  - [ ] 3.2 更新 CHANGELOG

- [ ] 4. 验证
  - [ ] 4.1 执行扫描并记录统计
  - [ ] 4.2 输出验证摘要
