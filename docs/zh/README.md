# sce 文档索引

> sce (Scene Capability Engine) 的完整文档 - AI 辅助开发的上下文管理系统

---

**版本**: 1.46.2  
**最后更新**: 2026-02-14  
**语言**: 简体中文

---

## 📚 文档概述

本文档集合提供了使用 sce 进行 Spec 驱动开发所需的一切。无论你是初学者还是高级用户，你都会在这里找到所需的指导。

---

## ⭐ 为什么团队选择 sce

- **结构化交付**：先需求、后设计、再任务，实现路径可追踪。
- **可并行扩展**：支持依赖感知的多 Spec 编排，减少串行等待。
- **双轨交接闭环**：`sce auto handoff run` 一条命令完成 plan/queue/batch/observability，支持 `--continue-from` 续跑，并输出可直接执行的后续建议命令。
- **结果可量化**：通过 KPI 快照、基线、趋势命令持续度量交付质量。
- **工具无锁定**：可与 Claude、Cursor、Windsurf、Copilot、SCE 协作。
- **治理能力内建**：文档治理、锁管理、环境/工作区控制和审计链路。

---

## 🚀 入门指南

从这里开始你的 sce 之旅：

### [快速入门指南](quick-start.md)
**5 分钟教程** - 从安装到第一个 AI 辅助功能实现
- 安装 sce
- 创建你的第一个 Spec
- 导出上下文
- 使用 AI 工具实现功能

### [常见问题 (FAQ)](faq.md)
**常见问题解答** - 关于 sce 的快速答案
- sce 是什么？
- 它如何与 AI 工具配合使用？
- 我应该使用哪个 AI 工具？
- 常见误解

### [故障排除](troubleshooting.md)
**问题解决** - 常见问题和解决方案
- 安装问题
- 采用问题
- 命令错误
- 集成问题

---

## 📋 核心概念

深入理解 sce 的工作原理：

### [Spec 工作流](spec-workflow.md)
**深入指南** - 理解 Spec 驱动开发
- 什么是 Spec？
- Requirements → Design → Tasks 工作流
- 创建有效 Spec 的最佳实践
- 示例 Spec 演练

### [集成模式](integration-modes.md)
**三种集成方式** - 选择最适合你的模式
- 原生集成（SCE、Windsurf）
- 手动导出（Claude、Cursor、ChatGPT）
- Watch 模式（所有工具）
- 每种模式的优缺点

### [命令参考](../command-reference.md)
**完整命令列表** - 所有 sce 命令及示例
- 项目设置命令
- 上下文管理命令
- 任务管理命令
- 自动化命令

---

## 🔧 工具专用指南

为你的 AI 工具选择集成指南：

### IDE 集成

#### [Cursor 指南](tools/cursor-guide.md)
**Cursor IDE** - 带 AI 结对编程的 IDE
- 手动导出模式
- Composer 集成
- 最佳实践

#### [Windsurf 指南](tools/windsurf-guide.md)
**Windsurf IDE** - 带命令执行的 AI 代理
- 原生集成
- Watch 模式
- 自动化工作流

#### [SCE 指南](tools/SCE-guide.md)
**AI IDE** - 专为 Spec 驱动开发设计
- 完全原生集成
- 可视化工具
- 零配置

#### [VS Code + Copilot 指南](tools/vscode-guide.md)
**VS Code** - 带 GitHub Copilot
- 内联注释集成
- Copilot Chat
- 代码片段

### 聊天机器人集成

#### [Claude 指南](tools/claude-guide.md)
**Claude Code** - Anthropic 的 AI 助手
- 对话式开发
- 长上下文窗口
- 示例提示

### 通用集成

#### [通用 AI 工具指南](tools/generic-guide.md)
**适用于任何 AI 工具** - 灵活的集成方法
- 三种集成模式
- 工具无关工作流
- 自定义集成

---

## 💡 示例和模板

从真实示例中学习：

### 完整 Spec 示例

