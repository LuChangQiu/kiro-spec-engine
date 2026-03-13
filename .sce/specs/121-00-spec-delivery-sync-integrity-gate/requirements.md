# 需求文档

## 简介

本 Spec 为 SCE 增加“交付同步完整性”能力，确保 Spec 在推进过程中产出的关键文件被显式声明、纳入 git，并具备跨机器可复现的最小同步证明。

## 术语表

- **Delivery Manifest**: 位于 `.sce/specs/<spec>/deliverables.json` 的交付清单文件
- **Declared File**: 在 Delivery Manifest 中显式声明的交付文件
- **Delivery Sync Audit**: 面向 declared files 的 git 跟踪、工作区状态和 upstream 同步检查

## 需求

### 需求 1：Spec 交付清单声明

**用户故事：** 作为 SCE 使用者，我希望每个重要 Spec 都能声明自身交付文件，避免功能落地后遗漏提交或遗漏推送。

#### 验收标准

1. WHEN Spec 需要交付真实业务文件 THEN SCE SHALL 支持在 `.sce/specs/<spec>/deliverables.json` 中显式声明文件列表
2. THE manifest SHALL 支持 `verification_mode` 区分 `blocking` 与 `advisory`
3. THE manifest SHALL 支持 `declared_files`、`optional_files` 与 `ignored_patterns`

### 需求 2：交付同步审计

**用户故事：** 作为多机协作开发者，我希望 SCE 能发现声明交付是否已真正进入 git 并具备同步证明。

#### 验收标准

1. WHEN declared file 不存在 THEN audit SHALL 报告 violation
2. WHEN declared file 未被 git 跟踪 THEN audit SHALL 报告 violation
3. WHEN declared file 已跟踪但工作区存在未提交变化 THEN audit SHALL 报告 violation
4. WHEN 当前分支 ahead/behind upstream THEN audit SHALL 报告 sync violation
5. WHEN 未配置目标 remote THEN audit MAY 以 warning 形式提示无法证明跨机器同步

### 需求 3：Release/Handoff 门禁接入

**用户故事：** 作为 release 与 handoff 执行者，我希望在关键门禁阶段自动检查声明交付是否完整同步。

#### 验收标准

1. THE CLI SHALL 提供 `sce workspace delivery-audit` 命令
2. WHEN handoff preflight/run 启用 hard gate THEN delivery sync violation SHALL 阻断流程
3. WHEN release gate steps 执行 THEN delivery sync audit SHALL 作为必经步骤之一
4. WHEN 仓库没有任何 delivery manifest 且未显式要求 manifest THEN audit SHALL 采用 advisory 行为而非硬阻断

### 需求 4：自举治理

**用户故事：** 作为 SCE 维护者，我希望这项能力本身也被纳入 Spec 管理，形成可持续自进化闭环。

#### 验收标准

1. THE capability SHALL 具备对应 spec requirements/design/tasks 文档
2. THE capability SHALL 提供自己的 delivery manifest
3. THE capability SHALL 具备单测或集成测试覆盖主要风险路径
