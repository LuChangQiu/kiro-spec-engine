# 331-poc 双轨协同对接手册

> 目的：在 `kiro-spec-engine` 侧承接 331-poc 的深度补全成果，完成模板接入、ontology 校验、主从编排与闭环验收。

## 1. 输入契约（来自 331-poc）

每一轮从 `E:\workspace\331-poc` 接收以下产物：

1. 完成态 Spec（requirements/design/tasks + `custom/scene.yaml` + `custom/scene-package.json`）。
2. 模板导出目录：`.kiro/templates/exports/<template-name>/`。
3. 交接包：`docs/handoffs/handoff-manifest.json` + 证据文档。

若输入不满足以上三类，KSE 侧不进入接入批次。

## 2. KSE 侧接入流程

## 2.0 一键化入口（推荐）

先基于 handoff manifest 生成计划和队列，再执行批次：

```bash
npx kse auto handoff plan --manifest ../331-poc/docs/handoffs/handoff-manifest.json --out .kiro/reports/handoff-plan.json --json
npx kse auto handoff queue --manifest ../331-poc/docs/handoffs/handoff-manifest.json --out .kiro/auto/handoff-goals.lines --json
npx kse auto close-loop-batch .kiro/auto/handoff-goals.lines --format lines --batch-autonomous --continue-on-error --json
```

## 2.1 批次 1：输入预检

```bash
npx kse status --verbose
npx kse doctor --docs
```

核对 `handoff-manifest.json`：
1. `specs[]` 非空。
2. `templates[]` 非空。
3. `ontology_validation` 有最近一次执行记录。

## 2.2 批次 2：scene 包验证与 ontology 回归

对每个 handoff spec 执行：

```bash
npx kse scene package-validate --spec <spec-name> --spec-package custom/scene-package.json --strict --json
npx kse scene ontology validate --package .kiro/specs/<spec-name>/custom --json
npx kse scene ontology impact --package .kiro/specs/<spec-name>/custom --ref <ref> --max-depth 2 --json
npx kse scene ontology path --package .kiro/specs/<spec-name>/custom --from <from-ref> --to <to-ref> --json
```

## 2.3 批次 3：模板层接入

对于 scene package 模板链路（如果本轮包含 scene-package 模板）：

```bash
npx kse scene package-publish --spec <spec-name> --out-dir .kiro/templates/scene-packages --json --force
npx kse scene package-registry --template-dir .kiro/templates/scene-packages --strict --json
npx kse scene package-gate-template --out .kiro/templates/scene-package-gate-policy.json --profile three-layer --force --json
npx kse scene package-gate --registry .kiro/templates/scene-packages/registry.json --policy .kiro/templates/scene-package-gate-policy.json --strict --json
```

说明：Spec 模板（`templates create-from-spec` 导出）与 scene package 模板是两条链路，可并行维护，但推荐在同一交接批次一并校验。

## 2.4 批次 4：主从编排闭环验证

基于本轮 spec 组合，执行自动闭环 dry-run/正式 run：

```bash
npx kse auto close-loop --specs "<spec-a>,<spec-b>,<spec-c>" --dry-run --json
npx kse auto close-loop --specs "<spec-a>,<spec-b>,<spec-c>" --json
npx kse auto observability snapshot --json
```

判定标准：
1. 编排成功率满足门槛。
2. 不出现高风险未处置项。
3. observability 快照可追踪到本轮变更。

## 3. KSE 侧当前需持续适配的点

1. 对接自动化：把 331 handoff manifest 解析为可执行批次计划。
2. ontology 深化：将“业务规则/决策逻辑”映射为可量化 gate 指标。
3. 多 spec 主从调度：按依赖图自动分批并控制并行度。
4. 发布治理：把 handoff 批次结果写入统一 release evidence。

## 4. 角色划分

1. 331-poc Agent：交付业务事实、完成态 Spec、模板和证据。
2. KSE Agent：执行接入验证、治理门禁、主从闭环与发布收口。
3. Master Agent：维护跨仓上下文与批次节奏。

## 5. 失败处理

1. 输入缺失：退回 331-poc，标注缺失项，不进入 KSE 接入。
2. ontology 校验失败：先修 ref/lineage，再跑 gate。
3. 主从编排失败：降并发、缩批次、保留快照后重试。

## 6. 最终交付口径

每个接入批次结束后，KSE 侧必须输出：
1. 接入批次执行记录（命令、结果、失败点）。
2. gate 与 observability 快照。
3. 下一批次建议（可直接执行）。

## 7. 持续推进参考

KSE 侧后续增强计划见：`docs/331-poc-adaptation-roadmap.md`