#### [API 功能示例](examples/add-rest-api/)
**RESTful API Spec** - 带认证的完整 API
- 完整的 requirements.md
- 详细的 design.md
- 分步 tasks.md

#### [UI 功能示例](examples/add-user-dashboard/)
**React 仪表板 Spec** - 前端功能
- 组件层次结构
- 状态管理设计
- UI 实现任务

#### [CLI 功能示例](examples/add-export-command/)
**CLI 命令 Spec** - 命令行工具
- 命令设计
- 参数处理
- 测试策略

---

## 📖 高级主题

对于有经验的用户：

### [采用指南](adoption-guide.md)
**在现有项目中采用 sce** - 迁移策略
- 评估你的项目
- 采用策略
- 迁移现有文档

### [场景运行时指南](scene-runtime-guide.md)
**Scene 功能完整指南** - 模板引擎、质量流水线、Ontology、Moqui ERP 集成
- 模板变量 Schema 和三层继承
- Lint 检查和质量评分
- Ontology 图、Action Abstraction、Data Lineage、Agent Hints
- Moqui ERP 连接、发现、模板提取

### [Moqui Template Core Library Playbook](../moqui-template-core-library-playbook.md)
**Moqui 能力核心库化执行清单（英文）** - 默认门禁、批处理吸收链路、证据合同
- 不依赖 331 特参的通用 intake 流程
- Ontology 与 scene-package 默认门禁
- remediation 队列回灌闭环

### [331-poc 双轨协同对接手册](../331-poc-dual-track-integration-guide.md)
**331-poc 与 sce 协同执行指南** - 交接契约、接入命令链、主从闭环验收
- 331 深化成果输入约束
- sce 侧模板/ontology/gate 验证流程
- 双仓协同失败回退策略

### [331-poc 适配路线图](../331-poc-adaptation-roadmap.md)
**sce 侧持续适配清单** - 已完成、下一阶段、中期增强与长期目标
- handoff 自动化命令演进
- 主从编排与门禁增强
- 跨轮次回归与发布治理集成

### [SCE 能力矩阵路线图](../sce-capability-matrix-roadmap.md)
**核心能力补齐路线（英文）** - 策略路由、符号证据、自修复、ontology 映射与多 agent 汇总
- 任务策略决策闭环
- 失败归因与有界修复
- 跨项目能力沉淀与协同治理

### [SCE 能力矩阵端到端示例](../sce-capability-matrix-e2e-example.md)
**端到端流程示例（英文）** - 从策略决策到符号证据、失败修复、能力映射和主从摘要合并阻断

### [SCE 业务模式能力地图](../sce-business-mode-map.md)
**三态执行治理（英文）** - 用户态 / 运维态 / 开发态的默认接管、授权门禁与审计要求

### [Handoff Profile Integration Guide](../handoff-profile-integration-guide.md)
**外部项目接入规范（英文）** - `default|moqui|enterprise` 三档 handoff profile 契约
- profile 默认策略与显式参数覆盖规则
- 外部项目 manifest/evidence 最小要求
- 从 `moqui` 到 `enterprise` 的分阶段上线建议

### [Value 可观测指南](value-observability-guide.md)
**KPI 量化交付指南** - 快照、基线、趋势、门禁证据
- 周度 KPI 快照生成
- baseline 与趋势风险分析
- Day30/Day60 门禁输入复用

### [升级指南](upgrade-guide.md)
**版本升级** - 保持 sce 最新
- 升级过程
- 版本兼容性
- 迁移指南

### [发布检查清单](release-checklist.md)
**发布前核验流程** - 可重复执行的发版前检查
- 测试、命令冒烟、打包检查
- 文档一致性和 Git 准备状态

### [安全治理默认基线](../security-governance-default-baseline.md)
**默认安全控制（英文）** - 上下文脱敏、审批策略、发布审计证据最小集合

### [发布即用 Starter Kit](../starter-kit/README.md)
**外部项目接入脚手架（英文）** - handoff manifest 样例与 release workflow 样例

