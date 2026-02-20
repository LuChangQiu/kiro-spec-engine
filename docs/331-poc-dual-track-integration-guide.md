# 331-poc 双轨协同对接手册

> 目的：在 `scene-capability-engine` 侧承接 331-poc 的深度补全成果，完成模板接入、ontology 校验、主从编排与闭环验收。

## 1. 输入契约（来自 331-poc）

每一轮从 `E:\workspace\331-poc` 接收以下产物：

1. 完成态 Spec（requirements/design/tasks + `custom/scene.yaml` + `custom/scene-package.json`）。
2. 模板导出目录：`.kiro/templates/exports/<template-name>/`。
3. 交接包：`docs/handoffs/handoff-manifest.json` + 证据文档。

若输入不满足以上三类，sce 侧不进入接入批次。

## 2. sce 侧接入流程

## 2.0 一键化入口（推荐）

推荐直接使用一条命令闭环执行：

```bash
npx sce auto handoff run --manifest ../331-poc/docs/handoffs/handoff-manifest.json --json
```

需要提高成功率门槛时：

```bash
npx sce auto handoff run --manifest ../331-poc/docs/handoffs/handoff-manifest.json \
  --min-spec-success-rate 95 \
  --max-risk-level medium \
  --json
```

建议每轮执行后追加两条诊断命令：

```bash
npx sce auto handoff template-diff --manifest ../331-poc/docs/handoffs/handoff-manifest.json --json
npx sce auto handoff regression --session-id latest --json
```

## 2.1 批次 1：输入预检

```bash
npx sce status --verbose
npx sce doctor --docs
```

核对 `handoff-manifest.json`：
1. `specs[]` 非空。
2. `templates[]` 非空。
3. `ontology_validation` 有最近一次执行记录。

## 2.2 批次 2：scene 包验证与 ontology 回归

对每个 handoff spec 执行：

```bash
npx sce scene package-validate --spec <spec-name> --spec-package custom/scene-package.json --strict --json
npx sce scene ontology validate --package .kiro/specs/<spec-name>/custom --json
npx sce scene ontology impact --package .kiro/specs/<spec-name>/custom --ref <ref> --max-depth 2 --json
npx sce scene ontology path --package .kiro/specs/<spec-name>/custom --from <from-ref> --to <to-ref> --json
```

## 2.3 批次 3：模板层接入

对于 scene package 模板链路（如果本轮包含 scene-package 模板）：

```bash
npx sce scene package-publish --spec <spec-name> --out-dir .kiro/templates/scene-packages --json --force
npx sce scene package-registry --template-dir .kiro/templates/scene-packages --strict --json
npx sce scene package-gate-template --out .kiro/templates/scene-package-gate-policy.json --profile three-layer --force --json
npx sce scene package-gate --registry .kiro/templates/scene-packages/registry.json --policy .kiro/templates/scene-package-gate-policy.json --strict --json
```

说明：Spec 模板（`templates create-from-spec` 导出）与 scene package 模板是两条链路，可并行维护，但推荐在同一交接批次一并校验。

## 2.4 批次 4：主从编排闭环验证

基于本轮 spec 组合，执行自动闭环 dry-run/正式 run：

```bash
npx sce auto close-loop --specs "<spec-a>,<spec-b>,<spec-c>" --dry-run --json
npx sce auto close-loop --specs "<spec-a>,<spec-b>,<spec-c>" --json
npx sce auto observability snapshot --json
```

判定标准：
1. 编排成功率满足门槛。
2. 不出现高风险未处置项。
3. observability 快照可追踪到本轮变更。

## 3. sce 侧当前持续增强点（主线收口后）

1. profile 维度外部接入样本补齐：
   - default/moqui/enterprise 的最小 manifest + evidence 示例与 CI 验收样例保持同步。
2. 周报与漂移协同门禁：
   - weekly ops gate 与 drift gate 在阻断场景输出统一 remediation 指令包。
3. 发布资产完整性审计：
   - 对治理快照、weekly ops summary、release-gate-history 进行发布前自动完整性校验。
4. ontology 语义矩阵持续加深：
   - 对“业务规则/决策策略/实体关系”闭环指标保持 100% 合规，持续吸收 Moqui 新增能力模板。

## 4. 角色划分

1. 331-poc Agent：交付业务事实、完成态 Spec、模板和证据。
2. sce Agent：执行接入验证、治理门禁、主从闭环与发布收口。
3. Master Agent：维护跨仓上下文与批次节奏。

## 5. 失败处理

1. 输入缺失：退回 331-poc，标注缺失项，不进入 sce 接入。
2. ontology 校验失败：先修 ref/lineage，再跑 gate。
3. 主从编排失败：降并发、缩批次、保留快照后重试。

## 6. 最终交付口径

每个接入批次结束后，sce 侧必须输出：
1. 接入批次执行记录（命令、结果、失败点）。
2. gate 与 observability 快照。
3. 下一批次建议（可直接执行）。

## 7. 持续推进参考

sce 侧后续增强计划见：`docs/331-poc-adaptation-roadmap.md`
