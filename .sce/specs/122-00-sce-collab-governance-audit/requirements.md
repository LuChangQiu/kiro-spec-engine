# 需求文档

## 简介

本 Spec 为 SCE 增加“协作治理审计”能力，用于在多机、多 Agent、多人协作场景下，持续检查协作配置、Git 边界和遗留命名漂移，降低因未纳管文件、错误提交运行态状态、或继续依赖 legacy `.kiro-*` 语义导致的异常。

## 术语表

- **Collab Governance Audit**: 面向协作治理基线的工作区审计
- **Runtime/Personal State**: 仅对单机、单人或当前运行有效的状态文件
- **Official SCE Paths**: SCE 当前认可的目录与配置入口，例如 `.sce/contexts/`、`.sce/config/multi-agent.json`
- **Legacy Kiro Reference**: 仍引用 `.kiro`、`.kiro-workspaces` 等历史命名的文件、脚本或文档内容

## 需求

### 需求 1：协作治理审计命令

**用户故事：** 作为 SCE 使用者，我希望通过一个统一命令检查当前项目的协作治理是否偏离标准基线。

#### 验收标准

1. THE CLI SHALL 提供 `sce workspace collab-governance-audit` 命令
2. THE command SHALL 支持 `--json` 输出结构化报告
3. THE command SHALL 支持 `--strict` 在存在 violation 时返回非零退出码
4. THE report SHALL 包含 summary、warnings、violations、passed、reason 等统一字段

### 需求 2：Git 边界与运行态状态检查

**用户故事：** 作为跨机器协作者，我希望 SCE 能发现哪些运行态或个人态文件没有被正确隔离，从而避免错误提交或漏同步。

#### 验收标准

1. WHEN `.gitignore` 缺少关键 ignore 规则 THEN audit SHALL 报告 violation
2. WHEN 运行态/个人态文件被错误纳入 git 跟踪 THEN audit SHALL 报告 violation
3. THE audit SHALL 至少检查 `.sce/contexts/`、`.sce/config/agent-registry.json`、`.sce/config/coordination-log.json`、`.sce/config/machine-id.json`
4. THE audit SHALL 检查 spec/steering 相关 lock 与 pending 文件是否被视为运行态边界

### 需求 3：协作配置与官方来源检查

**用户故事：** 作为 SCE 维护者，我希望多 Agent 协作配置和官方路径来源保持一致，避免不同代际能力并存时产生歧义。

#### 验收标准

1. WHEN 项目启用了多 Agent 协作相关能力 THEN audit SHALL 检查 `.sce/config/multi-agent.json` 是否存在且可被解析
2. WHEN 多 Agent 配置文件缺失但仓库已存在多 Agent 运行态痕迹或文档引用 THEN audit SHALL 报告 warning 或 violation
3. WHEN 检测到仓库内仍存在 legacy `.kiro-*` 命名引用 THEN audit SHALL 报告 violation
4. THE audit SHALL 明确区分 official SCE paths 与 legacy 命名

### 需求 4：Steering 核心区边界检查

**用户故事：** 作为治理负责人，我希望 `.sce/steering/` 持续保持精简，只承载核心 steering 文件及必要运行态退化文件。

#### 验收标准

1. WHEN `.sce/steering/` 中出现非核心治理文件 THEN audit SHALL 报告 warning 或 violation
2. THE audit SHALL 允许 manifest、核心 layer 文件以及 lock/pending 等运行态退化文件存在
3. THE audit SHALL 指出应迁移到 steering 外部治理文档的位置，而非直接自动删除

### 需求 5：自举治理

**用户故事：** 作为 SCE 核心能力维护者，我希望该能力本身也遵守 spec 化和交付清单治理。

#### 验收标准

1. THE capability SHALL 具备对应 spec requirements/design/tasks 文档
2. THE capability SHALL 提供自己的 delivery manifest
3. THE capability SHALL 具备单测与 CLI/integration test 覆盖主要漂移路径