### [发布归档](releases/README.md)
**历史发布入口** - 集中查看发布说明与验证报告
- 版本化发布说明
- 验证证据记录

### [发布说明 v1.46.2](releases/v1.46.2.md)
**本版更新摘要** - 可量化交付与入口文档收敛
- KPI 可观测命令与首用脚手架
- 文档入口与离线安装一致性更新

### [验证报告 v1.46.2](releases/v1.46.2-validation.md)
**发布证据记录** - 测试与打包预检结果
- 命令单测与 CI 结果
- npm 打包清单健康性

### [手动工作流](manual-workflows-guide.md)
**分步工作流** - 详细过程
- 创建 Spec 工作流
- 实现工作流
- 审查工作流

### [开发者指南](developer-guide.md)
**贡献和扩展 sce** - 对于贡献者
- 项目结构
- 开发设置
- 贡献指南

---

## 🗺️ 学习路径

### 对于初学者

1. 从[快速入门指南](quick-start.md)开始
2. 阅读[Spec 工作流](spec-workflow.md)
3. 选择你的工具指南：
   - [Cursor](tools/cursor-guide.md)
   - [Claude](tools/claude-guide.md)
   - [Windsurf](tools/windsurf-guide.md)
   - [VS Code](tools/vscode-guide.md)
4. 查看[示例](examples/add-rest-api/)
5. 查阅[FAQ](faq.md)和[故障排除](troubleshooting.md)

### 对于有经验的用户

1. 查看[集成模式](integration-modes.md)
2. 探索[高级主题](#-高级主题)
3. 阅读[开发者指南](developer-guide.md)
4. 贡献到项目

### 对于团队

1. 阅读[采用指南](adoption-guide.md)
2. 设置团队约定
3. 创建共享 Spec 模板
4. 建立审查流程

---

## 🔍 按主题查找

### 安装和设置
- [快速入门 - 安装](quick-start.md#步骤-1安装-kse30-秒)
- [故障排除 - 安装问题](troubleshooting.md)
- [采用指南](adoption-guide.md)

### 创建 Spec
- [快速入门 - 创建 Spec](quick-start.md#步骤-3创建你的第一个-spec2-分钟)
- [Spec 工作流](spec-workflow.md)
- [示例 Spec](examples/add-rest-api/)

### AI 工具集成
- [集成模式](integration-modes.md)
- [工具专用指南](#-工具专用指南)
- [通用指南](tools/generic-guide.md)

### 任务管理
- [命令参考 - 任务命令](../command-reference.md)
- [Spec 工作流 - 任务](spec-workflow.md)

### KPI 可观测
- [命令参考 - Value Metrics](../command-reference.md#value-metrics)
- [Value 可观测指南](value-observability-guide.md)
- [快速入门指南](quick-start.md)

### 自动化
- [集成模式 - Watch 模式](integration-modes.md)
- [Windsurf 指南 - Watch 配置](tools/windsurf-guide.md)

---

## 📞 获取帮助

### 文档
- 📖 从[快速入门指南](quick-start.md)开始
- 🤔 查看[常见问题](faq.md)
- 🔧 查阅[故障排除](troubleshooting.md)

### 社区
- 💬 [GitHub Discussions](https://github.com/heguangyong/scene-capability-engine/discussions)
- 🐛 [GitHub Issues](https://github.com/heguangyong/scene-capability-engine/issues)

---

## 🤝 贡献

帮助改进文档：

- 📝 报告文档问题
- ✏️ 建议改进
- 🌍 帮助翻译
- 📖 分享你的经验

查看[贡献指南](../CONTRIBUTING.md)了解详情。

---

## 📄 许可证

本文档根据 MIT 许可证授权。查看[LICENSE](../LICENSE)了解详情。

---

**准备好开始了吗？** 🚀

从[快速入门指南](quick-start.md)开始你的 sce 之旅！

---

**版本**: 1.46.2  
**最后更新**: 2026-02-14  
**语言**: 简体中文
